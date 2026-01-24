/**
 * useInquiryErrorHandler Composable (Phase 1 v0.86)
 * 
 * Обробка помилок inquiry операцій з fail-closed підходом
 */

import { ref } from 'vue'
import type { AxiosError } from 'axios'
import {
  InquiryAlreadyExistsError,
  InquiryNotAllowedError,
  InquiryInvalidStateError,
  RateLimitedError
} from '@/utils/errors'

export interface ErrorState {
  variant: 'error' | 'rate-limit' | 'forbidden' | 'unauthorized'
  title: string
  message: string
  retryAfter?: number
  showRetry: boolean
}

export function useInquiryErrorHandler() {
  const errorState = ref<ErrorState | null>(null)

  function handleError(error: unknown): void {
    // Детальне логування для діагностики
    console.error('[useInquiryErrorHandler] Error details:', {
      error,
      isAxiosError: !!(error as any)?.isAxiosError,
      status: (error as any)?.response?.status,
      data: (error as any)?.response?.data,
      message: (error as any)?.message
    })
    
    // Rate limit (429)
    if (error instanceof RateLimitedError) {
      errorState.value = {
        variant: 'rate-limit',
        title: 'Забагато запитів',
        message: 'Ви надіслали забагато запитів. Будь ласка, зачекайте.',
        retryAfter: error.meta.retry_after_seconds,
        showRetry: false
      }
      return
    }

    // Permission denied (403)
    if (error instanceof InquiryNotAllowedError) {
      errorState.value = {
        variant: 'forbidden',
        title: 'Доступ заборонено',
        message: 'У вас немає прав для виконання цієї дії.',
        showRetry: false
      }
      return
    }

    // Invalid state (400)
    if (error instanceof InquiryInvalidStateError) {
      errorState.value = {
        variant: 'error',
        title: 'Неможливо виконати дію',
        message: error.meta.current_state 
          ? `Запит вже має статус: ${error.meta.current_state}`
          : 'Запит знаходиться в невірному стані для цієї операції.',
        showRetry: false
      }
      return
    }

    // Already exists
    if (error instanceof InquiryAlreadyExistsError) {
      errorState.value = {
        variant: 'error',
        title: 'Запит вже існує',
        message: 'У вас вже є активний запит до цього тьютора.',
        showRetry: false
      }
      return
    }

    // Unauthorized (401)
    if ((error as AxiosError)?.response?.status === 401) {
      errorState.value = {
        variant: 'unauthorized',
        title: 'Необхідна авторизація',
        message: 'Будь ласка, увійдіть в систему для продовження.',
        showRetry: false
      }
      return
    }

    // Network error
    if ((error as AxiosError)?.code === 'ERR_NETWORK') {
      errorState.value = {
        variant: 'error',
        title: 'Помилка мережі',
        message: 'Не вдалося зв\'язатися з сервером. Перевірте підключення до інтернету.',
        showRetry: true
      }
      return
    }

    // Generic error (fail-closed)
    errorState.value = {
      variant: 'error',
      title: 'Помилка',
      message: 'Щось пішло не так. Спробуйте ще раз пізніше.',
      showRetry: true
    }
  }

  function clearError(): void {
    errorState.value = null
  }

  return {
    errorState,
    handleError,
    clearError
  }
}
