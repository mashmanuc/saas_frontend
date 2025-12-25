/**
 * useAvailabilityJob Composable v0.49.5
 * Job tracking with polling for availability slot generation
 */

import { ref, onUnmounted } from 'vue'
import { bookingApi } from '../api/booking'
import type { AvailabilitySyncJob } from '../types/availability'

export function useAvailabilityJob() {
  const currentJob = ref<AvailabilitySyncJob | null>(null)
  const isPolling = ref(false)
  const error = ref<string | null>(null)
  
  let pollInterval: number | null = null
  let lastJobStartTime = 0
  const MIN_JOB_INTERVAL_MS = 30000 // 30 секунд між job згідно з API rate limit
  
  /**
   * Почати відстеження job з polling кожні 2 секунди
   * Debounce: не дозволяє запускати новий job якщо попередній ще активний
   * або якщо не минуло 30 секунд з останнього запуску
   */
  async function startTracking(jobId: number) {
    // Debounce: перевірити чи не активний вже job
    if (currentJob.value && ['pending', 'running'].includes(currentJob.value.status)) {
      console.warn('[useAvailabilityJob] Job already in progress, skipping')
      return
    }
    
    // Rate limit: перевірити чи минуло 30 секунд з останнього запуску
    const now = Date.now()
    const timeSinceLastJob = now - lastJobStartTime
    if (timeSinceLastJob < MIN_JOB_INTERVAL_MS && lastJobStartTime > 0) {
      const remainingTime = Math.ceil((MIN_JOB_INTERVAL_MS - timeSinceLastJob) / 1000)
      console.warn(`[useAvailabilityJob] Rate limit: wait ${remainingTime}s before starting new job`)
      error.value = `Please wait ${remainingTime} seconds before retrying`
      return
    }
    
    lastJobStartTime = now
    isPolling.value = true
    error.value = null
    
    // Перший запит одразу
    await pollJobStatus(jobId)
    
    // Polling кожні 2 секунди
    pollInterval = window.setInterval(async () => {
      await pollJobStatus(jobId)
      
      // Зупинити polling якщо job завершено
      if (currentJob.value && ['success', 'failed'].includes(currentJob.value.status)) {
        stopTracking()
      }
    }, 2000)
  }
  
  async function pollJobStatus(jobId: number) {
    try {
      currentJob.value = await bookingApi.getAvailabilityJobStatus(jobId)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch job status'
      stopTracking()
    }
  }
  
  function stopTracking() {
    if (pollInterval) {
      clearInterval(pollInterval)
      pollInterval = null
    }
    isPolling.value = false
  }
  
  // Cleanup on unmount
  onUnmounted(() => {
    stopTracking()
  })
  
  return {
    currentJob,
    isPolling,
    error,
    startTracking,
    stopTracking,
  }
}
