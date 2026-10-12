/**
 * Вигляд помічника — «Інтегралик» / «Інтегралка» (рішення власника 2026-10-12:
 * «Додавати, але з назвою Інтегралка»; ТЗ `domains/intent/TZ_INTEGRALYK_INTEGRALKA_VARIANT_2026-10-11.md`).
 *
 * Той самий помічник: змінюються бантик, колір і ВІДОБРАЖУВАНА назва. Логіка, доступ, запити,
 * інструменти й ліміти від вигляду не залежать; внутрішні ідентифікатори (`integralyk`, події
 * `m4sh:integralyk-*`, ключі) не перейменовуються. Вибір належить акаунту
 * (`UserSettings.integralyk_appearance`) — НЕ localStorage; FE читає його реактивно з
 * `profileStore.settings`. Обидва місця вибору (профіль і панель помічника) кличуть один
 * `setAssistantLook` — без локальних копій. Це налаштування глядача: у дошку, ops чи Replay
 * не пишеться.
 */
import { computed } from 'vue'
import { getActivePinia } from 'pinia'
import { useI18n } from 'vue-i18n'
import { i18n } from '@/i18n'
import { useProfileStore } from '@/modules/profile/store/profileStore'
import type { IntegralykLook } from './integralykMascotSvg'

export type { IntegralykLook }

export const ASSISTANT_LOOKS: readonly IntegralykLook[] = ['integralyk', 'integralka']

/** Вигляд із налаштувань акаунта; невідоме чи відсутнє — чинний Інтегралик. */
export function assistantLookOf(settings: { integralyk_appearance?: unknown } | null | undefined): IntegralykLook {
  return settings?.integralyk_appearance === 'integralka' ? 'integralka' : 'integralyk'
}

/** Відмінки відображуваної назви й ролі — для рядків, складених у коді (не з i18n). */
export interface AssistantNameForms {
  nom: string
  gen: string
  dat: string
  acc: string
  ins: string
  /** «AI-помічник» / «AI-помічниця». */
  role: string
  /** Знахідний відмінок ролі. */
  roleAcc: string
}

export const ASSISTANT_NAMES: Record<IntegralykLook, { uk: AssistantNameForms; en: AssistantNameForms }> = {
  integralyk: {
    uk: { nom: 'Інтегралик', gen: 'Інтегралика', dat: 'Інтегралику', acc: 'Інтегралика', ins: 'Інтеграликом',
      role: 'AI-помічник', roleAcc: 'AI-помічника' },
    en: { nom: 'Integralyk', gen: 'Integralyk', dat: 'Integralyk', acc: 'Integralyk', ins: 'Integralyk',
      role: 'AI assistant', roleAcc: 'AI assistant' },
  },
  integralka: {
    uk: { nom: 'Інтегралка', gen: 'Інтегралки', dat: 'Інтегралці', acc: 'Інтегралку', ins: 'Інтегралкою',
      role: 'AI-помічниця', roleAcc: 'AI-помічницю' },
    en: { nom: 'Integralka', gen: 'Integralka', dat: 'Integralka', acc: 'Integralka', ins: 'Integralka',
      role: 'AI assistant', roleAcc: 'AI assistant' },
  },
}

/**
 * Ключ i18n з урахуванням вигляду. Для «Інтегралки» — сусідній ключ `<key>Integralka` (ціле
 * речення: в українській і російській з ім'ям узгоджуються дієслова й прикметники — «прочитав» →
 * «прочитала», «недоступний» → «недоступна»). `te` перевіряє поточну мову й запасну `uk`: де
 * базового рядка в мові немає і він береться з `uk`, варіант теж має братися звідти, інакше
 * вийде суміш імен.
 */
export function assistantKey(
  key: string,
  look: IntegralykLook,
  te: (key: string, locale?: string) => boolean,
): string {
  if (look !== 'integralka') return key
  const alt = `${key}Integralka`
  return te(alt) || te(alt, 'uk') ? alt : key
}

