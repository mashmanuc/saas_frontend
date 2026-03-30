// P4: useReplayRecorder — batch recording composable for replay operations
// Ref: Phase 10 DAY2_AGENT_A.md — A4.1
// Zone: AGENT-A (composables/)
//
// Architecture:
//   - Collects board operations in a memory buffer
//   - Flushes buffer to backend every FLUSH_INTERVAL_MS or when buffer >= BATCH_SIZE
//   - Auto-creates snapshots every SNAPSHOT_EVERY ops for fast seek
//   - NEVER blocks UI — all network calls are fire-and-forget with error re-queuing
//   - Designed as platform primitive: any board view (solo/classroom) can use it

import { ref, readonly, type Ref } from 'vue'
import type { RecordOperationRequest } from '../types/replay'
import { recordOperationsBatch, createSnapshot } from '../api/replay'
import { isCircuitBreakerOpen } from '@/utils/apiClient'

// ─── Constants ──────────────────────────────────────────────────────────────

const BATCH_SIZE = 50
const FLUSH_INTERVAL_MS = 5000
const SNAPSHOT_EVERY = 200
const MAX_PAYLOAD_BYTES = 64 * 1024  // 64KB — must match backend WBBoardOperationCreateSerializer

// Circuit breaker: pause flushing after consecutive failures to prevent server overload
const MAX_CONSECUTIVE_FAILURES = 3
const CIRCUIT_BREAKER_COOLDOWN_MS = 30_000  // 30s pause after 3 failures

// ─── Types ──────────────────────────────────────────────────────────────────

export interface UseReplayRecorderOptions {
  sessionId: Ref<string | null>
  /** Returns serialisable board state for snapshot creation */
  getBoardState: () => Record<string, unknown>
}

// ─── Composable ─────────────────────────────────────────────────────────────

