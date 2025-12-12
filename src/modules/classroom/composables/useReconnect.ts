// F28: useReconnect composable - Reconnection logic
import { ref, computed, onUnmounted } from 'vue'
import { useRoomStore } from '../stores/roomStore'

export interface ReconnectOptions {
  maxAttempts?: number
  baseDelay?: number
  maxDelay?: number
  onReconnecting?: () => void
  onReconnected?: () => void
  onFailed?: () => void
}

export function useReconnect(options: ReconnectOptions = {}) {
  const {
    maxAttempts = 5,
    baseDelay = 1000,
    maxDelay = 30000,
    onReconnecting,
    onReconnected,
    onFailed,
  } = options

  const roomStore = useRoomStore()

  // State
  const attempt = ref(0)
  const isReconnecting = ref(false)
  const countdown = ref(0)
  const lastError = ref<string | null>(null)

  // Timers
  let reconnectTimer: number | null = null
  let countdownTimer: number | null = null

  // Computed
  const progress = computed(() => {
    if (maxAttempts === 0) return 0
    return (attempt.value / maxAttempts) * 100
  })

  const canRetry = computed(() => attempt.value < maxAttempts)

  const nextDelay = computed(() => {
    // Exponential backoff with jitter
    const exponentialDelay = baseDelay * Math.pow(2, attempt.value)
    const jitter = Math.random() * 1000
    return Math.min(exponentialDelay + jitter, maxDelay)
  })

  // Actions
  async function startReconnect(): Promise<boolean> {
    if (isReconnecting.value) return false
    if (!canRetry.value) {
      onFailed?.()
      return false
    }

    isReconnecting.value = true
    attempt.value++
    onReconnecting?.()

    try {
      const sessionId = roomStore.session?.uuid
      if (!sessionId) {
        throw new Error('No session to reconnect to')
      }

      await roomStore.joinRoom(sessionId)
      
      // Success
      isReconnecting.value = false
      attempt.value = 0
      lastError.value = null
      onReconnected?.()
      return true
    } catch (error) {
      isReconnecting.value = false
      lastError.value = error instanceof Error ? error.message : 'Reconnection failed'

      if (canRetry.value) {
        scheduleReconnect()
      } else {
        onFailed?.()
      }
      return false
    }
  }

  function scheduleReconnect(): void {
    const delay = nextDelay.value
    countdown.value = Math.ceil(delay / 1000)

    // Start countdown
    countdownTimer = window.setInterval(() => {
      countdown.value--
      if (countdown.value <= 0) {
        clearCountdown()
      }
    }, 1000)

    // Schedule reconnect
    reconnectTimer = window.setTimeout(() => {
      startReconnect()
    }, delay)
  }

  function cancelReconnect(): void {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    clearCountdown()
    isReconnecting.value = false
  }

  function clearCountdown(): void {
    if (countdownTimer) {
      clearInterval(countdownTimer)
      countdownTimer = null
    }
    countdown.value = 0
  }

  function reset(): void {
    cancelReconnect()
    attempt.value = 0
    lastError.value = null
  }

  function retryNow(): void {
    cancelReconnect()
    startReconnect()
  }

  // Cleanup
  onUnmounted(() => {
    cancelReconnect()
  })

  return {
    // State
    attempt,
    isReconnecting,
    countdown,
    lastError,

    // Computed
    progress,
    canRetry,
    maxAttempts,

    // Actions
    startReconnect,
    cancelReconnect,
    reset,
    retryNow,
  }
}
