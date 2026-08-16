/**
 * PIN-політика панелі Інтегралика: коли панель закріплена й хто це вирішує.
 *
 * Закріплено = підкладка прозора й пропускає кліки на дошку (можна тягнути
 * повзунок графіка й читати пояснення), а клік повз панель НЕ закриває.
 *
 * Головне правило (2026-08-17, скарга власника «кнопка відкріпити ніхера не
 * робить»): РІШЕННЯ ЛЮДИНИ СТАРШЕ ЗА АВТОМАТИКУ. Раніше авто-закріплення
 * спрацьовувало на кожній дії на дошці й на кожному відкритті панелі — тьютор
 * відкріплював, просив ще щось, і панель закріплювалась знову. Ефект кнопки
 * жив рівно до наступної команди, тому вона й здавалася мертвою.
 *
 * Тепер:
 *   • авто-закріплення — РІВНО ОДИН раз за діалог (перше малювання);
 *   • після ручного відкріплення автоматика мовчить до кінця діалогу;
 *   • новий діалог (↺) скидає звичку — чистий аркуш і для pin.
 */
import { computed, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'

export interface PinPolicy {
  /** Сире побажання «закріпити». Ефективний стан — `isPinned`. */
  pinned: Ref<boolean>
  /** Побажання + фізична можливість (широкий екран І відкрита дошка). */
  isPinned: ComputedRef<boolean>
  /** Клік по 📌. */
  togglePin: () => void
  /** Автоматика: закріпити, якщо ще не закріплювали і людина не проти. */
  autoPinOnce: () => void
  /** Новий діалог — забути pin-звичку. */
  resetHabit: () => void
  /** Для тестів/діагностики. */
  userUnpinned: Ref<boolean>
  autoPinnedOnce: Ref<boolean>
}

/**
 * @param canPin геттер «pin тут узагалі має сенс»: широкий екран І під
 *   панеллю є дошка. Геттер, а не значення — щоб політика бачила зміну
 *   ширини вікна й переходу між сторінками.
 */
export function createPinPolicy(canPin: () => boolean): PinPolicy {
  const pinned = ref(false)
  const userUnpinned = ref(false)
  const autoPinnedOnce = ref(false)

  const isPinned = computed(() => pinned.value && canPin())

  function togglePin(): void {
    pinned.value = !pinned.value
    // Зняв вручну → автоматика більше не втручається. Закріпив вручну →
    // прапорець знімаємо: людина знову «за» pin, хай автоматика допомагає.
    userUnpinned.value = !pinned.value
  }

  function autoPinOnce(): void {
    if (!canPin() || userUnpinned.value || autoPinnedOnce.value) return
    pinned.value = true
    autoPinnedOnce.value = true
  }

  function resetHabit(): void {
    userUnpinned.value = false
    autoPinnedOnce.value = false
  }

  return { pinned, isPinned, togglePin, autoPinOnce, resetHabit, userUnpinned, autoPinnedOnce }
}
