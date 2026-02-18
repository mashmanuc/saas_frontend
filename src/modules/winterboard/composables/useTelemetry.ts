// WB: Telemetry composable for Winterboard
// Ref: TASK_BOARD C3.1, ManifestWinterboard_v2.md
// Collects FE metrics and sends in batches every 30 seconds.
// Graceful: never crashes on send failure, logs warning only.
// Beacon on beforeunload for final batch.

import { ref, onUnmounted, type Ref } from 'vue'
import { winterboardApi } from '../api/winterboardApi'
import type { WBToolType } from '../types/winterboard'

// ── Config ─────────────────────────────────────────────────────────────

const FLUSH_INTERVAL_MS = 30_000  // 30 seconds
const MAX_BUFFER_SIZE = 200       // Flush early if buffer exceeds this

// ── Types ──────────────────────────────────────────────────────────────

interface TelemetryEvent {
  event_type: string
  timestamp: string
  session_id: string | null
  payload: Record<string, unknown>
}

export interface TelemetryMetrics {
  strokeCount: number
  saveLatencyMs: number[]
  errorCount: number
  sessionDurationS: number
  toolUsage: Record<string, number>
  pageCount: number
  undoRedoCount: number
}

export interface TelemetryReturn {
  /** Current accumulated metrics */
  metrics: Ref<TelemetryMetrics>
  /** Track a stroke added */
  trackStroke: () => void
  /** Track save latency (ms from dirty → saved) */
  trackSaveLatency: (ms: number) => void
  /** Track an error */
  trackError: (errorType?: string) => void
  /** Track tool usage */
  trackToolUse: (tool: WBToolType) => void
  /** Track page count change */
  trackPageCount: (count: number) => void
  /** Track undo or redo */
  trackUndoRedo: () => void
  /** Send a custom event */
  trackCustom: (eventType: string, payload?: Record<string, unknown>) => void
  /** Force flush all buffered events */
  flush: () => Promise<void>
  /** Destroy — cleanup timers and listeners */
  destroy: () => void
}

// ── Composable ─────────────────────────────────────────────────────────

export function useTelemetry(sessionId: Ref<string | null>): TelemetryReturn {
  const metrics = ref<TelemetryMetrics>({
    strokeCount: 0,
    saveLatencyMs: [],
    errorCount: 0,
    sessionDurationS: 0,
    toolUsage: {},
    pageCount: 1,
    undoRedoCount: 0,
  })

  // Internal buffer
  let buffer: TelemetryEvent[] = []
  let flushTimer: ReturnType<typeof setInterval> | null = null
  let durationTimer: ReturnType<typeof setInterval> | null = null
  const mountedAt = Date.now()
  let destroyed = false

  // ── Helpers ────────────────────────────────────────────────────────

  function nowISO(): string {
    return new Date().toISOString()
  }

  function pushEvent(eventType: string, payload: Record<string, unknown> = {}): void {
    if (destroyed) return

    buffer.push({
      event_type: eventType,
      timestamp: nowISO(),
      session_id: sessionId.value,
      payload,
    })

    // Flush early if buffer is large
    if (buffer.length >= MAX_BUFFER_SIZE) {
      doFlush()
    }
  }

  // ── Flush logic ────────────────────────────────────────────────────

  async function doFlush(): Promise<void> {
    if (buffer.length === 0) return

    const batch = [...buffer]
    buffer = []

    const ok = await winterboardApi.ingestTelemetry(batch)
    if (!ok) {
      if (import.meta.env?.DEV) {
        console.warn(`[WB:telemetry] Failed to send ${batch.length} events`)
      }
      // Don't re-add to buffer — graceful drop
    } else if (import.meta.env?.DEV) {
      console.log(`[WB:telemetry] Sent ${batch.length} events`)
    }
  }

  function beaconFlush(): void {
    if (buffer.length === 0) return

    // Add session summary event
    pushEvent('session.summary', {
      stroke_count: metrics.value.strokeCount,
      error_count: metrics.value.errorCount,
      session_duration_s: Math.round((Date.now() - mountedAt) / 1000),
      tool_usage: { ...metrics.value.toolUsage },
      page_count: metrics.value.pageCount,
      undo_redo_count: metrics.value.undoRedoCount,
      avg_save_latency_ms: metrics.value.saveLatencyMs.length > 0
        ? Math.round(
            metrics.value.saveLatencyMs.reduce((a, b) => a + b, 0) /
            metrics.value.saveLatencyMs.length,
          )
        : null,
    })

    const batch = [...buffer]
    buffer = []
    winterboardApi.beaconTelemetry(batch)
  }

  // ── Tracking methods ───────────────────────────────────────────────

  function trackStroke(): void {
    metrics.value.strokeCount++
    pushEvent('stroke.added', { total: metrics.value.strokeCount })
  }

  function trackSaveLatency(ms: number): void {
    metrics.value.saveLatencyMs.push(ms)
    pushEvent('save.latency', { latency_ms: ms })
  }

  function trackError(errorType?: string): void {
    metrics.value.errorCount++
    pushEvent('error.occurred', {
      error_type: errorType || 'unknown',
      total: metrics.value.errorCount,
    })
  }

  function trackToolUse(tool: WBToolType): void {
    const usage = metrics.value.toolUsage
    usage[tool] = (usage[tool] || 0) + 1
    // Don't push individual tool events — too noisy. Sent in summary.
  }

  function trackPageCount(count: number): void {
    metrics.value.pageCount = count
    pushEvent('page.count_changed', { page_count: count })
  }

  function trackUndoRedo(): void {
    metrics.value.undoRedoCount++
    // Don't push individual undo/redo — sent in summary.
  }

  function trackCustom(eventType: string, payload: Record<string, unknown> = {}): void {
    pushEvent(eventType, payload)
  }

  async function flush(): Promise<void> {
    await doFlush()
  }

  // ── Duration tracking ──────────────────────────────────────────────

  durationTimer = setInterval(() => {
    metrics.value.sessionDurationS = Math.round((Date.now() - mountedAt) / 1000)
  }, 5_000)

  // ── Periodic flush ─────────────────────────────────────────────────

  flushTimer = setInterval(() => {
    doFlush()
  }, FLUSH_INTERVAL_MS)

  // ── Lifecycle events ───────────────────────────────────────────────

  function handleBeforeUnload(): void {
    beaconFlush()
  }

  function handleVisibilityChange(): void {
    if (document.visibilityState === 'hidden') {
      beaconFlush()
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)
  }

  // Push session.start event
  pushEvent('session.start', {
    session_id: sessionId.value,
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
  })

  // ── Cleanup ────────────────────────────────────────────────────────

  function destroy(): void {
    if (destroyed) return
    destroyed = true

    if (flushTimer) clearInterval(flushTimer)
    if (durationTimer) clearInterval(durationTimer)

    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }

    // Final beacon flush with summary
    beaconFlush()
  }

  onUnmounted(destroy)

  return {
    metrics,
    trackStroke,
    trackSaveLatency,
    trackError,
    trackToolUse,
    trackPageCount,
    trackUndoRedo,
    trackCustom,
    flush,
    destroy,
  }
}

export default useTelemetry
