/**
 * Chat Circuit Breaker v1.0
 * 
 * Паттерн Circuit Breaker для API чату:
 * - CLOSED: нормальна робота
 * - OPEN: блокування запитів після 3 помилок (30 сек)
 * - HALF_OPEN: тестовий запит після таймауту
 * 
 * Це ізолює чат від каскадних помилок сервера.
 */

const CIRCUIT_BREAKER_CONFIG = {
  FAILURE_THRESHOLD: 3,        // Кількість помилок для OPEN
  SUCCESS_THRESHOLD: 2,        // Кількість успіхів для CLOSED (з HALF_OPEN)
  OPEN_TIMEOUT_MS: 30000,      // Час відкритого стану
  HALF_OPEN_TIMEOUT_MS: 5000,  // Час між тестами в HALF_OPEN
}

class ChatCircuitBreaker {
  constructor() {
    this.state = 'CLOSED'  // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0
    this.successCount = 0
    this.nextAttempt = 0
    this.lastError = null
    this.pendingRequests = new Map()
  }

  /**
   * Виконати функцію з захистом circuit breaker
   */
  async execute(fn, context = {}) {
    const requestId = `${context.action || 'unknown'}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Check if circuit is OPEN
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new CircuitBreakerOpenError(
          `Circuit breaker OPEN. Retry after ${new Date(this.nextAttempt).toISOString()}`,
          this.lastError
        )
      }
      // Transition to HALF_OPEN for test request
      this.state = 'HALF_OPEN'
      this.successCount = 0
      console.log('[ChatCircuitBreaker] Transition to HALF_OPEN')
    }

    // Check if circuit is HALF_OPEN and we already have a pending test
    if (this.state === 'HALF_OPEN' && this.pendingRequests.size > 0) {
      throw new CircuitBreakerOpenError(
        'Circuit breaker HALF_OPEN - test request in progress',
        this.lastError
      )
    }

    this.pendingRequests.set(requestId, { startTime: Date.now(), context })

    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (error) {
      // Only count server errors (5xx) and network errors
      if (this.isServerError(error)) {
        this.onFailure(error)
      }
      throw error
    } finally {
      this.pendingRequests.delete(requestId)
    }
  }

  /**
   * Перевірка чи це серверна помилка (рахуємо для circuit breaker)
   */
  isServerError(error) {
    if (!error) return false
    
    // HTTP 5xx errors
    if (error.response?.status >= 500) return true
    
    // Network errors
    if (error.message?.includes('network')) return true
    if (error.message?.includes('fetch')) return true
    if (error.message?.includes('timeout')) return true
    
    // Connection errors
    if (error.code === 'ECONNREFUSED') return true
    if (error.code === 'ETIMEDOUT') return true
    if (error.code === 'ENOTFOUND') return true
    
    return false
  }

  onSuccess() {
    this.failureCount = 0
    this.lastError = null

    if (this.state === 'HALF_OPEN') {
      this.successCount++
      if (this.successCount >= CIRCUIT_BREAKER_CONFIG.SUCCESS_THRESHOLD) {
        this.state = 'CLOSED'
        this.successCount = 0
        console.log('[ChatCircuitBreaker] Transition to CLOSED')
      }
    }
  }

  onFailure(error) {
    this.failureCount++
    this.lastError = error

    if (this.state === 'HALF_OPEN') {
      // One failure in HALF_OPEN goes back to OPEN
      this.state = 'OPEN'
      this.nextAttempt = Date.now() + CIRCUIT_BREAKER_CONFIG.OPEN_TIMEOUT_MS
      console.log('[ChatCircuitBreaker] Transition to OPEN (from HALF_OPEN)')
    } else if (this.failureCount >= CIRCUIT_BREAKER_CONFIG.FAILURE_THRESHOLD) {
      this.state = 'OPEN'
      this.nextAttempt = Date.now() + CIRCUIT_BREAKER_CONFIG.OPEN_TIMEOUT_MS
      console.log('[ChatCircuitBreaker] Transition to OPEN')
    }
  }

  /**
   * Отримати поточний стан для UI
   */
  getStatus() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      nextAttempt: this.nextAttempt,
      canRetry: this.state === 'CLOSED' || (this.state === 'OPEN' && Date.now() >= this.nextAttempt),
      timeUntilRetry: Math.max(0, this.nextAttempt - Date.now())
    }
  }

  /**
   * Скинути circuit breaker (ручне відновлення)
   */
  reset() {
    this.state = 'CLOSED'
    this.failureCount = 0
    this.successCount = 0
    this.nextAttempt = 0
    this.lastError = null
    console.log('[ChatCircuitBreaker] Manual reset to CLOSED')
  }
}

class CircuitBreakerOpenError extends Error {
  constructor(message, originalError) {
    super(message)
    this.name = 'CircuitBreakerOpenError'
    this.originalError = originalError
    this.isCircuitBreakerError = true
  }
}

// Singleton instance for chat
export const chatCircuitBreaker = new ChatCircuitBreaker()

/**
 * Helper: обгорнути chat API з circuit breaker
 */
export function withCircuitBreaker(apiFn) {
  return async (...args) => {
    return chatCircuitBreaker.execute(
      () => apiFn(...args),
      { action: apiFn.name || 'unknown' }
    )
  }
}

/**
 * Composable для Vue компонентів
 */
export function useChatCircuitBreaker() {
  return {
    execute: (fn, context) => chatCircuitBreaker.execute(fn, context),
    getStatus: () => chatCircuitBreaker.getStatus(),
    reset: () => chatCircuitBreaker.reset(),
    isOpen: () => chatCircuitBreaker.state === 'OPEN',
    isClosed: () => chatCircuitBreaker.state === 'CLOSED'
  }
}

export default chatCircuitBreaker
