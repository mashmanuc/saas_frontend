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

import { ref, readonly, watch, type Ref } from 'vue'
import type { RecordOperationRequest } from '../types/replay'
import { recordOperationsBatch, createSnapshot } from '../api/replay'
import { isCircuitBreakerOpen } from '@/utils/apiClient'

// ─── Constants ──────────────────────────────────────────────────────────────

const BATCH_SIZE = 50
// P0 FIX (2026-04-07): chunk autosave to 100 ops max per batch
// Backend `/replay/batch/` має ліміт 100 операцій (views.py:3222).
// Якщо WS лежить і buffer+retryQueue накопичили >100 ops — без chunking
// усі retry падають з 400 і дані ВТРАЧАЮТЬСЯ.
const MAX_OPS_PER_REQUEST = 100
const FLUSH_INTERVAL_MS = 1500          // streaming: flush кожні 1.5с (було 5с)
const SNAPSHOT_EVERY = 200
const MAX_PAYLOAD_BYTES = 64 * 1024    // 64KB — must match backend WBBoardOperationCreateSerializer
const MAX_RETRY_QUEUE_SIZE = 200       // REPLAY-INV-8: retry queue cap — не memory leak

// Circuit breaker: pause flushing after consecutive failures to prevent server overload
const MAX_CONSECUTIVE_FAILURES = 3
const CIRCUIT_BREAKER_COOLDOWN_MS = 30_000  // 30s pause after 3 failures

// ─── Types ──────────────────────────────────────────────────────────────────

export interface UseReplayRecorderOptions {
  sessionId: Ref<string | null>
  /** Returns serialisable board state for snapshot creation */
  getBoardState: () => Record<string, unknown>
  /** Controls whether the recorder is active. Default: false (opt-in).
   *  When false, record() is a no-op and flush timer is stopped.
   *  When switched to true, starts the flush timer and connects to store.
   *  When switched to false, flushes remaining buffer and stops timer. */
  enabled?: Ref<boolean>
}

// ─── Composable ─────────────────────────────────────────────────────────────

