/**
 * Board sync diagnostics integration.
 */
import { diagnosticsApi } from '../api/diagnostics'

export function useBoardDiagnostics(sessionId: string) {
  /**
   * Log version conflict.
   */
  function logVersionConflict(
    clientVersion: number,
    serverVersion: number,
    operationId?: string
  ): void {
    diagnosticsApi.queueError({
      severity: 'warning',
      message: 'Board version conflict',
      url: window.location.href,
      sessionId,
      appVersion: (import.meta.env.VITE_APP_VERSION as string) || 'unknown',
      context: {
        service: 'classroom.board',
        clientVersion,
        serverVersion,
        operationId,
        versionDiff: serverVersion - clientVersion,
      },
    })
  }

  /**
   * Log dropped event.
   */
  function logDroppedEvent(
    eventType: string,
    reason: string,
    eventData?: unknown
  ): void {
    diagnosticsApi.queueError({
      severity: 'warning',
      message: `Board event dropped: ${reason}`,
      url: window.location.href,
      sessionId,
      appVersion: (import.meta.env.VITE_APP_VERSION as string) || 'unknown',
      context: {
        service: 'classroom.board',
        eventType,
        reason,
        eventDataKeys: eventData && typeof eventData === 'object' ? Object.keys(eventData) : [],
      },
    })
  }

  /**
   * Log payload parse error.
   */
  function logPayloadError(error: Error, rawPayload?: string): void {
    diagnosticsApi.queueError({
      severity: 'error',
      message: `Board payload parse error: ${error.message}`,
      stack: error.stack,
      url: window.location.href,
      sessionId,
      appVersion: (import.meta.env.VITE_APP_VERSION as string) || 'unknown',
      context: {
        service: 'classroom.board',
        errorName: error.name,
        payloadLength: rawPayload?.length,
      },
    })
  }

  /**
   * Log sync state recovery.
   */
  function logSyncRecovery(
    fromVersion: number,
    toVersion: number,
    method: 'snapshot' | 'events'
  ): void {
    diagnosticsApi.queueError({
      severity: 'info',
      message: `Board sync recovered: ${method}`,
      url: window.location.href,
      sessionId,
      appVersion: (import.meta.env.VITE_APP_VERSION as string) || 'unknown',
      context: {
        service: 'classroom.board',
        fromVersion,
        toVersion,
        recoveryMethod: method,
      },
    })
  }

  /**
   * Log WebSocket error.
   */
  function logWebSocketError(
    channel: 'webrtc' | 'board' | 'system',
    error: Event | Error | string,
    context?: Record<string, unknown>
  ): void {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : 'WebSocket error'

    diagnosticsApi.queueError({
      severity: 'error',
      message: `WebSocket error (${channel}): ${message}`,
      stack: error instanceof Error ? error.stack : undefined,
      url: window.location.href,
      sessionId,
      appVersion: (import.meta.env.VITE_APP_VERSION as string) || 'unknown',
      context: {
        service: `classroom.${channel}`,
        channel,
        ...context,
      },
    })
  }

  /**
   * Log WebSocket close with error.
   */
  function logWebSocketClose(
    channel: 'webrtc' | 'board' | 'system',
    code: number,
    reason: string,
    reconnectAttempts?: number
  ): void {
    // Only log abnormal closures
    if (code >= 4000 || (code !== 1000 && code !== 1001)) {
      diagnosticsApi.queueError({
        severity: 'warning',
        message: `WebSocket closed (${channel}): code=${code} reason=${reason}`,
        url: window.location.href,
        sessionId,
        appVersion: (import.meta.env.VITE_APP_VERSION as string) || 'unknown',
        context: {
          service: `classroom.${channel}`,
          channel,
          closeCode: code,
          closeReason: reason,
          reconnectAttempts,
        },
      })
    }
  }

  /**
   * Log unexpected message type.
   */
  function logUnexpectedMessage(
    channel: 'webrtc' | 'board' | 'system',
    messageType: string,
    data?: unknown
  ): void {
    diagnosticsApi.queueError({
      severity: 'warning',
      message: `Unexpected WebSocket message type: ${messageType}`,
      url: window.location.href,
      sessionId,
      appVersion: (import.meta.env.VITE_APP_VERSION as string) || 'unknown',
      context: {
        service: `classroom.${channel}`,
        channel,
        messageType,
        dataKeys: data && typeof data === 'object' ? Object.keys(data) : [],
      },
    })
  }

  return {
    logVersionConflict,
    logDroppedEvent,
    logPayloadError,
    logSyncRecovery,
    logWebSocketError,
    logWebSocketClose,
    logUnexpectedMessage,
  }
}
