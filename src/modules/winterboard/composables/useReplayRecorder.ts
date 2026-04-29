// Phase 2 (2026-04-27) — useReplayRecorder: thin wrapper над opsSyncStore.
//
// Refactor scope (Section D HARD CHECKPOINT):
//   - DELETED: local buffer / retryQueue / inFlight refs (moved to opsSyncStore)
//   - DELETED: PR3 hacks — MAX_LOCK_RETRIES, PAUSE_AFTER_CONSECUTIVE_409,
//     PAUSE_DURATION_MS, PAUSE_JITTER_MS, MAX_409_PER_SESSION, consecutive409,
//     total409InSession, circuitOpen, lockRetryCount, recoverFromOverflow()
//   - DELETED: 409 burst handler block (~75 LOC) — opsSyncStore.flush() handles
//     SSOT §4 errors (PROTOCOL_VERSION_MISMATCH / SEQ_MISMATCH / SERVER_BUSY)
//   - DELETED: writeLock (replaced by opsSyncStore _flushPromise mutex)
//   - DELETED: navigator.sendBeacon path (Variant A — opsSyncStore.sendBeacon throws)
//   - PRESERVED: composable lifecycle (start/stop/destroy/connectToStore),
//     payload size guard, data URL stripping, debounce timer, safety interval,
//     auth death cleanup, backup/restore (crash recovery).
//
// Why thin wrapper:
//   - opsSyncStore (Pinia) owns persistent state across composable unmount/remount
//   - Composable owns lifecycle (timers, watchers, store subscriptions)
//   - Single source of truth for ops state machine

import { ref, readonly, watch, computed, type Ref } from 'vue'
import type { RecordOperationRequest } from '../types/replay'
import { createSnapshot } from '../api/replay'
import { registerAuthDeathCleanup, isAuthDead } from '@/core/auth/onAuthDeath'
import { saveBackup, clearBackup, readBackup } from './useOpsBackup'
import { trackEvent } from '@/utils/telemetryAgent'
import { notifyWarning } from '@/utils/notify'
import {
  useOpsSyncStore,
  DesyncError,
  BeaconUnsupportedError,
  BackpressureError,
  type OpsSyncOp,
} from '../stores/opsSyncStore'
import { tryCoalesceStrokeAppend } from '../services/opsCoalescer'

// ─── Constants ──────────────────────────────────────────────────────────────

// Phase 2: BATCH_SIZE визначається у opsSyncStore (FLUSH_BATCH_SIZE = 50).
// Тут залишаємо threshold для instant-flush trigger (буфер заповнюється швидше
// debounce window → не чекаємо tick).
const INSTANT_FLUSH_THRESHOLD = 50
const FLUSH_DEBOUNCE_MS = 150
const FLUSH_SAFETY_INTERVAL_MS = 2_000
const MAX_PAYLOAD_BYTES = 64 * 1024  // 64KB — must match backend WBBoardOperationCreateSerializer

// Phase S PR-3 (2026-04-28) — bounded batcher per REFACTOR_PLAN.md v2 §3.A.
/** Hard cap per POST (BE accepts up to 100 ops/batch). */
const MAX_BATCH_OPS = 100
/** Aggregate batch ceiling per POST (defense-in-depth поверх per-op MAX_PAYLOAD_BYTES).
 *  128KB вибрано per helper review 2026-04-29 — 512KB risk: CDN/proxy/gunicorn intermediate limits.
 *  128KB = 2× headroom over per-op 64KB; ~100 small strokes (1-1.3KB avg) fit без issue. */
const MAX_BATCH_BYTES = 128 * 1024
/** Coalescer trigger: коли pendingCount > N AND incoming op = stroke_append → merge. */
const COALESCE_THRESHOLD = 50

// ─── Types ──────────────────────────────────────────────────────────────────

export interface UseReplayRecorderOptions {
  sessionId: Ref<string | null>
  /** Returns serialisable board state for snapshot creation. */
  getBoardState: () => Record<string, unknown>
  /** Controls whether the recorder is active. Default: false (opt-in). */
  enabled?: Ref<boolean>
}

// ─── Composable ─────────────────────────────────────────────────────────────

