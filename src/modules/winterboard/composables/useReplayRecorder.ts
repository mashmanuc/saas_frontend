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
import { backupKey, clearBackup, readAllBackups, removeBackupKeys } from './useOpsBackup'
import { liveTabIds, mayAdopt, mayRemove } from './tabLiveness'
import { serverPayloadBytes, SERVER_PAYLOAD_LIMIT_BYTES } from '../services/opsPayloadSize'
import { trackEvent } from '@/utils/telemetryAgent'
import { notifyWarning, notifyError } from '@/utils/notify'
import { announceLifecycleBlock } from '../remote/lifecycleBlock'
import {
  useOpsSyncStore,
  DesyncError,
  BeaconUnsupportedError,
  BackpressureError,
  LifecycleStateError,
  SeqResyncError,
  SaveBlockedError,
  type OpsSyncOp,
  MAX_BATCH_BYTES,
} from '../stores/opsSyncStore'
import { tryCoalesceStrokeAppend } from '../services/opsCoalescer'

// ─── Constants ──────────────────────────────────────────────────────────────

// Phase 2: BATCH_SIZE визначається у opsSyncStore (FLUSH_BATCH_SIZE = 50).
// Тут залишаємо threshold для instant-flush trigger (буфер заповнюється швидше
// debounce window → не чекаємо tick).
const INSTANT_FLUSH_THRESHOLD = 50
const FLUSH_DEBOUNCE_MS = 150
const FLUSH_SAFETY_INTERVAL_MS = 2_000
// Ліміт операції рахуємо РІВНО як сервер (serverPayloadBytes: реальні UTF-8 байти,
// дроби — як Python repr; звірено з CPython) — запас не потрібен.
const MAX_PAYLOAD_BYTES = SERVER_PAYLOAD_LIMIT_BYTES

