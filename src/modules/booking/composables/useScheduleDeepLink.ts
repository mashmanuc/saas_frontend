/**
 * Phase 1.5 (1-click UX): deep-link у розклад з hero CTA.
 *
 * Використовується у TutorCalendarView + StudentCalendarView. Читає ?booking={id}
 * з URL, після того як розклад встиг відрендеритись — скролить до картки і
 * додає тимчасовий підсвічений клас.
 *
 * НЕ відкриває урок автоматично — user має клікнути «Приєднатись» свідомо
 * (public action, reversibility low). Для draft/lesson auto-open існує
 * окремий flow у WBMyLessonsPage через ?open=.
 *
 * Robustness:
 *   - `watch(route.query.booking)` замість onMounted — ловить navigation у той
 *     самий route з новим ?booking (CTA → schedule → back → інший CTA → schedule)
 *   - Immediate find (без delay) — якщо DOM вже готовий, спрацьовує миттєво
 *   - Polling 150ms × 20 спроб (3с) — fallback для async-рендеру календаря
 *   - Query cleanup одразу — refresh/back не повторюють highlight
 *   - Cleanup на unmount + між викликами — жодних orphan timers
 */
import { onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const HIGHLIGHT_CLASS = 'schedule-booking--highlight'
const HIGHLIGHT_DURATION_MS = 2_500
const FIND_ATTEMPTS_MAX = 20
const FIND_INTERVAL_MS = 150

export function useScheduleDeepLink() {
  const route = useRoute()
  const router = useRouter()

  let findInterval: ReturnType<typeof setInterval> | null = null
  let cleanupTimer: ReturnType<typeof setTimeout> | null = null
  let activeElement: HTMLElement | null = null

  function clearTimers() {
    if (findInterval) {
      clearInterval(findInterval)
      findInterval = null
    }
    if (cleanupTimer) {
      clearTimeout(cleanupTimer)
      cleanupTimer = null
    }
    // Якщо ще світиться попередній highlight — знімаємо перед новим
    if (activeElement) {
      activeElement.classList.remove(HIGHLIGHT_CLASS)
      activeElement = null
    }
  }

  function tryHighlight(bookingId: string): boolean {
    const el = document.querySelector<HTMLElement>(
      `[data-event-id="${CSS.escape(bookingId)}"]`,
    )
    if (!el) return false

    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add(HIGHLIGHT_CLASS)
    activeElement = el

    cleanupTimer = setTimeout(() => {
      el.classList.remove(HIGHLIGHT_CLASS)
      if (activeElement === el) activeElement = null
    }, HIGHLIGHT_DURATION_MS)

    return true
  }

  function processBookingQuery(bookingId: string | null | undefined) {
    // Зупиняємо попередні спроби, якщо були
    clearTimers()

    if (!bookingId || typeof bookingId !== 'string') return

    // Чистимо query одразу щоб refresh/back не повторив — навіть якщо
    // не знайдемо картку, повторний highlight не потрібен
    router
      .replace({ query: { ...route.query, booking: undefined } })
      .catch(() => {})

    // Immediate спроба — DOM може вже бути готовий
    if (tryHighlight(bookingId)) return

    // Fallback: polling до FIND_INTERVAL_MS × FIND_ATTEMPTS_MAX
    let attempts = 0
    findInterval = setInterval(() => {
      attempts += 1
      if (tryHighlight(bookingId)) {
        if (findInterval) {
          clearInterval(findInterval)
          findInterval = null
        }
        return
      }
      if (attempts >= FIND_ATTEMPTS_MAX) {
        if (findInterval) {
          clearInterval(findInterval)
          findInterval = null
        }
        console.info('[schedule-deep-link] booking=%s not found in DOM', bookingId)
      }
    }, FIND_INTERVAL_MS)
  }

  // Watch `route.query.booking` з immediate — ловить:
  //   - первинний mount з ?booking=
  //   - перехід у той самий route з новим ?booking= (без remount)
  //   - back-кнопку: query вже очищено processBookingQuery → нічого не робить
  watch(
    () => route.query.booking,
    (val) => processBookingQuery(typeof val === 'string' ? val : null),
    { immediate: true },
  )

  onUnmounted(() => {
    clearTimers()
  })
}
