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
  
  /**
   * Почати відстеження job з polling кожні 2 секунди
   */
  async function startTracking(jobId: number) {
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
