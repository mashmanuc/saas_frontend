/**
 * WebSocket Error Handler — v0.13.0
 * Обробка WS помилок з кодами: WS_TIMEOUT, WS_INVALID_CHANNEL, WS_FORBIDDEN
 */

import { i18n } from '../../i18n'
import { notifyError, notifyWarning } from '../../utils/notify'

const t = (key, params) => {
  try {
    return i18n.global?.t?.(key, params) ?? key
  } catch {
    return key
  }
}

/**
 * WebSocket error codes → User-friendly messages
 */
export const WS_ERROR_CODES = Object.freeze({
  WS_TIMEOUT: () => t('errors.websocket.timeout'),
  WS_INVALID_CHANNEL: () => t('errors.websocket.invalidChannel'),
  WS_FORBIDDEN: () => t('errors.websocket.forbidden'),
  WS_UNAUTHORIZED: () => t('errors.websocket.unauthorized'),
  WS_RATE_LIMITED: () => t('errors.websocket.rateLimited'),
  WS_MALFORMED_JSON: () => t('errors.websocket.malformedJson'),
  WS_SERVER_ERROR: () => t('errors.websocket.serverError'),
})

/**
 * Parse WebSocket error payload
 * @param {object} payload - WS error message
 * @returns {{ code: string, message: string, isRecoverable: boolean }}
 */
export function parseWsError(payload) {
  if (!payload) {
    return {
      code: 'unknown',
      message: t('errors.websocket.unknown'),
      isRecoverable: true,
    }
  }

  const code = payload.code || payload.error_code || payload.type || 'unknown'
  const normalizedCode = code.toUpperCase().replace(/-/g, '_')
  
  // Check if we have a mapped message
  const messageFn = WS_ERROR_CODES[normalizedCode]
  const message = messageFn?.() || payload.detail || payload.message || t('errors.websocket.unknown')
  
  // Determine if error is recoverable
  const isRecoverable = !['WS_FORBIDDEN', 'WS_UNAUTHORIZED'].includes(normalizedCode)
  
  return {
    code: normalizedCode,
    message,
    isRecoverable,
    originalPayload: payload,
  }
}

/**
 * Handle WebSocket error with appropriate notification
 * @param {object} payload - WS error message
 * @param {object} options - Handler options
 * @returns {{ code: string, message: string, isRecoverable: boolean }}
 */
export function handleWsError(payload, options = {}) {
  const { silent = false, onForbidden, onUnauthorized } = options
  const parsed = parseWsError(payload)
  
  // Handle specific error types
  if (parsed.code === 'WS_FORBIDDEN') {
    onForbidden?.(parsed)
    if (!silent) {
      notifyError(parsed.message)
    }
    return parsed
  }
  
  if (parsed.code === 'WS_UNAUTHORIZED') {
    onUnauthorized?.(parsed)
    if (!silent) {
      notifyWarning(parsed.message)
    }
    return parsed
  }
  
  if (parsed.code === 'WS_TIMEOUT') {
    // Timeout is usually recoverable, just warn
    if (!silent) {
      notifyWarning(parsed.message)
    }
    return parsed
  }
  
  if (parsed.code === 'WS_INVALID_CHANNEL') {
    // Invalid channel subscription - log but don't spam user
    console.warn('[WS] Invalid channel:', payload)
    return parsed
  }
  
  // Generic error notification
  if (!silent) {
    notifyError(parsed.message)
  }
  
  return parsed
}

/**
 * Create a WS error handler bound to realtime service
 * @param {object} realtimeService
 * @param {object} options
 * @returns {Function} cleanup function
 */
export function createWsErrorListener(realtimeService, options = {}) {
  const handler = (payload) => {
    if (payload?.type === 'error' || payload?.error) {
      handleWsError(payload.error || payload, options)
    }
  }
  
  const unsubscribe = realtimeService.on('error', handler)
  
  // Also listen for message-level errors
  const messageHandler = (data) => {
    if (data?.type === 'error') {
      handleWsError(data, options)
    }
  }
  
  const unsubscribeMessage = realtimeService.on('message', messageHandler)
  
  return () => {
    unsubscribe?.()
    unsubscribeMessage?.()
  }
}

export default {
  WS_ERROR_CODES,
  parseWsError,
  handleWsError,
  createWsErrorListener,
}
