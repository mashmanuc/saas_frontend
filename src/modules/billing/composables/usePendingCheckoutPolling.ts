/**
 * Composable for polling pending checkout status
 * 
 * v0.80.0 FE-80.3: Smart polling with exponential backoff and TTL awareness
 * 
 * Features:
 * - Exponential backoff (5s → 10s → 20s → 30s)
 * - Auto-stop after TTL (15 min default)
 * - Manual stop control
 * - Telemetry logging
 */

import { ref, onUnmounted, computed } from 'vue'
import { useBillingStore } from '../stores/billingStore'

interface PendingCheckoutPollingOptions {
  initialInterval?: number
  maxInterval?: number
  ttlMinutes?: number
  onStatusChange?: (status: string) => void
}

export function usePendingCheckoutPolling(options: PendingCheckoutPollingOptions = {}) {
  const {
    initialInterval = 5000,
    maxInterval = 30000,
    ttlMinutes = 15,
    onStatusChange
  } = options

  const billingStore = useBillingStore()
  
  const isPolling = ref(false)
  const currentInterval = ref(initialInterval)
  const pollCount = ref(0)
  const startTime = ref<number | null>(null)
  let timeoutId: number | null = null

  const elapsedMinutes = computed(() => {
    if (!startTime.value) return 0
    return Math.floor((Date.now() - startTime.value) / 1000 / 60)
  })

  const shouldStopPolling = computed(() => {
    return elapsedMinutes.value >= ttlMinutes
  })

  async function poll() {
    if (!isPolling.value || shouldStopPolling.value) {
      stop()
      return
    }

    pollCount.value++

    try {
      const previousStatus = billingStore.me?.subscription_status
      
      await billingStore.fetchMe()
      
      const currentStatus = billingStore.me?.subscription_status
      
      // Check if status changed
      if (previousStatus !== currentStatus && onStatusChange) {
        onStatusChange(currentStatus || 'unknown')
      }

      // Log telemetry
      if (import.meta.env.DEV) {
        console.debug('[PendingCheckoutPolling]', {
          event: 'billing_pending_poll',
          poll_count: pollCount.value,
          interval_ms: currentInterval.value,
          elapsed_minutes: elapsedMinutes.value,
          status: currentStatus,
          pending_age_seconds: billingStore.me?.pending_age_seconds
        })
      }

      // Stop if no longer pending
      if (!billingStore.hasPendingPlan) {
        console.info('[PendingCheckoutPolling] Checkout completed, stopping polling')
        stop()
        return
      }

      // Exponential backoff
      currentInterval.value = Math.min(currentInterval.value * 2, maxInterval)

      // Schedule next poll
      timeoutId = window.setTimeout(poll, currentInterval.value)
    } catch (error) {
      console.error('[PendingCheckoutPolling] Poll failed:', error)
      
      // Continue polling on error (might be network issue)
      timeoutId = window.setTimeout(poll, currentInterval.value)
    }
  }

  function start() {
    if (isPolling.value) {
      console.warn('[PendingCheckoutPolling] Already polling')
      return
    }

    console.info('[PendingCheckoutPolling] Starting polling')
    
    isPolling.value = true
    startTime.value = Date.now()
    pollCount.value = 0
    currentInterval.value = initialInterval

    // Start first poll
    poll()
  }

  function stop() {
    if (!isPolling.value) return

    console.info('[PendingCheckoutPolling] Stopping polling', {
      poll_count: pollCount.value,
      elapsed_minutes: elapsedMinutes.value
    })

    isPolling.value = false
    
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId)
      timeoutId = null
    }
  }

  // Auto-cleanup on unmount
  onUnmounted(() => {
    stop()
  })

  return {
    isPolling,
    pollCount,
    elapsedMinutes,
    currentInterval,
    start,
    stop
  }
}
