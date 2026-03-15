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

// ─── Constants ──────────────────────────────────────────────────────────────

const BATCH_SIZE = 50
const FLUSH_INTERVAL_MS = 5000
const SNAPSHOT_EVERY = 200

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

  /**
   * Record a single board operation into the buffer.
   * Auto-flushes when buffer reaches BATCH_SIZE.
   * Auto-creates snapshot every SNAPSHOT_EVERY ops.
   */
  function record(op: RecordOperationRequest): void {
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

    isFlushing.value = true
    const ops = buffer.splice(0) // drain buffer atomically

    try {
      await recordOperationsBatch(sid, ops)
    } catch (e) {
      console.warn('[ReplayRecorder] batch flush failed, re-queuing:', e)
      // Re-queue at front so order is preserved
      buffer.unshift(...ops)
    } finally {
      isFlushing.value = false
    }
  }

  /**
   * Create a board state snapshot at the current operation index.
   * Called automatically every SNAPSHOT_EVERY ops — fire-and-forget.
   */
  async function _createSnapshot(): Promise<void> {
    const sid = options.sessionId.value
    if (!sid) return

    try {
      const boardState = options.getBoardState()
      await createSnapshot(sid, opCount.value, boardState)
    } catch (e) {
      // Non-critical — snapshot creation failure doesn't block recording
      console.warn('[ReplayRecorder] snapshot creation failed:', e)
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
  }

  return {
    record,
    flush,
    start,
    stop,
    destroy,
    opCount: readonly(opCount),
    isFlushing: readonly(isFlushing),
  }
}
