/**
 * useInquiryErrorHandler Unit Tests (Phase 1 v0.86)
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useInquiryErrorHandler } from '../useInquiryErrorHandler'
import {
  RateLimitedError,
  InquiryNotAllowedError,
  InquiryInvalidStateError,
  InquiryAlreadyExistsError
} from '@/utils/errors'
import type { AxiosError } from 'axios'

describe('useInquiryErrorHandler', () => {
  let handler: ReturnType<typeof useInquiryErrorHandler>

  beforeEach(() => {
    handler = useInquiryErrorHandler()
  })

  it('should handle RateLimitedError (429)', () => {
    const error = new RateLimitedError({ retry_after_seconds: 60 })
    
    handler.handleError(error)
    
    expect(handler.errorState.value).toEqual({
      variant: 'rate-limit',
      title: 'Забагато запитів',
      message: 'Ви надіслали забагато запитів. Будь ласка, зачекайте.',
      retryAfter: 60,
      showRetry: false
    })
  })

  it('should handle InquiryNotAllowedError (403)', () => {
    const error = new InquiryNotAllowedError({ reason: 'Not your inquiry' })
    
    handler.handleError(error)
    
    expect(handler.errorState.value).toEqual({
      variant: 'forbidden',
      title: 'Доступ заборонено',
      message: 'У вас немає прав для виконання цієї дії.',
      showRetry: false
    })
  })

  it('should handle InquiryInvalidStateError with current_state', () => {
    const error = new InquiryInvalidStateError({ 
      inquiry_id: '123',
      current_state: 'ACCEPTED'
    })
    
    handler.handleError(error)
    
    expect(handler.errorState.value?.variant).toBe('error')
    expect(handler.errorState.value?.title).toBe('Неможливо виконати дію')
    expect(handler.errorState.value?.message).toContain('ACCEPTED')
  })

  it('should handle InquiryAlreadyExistsError', () => {
    const error = new InquiryAlreadyExistsError({ relation_id: '456' })
    
    handler.handleError(error)
    
    expect(handler.errorState.value).toEqual({
      variant: 'error',
      title: 'Запит вже існує',
      message: 'У вас вже є активний запит до цього тьютора.',
      showRetry: false
    })
  })

  it('should handle 401 Unauthorized', () => {
    const error = {
      response: { status: 401 }
    } as AxiosError
    
    handler.handleError(error)
    
    expect(handler.errorState.value).toEqual({
      variant: 'unauthorized',
      title: 'Необхідна авторизація',
      message: 'Будь ласка, увійдіть в систему для продовження.',
      showRetry: false
    })
  })

  it('should handle network errors', () => {
    const error = {
      code: 'ERR_NETWORK'
    } as AxiosError
    
    handler.handleError(error)
    
    expect(handler.errorState.value).toEqual({
      variant: 'error',
      title: 'Помилка мережі',
      message: 'Не вдалося зв\'язатися з сервером. Перевірте підключення до інтернету.',
      showRetry: true
    })
  })

  it('should handle generic errors (fail-closed)', () => {
    const error = new Error('Unknown error')
    
    handler.handleError(error)
    
    expect(handler.errorState.value).toEqual({
      variant: 'error',
      title: 'Помилка',
      message: 'Щось пішло не так. Спробуйте ще раз пізніше.',
      showRetry: true
    })
  })

  it('should clear error state', () => {
    const error = new InquiryAlreadyExistsError({ relation_id: '456' })
    handler.handleError(error)
    
    expect(handler.errorState.value).not.toBeNull()
    
    handler.clearError()
    
    expect(handler.errorState.value).toBeNull()
  })
})
