/**
 * useTrialActivation (Sprint 2 §4.1).
 *
 * Композабл для trigger-логіки `TrialActivationModal.vue`.
 *
 * Принцип: modal НЕ показується при signup і НЕ при логіні. Тільки після
 * того як юзер завершив свій ПЕРШИЙ урок (classroom.session.ended
 * або booking.status === 'completed' первинно для цього user-а).
 *
 * Контракт використання:
 *   const trial = useTrialActivation()
 *   // десь у lifecycle класрума:
 *   trial.maybeOfferTrial({ trigger: 'first_lesson' })
 *
 *   // у шаблоні:
 *   <TrialActivationModal v-model="trial.modalOpen.value" :trigger="trial.trigger.value" />
 *
 * Логіка офера:
 *   1. Перевірити localStorage flag `m4sh.trial_modal_offered` — один раз на user.
 *   2. GET /v1/billing/trial/eligibility/ → якщо eligible=true → відкрити modal.
 *   3. Зберегти flag незалежно від реакції користувача (dismiss/activate),
 *      щоб не дратувати повторними показами.
 *
 * Sprint 2 swap surface: цей composable — єдина точка, де визначається коли offer.
 * Якщо пізніше з'явиться інший trigger (наприклад booking confirm) — він
 * додається сюди як ще один call-site, modal залишається тим самим.
 */
import { ref } from 'vue'
import { getTrialEligibility } from '../api/billingApi'

const STORAGE_KEY = 'm4sh.trial_modal_offered_v1'

type Trigger = 'first_lesson' | 'first_booking' | 'manual'

interface MaybeOfferOptions {
  trigger?: Trigger
  /** Якщо true — ігнорувати localStorage flag (наприклад "manual" дія користувача). */
  force?: boolean
}

export function useTrialActivation() {
  const modalOpen = ref(false)
  const trigger = ref<Trigger>('first_lesson')
  const lastEligibilityReason = ref<string | null>(null)

  function alreadyOffered(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1'
    } catch {
      return false
    }
  }

  function markOffered(): void {
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      // private mode / quota — best-effort
    }
  }

  /**
   * Перевірити право на trial і, якщо є — відкрити modal.
   *
   * Викликати з:
   *   - classroom session ended handler (перший раз для user-а)
   *   - manual upgrade page button (з force: true)
   */
  async function maybeOfferTrial(options: MaybeOfferOptions = {}): Promise<boolean> {
    const { trigger: t = 'first_lesson', force = false } = options

    if (!force && alreadyOffered()) {
      return false
    }

    try {
      const data = await getTrialEligibility()
      lastEligibilityReason.value = data.reason ?? null

      if (!data.eligible) {
        // Уже не показуємо повторно — або юзер його використав, або активна підписка.
        markOffered()
        return false
      }

      trigger.value = t
      modalOpen.value = true
      markOffered()
      return true
    } catch (err: any) {
      // Тиха невдача — не блокувати UX через eligibility-probe.
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn('[useTrialActivation] eligibility check failed:', err)
      }
      return false
    }
  }

  function closeModal(): void {
    modalOpen.value = false
  }

  return {
    modalOpen,
    trigger,
    lastEligibilityReason,
    maybeOfferTrial,
    closeModal,
  }
}