// Phase S PR-3 (2026-04-28) — bounded batcher per REFACTOR_PLAN.md v2 §3.A.
/** Hard cap per POST (BE accepts up to 100 ops/batch). */
const MAX_BATCH_OPS = 100
// Сумарна стеля POST — MAX_BATCH_BYTES у opsSyncStore (там її й застосовано при нарізці).
/** Coalescer trigger: коли pendingCount > N AND incoming op = stroke_append → merge. */
const COALESCE_THRESHOLD = 50
/** TLV2-G1b: після успішної спроби з PAUSED — скільки batch-ів черги дозлити одразу. */
const RECOVERY_DRAIN_MAX_BATCHES = 20

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
  /** Б-28: для якої дошки копії вже відновлено (раз на дошку). */
  let _restoredFor: string | null = null
  /**
   * Б-28: полотно вже показує стан дошки. Classroom підключає рекордер ДО getSession →
   * hydrateFromSession (потрібно для запису) — звірка до гідратації була б перезаписана
   * повільною відповіддю getSession. Тоді кімната кличе markCanvasReady() після неї.
   */
  let _canvasReady = true

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
    // TLV2-G1b: черга store належить дошці store; під час зміни дошки не писати її чужій.
    if (!sid || opsSync.sessionId !== sid) return
    // SAVE_BLOCKED (LAW §4): аварійний запис з перевіркою; інакше — звичайна копія,
    // теж з перевіркою: невдача вмикає «черга без копії» в store, не лише console.warn.
    opsSync.persistQueue()
  }

  // Trailing throttle для hot record() path. Reduces allocator pressure від
  // per-op array spread + JSON.stringify (1h soak: 1444 cycles → cap ~3600 у
  // worst-case at 1/s). Error / lifecycle / flush paths still call _persistBackup()
  // immediately для crash safety.
  const PERSIST_BACKUP_THROTTLE_MS = 1_000
  let _persistBackupTimer: ReturnType<typeof setTimeout> | null = null
  function _persistBackupThrottled(): void {
    if (_persistBackupTimer !== null) return
    _persistBackupTimer = setTimeout(() => {
      _persistBackupTimer = null
      _persistBackup()
    }, PERSIST_BACKUP_THROTTLE_MS)
  }
  function _flushPersistBackupTimer(): void {
    if (_persistBackupTimer !== null) {
      clearTimeout(_persistBackupTimer)
      _persistBackupTimer = null
      _persistBackup()  // ensure pending state hits localStorage on stop/destroy
    }
  }

  /**
   * TLV2-G1b: повернути в store ops із localStorage backup поточної дошки.
   *
   * Викликається і з start(), і з connectToStore() — у Solo start() не викликається,
   * тож без другого виклику backup там ніколи не відновлювався. op_id, які вже є в
   * черзі store, не дублюються. Якщо store ще не в SYNC/PAUSED, record() відмовить —
   * backup лишається до наступного виклику.
   */
  async function _restoreBackup(): Promise<void> {
    const sid = options.sessionId.value
    if (!sid || opsSync.sessionId !== sid) return
    // Б-28: одне відновлення на дошку. start() і connectToStore() кличуть обидва; поки
    // звірка йде (дії вже пішли з черги, копії ще не знято), другий виклик підхопив би
    // ті самі дії вдруге й зняв би копії до підтвердження. (Не `restoredPending`: його
    // ставить і відновлена зупинка — тоді звичайні копії теж треба підхопити, щоб
    // «Відкинути» зняло й їх.)
    if (_restoredFor === sid || opsSync.restoring) return
    const live = await liveTabIds()
    if (_destroyed || options.sessionId.value !== sid || opsSync.sessionId !== sid) return
    if (_restoredFor === sid || opsSync.restoring) return
    // Далі все синхронно. Копії СВОЇХ вкладок цієї дошки (ключ = дошка + акаунт +
    // вкладка). Копії ЖИВИХ інших вкладок не чіпаємо: вони надішлють своє самі, а
    // видалення могло б з'їсти дію, дописану між нашим читанням і видаленням.
    const own = opsSync.tabId
    const all = readAllBackups<RecordOperationRequest>(sid)
    all.records = all.records.filter(r => mayAdopt(r.key, own, live))
    if (all.records.length === 0) return
    const known = new Set([...opsSync.inFlightOps, ...opsSync.pendingOps].map(o => o.op_id))
    let restored = 0
    let partial = false
    const adopted: OpsSyncOp[] = []
    outer: for (const { backup } of all.records) {
      for (const op of [...backup.inFlight, ...backup.pending]) {
        if (!op.op_id || known.has(op.op_id)) continue
        if (!opsSync.record(op as unknown as OpsSyncOp)) { partial = true; break outer }
        known.add(op.op_id)
        adopted.push(op as unknown as OpsSyncOp)
        restored++
      }
    }
    if (partial) {
      // Store прийняв лише частину (стеля / не той режим): прийняте піде на сервер, але
      // на полотні його нема — звірка потрібна; копії НЕ знімаємо (там неприйняте).
      if (restored > 0) {
        opsSync.noteRestored([], adopted)
        if (opsSync.isSync && _canvasReady) await opsSync.reconcileRestored()
      }
      return
    }
    _restoredFor = sid  // store прийняв усе — повторно для цієї дошки не відновлюємо
    const ownKey = backupKey(sid)
    const removable = all.records.map(r => r.key).filter(k => k !== ownKey && mayRemove(k, own, live))
    const persisted = opsSync.persistQueue()
    if (restored === 0) {
      // Нових дій нема (усе вже в черзі) — копії мертвих вкладок можна знімати, щойно
      // власна копія підтверджена.
      if (persisted) removeBackupKeys(removable)
      return
    }
    console.info(`[WB:Recorder] Restored ${restored} ops from localStorage backup`)
    // Б-28: дії з копії є лише в черзі — не на полотні. Звірка: записати звичайним
    // шляхом → свіжий стан сервера → полотно. Копії знімає ЛИШЕ успішна звірка.
    opsSync.noteRestored(removable, adopted)
    if (opsSync.isSync && _canvasReady) await opsSync.reconcileRestored()
  }

  /** Б-28: після успішної відправки — звірити дії з копії, якщо попередня спроба
   *  зупинилась на «транзитній» причині (409 / нова дія). Подієво, не таймером (LAW §12);
   *  при збої читання стану чи stale — лише «Оновити сторінку». */
  function _maybeReconcileAfterFlush(): void {
    if (!_canvasReady || !opsSync.restoredPending || !opsSync.isSync || opsSync.restoring) return
    if (opsSync.pendingOps.length + opsSync.inFlightOps.length > 0) return
    const p = opsSync.restoreProblem
    if (p !== null && p !== 'flush' && p !== 'busy') return
    void opsSync.reconcileRestored()
  }

  /**
   * TLV2-G1b: одна спроба відновлення з PAUSED, дозволена store (таймер 30 с або
   * «Повторити зараз»). Після успіху — дозлив решти черги окремими batch-ами, поки є
   * прогрес; будь-яка невдача зупиняє дозлив (без повторів тут).
   */
  async function _runRecoveryAttempt(): Promise<void> {
    if (_destroyed) return
    const start = opsSync.pendingOps.length + opsSync.inFlightOps.length
    await flush()
    // Дозлив — лише після спроби, що ПРОСУНУЛА чергу. 409 лишає пакет у черзі
    // (LAW §5, 2026-09-24): негайно слати його знову = повтор, заборонений §12.
    if (opsSync.pendingOps.length + opsSync.inFlightOps.length >= start) return
    try {
      for (let i = 0; i < RECOVERY_DRAIN_MAX_BATCHES && !_destroyed && opsSync.isSync; i++) {
        const before = opsSync.pendingOps.length + opsSync.inFlightOps.length
        if (before === 0) return
        await flush()
        if (opsSync.pendingOps.length + opsSync.inFlightOps.length >= before) return
      }
    } finally {
      // Б-28: після виходу з PAUSED відновлені з копії дії — на полотно.
      if (!_destroyed) _maybeReconcileAfterFlush()
    }
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
      // Як сервер: json.dumps(ensure_ascii) — «І» = 6 байт, не 2 (рев'ю P0, 2026-09-24).
      const payloadBytes = serverPayloadBytes(op.payload ?? {})
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
      // Злитий штрих не має перевищити ліміт операції (64 KB), інакше сервер відхилить
      // увесь пакет (рев'ю P0, 2026-09-24) — тоді op іде окремо.
      if (last && tryCoalesceStrokeAppend(last as OpsSyncOp, op as unknown as OpsSyncOp, MAX_PAYLOAD_BYTES)) {
        // Merged into previous pending op — don't push new op
        opCount.value++
        _persistBackupThrottled()
        return
      }
    }

    // Route to store. INV-16: returns false якщо mode=DESYNC → silent drop (hot path safe).
    const accepted = opsSync.record(op as unknown as OpsSyncOp)
    if (!accepted) return  // dropped by store (DESYNC або BOOTSTRAP not done)

    opCount.value++
    _persistBackupThrottled()

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
    // SAVE_BLOCKED: store і так відмовить без HTTP; тут лише не множимо виклики.
    if (opsSync.isSaveBlocked) {
      _persistBackup()
      return
    }

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

      // ACK: порожня черга → копію знято; інакше — перезаписано (обидва через store).
      _persistBackup()
      _maybeReconcileAfterFlush()
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
      if (err instanceof LifecycleStateError) {
        // INV-23 §23.4 Guard 1 + §23.12 — BE rejected ops через invalid lifecycle.
        // NOT DESYNC (Taxonomy B). Store вже cleared pendingOps + inFlightOps.
        // Toast per §23.12 + telemetry, clear backup (ops won't be retryable).
        try {
          trackEvent('wb.ops.lifecycle_blocked', {
            session_id: sid,
            code: err.code,
            recording_state: err.recordingState ?? null,
            is_archived: err.isArchived ?? null,
          })
        } catch { /* telemetry never throws */ }
        // 2026-09-03 (борг з уроку): тост + подія `wb:lifecycle-blocked` → кімната
        // показує постійний банер «Новий запис» і робить полотно read-only.
        // Раніше тост казав «перейдіть у нову дошку» — хибно, re-record є з 05-04.
        announceLifecycleBlock({ code: err.code, recordingState: err.recordingState ?? null, sessionId: sid })
        clearBackup(sid)
        return
      }
      if (err instanceof BeaconUnsupportedError) {
        // Не повинно відбуватись з flush() (тільки sendBeacon throws це). Лог якщо станеться.
        console.warn('[WB:Recorder] flush() unexpected BeaconUnsupportedError:', err)
        return
      }
      if (err instanceof SaveBlockedError) {
        // SAVE_BLOCKED (LAW §4–§5): сервер остаточно відмовив або результат не
        // підтверджено. Черга ціла, банер кімнати пояснює; телеметрія — одна подія
        // на перехід, без payload (ТЗ §7).
        if (err.entered) {
          try {
            trackEvent('wb.ops.save_blocked', {
              session_id: sid,
              kind: err.info?.kind ?? 'unknown',
              http_status: err.info?.httpStatus ?? 0,
              reason: err.info?.reason ?? null,
              op_type: err.info?.invalidOpType ?? null,
              in_flight_count: opsSync.inFlightOps.length,
              pending_count: opsSync.pendingOps.length,
            })
          } catch { /* telemetry never throws */ }
        }
        _persistBackup()
        return
      }
      if (err instanceof SeqResyncError) {
        // 409 SEQ_MISMATCH auto-resynced by store: serverSeq ← expected_seq; inFlight і
        // pending ЛИШАЮТЬСЯ (пакет не застосовано, LAW §5 з 2026-09-24). Наступний
        // природний тик надішле той самий пакет першим. No DESYNC, no user action.
        console.info('[WB:Recorder] 409 seq auto-resynced:', err.message)
        _persistBackup()  // crash-safety: уся черга, включно з пакетом, що отримав 409
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
    void _restoreBackup()

    // Safety interval — ловить ops які debounce не скинув (idle-період, long burst).
    //
    // Phase S PR-3 (2026-04-28): respect bounded retry window AND PAUSED mode.
    // Якщо PAUSED → flush() throws BackpressureError → no-op. Якщо retryUntil active
    // → skip tick (don't burn cycles + don't trigger nested error path).
    flushTimer = setInterval(() => {
      if (opsSync.isPaused) return  // PAUSED — спроби дозволяє лише store (30 с / кнопка)
      if (opsSync.isSaveBlocked) return  // SAVE_BLOCKED — лише дія вчителя (LAW §12)
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
    // Force pending throttled backup to localStorage перед unload — інакше
    // ops emitted у last <1s могли б бути lost on crash.
    _flushPersistBackupTimer()
    void flush()  // final flush — fire-and-forget; data loss on unload accepted
  }

  /**
   * Full cleanup — stop timer, deregister auth-death, reset composable counters.
   * Does NOT reset opsSyncStore черги (інша composable instance може ще use).
   *
   * TLV2-G1b: вихід із кімнати — черга дошки йде в backup, таймер PAUSED і лічильник
   * 503 знімаються (лише якщо store досі на дошці цього рекордера).
   */
  function destroy(): void {
    if (_destroyed) return
    console.info('[WB:Recorder] destroy() — recorder terminated')
    const sid = options.sessionId.value
    if (sid && opsSync.sessionId === sid) {
      _persistBackup()
      opsSync.stopPauseRecovery()
    }
    _destroyed = true
    _stopProbeWatch()
    _stopSessionWatch()
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
    store: {
      onOperation: (l: (op: RecordOperationRequest) => void) => () => void
      /** Б-28: застосувати стан сервера до полотна (boardStore). */
      applyCatchUpState?: (state: Record<string, unknown>) => void
    },
    opts: { canvasReady?: boolean } = {},
  ): () => void {
    console.info('[WB:Recorder] connectToStore — listener registered')
    _canvasReady = opts.canvasReady ?? true
    // Б-28: звірка відновлених дій оновлює ЦЕ полотно (Solo і Classroom однаково).
    let applier: ((state: Record<string, unknown>) => void) | null = null
    if (typeof store.applyCatchUpState === 'function') {
      const board = store
      applier = (state) => board.applyCatchUpState!(state)
      opsSync.setCanvasApplier(applier)
    }
    // TLV2-G1b: connectToStore іде після bootstrap і в Solo, і в Classroom.
    // Відновлення асинхронне (живість вкладок) — дозлив черги лише ПІСЛЯ нього,
    // інакше в Solo (без start()) підхоплені дії чекали б наступної дії вчителя.
    void _restoreBackup().then(async () => {
      if (_destroyed) return
      // Б-28: дії з копії могли бути підхоплені ще до реєстрації полотна (start() раніше
      // connectToStore) — звіряємо тепер, коли полотно є. Одна спроба, не цикл.
      if (_canvasReady && opsSync.restoredPending && opsSync.isSync && !opsSync.restoring && opsSync.restoreProblem === null) {
        await opsSync.reconcileRestored()
      }
      if (!_destroyed && opsSync.isSync && opsSync.pendingOps.length + opsSync.inFlightOps.length > 0) void flush()
    })
    const unsubscribe = store.onOperation((op) => { record(op) })
    return () => {
      unsubscribe()
      if (applier) opsSync.clearCanvasApplier(applier)
    }
  }

  /**
   * Б-28: кімната показала стан дошки (Classroom — після hydrateFromSession). Якщо дії з
   * копії чекали полотна — одна звірка зараз.
   */
  function markCanvasReady(): void {
    if (_canvasReady) return
    _canvasReady = true
    if (opsSync.restoredPending && opsSync.isSync && !opsSync.restoring && opsSync.restoreProblem === null) {
      void opsSync.reconcileRestored()
    }
  }

  // TLV2-G1b: виконавець спроб відновлення з PAUSED. Синхронно, щоб дозволений store
  // flush був зайнятий одразу (жодного вікна для другого запиту).
  const _stopProbeWatch = watch(
    () => opsSync.pauseProbeSeq,
    () => { void _runRecoveryAttempt() },
    { flush: 'sync' },
  )

  // TLV2-G1b: зміна дошки в тій самій кімнаті — черга попередньої дошки йде в її backup
  // до того, як bootstrap нової її скине з пам'яті (INV-CROSS-SESSION).
  const _stopSessionWatch = watch(
    options.sessionId,
    (next, prev) => {
      if (!prev || prev === next || opsSync.sessionId !== prev) return
      if (_persistBackupTimer !== null) {
        clearTimeout(_persistBackupTimer)
        _persistBackupTimer = null
      }
      if (debounceTimer) {
        clearTimeout(debounceTimer)
        debounceTimer = null
      }
      opsSync.persistQueue()  // store ще на prev; у SAVE_BLOCKED — аварійний запис, не звичайний
    },
    { flush: 'sync' },
  )

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
    markCanvasReady,
    manualSnapshot,
    opCount: readonly(opCount),
    isFlushing,
    pipelineStatus,
  }
}
