/**
 * WebSocket Reconnection Strategy — v0.13.0
 * Exponential backoff з max 5 спроб
 * Інтеграція з UI-статусами та повідомленнями
 */

const DEFAULT_OPTIONS = {
  maxRetries: 5,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitterFactor: 0.3, // ±30% jitter
}

/**
 * Reconnection state manager
 */
export class ReconnectStrategy {
  constructor(options = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
    this.retryCount = 0
    this.currentDelay = this.options.initialDelayMs
    this.timer = null
    this.aborted = false
    this.onReconnect = null
    this.onMaxRetriesReached = null
    this.onStatusChange = null
  }

  /**
   * Calculate next delay with exponential backoff + jitter
   * @returns {number} delay in ms
   */
  getNextDelay() {
    const baseDelay = Math.min(
      this.options.initialDelayMs * Math.pow(this.options.backoffMultiplier, this.retryCount),
      this.options.maxDelayMs
    )
    
    // Add jitter to prevent thundering herd
    const jitter = baseDelay * this.options.jitterFactor * (Math.random() * 2 - 1)
    return Math.max(0, Math.round(baseDelay + jitter))
  }

  /**
   * Schedule a reconnection attempt
   * @param {Function} connectFn - Function to call for reconnection
   * @returns {Promise<boolean>} - true if connected, false if max retries reached
   */
  async scheduleReconnect(connectFn) {
    if (this.aborted) {
      return false
    }

    if (this.retryCount >= this.options.maxRetries) {
      this.onMaxRetriesReached?.()
      this.onStatusChange?.('max_retries_reached')
      return false
    }

    const delay = this.getNextDelay()
    this.retryCount++
    
    this.onStatusChange?.('waiting', {
      attempt: this.retryCount,
      maxRetries: this.options.maxRetries,
      delayMs: delay,
    })

    return new Promise((resolve) => {
      this.timer = setTimeout(async () => {
        if (this.aborted) {
          resolve(false)
          return
        }

        this.onStatusChange?.('connecting', {
          attempt: this.retryCount,
          maxRetries: this.options.maxRetries,
        })

        try {
          await connectFn()
          this.reset()
          this.onStatusChange?.('connected')
          this.onReconnect?.()
          resolve(true)
        } catch (error) {
          this.onStatusChange?.('failed', {
            attempt: this.retryCount,
            error: error?.message || 'Connection failed',
          })
          
          // Recursively try again
          const result = await this.scheduleReconnect(connectFn)
          resolve(result)
        }
      }, delay)
    })
  }

  /**
   * Reset retry state (call after successful connection)
   */
  reset() {
    this.retryCount = 0
    this.currentDelay = this.options.initialDelayMs
    this.aborted = false
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  /**
   * Abort any pending reconnection
   */
  abort() {
    this.aborted = true
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this.onStatusChange?.('aborted')
  }

  /**
   * Check if currently attempting to reconnect
   * @returns {boolean}
   */
  isReconnecting() {
    return this.timer !== null && !this.aborted
  }

  /**
   * Get current retry info
   * @returns {{ attempt: number, maxRetries: number, isReconnecting: boolean }}
   */
  getStatus() {
    return {
      attempt: this.retryCount,
      maxRetries: this.options.maxRetries,
      isReconnecting: this.isReconnecting(),
      aborted: this.aborted,
    }
  }
}

/**
 * Create a reconnect strategy with callbacks
 * @param {object} options
 * @param {Function} options.onReconnect - Called when reconnection succeeds
 * @param {Function} options.onMaxRetriesReached - Called when max retries exceeded
 * @param {Function} options.onStatusChange - Called on status changes
 * @returns {ReconnectStrategy}
 */
export function createReconnectStrategy(options = {}) {
  const { onReconnect, onMaxRetriesReached, onStatusChange, ...strategyOptions } = options
  const strategy = new ReconnectStrategy(strategyOptions)
  
  if (onReconnect) strategy.onReconnect = onReconnect
  if (onMaxRetriesReached) strategy.onMaxRetriesReached = onMaxRetriesReached
  if (onStatusChange) strategy.onStatusChange = onStatusChange
  
  return strategy
}

/**
 * Simple exponential backoff helper (for one-off use)
 * @param {number} attempt - Current attempt number (0-based)
 * @param {object} options
 * @returns {number} delay in ms
 */
export function calculateBackoff(attempt, options = {}) {
  const { initialDelayMs = 1000, maxDelayMs = 30000, multiplier = 2 } = options
  return Math.min(initialDelayMs * Math.pow(multiplier, attempt), maxDelayMs)
}

/**
 * Connection status enum for UI binding
 */
export const CONNECTION_STATUS = Object.freeze({
  CONNECTED: 'connected',
  CONNECTING: 'connecting',
  DISCONNECTED: 'disconnected',
  RECONNECTING: 'reconnecting',
  SYNCING: 'syncing',
  FAILED: 'failed',
})

/**
 * Map reconnect strategy status to UI status
 * @param {string} strategyStatus
 * @returns {string}
 */
export function mapToUiStatus(strategyStatus) {
  switch (strategyStatus) {
    case 'connected':
      return CONNECTION_STATUS.CONNECTED
    case 'connecting':
      return CONNECTION_STATUS.CONNECTING
    case 'waiting':
    case 'failed':
      return CONNECTION_STATUS.RECONNECTING
    case 'max_retries_reached':
    case 'aborted':
      return CONNECTION_STATUS.FAILED
    default:
      return CONNECTION_STATUS.DISCONNECTED
  }
}

export default {
  ReconnectStrategy,
  createReconnectStrategy,
  calculateBackoff,
  CONNECTION_STATUS,
  mapToUiStatus,
}
