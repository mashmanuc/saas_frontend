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
//
// === SNAPSHOT RACE CONDITION (known limitation) ===
//
// Problem:
//   Between flush() confirming ops 1..N and _createSnapshot() calling getBoardState(),
//   new ops N+1..M may arrive and mutate the store. The snapshot is then labeled
//   operation_index=N but contains state from ops N+1..M.
//
// Failure mode:
//   Replay from that snapshot starts with extra objects already present.
//   When ops N+1..M are applied again, objects may be duplicated.
//
// Current mitigations:
//   - op_id dedup prevents true duplicates on re-record
//   - Boundary check prevents snapshots at same index twice
//   - FLUSH_INTERVAL=1.5s limits the race window
//
// Future fix: freeze board state at flush boundary before getBoardState().
//
// === STALE OPS / CIRCUIT BREAKER (known limitation) ===
//
// Problem:
//   After circuit breaker opens (30s pause after 3 failures), retryQueue
//   contains ops from before the pause. During the 30s, the user continues
//   editing — new context is created, objects may be deleted.
//
// Failure mode:
//   Stale ops reference objects that no longer exist or have changed state.
//   Example: text_update on a deleted object → silent skip (benign).
//   Example: lock_update on a deleted group → state corruption (harmful).
//
// Current mitigations:
//   - retryQueue cap (MAX_RETRY_QUEUE_SIZE=200) prevents unbounded growth
//   - op_id dedup prevents double-apply after recovery
//   - Most ops are create/update which are idempotent
//
// Future fix: backend should reject ops with client_ts > 60s old.

import { ref, readonly, watch, type Ref } from 'vue'
import type { RecordOperationRequest } from '../types/replay'
import { recordOperationsBatch, createSnapshot } from '../api/replay'
import { isCircuitBreakerOpen } from '@/utils/apiClient'
import { registerAuthDeathCleanup, isAuthDead } from '@/core/auth/onAuthDeath'
import { createSessionWriteLock } from './useSessionWriteLock'
import { saveBackup, clearBackup, readBackup } from './useOpsBackup'

// ─── Constants ──────────────────────────────────────────────────────────────

const BATCH_SIZE = 50
// P0 FIX (2026-04-07): chunk autosave to 100 ops max per batch
// Backend `/replay/batch/` має ліміт 100 операцій (views.py:3222).
// Якщо WS лежить і buffer+retryQueue накопичили >100 ops — без chunking
// усі retry падають з 400 і дані ВТРАЧАЮТЬСЯ.
const MAX_OPS_PER_REQUEST = 100
// Phase ops-only (advisor): debounced flush. Замість фіксованого setInterval кожні
// 1.5с — агрегуємо ops за 150мс вікно. Негайний flush якщо buffer >= BATCH_SIZE.
// Таймер безпеки теж є (див. FLUSH_SAFETY_INTERVAL_MS) для idle-періодів.
const FLUSH_DEBOUNCE_MS = 150
const FLUSH_SAFETY_INTERVAL_MS = 2_000
const SNAPSHOT_EVERY = 200
const MAX_PAYLOAD_BYTES = 64 * 1024    // 64KB — must match backend WBBoardOperationCreateSerializer
const MAX_RETRY_QUEUE_SIZE = 200       // REPLAY-INV-8: retry queue cap — не memory leak

// Circuit breaker: pause flushing after consecutive failures to prevent server overload
const MAX_CONSECUTIVE_FAILURES = 3
const CIRCUIT_BREAKER_COOLDOWN_MS = 30_000  // 30s pause after 3 failures

