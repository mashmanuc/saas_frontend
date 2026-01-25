/**
 * Phase 2.3: 429 Retry-After countdown composable
 * 
 * INV-4: Reads Retry-After header/body, disables action, shows countdown
 */

import { ref, computed, onUnmounted } from 'vue'

export function useRateLimitCountdown() {
  const retryAfterSeconds = ref<number | null>(null)
  const remainingSeconds = ref<number | null>(null)
  let countdownInterval: number | null = null

  const isRateLimited = computed(() => remainingSeconds.value !== null && remainingSeconds.value > 0)
  const canRetry = computed(() => !isRateLimited.value)

  /**
   * Start countdown from 429 response
   * @param error - Axios error with response
   */
  function startCountdown(error: any): void {
    // Try to get Retry-After from headers first (priority)
    let seconds = error.response?.headers?.['retry-after']
    
    // Fallback to body.retry_after
    if (!seconds && error.response?.data?.retry_after) {
      seconds = error.response.data.retry_after
    }

    // Parse to number
    const parsedSeconds = parseInt(seconds, 10)
    if (isNaN(parsedSeconds) || parsedSeconds <= 0) {
      // Invalid retry-after, use default 60s
      retryAfterSeconds.value = 60
      remainingSeconds.value = 60
    } else {
      retryAfterSeconds.value = parsedSeconds
      remainingSeconds.value = parsedSeconds
    }

    // Clear existing interval
    if (countdownInterval !== null) {
      clearInterval(countdownInterval)
    }

    // Start countdown
    countdownInterval = window.setInterval(() => {
      if (remainingSeconds.value !== null && remainingSeconds.value > 0) {
        remainingSeconds.value -= 1
      } else {
        stopCountdown()
      }
    }, 1000)
  }

  /**
   * Stop countdown and clear state
   */
  function stopCountdown(): void {
    if (countdownInterval !== null) {
      clearInterval(countdownInterval)
      countdownInterval = null
    }
    retryAfterSeconds.value = null
    remainingSeconds.value = null
  }

  /**
   * Reset countdown (manual retry)
   */
  function reset(): void {
    stopCountdown()
  }

  // Cleanup on unmount
  onUnmounted(() => {
    stopCountdown()
  })

  return {
    isRateLimited,
    canRetry,
    remainingSeconds,
    retryAfterSeconds,
    startCountdown,
    stopCountdown,
    reset
  }
}
