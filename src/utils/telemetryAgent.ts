/**
 * Telemetry agent SDK for buffering and batching events
 */

import apiClient from './apiClient'

export interface TelemetryEvent {
  event_type: string
  timestamp: number
  context: Record<string, any>
  metrics?: Record<string, number>
}

export function trackEvent(
  eventType: string,
  context: Record<string, any> = {},
  metrics?: Record<string, number>
): void {
  if (!eventType) return
  track({
    event_type: eventType,
    context,
    metrics,
  })
}

interface TelemetryBatch {
  events: TelemetryEvent[]
  session_id: string | null
  request_id: string
}

const MAX_BUFFER_SIZE = 50
const MAX_PAYLOAD_SIZE = 100 * 1024 // 100KB
const FLUSH_INTERVAL_MS = 10000 // 10 seconds
const RATE_LIMIT_PER_MIN = 10

let eventBuffer: TelemetryEvent[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null
let requestCount = 0
let requestResetTimer: ReturnType<typeof setTimeout> | null = null

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

function getSessionId(): string | null {
  try {
    const access = localStorage.getItem('access')
    if (!access) return null
    // Extract session from JWT payload (simplified)
    const parts = access.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(atob(parts[1]))
    return payload?.session_id || null
  } catch {
    return null
  }
}

function estimatePayloadSize(batch: TelemetryBatch): number {
  try {
    return JSON.stringify(batch).length
  } catch {
    return 0
  }
}

async function sendBatch(batch: TelemetryBatch): Promise<void> {
  try {
    // Check rate limit
    if (requestCount >= RATE_LIMIT_PER_MIN) {
      console.warn('[Telemetry] Rate limit reached, dropping batch')
      return
    }

    requestCount++
    if (!requestResetTimer) {
      requestResetTimer = setTimeout(() => {
        requestCount = 0
        requestResetTimer = null
      }, 60000)
    }

    await apiClient.post('/v1/telemetry/events', batch)
  } catch (err: any) {
    const status = err?.response?.status
    if (status === 413) {
      console.error('[Telemetry] Payload too large')
    } else if (status === 429) {
      console.warn('[Telemetry] Rate limited')
    } else {
      console.error('[Telemetry] Failed to send batch:', err)
    }
  }
}

function scheduleFlush(): void {
  if (flushTimer) {
    clearTimeout(flushTimer)
  }
  flushTimer = setTimeout(() => {
    flush()
  }, FLUSH_INTERVAL_MS)
}

export function track(event: Omit<TelemetryEvent, 'timestamp'>): void {
  const fullEvent: TelemetryEvent = {
    ...event,
    timestamp: Date.now(),
  }

  eventBuffer.push(fullEvent)

  if (eventBuffer.length >= MAX_BUFFER_SIZE) {
    flush()
  } else {
    scheduleFlush()
  }
}

export async function flush(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }

  if (eventBuffer.length === 0) return

  const batch: TelemetryBatch = {
    events: eventBuffer.slice(0, MAX_BUFFER_SIZE),
    session_id: getSessionId(),
    request_id: generateRequestId(),
  }

  const size = estimatePayloadSize(batch)
  if (size > MAX_PAYLOAD_SIZE) {
    console.warn('[Telemetry] Batch too large, splitting')
    const half = Math.floor(batch.events.length / 2)
    const firstBatch: TelemetryBatch = {
      events: batch.events.slice(0, half),
      session_id: batch.session_id,
      request_id: generateRequestId(),
    }
    const secondBatch: TelemetryBatch = {
      events: batch.events.slice(half),
      session_id: batch.session_id,
      request_id: generateRequestId(),
    }
    
    eventBuffer = eventBuffer.slice(MAX_BUFFER_SIZE)
    
    await sendBatch(firstBatch)
    await sendBatch(secondBatch)
  } else {
    eventBuffer = eventBuffer.slice(MAX_BUFFER_SIZE)
    await sendBatch(batch)
  }

  if (eventBuffer.length > 0) {
    scheduleFlush()
  }
}

export function trackPageView(path: string, context?: Record<string, any>): void {
  track({
    event_type: 'page_view',
    context: {
      path,
      ...context,
    },
  })
}

export function trackAction(action: string, context?: Record<string, any>, metrics?: Record<string, number>): void {
  track({
    event_type: 'user_action',
    context: {
      action,
      ...context,
    },
    metrics,
  })
}

export function trackError(error: string, context?: Record<string, any>): void {
  track({
    event_type: 'error',
    context: {
      error,
      ...context,
    },
  })
}

// Auto-flush on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    flush()
  })
}
