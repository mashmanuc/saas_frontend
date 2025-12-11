/**
 * Global API Error Map — v0.13.0
 * Централізована обробка помилок HTTP та WebSocket
 * Підтримка нового REST error format v2:
 * { "error": { "code": "...", "detail": "...", "fields": {...} } }
 */

import { i18n } from '../../i18n'

const t = (key, params) => {
  try {
    return i18n.global?.t?.(key, params) ?? key
  } catch {
    return key
  }
}

/**
 * HTTP Status Code → User-friendly message mapping
 */
export const HTTP_ERROR_MAP = Object.freeze({
  400: () => t('errors.http.badRequest'),
  401: () => t('errors.http.unauthorized'),
  403: () => t('errors.http.forbidden'),
  404: () => t('errors.http.notFound'),
  408: () => t('errors.http.timeout'),
  409: () => t('errors.http.conflict'),
  422: () => t('errors.http.validation'),
  429: () => t('errors.http.rateLimit'),
  500: () => t('errors.http.serverError'),
  502: () => t('errors.http.badGateway'),
  503: () => t('errors.http.serviceUnavailable'),
  504: () => t('errors.http.gatewayTimeout'),
})

/**
 * Error codes from backend → User-friendly message
 */
export const API_ERROR_CODES = Object.freeze({
  // Auth
  invalid_credentials: () => t('errors.api.invalidCredentials'),
  token_expired: () => t('errors.api.tokenExpired'),
  token_invalid: () => t('errors.api.tokenInvalid'),
  session_expired: () => t('errors.api.sessionExpired'),
  
  // Validation
  validation_error: () => t('errors.api.validationError'),
  field_required: (field) => t('errors.api.fieldRequired', { field }),
  invalid_format: () => t('errors.api.invalidFormat'),
  
  // Relations
  relation_not_found: () => t('errors.api.relationNotFound'),
  relation_already_exists: () => t('errors.api.relationAlreadyExists'),
  cannot_invite_self: () => t('errors.api.cannotInviteSelf'),
  
  // Lessons
  lesson_not_found: () => t('errors.api.lessonNotFound'),
  lesson_already_cancelled: () => t('errors.api.lessonAlreadyCancelled'),
  invalid_schedule_time: () => t('errors.api.invalidScheduleTime'),
  
  // Chat
  message_not_found: () => t('errors.api.messageNotFound'),
  message_edit_forbidden: () => t('errors.api.messageEditForbidden'),
  
  // Generic
  not_found: () => t('errors.api.notFound'),
  permission_denied: () => t('errors.api.permissionDenied'),
  rate_limited: () => t('errors.api.rateLimited'),
  server_error: () => t('errors.api.serverError'),
})

/**
 * Network/offline error messages
 */
export const NETWORK_ERRORS = Object.freeze({
  offline: () => t('errors.network.offline'),
  timeout: () => t('errors.network.timeout'),
  connection_refused: () => t('errors.network.connectionRefused'),
  dns_error: () => t('errors.network.dnsError'),
  ssl_error: () => t('errors.network.sslError'),
})

/**
 * Parse error from Axios response
 * @param {Error} error - Axios error object
 * @returns {{ message: string, code: string|null, status: number|null, isOffline: boolean }}
 */
export function parseApiError(error) {
  // Network error (no response)
  if (!error?.response) {
    const isOffline = !navigator.onLine || error?.code === 'ERR_NETWORK'
    return {
      message: isOffline ? NETWORK_ERRORS.offline() : NETWORK_ERRORS.connection_refused(),
      code: isOffline ? 'offline' : 'network_error',
      status: null,
      isOffline,
    }
  }

  const { status, data } = error.response
  
  // Support new error format v2: { error: { code, detail, fields } }
  const errorObj = data?.error || data
  const backendCode = errorObj?.code || data?.error_code || null
  const backendDetail = errorObj?.detail || data?.message || null
  const fieldErrors = errorObj?.fields || data?.fields || null

  // Try backend error code first (normalize to snake_case)
  const normalizedCode = backendCode?.toLowerCase?.()?.replace(/-/g, '_') || null
  if (normalizedCode && API_ERROR_CODES[normalizedCode]) {
    return {
      message: API_ERROR_CODES[normalizedCode](),
      code: normalizedCode,
      status,
      isOffline: false,
      fieldErrors,
    }
  }

  // Use backend detail if available
  if (backendDetail && typeof backendDetail === 'string') {
    return {
      message: backendDetail,
      code: normalizedCode || backendCode,
      status,
      isOffline: false,
      fieldErrors,
    }
  }

  // Fallback to HTTP status
  const httpMessage = HTTP_ERROR_MAP[status]?.() || t('errors.http.unknown')
  return {
    message: httpMessage,
    code: `http_${status}`,
    status,
    isOffline: false,
    fieldErrors,
  }
}

/**
 * Check if error is retryable
 * @param {Error} error
 * @returns {boolean}
 */
export function isRetryableError(error) {
  if (!error?.response) return true // Network errors are retryable
  const status = error.response.status
  return status === 408 || status === 429 || status >= 500
}

/**
 * Check if error requires re-authentication
 * @param {Error} error
 * @returns {boolean}
 */
export function isAuthError(error) {
  if (!error?.response) return false
  const status = error.response.status
  const code = error.response.data?.code
  return status === 401 || code === 'token_expired' || code === 'token_invalid'
}

/**
 * Format validation errors from backend
 * @param {object} data - Response data with field errors
 * @returns {Record<string, string>}
 */
export function formatValidationErrors(data) {
  if (!data || typeof data !== 'object') return {}
  
  const errors = {}
  const fieldErrors = data.errors || data.field_errors || data
  
  Object.entries(fieldErrors).forEach(([field, messages]) => {
    if (Array.isArray(messages)) {
      errors[field] = messages[0]
    } else if (typeof messages === 'string') {
      errors[field] = messages
    }
  })
  
  return errors
}

export default {
  HTTP_ERROR_MAP,
  API_ERROR_CODES,
  NETWORK_ERRORS,
  parseApiError,
  isRetryableError,
  isAuthError,
  formatValidationErrors,
}
