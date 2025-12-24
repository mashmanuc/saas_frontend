import { useToast } from '@/composables/useToast'
import { useI18n } from 'vue-i18n'

interface ApiError {
  response?: {
    status: number
    data?: {
      error?: {
        code: string
        message: string
        details?: any
        requestId?: string
      }
    }
  }
  message?: string
}

export function useErrorHandler() {
  const toast = useToast()
  const { t } = useI18n()

  const errorMessages: Record<string, string> = {
    'PAST_TIME': 'calendar.errors.invalidTime',
    'INVALID_DURATION': 'calendar.errors.invalidDuration',
    'INVALID_ORDER': 'calendar.errors.invalidOrder',
    'TIME_OVERLAP': 'calendar.errors.timeOverlap',
    'CANNOT_DELETE': 'calendar.errors.cannotDelete',
    'NOT_FOUND': 'calendar.errors.notFound',
    'PERMISSION_DENIED': 'calendar.errors.permissionDenied',
    'RATE_LIMIT_EXCEEDED': 'calendar.errors.rateLimitExceeded',
    'VALIDATION_ERROR': 'calendar.errors.validationError',
  }

  const handleError = (error: ApiError, fallbackMessage?: string) => {
    console.error('[useErrorHandler] Error:', error)

    const errorCode = error.response?.data?.error?.code
    const errorMessage = error.response?.data?.error?.message
    const requestId = error.response?.data?.error?.requestId
    const status = error.response?.status

    let message = fallbackMessage || t('calendar.errors.unknown')

    if (errorCode && errorMessages[errorCode]) {
      message = t(errorMessages[errorCode])
    } else if (errorMessage) {
      message = errorMessage
    } else if (status === 429) {
      message = t('calendar.errors.rateLimitExceeded')
    } else if (status === 403) {
      message = t('calendar.errors.permissionDenied')
    } else if (status === 404) {
      message = t('calendar.errors.notFound')
    } else if (status === 500) {
      message = t('calendar.errors.serverError')
    }

    toast.error(message)

    // Log request ID for debugging
    if (requestId) {
      console.error('[useErrorHandler] Request ID:', requestId)
    }

    return message
  }

  return {
    handleError,
  }
}
