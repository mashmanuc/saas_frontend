/**
 * useOnboardingHints — composable для dismissible FTUE coach marks.
 *
 * Зберігає стан dismissed hints у localStorage.
 * Не блокує інтерфейс — hints = пояснення, не заборони.
 */
import { ref, computed, watch } from 'vue'
import { useAuthStore } from '@/modules/auth/store/authStore'

export enum TutorHintId {
  DASHBOARD_WELCOME = 'tutor.dashboard.welcome',
  CALENDAR_FIRST_VISIT = 'tutor.calendar.firstVisit',
  PROFILE_FORMAT_ONLINE = 'tutor.profile.format.online',
  PROFILE_FORMAT_OFFLINE = 'tutor.profile.format.offline',
  PROFILE_PUBLISH_BLOCKED = 'tutor.profile.publish.blocked',
  DEMO_STUDENT_ONLY = 'tutor.dashboard.demoStudentOnly',
  SIDEBAR_COACHING = 'tutor.sidebar.coaching',
  // FTUE у конструкторі дошки: підказка зберегти урок як багаторазовий шаблон.
  CONSTRUCTOR_SAVE_TEMPLATE = 'tutor.constructor.saveTemplate',
}

const STORAGE_PREFIX = 'm4sh:hints:dismissed'

function getStorageKey(userId?: number | string): string {
  return `${STORAGE_PREFIX}:${userId ?? 'anon'}`
}

function loadDismissed(userId?: number | string): Set<string> {
  try {
    const raw = localStorage.getItem(getStorageKey(userId))
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    return new Set(Array.isArray(arr) ? arr : [])
  } catch {
    return new Set()
  }
}

function saveDismissed(dismissed: Set<string>, userId?: number | string): void {
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify([...dismissed]))
  } catch {
    // Silent — localStorage може бути недоступний
  }
}

// Singleton shared state — всі екземпляри OnboardingHint читають один ref.
// Це гарантує що dismiss в одному компоненті одразу оновлює всі інші.
const _dismissed = ref<Set<string>>(new Set())
let _initialized = false

function _ensureInitialized(userId?: number | string) {
  if (!_initialized) {
    _dismissed.value = loadDismissed(userId)
    _initialized = true
  }
}

export function useOnboardingHints() {
  const authStore = useAuthStore()
  const userId = computed(() => authStore.user?.id)

  // Ініціалізуємо при першому виклику
  _ensureInitialized(userId.value)

  // Перезавантажуємо при зміні userId (login, logout, новий акаунт)
  watch(userId, (newId, oldId) => {
    if (newId !== oldId) {
      _dismissed.value = loadDismissed(newId)
    }
  })

  function isHintVisible(hintId: string): boolean {
    return !_dismissed.value.has(hintId)
  }

  function dismissHint(hintId: string): void {
    _dismissed.value = new Set([..._dismissed.value, hintId])
    saveDismissed(_dismissed.value, userId.value)
  }

  function dismissAllHints(): void {
    const all = new Set([
      ..._dismissed.value,
      ...Object.values(TutorHintId),
    ])
    _dismissed.value = all
    saveDismissed(all, userId.value)
  }

  function resetHints(): void {
    _dismissed.value = new Set()
    _initialized = false
    saveDismissed(_dismissed.value, userId.value)
  }

  return {
    isHintVisible,
    dismissHint,
    dismissAllHints,
    resetHints,
    dismissed: computed(() => _dismissed.value),
  }
}
