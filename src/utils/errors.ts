/**
 * Domain errors for Relations API v2.1 + v0.62
 * Based on FRONTEND_TASKS_v2.1.md and v0.62 specification
 */

export class LimitExceededError extends Error {
  constructor(
    public meta: {
      limit_type: string
      used: number
      max: number
      reset_at: string
    }
  ) {
    super('Limit exceeded')
    this.name = 'LimitExceededError'
  }
}

export function isLimitExceededError(error: any): error is LimitExceededError {
  return error instanceof LimitExceededError
}

/**
 * v0.62: Inquiry domain errors
 */
export class InquiryAlreadyExistsError extends Error {
  constructor(public meta: { relation_id?: string; [key: string]: unknown }) {
    super('Inquiry already exists for this relation')
    this.name = 'InquiryAlreadyExistsError'
  }
}

export class InquiryNotAllowedError extends Error {
  constructor(public meta: { reason?: string; [key: string]: unknown }) {
    super('Inquiry not allowed')
    this.name = 'InquiryNotAllowedError'
  }
}

export class InquiryInvalidStateError extends Error {
  constructor(public meta: { inquiry_id?: string; current_state?: string; [key: string]: unknown }) {
    super('Invalid inquiry state for this operation')
    this.name = 'InquiryInvalidStateError'
  }
}

export class ContactLockedError extends Error {
  constructor(public meta: { locked_reason?: string; [key: string]: unknown }) {
    super('Contact access is locked')
    this.name = 'ContactLockedError'
  }
}

/**
 * v0.63: Subscription/Paywall errors
 */
export class SubscriptionRequiredError extends Error {
  constructor(public meta: { feature?: string; required_plan?: string; [key: string]: unknown }) {
    super('Subscription required for this feature')
    this.name = 'SubscriptionRequiredError'
  }
}

/**
 * v0.66: Trust & Safety errors
 */
export class UserBannedError extends Error {
  constructor(
    public meta: {
      scope: string
      ends_at: string | null
      reason?: string
    }
  ) {
    super(`User is banned from ${meta.scope}`)
    this.name = 'UserBannedError'
  }
}

export class UserBlockedError extends Error {
  constructor(
    public meta: {
      blocked_user_id?: number
      blocker_user_id?: number
    }
  ) {
    super('User is blocked')
    this.name = 'UserBlockedError'
  }
}

export class RateLimitedError extends Error {
  constructor(
    public meta: {
      retry_after_seconds: number
      limit_display?: string
    }
  ) {
    super(`Rate limited. Retry after ${meta.retry_after_seconds} seconds`)
    this.name = 'RateLimitedError'
  }
}
