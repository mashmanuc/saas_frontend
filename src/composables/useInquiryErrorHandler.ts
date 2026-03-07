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
  showUpgrade?: boolean
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

    // Permission denied / domain validation - check specific codes
    if (error instanceof InquiryNotAllowedError) {
      const meta = error.meta || {}
      
      // Contact information required
      if (meta.reason === 'contact_required') {
        errorState.value = {
          variant: 'error',
          title: 'Необхідна контактна інформація',
          message: 'Будь ласка, додайте номер телефону або Telegram у налаштуваннях профілю перед створенням запиту.',
          showRetry: false
        }
        return
      }
      
      // Invalid phone format
      if (meta.reason === 'invalid_phone_format') {
        errorState.value = {
          variant: 'error',
          title: 'Невірний формат телефону',
          message: 'Використовуйте міжнародний формат: +[код країни][номер]. Наприклад: +380501234567',
          showRetry: false
        }
        return
      }
      
      // Tutor not found
      if (meta.reason === 'tutor_not_found') {
        errorState.value = {
          variant: 'error',
          title: 'Тьютора не знайдено',
          message: 'Профіль цього тьютора недоступний. Можливо, він був видалений або деактивований.',
          showRetry: false
        }
        return
      }
      
      // Not a student role
      if (meta.reason === 'not_student') {
        errorState.value = {
          variant: 'forbidden',
          title: 'Недоступно для вашого акаунта',
          message: 'Надсилати запити можуть тільки студенти.',
          showRetry: false
        }
        return
      }
      
      // Cooldown active
      if (meta.locked_reason === 'cooldown' || meta.cooldown_expires_at) {
        const daysRemaining = meta.cooldown_expires_at && typeof meta.cooldown_expires_at === 'string'
          ? Math.ceil((new Date(meta.cooldown_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : 7
        errorState.value = {
          variant: 'forbidden',
          title: 'Cooldown активний',
          message: `Ви можете надіслати новий запит цьому тьютору через ${daysRemaining} днів`,
          showRetry: false
        }
        return
      }
      
      // Max open limit reached
      if (meta.locked_reason === 'max_open_limit' || meta.limit) {
        const limit = meta.limit || 5
        errorState.value = {
          variant: 'forbidden',
          title: 'Досягнуто ліміт активних запитів',
          message: `Досягнуто ліміт активних запитів (${limit})`,
          showRetry: false,
          showUpgrade: limit === 5
        }
        return
      }
      
      // Generic forbidden
      errorState.value = {
        variant: 'forbidden',
        title: 'Доступ заборонено',
        message: 'У вас немає прав для виконання цієї дії.',
        showRetry: false
      }
      return
    }

    // Conflict responses (409) — cooldown, max open limit, already exists
    if ((error as AxiosError)?.response?.status === 409) {
      const data409 = (error as AxiosError)?.response?.data as any
      const meta = data409?.meta || {}
      
      // Cooldown active
      if (data409?.code === 'INQUIRY_COOLDOWN_ACTIVE' || meta.locked_reason === 'cooldown') {
        const daysRemaining = meta.cooldown_expires_at && typeof meta.cooldown_expires_at === 'string'
          ? Math.ceil((new Date(meta.cooldown_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : 7
        errorState.value = {
          variant: 'forbidden',
          title: 'Cooldown активний',
          message: `Ви можете надіслати новий запит цьому тьютору через ${daysRemaining} днів`,
          showRetry: false
        }
        return
      }
      
      // Max open limit reached
      if (data409?.code === 'STUDENT_ACTIVE_LIMIT_REACHED' || meta.locked_reason === 'max_open_limit') {
        const limit = meta.limit || 5
        errorState.value = {
          variant: 'forbidden',
          title: 'Досягнуто ліміт активних запитів',
          message: `Досягнуто ліміт активних запитів (${limit})`,
          showRetry: false,
          showUpgrade: limit === 5
        }
        return
      }
      
      // Already exists (409 variant)
      if (data409?.code === 'inquiry_already_exists' || data409?.code === 'INQUIRY_ALREADY_EXISTS') {
        errorState.value = {
          variant: 'error',
          title: 'Запит вже існує',
          message: 'У вас вже є активний запит до цього тьютора.',
          showRetry: false
        }
        return
      }
      
      // Generic 409
      errorState.value = {
        variant: 'error',
        title: 'Конфлікт',
        message: data409?.message || 'Не вдалося виконати дію через конфлікт стану.',
        showRetry: false
      }
      return
    }

    // DomainError responses (400 with code field from custom_exception_handler)
    if ((error as AxiosError)?.response?.status === 400) {
      const data = (error as AxiosError)?.response?.data as any
      const domainCode = data?.code
      
      // Contact information required
      if (domainCode === 'contact_required' || data?.contact_required) {
        errorState.value = {
          variant: 'error',
          title: 'Необхідна контактна інформація',
          message: 'Будь ласка, додайте номер телефону або Telegram у налаштуваннях профілю перед створенням запиту.',
          showRetry: false
        }
        return
      }
      
      // Invalid phone format
      if (domainCode === 'invalid_phone_format' || data?.invalid_phone_format) {
        errorState.value = {
          variant: 'error',
          title: 'Невірний формат телефону',
          message: 'Використовуйте міжнародний формат: +[код країни][номер]. Наприклад: +380501234567',
          showRetry: false
        }
        return
      }
      
      // Tutor not found
      if (domainCode === 'inquiry_not_allowed' && data?.meta?.reason === 'tutor_not_found') {
        errorState.value = {
          variant: 'error',
          title: 'Тьютора не знайдено',
          message: 'Профіль цього тьютора недоступний. Можливо, він був видалений або деактивований.',
          showRetry: false
        }
        return
      }
      
      // Not a student role
      if (domainCode === 'inquiry_not_allowed' && data?.meta?.reason === 'not_student') {
        errorState.value = {
          variant: 'forbidden',
          title: 'Недоступно для вашого акаунта',
          message: 'Надсилати запити можуть тільки студенти.',
          showRetry: false
        }
        return
      }
      
      // Generic inquiry_not_allowed with known code
      if (domainCode === 'inquiry_not_allowed') {
        const reason = data?.meta?.reason || ''
        errorState.value = {
          variant: 'forbidden',
          title: 'Неможливо надіслати запит',
          message: data?.message || `Дія заборонена: ${reason}`,
          showRetry: false
        }
        return
      }
      
      // inquiry_already_exists (handled by DomainError but can also come as raw 400)
      if (domainCode === 'inquiry_already_exists') {
        errorState.value = {
          variant: 'error',
          title: 'Запит вже існує',
          message: 'У вас вже є активний запит до цього тьютора.',
          showRetry: false
        }
        return
      }
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

    // Validation error (422 / 400 with generic field errors)
    const respData = (error as AxiosError)?.response?.data as any
    const respStatus = (error as AxiosError)?.response?.status
    if (respStatus === 422 || 
        (respStatus === 400 && !respData?.code && !respData?.contact_required && !respData?.invalid_phone_format)) {
      const data400 = (error as AxiosError)?.response?.data as any
      
      // Phone validation error
      if (data400?.phone) {
        errorState.value = {
          variant: 'error',
          title: 'Невірний формат телефону',
          message: 'Використовуйте міжнародний формат: +[код країни][номер]. Наприклад: +380501234567',
          showRetry: false
        }
        return
      }
      
      // Map known field names to user-friendly messages
      const fieldLabels: Record<string, string> = {
        phone: 'телефон',
        telegram_username: 'Telegram',
        message: 'повідомлення',
        start_preference: 'бажаний час початку',
        tutor_id: 'тьютор',
        email: 'email',
        goals: 'цілі та побажання',
      }
      
      // Skip structural keys that are NOT field errors
      const skipKeys = new Set(['detail', 'error', 'message', 'code', 'error_code', 'non_field_errors', 'meta', 'request_id'])
      
      // Extract human-readable error
      const fieldKeys = data400 ? Object.keys(data400).filter(k => !skipKeys.has(k)) : []
      if (fieldKeys.length > 0) {
        const messages: string[] = []
        for (const key of fieldKeys) {
          const rawMsg = Array.isArray(data400[key]) ? data400[key][0] : data400[key]
          if (typeof rawMsg === 'object') continue
          const label = fieldLabels[key] || key
          const friendlyMsg = mapValidationMessage(String(rawMsg))
          messages.push(`${label}: ${friendlyMsg}`)
        }
        if (messages.length > 0) {
          errorState.value = {
            variant: 'error',
            title: 'Перевірте введені дані',
            message: messages.join('. '),
            showRetry: false
          }
          return
        }
      }
      
      // Fallback for unknown structure
      const detail = data400?.detail || data400?.message
      errorState.value = {
        variant: 'error',
        title: 'Перевірте введені дані',
        message: detail ? mapValidationMessage(String(detail)) : 'Одне або кілька полів заповнені некоректно.',
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

  function mapValidationMessage(raw: string): string {
    const lower = raw.toLowerCase()
    if (lower.includes('required') || lower.includes('blank') || lower === 'missing') {
      return 'це поле обовʼязкове'
    }
    if (lower.includes('too short') || lower.includes('min') || lower.includes('ensure this value has at least')) {
      return 'значення занадто коротке'
    }
    if (lower.includes('too long') || lower.includes('max') || lower.includes('ensure this value has at most')) {
      return 'значення занадто довге'
    }
    if (lower.includes('invalid') || lower.includes('not a valid')) {
      return 'невірний формат'
    }
    if (lower.includes('already exists') || lower.includes('unique')) {
      return 'таке значення вже існує'
    }
    if (lower.includes('phone')) {
      return 'невірний формат телефону'
    }
    return raw
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
