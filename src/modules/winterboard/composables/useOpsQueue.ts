// Phase 3: Ops Queue — reliable queue with ACK/retry, batching, reconnect recovery
// Ref: OPS_CONTRACT.md §5, CRITICAL_GAPS.md Gap 1+2+4
//
// Replaces pendingOps in useAutosave with proper ACK-based delivery:
//   enqueue() → op_id assigned (crypto.randomUUID) → persist
//   flush()   → batch send → wait for ACK (assigned list)
//   onAck()   → remove confirmed ops by op_id
//   onNack()  → return inFlight to pending (retry)

import { ref, computed, readonly, type Ref } from 'vue'
import type { WBDiffOp } from '../api/winterboardApi'

// ── Config ──────────────────────────────────────────────────────────────

const MAX_BATCH_SIZE = 50       // max ops per request
const MAX_BATCH_BYTES = 48_000  // 48KB safety margin (backend DIFF_MAX_BYTES=256KB)
const FLUSH_INTERVAL_MS = 2_000 // flush every 2s
const MAX_RETRIES = 3

// ── Types ───────────────────────────────────────────────────────────────

export interface QueuedOp extends WBDiffOp {
  op_id: string
  client_ts: number
}

export interface FlushResult {
  rev: number
  ack: number
  assigned: Array<{ op_id: string; seq: number }>
}

export interface UseOpsQueueOptions {
  sessionId: Ref<string | null>
  onFlush: (ops: QueuedOp[]) => Promise<FlushResult>
  onAck: (lastSeq: number, newRev: number) => void
  onError: (err: unknown) => void
}

// ── Composable ──────────────────────────────────────────────────────────

export function useOpsQueue(options: UseOpsQueueOptions) {
  const pending = ref<QueuedOp[]>([])
  const inFlight = ref<QueuedOp[]>([])
  const ackedSeq = ref(0)

  let retryCount = 0
  let flushTimer: ReturnType<typeof setInterval> | null = null
  let destroyed = false

  // ── Enqueue ─────────────────────────────────────────────────────────

  function enqueue(op: WBDiffOp): void {
    const queued: QueuedOp = {
      ...op,
      op_id: crypto.randomUUID(),
      client_ts: Date.now(),
    }
    pending.value = [...pending.value, queued]
  }

  // ── Flush ───────────────────────────────────────────────────────────

  async function flush(): Promise<void> {
    if (destroyed) return
    if (!options.sessionId.value) return
    if (inFlight.value.length > 0) return  // wait for ACK
    if (pending.value.length === 0) return

    // Take batch with size limit
    const batch = takeBatch(pending.value, MAX_BATCH_SIZE, MAX_BATCH_BYTES)
    inFlight.value = batch
    pending.value = pending.value.slice(batch.length)

    try {
      const result = await options.onFlush(batch)

      // ACK: remove confirmed ops by op_id (partial ACK support)
      const assignedIds = new Set(result.assigned.map(a => a.op_id))
      const unacked = inFlight.value.filter(op => !assignedIds.has(op.op_id))

      // Return unacked ops to pending for retry
      if (unacked.length > 0) {
        pending.value = [...unacked, ...pending.value]
      }

      inFlight.value = []
      ackedSeq.value = result.ack
      options.onAck(result.ack, result.rev)
      retryCount = 0
    } catch (err: any) {
      const errStatus = err?.response?.status

      // P2.2: 422 = ops validation failed — drop them (retrying malformed ops is pointless)
      if (errStatus === 422) {
        console.warn('[WB:opsQueue] 422 — dropping %d invalid ops', inFlight.value.length)
        inFlight.value = []
        options.onError(err)
        retryCount = 0
        return
      }

      retryCount++
      // NACK: return all inFlight to pending
      pending.value = [...inFlight.value, ...pending.value]
      inFlight.value = []

      if (retryCount >= MAX_RETRIES) {
        options.onError(err)
        retryCount = 0
      }
    }
  }

  // ── Reconnect ───────────────────────────────────────────────────────

  function onReconnect(): void {
    // In-flight ops may not have reached server — return to pending
    if (inFlight.value.length > 0) {
      pending.value = [...inFlight.value, ...pending.value]
      inFlight.value = []
    }
    retryCount = 0
    flush()
  }

  // ── Lifecycle ───────────────────────────────────────────────────────

  function start(): void {
    if (flushTimer) return
    flushTimer = setInterval(flush, FLUSH_INTERVAL_MS)
  }

  function stop(): void {
    if (flushTimer) {
      clearInterval(flushTimer)
      flushTimer = null
    }
  }

  /** Clear all pending and in-flight ops (used after stream-save overwrites state) */
  function clear(): void {
    pending.value = []
    inFlight.value = []
    retryCount = 0
  }

  function destroy(): void {
    destroyed = true
    stop()
    // Final flush attempt (sync — best effort)
    flush()
  }

  return {
    enqueue,
    flush,
    clear,
    onReconnect,
    start,
    stop,
    destroy,
    pending: readonly(pending),
    inFlight: readonly(inFlight),
    pendingCount: computed(() => pending.value.length + inFlight.value.length),
    ackedSeq: readonly(ackedSeq),
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────

function takeBatch(ops: QueuedOp[], maxCount: number, maxBytes: number): QueuedOp[] {
  let size = 0
  const result: QueuedOp[] = []
  for (const op of ops) {
    const opSize = JSON.stringify(op).length
    if (result.length >= maxCount || size + opSize > maxBytes) break
    result.push(op)
    size += opSize
  }
  // Always include at least one op (even if it exceeds maxBytes)
  if (result.length === 0 && ops.length > 0) {
    result.push(ops[0])
  }
  return result
}
