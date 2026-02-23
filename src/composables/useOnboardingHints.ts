/**
 * useOnboardingHints — composable для dismissible FTUE coach marks.
 *
 * Зберігає стан dismissed hints у localStorage.
 * Не блокує інтерфейс — hints = пояснення, не заборони.
 */
import { ref, computed } from 'vue'
import { useAuthStore } from '@/modules/auth/store/authStore'

export enum TutorHintId {
  DASHBOARD_WELCOME = 'tutor.dashboard.welcome',
  CALENDAR_FIRST_VISIT = 'tutor.calendar.firstVisit',
  PROFILE_FORMAT_ONLINE = 'tutor.profile.format.online',
  PROFILE_FORMAT_OFFLINE = 'tutor.profile.format.offline',
  PROFILE_PUBLISH_BLOCKED = 'tutor.profile.publish.blocked',
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

export function useOnboardingHints() {
  const authStore = useAuthStore()
  const userId = computed(() => authStore.user?.id)

  // Реактивний стан
  const dismissed = ref<Set<string>>(loadDismissed(userId.value))

  function isHintVisible(hintId: string): boolean {
    return !dismissed.value.has(hintId)
  }

  function dismissHint(hintId: string): void {
    dismissed.value = new Set([...dismissed.value, hintId])
    saveDismissed(dismissed.value, userId.value)
  }

  function dismissAllHints(): void {
    const all = new Set([
      ...dismissed.value,
      ...Object.values(TutorHintId),
    ])
    dismissed.value = all
    saveDismissed(all, userId.value)
  }

  function resetHints(): void {
    dismissed.value = new Set()
    saveDismissed(dismissed.value, userId.value)
  }

  return {
    isHintVisible,
    dismissHint,
    dismissAllHints,
    resetHints,
    dismissed: computed(() => dismissed.value),
  }
}
