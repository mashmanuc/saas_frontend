export type MarketplaceValidationErrors = Record<string, string[]>

export type MarketplaceApiErrorInfo = {
  status: number | null
  code: string | null
  detail: string | null
  fields: MarketplaceValidationErrors | null
}

import { i18n } from '@/i18n'

export function parseMarketplaceApiError(err: unknown): MarketplaceApiErrorInfo {
  const anyErr = err as any
  const status = anyErr?.response?.status ?? null
  const data = anyErr?.response?.data

  const code = (data?.error ?? data?.code ?? null) as string | null
  const detail = (data?.detail ?? data?.message ?? null) as string | null

  let fields: MarketplaceValidationErrors | null = null
  // DRF ValidationError returns 400 (not 422). Parse field errors for both.
  if ((status === 400 || status === 422) && data && typeof data === 'object') {
    // Try structured containers first: data.fields, data.errors
    let raw = (data as any).fields && typeof (data as any).fields === 'object'
      ? (data as any).fields
      : (data as any).errors && typeof (data as any).errors === 'object'
        ? (data as any).errors
        : null

    // DRF default: validation errors are directly in data (e.g. { "headline": ["This field is required."] })
    if (!raw) {
      const skipKeys = new Set(['detail', 'error', 'message', 'code', 'error_code', 'non_field_errors'])
      const candidate: Record<string, unknown> = {}
      let hasFieldErrors = false
      for (const [k, v] of Object.entries(data)) {
        if (skipKeys.has(k)) continue
        if (Array.isArray(v) || typeof v === 'string') {
          candidate[k] = v
          hasFieldErrors = true
        }
      }
      if (hasFieldErrors) raw = candidate
    }

    if (raw && typeof raw === 'object') {
      const next: MarketplaceValidationErrors = {}
      for (const [k, v] of Object.entries(raw)) {
        if (k === 'detail' || k === 'error') continue
        if (Array.isArray(v)) next[k] = v.map((x) => String(x))
        else if (typeof v === 'string') next[k] = [v]
        else if (v != null) next[k] = [JSON.stringify(v)]
      }
      fields = Object.keys(next).length ? next : null
    }
  }

  return { status, code, detail, fields }
}

export function mapMarketplaceErrorToMessage(info: MarketplaceApiErrorInfo, fallback: string): string {
  const t = (key: string): string => {
    try {
      return (i18n as any)?.global?.t?.(key) ?? key
    } catch (_err) {
      return key
    }
  }

  // v0.83.0: Onboarding-specific error codes
  if (info.code === 'profile_missing' || info.code === 'profile_not_created') {
    // Don't show error banner - show create prompt instead
    return ''
  }
  if (info.code === 'profile_incomplete') {
    return t('marketplace.errors.profileIncomplete')
  }
  if (info.code === 'pending_review') {
    return t('marketplace.errors.pendingReview')
  }
  if (info.code === 'profile_suspended') {
    return t('marketplace.errors.profileSuspended')
  }

  // Existing error codes — DRF uses 400 for ValidationError, not 422
  if (info.status === 400 || info.status === 422 || info.code === 'validation_failed') {
    // If we have per-field errors, show them; otherwise show generic message
    if (info.fields) {
      const fieldMessages = Object.entries(info.fields)
        .map(([field, msgs]) => `${field}: ${msgs.join(', ')}`)
        .slice(0, 3) // max 3 fields to avoid huge toast
      return fieldMessages.join('\n') || t('marketplace.errors.validation')
    }
    return t('marketplace.errors.validation')
  }
  if (info.status === 409 || info.code === 'slot_conflict') {
    return t('marketplace.errors.slotConflict')
  }
  if (info.status === 429 || info.code === 'rate_limited') {
    return t('marketplace.errors.rateLimited')
  }
  if (info.status === 413 || info.code === 'payload_too_large') {
    return t('marketplace.errors.payloadTooLarge')
  }
  if (info.status === 403 || info.code === 'forbidden') {
    return t('marketplace.errors.forbidden')
  }
  if (typeof info.status === 'number' && info.status >= 500) {
    return t('marketplace.errors.serverError')
  }
  return info.detail || fallback
}
