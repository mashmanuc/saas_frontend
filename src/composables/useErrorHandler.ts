/**
 * Global Error Handler composable v2.1
 * Based on FRONTEND_TASKS_v2.1.md specification
 * 
 * Handles LimitExceededError and other API errors with proper i18n
 */

import { useI18n } from 'vue-i18n'
import { isLimitExceededError } from '@/utils/errors'

interface ToastOptions {
  error: (message: string) => void
  success: (message: string) => void
}

export function useErrorHandler() {
  const { t } = useI18n()
  
  function handleError(error: any, toast?: ToastOptions) {
    let errorMessage = ''
    
    if (isLimitExceededError(error)) {
      const { limit_type, used, max, reset_at } = error.meta
      const resetDate = new Date(reset_at).toLocaleString('uk-UA', { 
        dateStyle: 'medium', 
        timeStyle: 'short' 
      })
      
      errorMessage = t('errors.limitExceeded', {
        type: t(`limits.types.${limit_type}`),
        used,
        max,
        resetDate
      })
    } else if (error?.response?.status === 403) {
      errorMessage = t('errors.forbidden')
    } else if (error?.response?.status === 404) {
      errorMessage = t('errors.notFound')
    } else {
      errorMessage = error?.message || t('errors.unknown')
    }
    
    if (toast) {
      toast.error(errorMessage)
    }
    
    return errorMessage
  }
  
  return { handleError }
}