export function useReplayRecorder(options: UseReplayRecorderOptions) {
  const buffer: RecordOperationRequest[] = []
  const retryQueue: RecordOperationRequest[] = []  // REPLAY-INV-8: окремий retry queue
  const opCount = ref(0)
  const lastKnownTotal = ref(0)  // синхронізовано з BE total_operations
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
    // Phase 1: Skip recording if not enabled (opt-in)
    if (options.enabled && !options.enabled.value) return

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

    // REPLAY-INV-8: призначаємо op_id при enqueue якщо не переданий
    // Незмінний при retry — BE дедуплікує по (session, op_id)
    if (!op.op_id) {
      op = { ...op, op_id: crypto.randomUUID() }
    }

    buffer.push(op)
    opCount.value++

    if (buffer.length >= BATCH_SIZE) {
      flush()
      // Snapshot перевіряється у flush() після успішного commit — не тут
      // (race condition fix: snapshot тільки після підтвердженого BE commit)
    }
  }

  /**
   * Drain buffer and send to backend in a single batch request.
   * Re-queues ops on failure (network resilience).
   * Fire-and-forget — never awaited in hot path.
   */
  // GUARD: Track total successfully flushed ops for pipeline health monitoring
  let _totalFlushedOps = 0

  async function flush(): Promise<void> {
    const sid = options.sessionId.value
    if (!sid) {
      if (buffer.length > 0) console.warn(`[WB:Recorder] flush skipped: no sessionId (${buffer.length} ops in buffer)`)
      return
    }
    if (isFlushing.value) return // prevent concurrent flushes
    if (circuitOpen) {
      if (buffer.length > 0) console.warn(`[WB:Recorder] flush skipped: local circuit breaker open (${buffer.length} ops)`)
      return
    }
    if (isCircuitBreakerOpen()) {
      if (buffer.length > 0) console.warn(`[WB:Recorder] flush skipped: global circuit breaker open (${buffer.length} ops)`)
      return
    }

    // REPLAY-INV-8: спочатку retry queue, потім нові ops
    const toSend = [...retryQueue.splice(0), ...buffer.splice(0)]
    if (toSend.length === 0) return

    isFlushing.value = true

    // P0 FIX (2026-04-07): chunk autosave to 100 ops max per batch
    // Розбиваємо toSend на чанки по MAX_OPS_PER_REQUEST і відправляємо
    // ПОСЛІДОВНО (await в циклі), щоб BE міг правильно нумерувати seq.
    // При першій помилці — зупиняємось, незаслані ops повертаються в retryQueue.
    const chunks: RecordOperationRequest[][] = []
    for (let i = 0; i < toSend.length; i += MAX_OPS_PER_REQUEST) {
      chunks.push(toSend.slice(i, i + MAX_OPS_PER_REQUEST))
    }
    if (chunks.length > 1) {
      console.log(`[WB:autosave] flushing ${toSend.length} ops in ${chunks.length} chunks of ${MAX_OPS_PER_REQUEST}`)
    }

    let flushedCount = 0
    let lastResult: Awaited<ReturnType<typeof recordOperationsBatch>> | null = null
    let flushError: unknown = null

    try {
      for (let i = 0; i < chunks.length; i++) {
        try {
          lastResult = await recordOperationsBatch(sid, chunks[i])
          flushedCount += chunks[i].length
        } catch (chunkErr) {
          console.warn(
            `[WB:autosave] chunk ${i + 1}/${chunks.length} failed (${chunks[i].length} ops):`,
            chunkErr,
          )
          flushError = chunkErr
          break // НЕ продовжуємо наступні чанки — атомарність queue
        }
      }

      if (flushError) {
        throw flushError
      }

      consecutiveFailures = 0     // success — reset counter
      _totalFlushedOps += flushedCount
      // Синхронізуємо lastKnownTotal з BE після підтвердженого commit (останнього чанка)
      if (lastResult && typeof lastResult.total_operations === 'number') {
        const prevTotal = lastKnownTotal.value  // зберігаємо ДО оновлення
        lastKnownTotal.value = lastResult.total_operations
        // Race condition fix: snapshot тільки після підтвердженого BE commit ops —
        // не в record() де ops ще в buffer і не збережені
        const crossedBoundary = Math.floor(lastResult.total_operations / SNAPSHOT_EVERY) >
                                Math.floor(prevTotal / SNAPSHOT_EVERY)
        if (crossedBoundary) {
          _createSnapshot()
        }
      }
    } catch (e) {
      console.warn('[ReplayRecorder] batch flush failed, re-queuing to retryQueue:', e)
      // P0 FIX (2026-04-07): re-queue ТІЛЬКИ ті ops що НЕ пройшли
      // (атомарність: успішно відправлені чанки не дублюються)
      const notFlushed = toSend.slice(flushedCount)
      const combined = [...notFlushed, ...retryQueue]
      retryQueue.length = 0
      if (combined.length > MAX_RETRY_QUEUE_SIZE) {
        console.warn(`[ReplayRecorder] retryQueue cap exceeded, dropping ${combined.length - MAX_RETRY_QUEUE_SIZE} old ops`)
        retryQueue.push(...combined.slice(combined.length - MAX_RETRY_QUEUE_SIZE))
      } else {
        retryQueue.push(...combined)
      }

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

    // REPLAY-INV-7: використовуємо lastKnownTotal (синхронізовано з BE) якщо є,
    // інакше локальний opCount (менш точний, але краще ніж нічого)
    const opIdx = lastKnownTotal.value > 0 ? lastKnownTotal.value : opCount.value

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
    retryQueue.length = 0
    opCount.value = 0
    lastKnownTotal.value = 0
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

  // Phase 1: Watch enabled ref — auto start/stop recorder
  // { immediate: true } — запускає start() одразу якщо enabled=true при монтуванні
  // (без цього watch не спрацьовує для початкового значення)
  if (options.enabled) {
    watch(options.enabled, (isEnabled) => {
      if (isEnabled) {
        start()
      } else {
        stop() // flushes remaining buffer
      }
    }, { immediate: true })
  }

  return {
    record,
    flush,
    start,
    stop,
    destroy,
    connectToStore,
    opCount: readonly(opCount),
    lastKnownTotal: readonly(lastKnownTotal),
    isFlushing: readonly(isFlushing),
  }
}
