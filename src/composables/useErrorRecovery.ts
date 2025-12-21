import { ref } from 'vue'

export interface ErrorRecoveryOptions {
  maxRetries?: number
  retryDelay?: number
  exponentialBackoff?: boolean
  onRetry?: (attempt: number, error: any) => void
  onMaxRetriesReached?: (error: any) => void
}

export function useErrorRecovery(options: ErrorRecoveryOptions = {}) {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    exponentialBackoff = true,
    onRetry,
    onMaxRetriesReached
  } = options

  const isRetrying = ref(false)
  const retryCount = ref(0)
  const lastError = ref<any>(null)

  async function executeWithRetry<T>(
    fn: () => Promise<T>,
    context?: string
  ): Promise<T> {
    retryCount.value = 0
    lastError.value = null

    while (retryCount.value <= maxRetries) {
      try {
        const result = await fn()
        retryCount.value = 0
        isRetrying.value = false
        return result
      } catch (error) {
        lastError.value = error
        retryCount.value++

        if (retryCount.value > maxRetries) {
          isRetrying.value = false
          if (onMaxRetriesReached) {
            onMaxRetriesReached(error)
          }
          throw error
        }

        isRetrying.value = true
        const delay = exponentialBackoff
          ? retryDelay * Math.pow(2, retryCount.value - 1)
          : retryDelay

        if (onRetry) {
          onRetry(retryCount.value, error)
        }

        console.warn(
          `[retry] Attempt ${retryCount.value}/${maxRetries} failed${context ? ` (${context})` : ''}, retrying in ${delay}ms...`,
          error
        )

        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    throw lastError.value
  }

  function reset() {
    retryCount.value = 0
    lastError.value = null
    isRetrying.value = false
  }

  return {
    executeWithRetry,
    isRetrying,
    retryCount,
    lastError,
    reset
  }
}

export function useApiErrorHandler() {
  function handleApiError(error: any, context?: string): string {
    const contextStr = context ? `[${context}] ` : ''

    if (!error) {
      return `${contextStr}Unknown error occurred`
    }

    // Network errors
    if (error.message === 'Network Error' || !error.response) {
      return `${contextStr}Network connection failed. Please check your internet connection.`
    }

    // HTTP status errors
    const status = error.response?.status
    const data = error.response?.data

    switch (status) {
      case 400:
        return `${contextStr}${data?.detail || data?.error || 'Invalid request'}`
      case 401:
        return `${contextStr}Authentication required. Please log in.`
      case 403:
        return `${contextStr}${data?.detail || 'Access denied'}`
      case 404:
        return `${contextStr}${data?.detail || 'Resource not found'}`
      case 409:
        return `${contextStr}${data?.detail || 'Conflict occurred'}`
      case 422:
        if (data?.fields) {
          const fieldErrors = Object.entries(data.fields)
            .map(([field, errors]: [string, any]) => `${field}: ${errors.join(', ')}`)
            .join('; ')
          return `${contextStr}Validation failed: ${fieldErrors}`
        }
        return `${contextStr}${data?.detail || 'Validation failed'}`
      case 429:
        return `${contextStr}Too many requests. Please try again later.`
      case 500:
      case 502:
      case 503:
      case 504:
        return `${contextStr}Server error. Please try again later.`
      default:
        return `${contextStr}${data?.detail || data?.error || error.message || 'An error occurred'}`
    }
  }

  function isRetryableError(error: any): boolean {
    if (!error.response) {
      return true // Network errors are retryable
    }

    const status = error.response.status
    // Retry on server errors and rate limiting
    return status >= 500 || status === 429
  }

  function shouldShowToUser(error: any): boolean {
    if (!error.response) {
      return true
    }

    const status = error.response.status
    // Don't show auth errors as toasts (handled by auth flow)
    return status !== 401
  }

  return {
    handleApiError,
    isRetryableError,
    shouldShowToUser
  }
}