export function useReplayRecorder(options: UseReplayRecorderOptions) {
  const opsSync = useOpsSyncStore()

  // Lifecycle state (composable-scoped, NOT shared via store)
  let flushTimer: ReturnType<typeof setInterval> | null = null
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let _destroyed = false

  // Telemetry counters
  const opCount = ref(0)
  let _totalFlushedOps = 0

  // Reactive view of store buffers (для UI status indicators)
  const isFlushing = computed(() => opsSync.inFlightOps.length > 0)
  const pipelineStatus = computed<'idle' | 'healthy' | 'degraded' | 'broken'>(() => {
    if (opsSync.isDesync) return 'broken'
    if (opsSync.inFlightOps.length > 0) return 'degraded'
    if (_totalFlushedOps > 0) return 'healthy'
    return 'idle'
  })

  // P0.0: Auth death cleanup
  const _unregisterAuthDeath = registerAuthDeathCleanup(() => {
    if (_destroyed) return
    // Phase 2: sendBeacon ALWAYS throws BeaconUnsupportedError (Variant A).
    // Catch and accept data loss — auth death = unload-equivalent context.
    try {
      opsSync.sendBeacon()
    } catch (e) {
      if (e instanceof BeaconUnsupportedError) {
        // Expected post-Phase 1 — no fallback path available
      } else if (e instanceof DesyncError) {
        // Acceptable — already in DESYNC, no further action
      } else {
        console.warn('[WB:Recorder] auth-death sendBeacon unexpected error:', e)
      }
    }
    destroy()
  })

  // ─── Helpers ──

  /** Strip non-persistable URL prefixes and FE-only status flags from asset payloads.
   *
   *  Stripped:
   *   - `data:` URLs — base64 inline data (replay needs only remote URL)
   *   - `blob:` URLs — P0 UX optimistic paste (asset emitted з blob URL до S3 upload;
   *     final URL прилітає окремим asset_update. Якщо blob потрапить у BE — replay
   *     зламається бо blob URL валідний лише в межах однієї browser tab session.)
   *   - `status` / `errorMessage` — FE-only optimistic flags, не персистимо. */
  function _stripDataUrls(payload: Record<string, unknown>): Record<string, unknown> {
    const result = { ...payload }
    for (const key of ['src', 'url', 'thumbnail'] as const) {
      const value = result[key]
      if (typeof value === 'string' && (value.startsWith('data:') || value.startsWith('blob:'))) {
        result[key] = ''
      }
    }
    // FE-only optimistic paste status — НЕ шлемо у BE
    if ('status' in result) delete result.status
    if ('errorMessage' in result) delete result.errorMessage
    if (result.asset && typeof result.asset === 'object') {
      result.asset = _stripDataUrls(result.asset as Record<string, unknown>)
    }
    if (result.stroke && typeof result.stroke === 'object') {
      result.stroke = _stripDataUrls(result.stroke as Record<string, unknown>)
    }
    return result
  }

  function _persistBackup(): void {
    const sid = options.sessionId.value
    if (!sid) return
    saveBackup(sid, [...opsSync.pendingOps], [...opsSync.inFlightOps])
  }

  // ─── Public API ──

  /**
   * Record a single board operation. Routed through opsSyncStore.record() —
   * INV-16 NO-OP if mode=DESYNC (silent drop, hot path safe).
   *
   * Side effects:
   *   - Payload size validation (skip op if >64KB)
   *   - Data URL stripping (asset payloads)
   *   - op_id generation if not provided (UUID v4)
   *   - Backup snapshot to localStorage (crash recovery)
   *   - Debounced flush trigger (instant if buffer >= INSTANT_FLUSH_THRESHOLD)
   */
  function record(op: RecordOperationRequest): void {
    if (_destroyed) {
      console.warn('[WB:Recorder] record() called after destroy')
      return
    }
    if (options.enabled && !options.enabled.value) return

    // Strip data URLs from asset payloads before size check
    if (op.payload && typeof op.payload === 'object') {
      op = { ...op, payload: _stripDataUrls(op.payload as Record<string, unknown>) }
    }

    // Payload size guard — prevents 400 on backend.
    //
    // Phase S PR-3 (2026-04-28): NO silent drop. Per REFACTOR_PLAN.md §3 task #4:
    //   - emit telemetry `wb.ops.payload_oversized` (BE inspection visibility)
    //   - show user-facing toast (rejection observable, not invisible)
    //   - return without recording (op rejected, NOT chunked — chunking deferred Phase P2)
    try {
      const payloadJson = JSON.stringify(op.payload ?? {})
      const payloadBytes = new TextEncoder().encode(payloadJson).byteLength
      if (payloadBytes > MAX_PAYLOAD_BYTES) {
        try {
          trackEvent('wb.ops.payload_oversized', {
            op_type: op.op_type,
            bytes: payloadBytes,
            limit: MAX_PAYLOAD_BYTES,
            session_id: opsSync.sessionId,
          })
        } catch { /* telemetry never throws */ }
        try {
          notifyWarning(
            `Операція ${op.op_type} занадто велика (${Math.round(payloadBytes / 1024)}KB > ${MAX_PAYLOAD_BYTES / 1024}KB). ` +
            'Зменшіть складність малювання або розділіть на менші частини.',
          )
        } catch { /* notification never throws */ }
        console.warn(
          `[WB:Recorder] payload oversized rejected (${payloadBytes}B > ${MAX_PAYLOAD_BYTES}B):`,
          op.op_type,
        )
        return
      }
    } catch {
      console.warn('[WB:Recorder] payload serialization failed, skipping op:', op.op_type)
      return
    }

    // Phase 2 INV-14: op_id REQUIRED (BE migration 0038 enforces NOT NULL).
    // Generate UUID v4 if caller didn't provide; stable across retry per INV-14 dedup.
    if (!op.op_id) {
      op = { ...op, op_id: crypto.randomUUID() }
    }

    // Phase S PR-3 (2026-04-28): coalesce stroke_append ops під load.
    // Якщо pendingCount > 50 AND incoming op = stroke_append AND last pending op
    // has same stroke_id → merge points замість додавати новий op.
    // Reduces op count без втрати fidelity (INV-14 + INV-15 safe — per opsCoalescer.ts).
    if (
      opsSync.pendingCount > COALESCE_THRESHOLD &&
      op.op_type === 'stroke_append' &&
      opsSync.pendingOps.length > 0
    ) {
      const last = opsSync.pendingOps[opsSync.pendingOps.length - 1]
      if (last && tryCoalesceStrokeAppend(last as OpsSyncOp, op as unknown as OpsSyncOp)) {
        // Merged into previous pending op — don't push new op
        opCount.value++
        _persistBackup()
        return
      }
    }

    // Route to store. INV-16: returns false якщо mode=DESYNC → silent drop (hot path safe).
    const accepted = opsSync.record(op as unknown as OpsSyncOp)
    if (!accepted) return  // dropped by store (DESYNC або BOOTSTRAP not done)

    opCount.value++
    _persistBackup()

    if (opsSync.pendingOps.length >= INSTANT_FLUSH_THRESHOLD) {
      // Instant flush коли buffer повний — не чекаємо debounce
      if (debounceTimer) {
        clearTimeout(debounceTimer)
        debounceTimer = null
      }
      void flush()
    } else {
      // Debounce — уникнути DDoS'у коли малювання швидке
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        debounceTimer = null
        void flush()
      }, FLUSH_DEBOUNCE_MS)
    }
  }

  /**
   * Flush pending ops через opsSyncStore. Concurrent calls share single Promise
   * (opsSyncStore _flushPromise mutex). Errors per SSOT §4:
   *   - DesyncError (PROTOCOL_VERSION_MISMATCH / SEQ_MISMATCH) — UI shows modal,
   *     pendingOps + inFlightOps already dropped by store.
   *   - 503 SERVER_BUSY — opsSyncStore.flush() throws with inFlightOps preserved
   *     for next retry (B4 INV-12 додасть max-2 jitter orchestration).
   *   - Other errors — propagated (caller може decide retry/drop).
   *
   * Telemetry: tracks total flushed ops + emits events on overflow/desync.
   */
  async function flush(): Promise<void> {
    if (_destroyed || isAuthDead()) return
    const sid = options.sessionId.value
    if (!sid) return

    const beforeCount = opsSync.pendingOps.length + opsSync.inFlightOps.length
    if (beforeCount === 0) return

    // Phase S PR-3 (2026-04-28): bounded batcher invariants — defense-in-depth поверх
    // store FLUSH_BATCH_SIZE=50. Telemetry якщо пробивають ceiling.
    if (opsSync.pendingCount > MAX_BATCH_OPS * 2) {
      try {
        trackEvent('wb.ops.queue_high_watermark', {
          pending_count: opsSync.pendingCount,
          in_flight_count: opsSync.inFlightCount,
          max_batch_ops: MAX_BATCH_OPS,
          max_batch_bytes: MAX_BATCH_BYTES,
          session_id: sid,
        })
      } catch { /* telemetry never throws */ }
    }

    try {
      await opsSync.flush()
      // Success — track count
      const afterCount = opsSync.pendingOps.length + opsSync.inFlightOps.length
      const flushed = beforeCount - afterCount
      if (flushed > 0) _totalFlushedOps += flushed

      // ACK clears localStorage backup if все відправлено
      if (afterCount === 0) {
        clearBackup(sid)
      } else {
        _persistBackup()
      }
    } catch (err) {
      if (err instanceof DesyncError) {
        // Store already entered DESYNC + cleared buffers + emitted broadcast
        // (per SSOT §4). UI Section E shows ProtocolMismatchModal / DesyncRecoveryBanner.
        try {
          trackEvent('wb.ops.desync', {
            session_id: sid,
            reason: opsSync.desyncReason ?? 'unknown',
          })
        } catch { /* telemetry never throws */ }
        clearBackup(sid)  // буфери вже cleared у store, синхронізуємо
        return  // DON'T propagate (caller — timer or record() — has nothing to do)
      }
      if (err instanceof BackpressureError) {
        // Phase S PR-3 (2026-04-28): PAUSED mode — server backpressure exhausted retries.
        // inFlightOps preserved у store. UI banner displays via opsSync.isPaused watch.
        // No retry storm — wait for resumeFromPause() (user click або 30s auto-retry).
        try {
          trackEvent('wb.ops.paused', {
            session_id: sid,
            reason: opsSync.desyncReason ?? 'server-busy-exhausted-retries',
            in_flight_count: opsSync.inFlightCount,
            pending_count: opsSync.pendingCount,
          })
        } catch { /* telemetry never throws */ }
        _persistBackup()  // crash-safety: ops preserved у localStorage
        return
      }
      if (err instanceof BeaconUnsupportedError) {
        // Не повинно відбуватись з flush() (тільки sendBeacon throws це). Лог якщо станеться.
        console.warn('[WB:Recorder] flush() unexpected BeaconUnsupportedError:', err)
        return
      }
      // 503 SERVER_BUSY або транзієнтні мережеві помилки — inFlight preserved у store,
      // safety interval спробує знову (after retryUntil window). Persist backup щоб не
      // загубити при crash.
      _persistBackup()
      console.warn('[WB:Recorder] flush() failed (will retry on next tick):', err)
    }
  }

  /**
   * Phase 2 (Variant A locked 2026-04-27): sendBeacon ALWAYS throws.
   *
   * Reason: navigator.sendBeacon CANNOT set X-Protocol-Version header (LAW §10).
   * Wrapper catches BeaconUnsupportedError + accepts data loss (no fallback path
   * post-Phase 1). DesyncError (mode=DESYNC) also caught — already DESYNC, no-op.
   *
   * Caller (unload handler) MUST tolerate this — no recovery available pre-deploy
   * of an alternative emergency-save channel.
   */
  function flushViaSendBeacon(): void {
    if (_destroyed) return
    try {
      opsSync.sendBeacon()  // ALWAYS throws (BeaconUnsupportedError or DesyncError)
    } catch (e) {
      if (e instanceof BeaconUnsupportedError) {
        // Expected — emit telemetry to track data loss visibility у production.
        try {
          trackEvent('wb.ops.beacon_unsupported', {
            session_id: options.sessionId.value,
            pending_count: opsSync.pendingOps.length,
            in_flight_count: opsSync.inFlightOps.length,
          })
        } catch { /* telemetry never throws */ }
      } else if (e instanceof DesyncError) {
        // Already in DESYNC — nothing to send anyway
      } else {
        console.warn('[WB:Recorder] flushViaSendBeacon unexpected error:', e)
      }
    }
  }

  /**
   * Manual snapshot trigger (Phase 2: НЕ auto-called per ops count, на відміну від
   * Phase 1 pre-incident behavior). Backend Celery `apply_ops_and_snapshot`
   * створює persistence snapshots automatically. FE snapshot = манual для special
   * cases (наприклад, перед `stop_recording` у future).
   */
  async function manualSnapshot(): Promise<void> {
    const sid = options.sessionId.value
    if (!sid) return
    try {
      const boardState = options.getBoardState()
      await createSnapshot(sid, opCount.value, boardState)
    } catch (e) {
      console.warn('[WB:Recorder] manual snapshot failed:', e)
    }
  }

  /**
   * Start the periodic flush timer + restore backup on mount.
   *
   * Crash recovery: localStorage backup → opsSyncStore.pendingOps. op_id гарантує
   * server-side dedup (INV-14), навіть якщо deset якась частина вже застосувалась
   * до crash.
   */
  function start(): void {
    if (flushTimer) return  // already started

    // Restore backup (якщо є) перед стартом safety-interval.
    // Note: opsSyncStore.bootstrap() має бути вже викликано caller'ом.
    const sid = options.sessionId.value
    if (sid) {
      const backup = readBackup<RecordOperationRequest>(sid)
      if (backup && (backup.pending.length > 0 || backup.inFlight.length > 0)) {
        const restored = [...backup.inFlight, ...backup.pending]
        // Push до opsSyncStore.pendingOps (через record()) щоб state machine побачила.
        // Mode має бути SYNC після bootstrap; якщо BOOTSTRAP — store.record() поверне
        // false і backup лишиться у localStorage до наступної спроби.
        for (const op of restored) {
          opsSync.record(op as unknown as OpsSyncOp)
        }
        console.info(`[WB:Recorder] Restored ${restored.length} ops from localStorage backup`)
      }
    }

    // Safety interval — ловить ops які debounce не скинув (idle-період, long burst).
    //
    // Phase S PR-3 (2026-04-28): respect bounded retry window AND PAUSED mode.
    // Якщо PAUSED → flush() throws BackpressureError → no-op. Якщо retryUntil active
    // → skip tick (don't burn cycles + don't trigger nested error path).
    flushTimer = setInterval(() => {
      if (opsSync.isPaused) return  // PAUSED — wait for resumeFromPause()
      const ru = opsSync.retryUntil
      if (typeof ru === 'number' && ru > 0 && Date.now() < ru) return  // backoff active
      void flush()
    }, FLUSH_SAFETY_INTERVAL_MS)
  }

  /**
   * Stop the periodic flush timer + final flush. Call before component unmount.
   *
   * Cleanup contract: timer cleanup is composable-scoped (lifecycle), but
   * opsSyncStore state PERSISTS through unmount/remount (Pinia singleton). Це
   * правильно — буфер не губиться при route change або page transition.
   * Store reset() called separately via forceLogout() / setAuth({access:null}).
   *
   * ⚠️ DATA LOSS POSSIBLE ON UNLOAD (concern #4 — accepted design decision):
   *   `void flush()` is fire-and-forget. На beforeunload/pagehide events:
   *     - Browser aborts in-flight Promises after ~500ms-2s grace period
   *     - opsSyncStore.sendBeacon() ALWAYS THROWS (Variant A, line 366) — нема
   *       fallback channel що міг би працювати у unload context (navigator.sendBeacon
   *       cannot set X-Protocol-Version per LAW §10 INV-20)
   *     - useOpsBackup persists pendingOps + inFlightOps до localStorage perform
   *       last-resort recovery on next page mount — НЕ guarantee delivery, але
   *       reduces window of loss.
   *
   *   ACCEPTED: ops emitted у останніх ~150ms перед unload може бути lost. Це
   *   architectural tradeoff per LAW §10 (no covert HTTP channel for emergency
   *   saves; either standard authenticated POST or accept loss). Phase 3+ може
   *   додати keepalive: true fetch як alternative до beacon якщо проблема стане
   *   user-impacting.
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
    void flush()  // final flush — fire-and-forget; data loss on unload accepted
  }

  /**
   * Full cleanup — stop timer, deregister auth-death, reset composable counters.
   * Does NOT reset opsSyncStore (інша composable instance може ще use).
   */
  function destroy(): void {
    if (_destroyed) return
    console.info('[WB:Recorder] destroy() — recorder terminated')
    _destroyed = true
    stop()
    opCount.value = 0
    _totalFlushedOps = 0
    _unregisterAuthDeath()
  }

  /**
   * Phase 20: Connect recorder to store operation emitter.
   * All operations emitted by store actions will be auto-recorded.
   * Returns unsubscribe function — call on unmount.
   */
  function connectToStore(
    store: { onOperation: (l: (op: RecordOperationRequest) => void) => () => void },
  ): () => void {
    console.info('[WB:Recorder] connectToStore — listener registered')
    return store.onOperation((op) => { record(op) })
  }

  // Phase 1: Watch enabled ref — auto start/stop recorder
  if (options.enabled) {
    watch(options.enabled, (isEnabled) => {
      if (isEnabled) {
        start()
      } else {
        stop()
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
    manualSnapshot,
    opCount: readonly(opCount),
    isFlushing,
    pipelineStatus,
  }
}
