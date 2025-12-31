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
      code?: string
    }
  }
  message?: string
}

export interface FieldError {
  field: string
  message: string
}

export interface ErrorHandlerResult {
  message: string
  fieldErrors: Record<string, string>
  shouldShowToast: boolean
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
    'INVALID_LESSON_TYPE': 'calendar.errors.invalidLessonType',
    'INVALID_DATETIME': 'calendar.errors.invalidDatetime',
    'STUDENT_NOT_FOUND': 'calendar.errors.studentNotFound',
    'ORDER_INACTIVE': 'calendar.errors.orderInactive',
  }

  // Мапінг кодів помилок на поля форми
  const fieldErrorMapping: Record<string, string> = {
    'PAST_TIME': 'start',
    'INVALID_DURATION': 'durationMin',
    'INVALID_LESSON_TYPE': 'lessonType',
    'INVALID_DATETIME': 'start',
    'INVALID_ORDER': 'orderId',
    'STUDENT_NOT_FOUND': 'orderId',
    'ORDER_INACTIVE': 'orderId',
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

  /**
   * Обробка помилок з розподілом на field errors та toast
   */
  const handleErrorWithFields = (error: ApiError, fallbackMessage?: string): ErrorHandlerResult => {
    console.error('[useErrorHandler] Error with fields:', error)

    const errorCode = error.response?.data?.error?.code || error.response?.data?.code
    const errorMessage = error.response?.data?.error?.message
    const requestId = error.response?.data?.error?.requestId
    const status = error.response?.status

    const fieldErrors: Record<string, string> = {}
    let message = fallbackMessage || t('calendar.errors.unknown')
    let shouldShowToast = true

    // Якщо є код помилки
    if (errorCode) {
      // Перевіряємо, чи це field-specific помилка
      if (fieldErrorMapping[errorCode]) {
        const field = fieldErrorMapping[errorCode]
        const errorKey = errorMessages[errorCode] || 'calendar.errors.validationError'
        fieldErrors[field] = t(errorKey)
        shouldShowToast = false // Не показуємо toast для field errors
      } else if (errorMessages[errorCode]) {
        // Загальна помилка - показуємо toast
        message = t(errorMessages[errorCode])
      } else if (errorMessage) {
        message = errorMessage
      }
    } else if (status === 429) {
      message = t('calendar.errors.rateLimitExceeded')
    } else if (status === 403) {
      message = t('calendar.errors.permissionDenied')
    } else if (status === 404) {
      message = t('calendar.errors.notFound')
    } else if (status === 500) {
      message = t('calendar.errors.serverError')
    }

    // Показуємо toast тільки якщо це не field error
    if (shouldShowToast) {
      toast.error(message)
    }

    // Log request ID for debugging
    if (requestId) {
      console.error('[useErrorHandler] Request ID:', requestId)
    }

    return {
      message,
      fieldErrors,
      shouldShowToast,
    }
  }

  /**
   * Отримати переклад для коду помилки
   */
  const getErrorMessage = (errorCode: string): string => {
    return errorMessages[errorCode] ? t(errorMessages[errorCode]) : t('calendar.errors.unknown')
  }

  return {
    handleError,
    handleErrorWithFields,
    getErrorMessage,
  }
}