export function useReplayRecorder(options: UseReplayRecorderOptions) {
  const buffer: RecordOperationRequest[] = []
  const opCount = ref(0)
  const isFlushing = ref(false)
  let flushTimer: ReturnType<typeof setInterval> | null = null
  let consecutiveFailures = 0
  let circuitBreakerTimer: ReturnType<typeof setTimeout> | null = null
  let circuitOpen = false

  /**
   * Record a single board operation into the buffer.
   * Auto-flushes when buffer reaches BATCH_SIZE.
   * Auto-creates snapshot every SNAPSHOT_EVERY ops.
   *
   * R4: Validates payload size before recording — rejects payloads > 64KB
   * to match backend WBBoardOperationCreateSerializer.validate_payload.
   */
  /**
   * Strip base64 data URLs from asset payloads to keep size under limit.
   * Replay only needs the remote URL (src), not the inline data.
   */
  function _stripDataUrls(payload: Record<string, unknown>): Record<string, unknown> {
    const result = { ...payload }
    // Strip from top-level src/url if it's a data URL
    for (const key of ['src', 'url', 'thumbnail'] as const) {
      if (typeof result[key] === 'string' && (result[key] as string).startsWith('data:')) {
        result[key] = ''
      }
    }
    // Strip from nested asset object
    if (result.asset && typeof result.asset === 'object') {
      result.asset = _stripDataUrls(result.asset as Record<string, unknown>)
    }
    // Strip from nested stroke object
    if (result.stroke && typeof result.stroke === 'object') {
      result.stroke = _stripDataUrls(result.stroke as Record<string, unknown>)
    }
    return result
  }

  function record(op: RecordOperationRequest): void {
    // Strip data URLs from asset payloads before size check
    if (op.payload && typeof op.payload === 'object') {
      op = { ...op, payload: _stripDataUrls(op.payload as Record<string, unknown>) }
    }

    // R4: Payload size guard — prevents 400 on backend
    try {
      const payloadJson = JSON.stringify(op.payload ?? {})
      const payloadBytes = new TextEncoder().encode(payloadJson).byteLength
      if (payloadBytes > MAX_PAYLOAD_BYTES) {
        console.warn(
          `[ReplayRecorder] payload too large (${payloadBytes}B > ${MAX_PAYLOAD_BYTES}B), skipping op:`,
          op.op_type,
        )
        return
      }
    } catch {
      // JSON.stringify failure — skip this operation
      console.warn('[ReplayRecorder] payload serialization failed, skipping op:', op.op_type)
      return
    }

    buffer.push(op)
    opCount.value++

    if (buffer.length >= BATCH_SIZE) {
      flush()
    }

    // Auto-snapshot every SNAPSHOT_EVERY ops
    if (opCount.value > 0 && opCount.value % SNAPSHOT_EVERY === 0) {
      _createSnapshot()
    }
  }

  /**
   * Drain buffer and send to backend in a single batch request.
   * Re-queues ops on failure (network resilience).
   * Fire-and-forget — never awaited in hot path.
   */
  async function flush(): Promise<void> {
    const sid = options.sessionId.value
    if (buffer.length === 0 || !sid) return
    if (isFlushing.value) return // prevent concurrent flushes
    if (circuitOpen) return       // local circuit breaker: server unreachable, skip flush
    if (isCircuitBreakerOpen()) return  // global circuit breaker from apiClient

    isFlushing.value = true
    const ops = buffer.splice(0) // drain buffer atomically

    try {
      await recordOperationsBatch(sid, ops)
      consecutiveFailures = 0     // success — reset counter
    } catch (e) {
      console.warn('[ReplayRecorder] batch flush failed, re-queuing:', e)
      // Re-queue at front so order is preserved
      buffer.unshift(...ops)

      // Circuit breaker: after N consecutive failures, pause to prevent server overload
      consecutiveFailures++
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        circuitOpen = true
        console.warn(
          `[ReplayRecorder] Circuit breaker OPEN: ${consecutiveFailures} consecutive failures. ` +
          `Pausing for ${CIRCUIT_BREAKER_COOLDOWN_MS / 1000}s`,
        )
        circuitBreakerTimer = setTimeout(() => {
          circuitOpen = false
          consecutiveFailures = 0
          circuitBreakerTimer = null
          console.info('[ReplayRecorder] Circuit breaker CLOSED — resuming flushes')
        }, CIRCUIT_BREAKER_COOLDOWN_MS)
      }
    } finally {
      isFlushing.value = false
    }
  }

  /**
   * Create a board state snapshot at the current operation index.
   * Called automatically every SNAPSHOT_EVERY ops — fire-and-forget.
   *
   * R4: Retries once on failure after 2s delay. If retry also fails,
   * logs warning and continues — snapshots are non-critical optimization.
   */
  async function _createSnapshot(): Promise<void> {
    const sid = options.sessionId.value
    if (!sid) return

    const opIdx = opCount.value

    try {
      const boardState = options.getBoardState()
      await createSnapshot(sid, opIdx, boardState)
    } catch (e) {
      console.warn('[ReplayRecorder] snapshot creation failed, retrying in 2s:', e)
      // R4: Single retry after delay
      setTimeout(async () => {
        try {
          const boardState = options.getBoardState()
          await createSnapshot(sid, opIdx, boardState)
        } catch (retryErr) {
          console.warn('[ReplayRecorder] snapshot retry also failed:', retryErr)
        }
      }, 2000)
    }
  }

  /**
   * Start the periodic flush timer. Call on component mount.
   */
  function start(): void {
    if (flushTimer) return // already started
    flushTimer = setInterval(flush, FLUSH_INTERVAL_MS)
  }

  /**
   * Stop the periodic flush timer and do a final flush.
   * Call before component unmount or mode switch.
   */
  function stop(): void {
    if (flushTimer) {
      clearInterval(flushTimer)
      flushTimer = null
    }
    flush() // final flush — fire-and-forget
  }

  /**
   * Full cleanup — stop timer, flush remaining, clear buffer.
   */
  function destroy(): void {
    stop()
    buffer.length = 0
    opCount.value = 0
    if (circuitBreakerTimer) {
      clearTimeout(circuitBreakerTimer)
      circuitBreakerTimer = null
    }
    circuitOpen = false
    consecutiveFailures = 0
  }

  /**
   * Phase 20: Connect recorder to store operation emitter.
   * All operations emitted by store actions will be auto-recorded.
   * Returns unsubscribe function — call on unmount.
   */
  function connectToStore(store: { onOperation: (l: (op: RecordOperationRequest) => void) => () => void }): () => void {
    return store.onOperation((op) => {
      record(op)
    })
  }

  return {
    record,
    flush,
    start,
    stop,
    destroy,
    connectToStore,
    opCount: readonly(opCount),
    isFlushing: readonly(isFlushing),
  }
}
