export type MarketplaceValidationErrors = Record<string, string[]>

export type MarketplaceApiErrorInfo = {
  status: number | null
  code: string | null
  detail: string | null
  fields: MarketplaceValidationErrors | null
}

import { i18n } from '@/i18n'
import { buildFriendlyErrorSummary } from './validationMessages'

/**
 * Нормалізує вкладені field-errors до плаского Record<string, string[]>,
 * collapse-ячи вкладеність до top-level поля.
 *
 * Backend (DRF nested serializers) повертає різні форми:
 *   { headline: ["required"] }                          → { headline: ["required"] }
 *   { subjects: { code: ["Subject X not found"] } }      → { subjects: ["Subject X not found"] }
 *   { subjects: [ { code: ["msg1"] }, { tags: ["msg2"] } ] } → { subjects: ["msg1","msg2"] }
 *
 * Вкладені ключі (code/tags) НЕ показуються користувачу — він знає поле "subjects",
 * а не "subjects.code". Усі вкладені повідомлення зливаються в масив батьківського поля.
 */
function flattenFieldErrors(raw: Record<string, unknown>): MarketplaceValidationErrors {
  const out: MarketplaceValidationErrors = {}

  const collect = (val: unknown, topKey: string): void => {
    if (Array.isArray(val)) {
      for (const item of val) {
        if (typeof item === 'string') (out[topKey] ??= []).push(item)
        else if (item && typeof item === 'object') collect(item, topKey)
        else if (item != null) (out[topKey] ??= []).push(String(item))
      }
    } else if (typeof val === 'string') {
      (out[topKey] ??= []).push(val)
    } else if (val && typeof val === 'object') {
      for (const v of Object.values(val as Record<string, unknown>)) collect(v, topKey)
    } else if (val != null) {
      (out[topKey] ??= []).push(String(val))
    }
  }

  for (const [k, v] of Object.entries(raw)) {
    if (k === 'detail' || k === 'error') continue
    collect(v, k)
  }
  return out
}

/**
 * Canonical parser для error-відповідей backend.
 *
 * Backend має ДВІ родини error-форматів — цей парсер нормалізує обидві до
 * єдиного MarketplaceApiErrorInfo:
 *
 *   Format B (canonical, apps/core/errors.py exception handler + APIError):
 *     { error: { code, detail, fields? } }
 *   Format A (ручні Response() у views):
 *     { error: 'code_string', fields?, detail?/message? }
 *   + DRF raw fallback:
 *     { field: ["msg"] }
 */
export function parseMarketplaceApiError(err: unknown): MarketplaceApiErrorInfo {
  const anyErr = err as any
  const status = anyErr?.response?.status ?? null
  const data = anyErr?.response?.data

  const errVal = (data && typeof data === 'object') ? (data as any).error : undefined
  // Format B: error — це об'єкт-обгортка { code, detail, fields }
  const wrapper = (errVal && typeof errVal === 'object') ? (errVal as any) : null

  const code = (
    wrapper
      ? (wrapper.code ?? null)
      : (typeof errVal === 'string' ? errVal : (data?.code ?? null))
  ) as string | null

  const detail = (
    wrapper?.detail ?? data?.detail ?? data?.message ?? null
  ) as string | null

  // Витягуємо сирий контейнер field-errors з будь-якого формату.
  let rawFields: Record<string, unknown> | null = null
  if (wrapper && wrapper.fields && typeof wrapper.fields === 'object') {
    rawFields = wrapper.fields // Format B
  } else if ((data as any)?.fields && typeof (data as any).fields === 'object') {
    rawFields = (data as any).fields // Format A
  } else if ((data as any)?.errors && typeof (data as any).errors === 'object') {
    rawFields = (data as any).errors // альтернативний контейнер
  } else if ((status === 400 || status === 422) && data && typeof data === 'object' && !wrapper) {
    // DRF raw { field: [...] } — поля лежать прямо в data
    const skipKeys = new Set(['detail', 'error', 'message', 'code', 'error_code', 'non_field_errors'])
    const candidate: Record<string, unknown> = {}
    let hasFieldErrors = false
    for (const [k, v] of Object.entries(data)) {
      if (skipKeys.has(k)) continue
      if (Array.isArray(v) || typeof v === 'string' || (v && typeof v === 'object')) {
        candidate[k] = v
        hasFieldErrors = true
      }
    }
    if (hasFieldErrors) rawFields = candidate
  }

  const flat = rawFields ? flattenFieldErrors(rawFields) : null
  const fields = flat && Object.keys(flat).length ? flat : null

  return { status, code, detail, fields }
}

export function mapMarketplaceErrorToMessage(info: MarketplaceApiErrorInfo, fallback: string): string {
  const t = (key: string, fb?: string): string => {
    try {
      const res = (i18n as any)?.global?.t?.(key)
      if (res && res !== key) return res
      return fb ?? key
    } catch (_err) {
      return fb ?? key
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
  if (info.status === 400 || info.status === 422 || info.code === 'validation_failed' || info.code === 'VALIDATION_ERROR') {
    // If we have per-field errors, show them; otherwise show generic message
    if (info.fields) {
      // Special case: status=not_approved is a moderation gate, not a field validation error
      if (info.fields.status?.includes('not_approved')) {
        return t('marketplace.errors.statusNotApproved')
      }
      // Friendly, localized per-field summary (label + перекладене повідомлення)
      const lines = buildFriendlyErrorSummary(info.fields, t, 3)
      if (lines.length > 0) return lines.join('\n')
      return t('marketplace.errors.validation')
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
