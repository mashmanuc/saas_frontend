import { ref } from 'vue'

export interface RetryOptions {
  maxAttempts?: number
  delayMs?: number
  backoff?: boolean
  onRetry?: (attempt: number, error: Error) => void
}

export function useRetry() {
  const isRetrying = ref(false)
  const attemptCount = ref(0)

  async function withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const {
      maxAttempts = 3,
      delayMs = 1000,
      backoff = true,
      onRetry,
    } = options

    attemptCount.value = 0
    isRetrying.value = false

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      attemptCount.value = attempt

      try {
        const result = await fn()
        isRetrying.value = false
        return result
      } catch (error) {
        if (attempt === maxAttempts) {
          isRetrying.value = false
          throw error
        }

        isRetrying.value = true
        const delay = backoff ? delayMs * Math.pow(2, attempt - 1) : delayMs

        if (onRetry) {
          onRetry(attempt, error as Error)
        }

        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    throw new Error('Max retry attempts reached')
  }

  return {
    withRetry,
    isRetrying,
    attemptCount,
  }
}