/**
 * Налаштування з профілю — лише коли Pinia вже є. У застосунку вона є завжди; без неї (окремий
 * віджет, тест без стору) — дефолтний Інтегралик, а не падіння всього компонента.
 */
function profileStoreIfAny() {
  return getActivePinia() ? useProfileStore() : null
}

/** Реактивний вигляд поточного користувача. */
export function useAssistantLook() {
  const profileStore = profileStoreIfAny()
  const look = computed<IntegralykLook>(() => assistantLookOf(profileStore?.settings))
  return { look }
}

/**
 * `t` для рядків про помічника: той самий ключ, але з урахуванням вибраного вигляду. Решта
 * аргументів — як у `t` (параметри, множина), тож ним можна підмінити `t` компонента цілком:
 * ключі без варіанта «Інтегралки» лишаються як були.
 */
export function useAssistantT() {
  const { t, te } = useI18n()
  const { look } = useAssistantLook()
  const at = (key: string, ...rest: unknown[]): string =>
    (t as (k: string, ...a: unknown[]) => string)(
      assistantKey(key, look.value, (k: string, l?: string) => (l ? te(k, l) : te(k))), ...rest)
  return { at, look }
}

/** Українські форми назви поза компонентами (повідомлення, складені в коді). */
export function assistantNameUk(): AssistantNameForms {
  return ASSISTANT_NAMES[assistantLookOf(profileStoreIfAny()?.settings)].uk
}

/** Те саме поза компонентами (композабли, модулі): вигляд — з `profileStore`, мова — глобальна. */
export function tAssistantGlobal(key: string, params: Record<string, unknown> = {}): string {
  const look = assistantLookOf(profileStoreIfAny()?.settings)
  const g = i18n.global as unknown as { t: (k: string, p?: unknown) => string; te: (k: string, l?: string) => boolean }
  return g.t(assistantKey(key, look, (k, l) => (l ? g.te(k, l) : g.te(k))), params)
}

/**
 * Налаштування акаунта для сторінок, де їх ніхто ще не завантажив (пульт на телефоні): без них
 * вигляд — дефолтний Інтегралик. Помилка мережі — лишаємо дефолт (вигляд не критичний).
 */
export async function loadAssistantSettings(): Promise<void> {
  const profileStore = profileStoreIfAny()
  if (!profileStore || profileStore.settings) return
  try {
    const { getUserSettings } = await import('@/api/users')
    const settings = await getUserSettings()
    if (!profileStore.settings) profileStore.settings = settings
  } catch (err) {
    console.warn('[помічник] налаштування вигляду не завантажено — показуємо дефолт:', err)
  }
}

let saving: Promise<void> | null = null

/**
 * Змінити вигляд — одне налаштування для профілю й панелі. Одразу застосовується в UI
 * (усі екземпляри маскота читають `profileStore.settings`), потім `PATCH /v1/me/settings`.
 * Відмова сервера → попередній вибір повертається, помилка йде викликачу (він її показує).
 */
export async function setAssistantLook(next: IntegralykLook): Promise<void> {
  const profileStore = useProfileStore()
  const prevSettings = profileStore.settings
  if (assistantLookOf(prevSettings) === next) return
  // Попереднє збереження ще в дорозі — чекаємо його кінця (його помилку вже показав його викликач).
  if (saving) await saving.catch(() => undefined)
  const before = assistantLookOf(profileStore.settings)
  profileStore.settings = { ...(profileStore.settings || {}), integralyk_appearance: next }
  const { updateUserSettings } = await import('@/api/users')
  saving = (async () => {
    try {
      const updated = await updateUserSettings({ integralyk_appearance: next })
      const saved = assistantLookOf(updated as { integralyk_appearance?: unknown })
      profileStore.settings = { ...(profileStore.settings || {}), integralyk_appearance: saved }
    } catch (err) {
      profileStore.settings = { ...(profileStore.settings || {}), integralyk_appearance: before }
      throw err
    }
  })()
  try {
    await saving
  } finally {
    saving = null
  }
}
