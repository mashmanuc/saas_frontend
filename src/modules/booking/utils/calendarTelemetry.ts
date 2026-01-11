/**
 * Calendar-specific telemetry helpers
 * Centralized logging for calendar operations
 */

import { trackAction, trackError } from '@/utils/telemetry'

export interface CalendarEventMeta {
  tutorId?: number
  eventId?: number
  weekStart?: string
  operation?: string
  duration_ms?: number
  [key: string]: any
}

/**
 * Log calendar event operation (create/delete/update/fetch)
 */
export function logCalendarEvent(
  action: string,
  meta: CalendarEventMeta = {},
  metrics?: Record<string, number>
): void {
  const context = {
    module: 'calendar',
    action,
    ...meta,
  }

  trackAction(`calendar_${action}`, context, metrics)

  // Console log for development
  if (import.meta.env.DEV) {
    console.info(`[Calendar Telemetry] ${action}`, context, metrics)
  }
}

/**
 * Log calendar error
 */
export function logCalendarError(
  operation: string,
  error: Error | string,
  meta: CalendarEventMeta = {}
): void {
  const errorMessage = error instanceof Error ? error.message : error
  const context = {
    module: 'calendar',
    operation,
    error: errorMessage,
    ...meta,
  }

  trackError(errorMessage, context)

  // Console error for development
  console.error(`[Calendar Error] ${operation}:`, errorMessage, meta)
}

/**
 * Measure operation duration
 */
export function measureCalendarOperation<T>(
  operation: string,
  fn: () => Promise<T>,
  meta: CalendarEventMeta = {}
): Promise<T> {
  const startTime = performance.now()

  return fn()
    .then((result) => {
      const duration_ms = Math.round(performance.now() - startTime)
      logCalendarEvent(operation, meta, { duration_ms })
      return result
    })
    .catch((error) => {
      const duration_ms = Math.round(performance.now() - startTime)
      logCalendarError(operation, error, { ...meta, duration_ms })
      throw error
    })
}
