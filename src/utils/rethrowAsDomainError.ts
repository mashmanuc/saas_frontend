import axios, { AxiosError } from 'axios'

import {
  LimitExceededError,
  InquiryAlreadyExistsError,
  InquiryNotAllowedError,
  InquiryInvalidStateError,
  ContactLockedError,
  SubscriptionRequiredError,
  UserBannedError,
  UserBlockedError,
  RateLimitedError,
} from '@/utils/errors'

type ApiErrorPayload = {
  code?: string
  message?: string
  meta?: Record<string, any>
  [key: string]: any
}

type DomainErrorFactory = (payload: ApiErrorPayload) => Error

const extractMeta = (payload: ApiErrorPayload): Record<string, any> => {
  if (payload.meta && typeof payload.meta === 'object') {
    return payload.meta
  }
  if (payload.details && typeof payload.details === 'object') {
    return payload.details as Record<string, any>
  }
  return {}
}

const toLimitMeta = (payload: ApiErrorPayload) => ({
  limit_type: payload.meta?.limit_type ?? payload.limit_type ?? 'unknown',
  used: payload.meta?.used ?? payload.used ?? 0,
  max: payload.meta?.max ?? payload.max ?? 0,
  reset_at: payload.meta?.reset_at ?? payload.reset_at ?? '',
})

const toRateLimitMeta = (payload: ApiErrorPayload) => ({
  retry_after_seconds:
    payload.meta?.retry_after_seconds ??
    payload.retry_after_seconds ??
    payload.meta?.retry_after ??
    payload.retry_after ??
    0,
  limit_display: payload.meta?.limit_display ?? payload.limit_display,
})

const toBanMeta = (payload: ApiErrorPayload) => ({
  scope: payload.meta?.scope ?? payload.scope ?? 'unknown',
  ends_at: payload.meta?.ends_at ?? payload.ends_at ?? null,
  reason: payload.meta?.reason ?? payload.reason,
})

const toBlockMeta = (payload: ApiErrorPayload) => ({
  blocked_user_id:
    payload.meta?.blocked_user_id ?? payload.blocked_user_id ?? undefined,
  blocker_user_id:
    payload.meta?.blocker_user_id ?? payload.blocker_user_id ?? undefined,
})

const DOMAIN_ERROR_FACTORIES: Record<string, DomainErrorFactory> = {
  limit_exceeded: (payload) => new LimitExceededError(toLimitMeta(payload)),
  inquiry_already_exists: (payload) =>
    new InquiryAlreadyExistsError(extractMeta(payload)),
  inquiry_not_allowed: (payload) =>
    new InquiryNotAllowedError(extractMeta(payload)),
  inquiry_invalid_state: (payload) =>
    new InquiryInvalidStateError(extractMeta(payload)),
  contact_locked: (payload) => new ContactLockedError(extractMeta(payload)),
  subscription_required: (payload) =>
    new SubscriptionRequiredError(extractMeta(payload)),
  user_banned: (payload) => new UserBannedError(toBanMeta(payload)),
  user_blocked: (payload) => new UserBlockedError(toBlockMeta(payload)),
  rate_limited: (payload) => new RateLimitedError(toRateLimitMeta(payload)),
  // Phase 1 v0.86 error codes
  INQUIRY_NOT_FOUND: (payload) =>
    new InquiryInvalidStateError(extractMeta(payload)),
  PERMISSION_DENIED: (payload) =>
    new InquiryNotAllowedError(extractMeta(payload)),
  INQUIRY_ALREADY_PROCESSED: (payload) =>
    new InquiryInvalidStateError(extractMeta(payload)),
  VALIDATION_ERROR: (payload) =>
    new InquiryInvalidStateError(extractMeta(payload)),
  CANNOT_CANCEL_PROCESSED: (payload) =>
    new InquiryInvalidStateError(extractMeta(payload)),
  // Phase 2.2 error codes
  INQUIRY_COOLDOWN_ACTIVE: (payload) =>
    new InquiryNotAllowedError(extractMeta(payload)),
  STUDENT_ACTIVE_LIMIT_REACHED: (payload) =>
    new InquiryNotAllowedError(extractMeta(payload)),
}

const buildDefaultError = (
  err: AxiosError,
  payload: ApiErrorPayload,
): Error => {
  if (err.response?.status === 429) {
    const retryAfter =
      Number(err.response.headers?.['retry-after']) ||
      payload.meta?.retry_after_seconds ||
      0
    const limitDisplay = payload.meta?.limit_display || payload.limit_display
    return new RateLimitedError({ 
      retry_after_seconds: retryAfter,
      limit_display: limitDisplay
    })
  }

  const message =
    payload.message ||
    err.message ||
    err.response?.statusText ||
    'Unknown server error'

  return new Error(message)
}

export function rethrowAsDomainError(error: unknown): never {
  if (axios.isAxiosError(error)) {
    const payload = (error.response?.data ?? {}) as ApiErrorPayload
    const code = payload.code

    if (code && DOMAIN_ERROR_FACTORIES[code]) {
      throw DOMAIN_ERROR_FACTORIES[code](payload)
    }

    throw buildDefaultError(error, payload)
  }

  if (error instanceof Error) {
    throw error
  }

  throw new Error(String(error))
}

export default rethrowAsDomainError
