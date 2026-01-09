/**
 * Централізований error handler для Relations API v2.1 + v0.62
 * 
 * Перетворює axios errors у domain-specific errors
 * Використовується у всіх stores для уніфікованої обробки помилок
 * 
 * Based on FRONTEND_TASKS_v2.1.md specification - Політика 5
 * Extended for v0.62 inquiry errors
 */

import axios from 'axios'
import {
  LimitExceededError,
  InquiryAlreadyExistsError,
  InquiryNotAllowedError,
  InquiryInvalidStateError,
  ContactLockedError,
  SubscriptionRequiredError
} from './errors'
import type { LimitExceededResponse } from '@/types/relations'

/**
 * Перевіряє axios error та кидає domain error якщо це відомий код
 * 
 * @param err - Unknown error від axios або інший exception
 * @throws Domain error - якщо це відомий error code
 * @throws err - re-throws оригінальну помилку якщо не domain error
 */
export function rethrowAsDomainError(err: unknown): never {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as any
    
    // v2.1: limit_exceeded
    if (data?.code === 'limit_exceeded') {
      throw new LimitExceededError(data.meta)
    }
    
    // v0.62: inquiry errors
    if (data?.code === 'inquiry_already_exists') {
      throw new InquiryAlreadyExistsError(data.meta || {})
    }
    
    if (data?.code === 'inquiry_not_allowed') {
      throw new InquiryNotAllowedError(data.meta || {})
    }
    
    if (data?.code === 'inquiry_invalid_state') {
      throw new InquiryInvalidStateError(data.meta || {})
    }
    
    if (data?.code === 'contact_locked') {
      throw new ContactLockedError(data.meta || {})
    }
    
    // v0.63: subscription/paywall errors
    if (data?.code === 'subscription_required') {
      throw new SubscriptionRequiredError(data.meta || {})
    }
  }
  throw err
}
