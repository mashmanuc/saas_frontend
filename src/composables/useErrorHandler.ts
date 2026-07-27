/**
 * Global Error Handler composable v2.1
 * Based on FRONTEND_TASKS_v2.1.md specification
 * 
 * Handles LimitExceededError and other API errors with proper i18n
 */

import { useI18n } from 'vue-i18n'
import { isLimitExceededError } from '@/utils/errors'
import { activeLocale } from '@/utils/i18nDate'

interface ToastOptions {
  error: (message: string) => void
  success: (message: string) => void
}

export function useErrorHandler() {
  const { t, te } = useI18n()

  /**
   * Назва типу ліміту. Раніше t(`limits.types.${limit_type}`) кликався напряму —
   * а в локалях лежав лише мертвий ключ-шаблон "${limit_type}" (скопійований у JSON),
   * тож юзер бачив сирий `limits.types.student_request` у тексті помилки (фікс 2026-07-27).
   * Тепер: є переклад → показуємо; нема (новий тип із BE) → нейтральне «ліміт», не техрядок.
   */
  function limitTypeLabel(limitType: string): string {
    const key = `limits.types.${limitType}`
    return te(key) ? t(key) : t('limits.types.generic')
  }

  function handleError(error: any, toast?: ToastOptions) {
    let errorMessage = ''
    
    if (isLimitExceededError(error)) {
      const { limit_type, used, max, reset_at } = error.meta
      const resetDate = new Date(reset_at).toLocaleString(activeLocale(), { 
        dateStyle: 'medium', 
        timeStyle: 'short' 
      })
      
      errorMessage = t('errors.limitExceeded', {
        type: limitTypeLabel(limit_type),
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