// Phase ops-only (advisor): retry policy з jitter + upper bound
const RETRY_BASE_MS = 200
const RETRY_MAX_MS = 5_000
const MAX_LOCK_RETRIES = 10      // Після N retry session_locked — тихий surrender; ops лишаються у retryQueue

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
  const inFlight: RecordOperationRequest[] = []    // Phase ops-only: ops у поточному request — для backup
  const opCount = ref(0)
  const lastKnownTotal = ref(0)  // синхронізовано з BE total_operations
  const isFlushing = ref(false)
  const pipelineStatus = ref<'idle' | 'healthy' | 'degraded' | 'broken'>('idle')
  // Phase ops-only: safety interval (не debounce — це fallback)
  let flushTimer: ReturnType<typeof setInterval> | null = null
  // Phase ops-only: debounce timer для агрегації burst-ів
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let consecutiveFailures = 0
  let lockRetryCount = 0                 // Лічильник 409 session_locked підряд
  let circuitBreakerTimer: ReturnType<typeof setTimeout> | null = null
  let circuitOpen = false
  let _destroyed = false  // guard against zombie usage after destroy()

  // Phase ops-only: серіалізатор записів — гарантує що backend ніколи не
  // отримує паралельні batch-и на ту саму сесію (корінь 409 storm).
  const writeLock = createSessionWriteLock()

  // Phase ops-only: backoff helper з jitter (advisor's must-have).
  function computeBackoff(attempt: number): number {
    const exp = RETRY_BASE_MS * Math.pow(2, attempt)
    const jitter = Math.random() * RETRY_BASE_MS
    return Math.min(exp + jitter, RETRY_MAX_MS)
  }

  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  function persistBackup(): void {
    const sid = options.sessionId.value
    if (!sid) return
    saveBackup(sid, [...retryQueue, ...buffer], [...inFlight])
  }

  // P0.0: Register cleanup on auth death — try beacon flush, then destroy
  const _unregisterAuthDeath = registerAuthDeathCleanup(() => {
    if (_destroyed) return
    flushViaSendBeacon()  // best-effort save remaining ops
    destroy()
  })

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
    if (_destroyed) { console.warn('[WB:Recorder] record() called after destroy'); return }
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

    // Phase ops-only: backup перед flush — якщо crash між enqueue та ACK,
    // restore на наступному mount (див. _restoreBackup).
    persistBackup()

    if (buffer.length >= BATCH_SIZE) {
      // Advisor optim: instant flush коли buffer повний — не чекаємо debounce
      if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null }
      flush()
    } else {
      // Advisor must-have: debounce — уникнути DDoS'у коли малювання швидке
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        debounceTimer = null
        flush()
      }, FLUSH_DEBOUNCE_MS)
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
    if (_destroyed || isAuthDead()) return
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

    // Phase ops-only: track inFlight для backup (advisor must-have)
    inFlight.length = 0
    inFlight.push(...toSend)
    persistBackup()

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
      // Phase ops-only: усі chunks — через ОДИН writeLock.run().
      // Це гарантує що паралельні `flush()` invocations не відправлять batch-и
      // одночасно → немає collision на backend → немає 409 storm.
      await writeLock.run(async () => {
        for (let i = 0; i < chunks.length; i++) {
          try {
            lastResult = await recordOperationsBatch(sid, chunks[i])
            flushedCount += chunks[i].length
            lockRetryCount = 0  // success — reset lock retry counter
          } catch (chunkErr) {
            // Phase ops-only (advisor): розрізняємо 409 session_locked vs
            // generic failure. 409 — transient, не збільшуємо circuit-breaker;
            // робимо jitter-backoff retry прямо тут, залишаючи op_id
            // незмінним (backend дедуплікує).
            const status = (chunkErr as { response?: { status?: number } })?.response?.status
            const detail = (chunkErr as { response?: { data?: { detail?: string } } })?.response?.data?.detail

            if (status === 409 && detail === 'session_locked') {
              lockRetryCount++
              if (lockRetryCount <= MAX_LOCK_RETRIES) {
                const delay = computeBackoff(lockRetryCount - 1)
                console.warn(
                  `[ReplayRecorder] 409 session_locked (${lockRetryCount}/${MAX_LOCK_RETRIES}) ` +
                  `— retrying chunk ${i + 1}/${chunks.length} after ${delay}ms`,
                )
                await sleep(delay)
                i--  // повторити ТОЙ САМИЙ chunk (op_id гарантує idempotency)
                continue
              }
              // Upper bound: після MAX_LOCK_RETRIES — віддаємо у retryQueue,
              // flush спробує пізніше (через safety timer). consecutiveFailures
              // НЕ інкрементуємо — це lock contention, не health issue.
              console.warn(
                `[ReplayRecorder] 409 session_locked retry limit (${MAX_LOCK_RETRIES}) reached — ` +
                `deferring ${chunks[i].length} ops`,
              )
              flushError = chunkErr
              break
            }

            // Інший тип помилки — generic handling (circuit breaker path)
            console.warn(
              `[WB:autosave] chunk ${i + 1}/${chunks.length} failed (${chunks[i].length} ops):`,
              chunkErr,
            )
            flushError = chunkErr
            break
          }
        }
      })

      if (flushError) {
        throw flushError
      }

      consecutiveFailures = 0     // success — reset counter
      _totalFlushedOps += flushedCount
      if (pipelineStatus.value !== 'healthy') pipelineStatus.value = 'healthy'

      // Phase ops-only: ACK → очищаємо inFlight + backup
      inFlight.length = 0
      if (retryQueue.length === 0 && buffer.length === 0) {
        clearBackup(sid)
      } else {
        persistBackup()
      }

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
      inFlight.length = 0
      persistBackup()  // backup включає retryQueue — ops не загубляться при crash

      // Phase ops-only: 409 session_locked НЕ інкрементує consecutiveFailures
      // (це contention, не server health).
      const errStatus = (e as { response?: { status?: number } })?.response?.status
      const errDetail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      const isLockContention = errStatus === 409 && errDetail === 'session_locked'

      if (!isLockContention) {
        consecutiveFailures++
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          circuitOpen = true
          console.warn(
            `[ReplayRecorder] Circuit breaker OPEN: ${consecutiveFailures} consecutive failures. ` +
            `Pausing for ${CIRCUIT_BREAKER_COOLDOWN_MS / 1000}s`,
          )
          circuitBreakerTimer = setTimeout(() => {
            if (_destroyed) return  // zombie guard
            circuitOpen = false
            consecutiveFailures = 0
            circuitBreakerTimer = null
            pipelineStatus.value = 'idle'
            console.info('[ReplayRecorder] Circuit breaker CLOSED — resuming flushes')
          }, CIRCUIT_BREAKER_COOLDOWN_MS)
          pipelineStatus.value = 'degraded'
        }
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
   *
   * Phase ops-only: відновлюємо ops з localStorage (advisor's must-have —
   * антикатастрофа після crash під час in-flight request).
   */
  function start(): void {
    if (flushTimer) return // already started

    // Restore backup (якщо є) перед стартом safety-interval
    const sid = options.sessionId.value
    if (sid) {
      const backup = readBackup<RecordOperationRequest>(sid)
      if (backup && (backup.pending.length > 0 || backup.inFlight.length > 0)) {
        // inFlight + pending → retryQueue (op_id гарантує server-side dedup,
        // навіть якщо якась частина вже застосувалась до crash).
        const restored = [...backup.inFlight, ...backup.pending]
        retryQueue.unshift(...restored)
        console.info(
          `[WB:Recorder] Restored ${restored.length} ops from localStorage backup`,
        )
      }
    }

    // Safety interval — ловить ops які debounce не скинув (idle-період, long burst)
    flushTimer = setInterval(flush, FLUSH_SAFETY_INTERVAL_MS)
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
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
    flush() // final flush — fire-and-forget
  }

  /**
   * Best-effort flush via navigator.sendBeacon for beforeunload.
   * Unlike flush(), this is synchronous and works during page unload.
   * May lose ops if buffer > MAX_OPS_PER_REQUEST (acceptable for unload).
   */
  function flushViaSendBeacon(): void {
    const sid = options.sessionId.value
    if (!sid) return
    const ops = [...retryQueue.splice(0), ...buffer.splice(0)]
    if (ops.length === 0) return
    const batch = ops.slice(0, MAX_OPS_PER_REQUEST)
    const apiBase = (import.meta as unknown as { env?: { VITE_API_BASE_URL?: string } }).env?.VITE_API_BASE_URL || '/api'
    const url = `${apiBase}/v1/winterboard/sessions/${sid}/replay/batch/`
    try {
      navigator.sendBeacon(url, new Blob([JSON.stringify({ operations: batch })], { type: 'application/json' }))
    } catch {
      // sendBeacon may fail silently in some browsers — acceptable for unload
    }
  }

  /**
   * Full cleanup — stop timer, flush remaining, clear buffer.
   */
  function destroy(): void {
    console.info('[WB:Recorder] destroy() — recorder terminated')
    _destroyed = true
    stop()
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
    buffer.length = 0
    retryQueue.length = 0
    inFlight.length = 0
    opCount.value = 0
    lastKnownTotal.value = 0
    lockRetryCount = 0
    pipelineStatus.value = 'idle'
    if (circuitBreakerTimer) {
      clearTimeout(circuitBreakerTimer)
      circuitBreakerTimer = null
    }
    circuitOpen = false
    consecutiveFailures = 0
    _unregisterAuthDeath()
  }

  /**
   * Phase 20: Connect recorder to store operation emitter.
   * All operations emitted by store actions will be auto-recorded.
   * Returns unsubscribe function — call on unmount.
   */
  function connectToStore(store: { onOperation: (l: (op: RecordOperationRequest) => void) => () => void }): () => void {
    console.info('[WB:Recorder] connectToStore — listener registered')
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
    flushViaSendBeacon,
    start,
    stop,
    destroy,
    connectToStore,
    opCount: readonly(opCount),
    lastKnownTotal: readonly(lastKnownTotal),
    isFlushing: readonly(isFlushing),
    pipelineStatus: readonly(pipelineStatus),
  }
}
