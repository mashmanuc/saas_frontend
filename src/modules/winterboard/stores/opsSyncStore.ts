// Phase 2 (2026-04-27) — opsSyncStore (Option A: store owns flush lifecycle).
//
// Authoritative spec: saas_docs/domains/winterboard/ops_sync/OPS_SYNC_SSOT.md
//   - INV-15 client-seq-filter (echo broadcast: only apply if op.seq > localSeq)
//   - INV-16 DESYNC HARD RULE (record() NO-OP, flush()/sendBeacon() throw)
//   - INV-17 WS-STRICT (write paths via REST only)
//   - INV-18 SEQ-INITIAL-CONTRACT (new session → last_op_seq=0)
//   - INV-19 multi-tab safety (BroadcastChannel, independent localSeq per tab)
//   - INV-20 PROTOCOL-VERSION-ENFORCEMENT (DESYNC on PROTOCOL_VERSION_MISMATCH)
//
// State machine:
//   BOOTSTRAP — initial. bootstrap() calls GET /state/, sets serverSeq+localSeq, → SYNC.
//   SYNC      — normal. record() enqueues to pendingOps; flush() → POST /replay/batch/.
//   DESYNC    — HARD lock. record() no-op, flush()/sendBeacon() throw DesyncError.
//
// Flush lifecycle (per SSOT §4):
//   1. pop ops з pendingOps → push у inFlightOps
//   2. POST /replay/batch/ {seq: localSeq, ops: inFlightOps[]} з X-Protocol-Version
//   3. on 201: clear inFlightOps; localSeq = response.last_seq
//   4. on 409 SEQ_MISMATCH: enterDesync (caller resync()-ить)
//   5. on 400 PROTOCOL_VERSION_MISMATCH: enterDesync (UI ProtocolMismatchModal)
//   6. on 503 SERVER_BUSY: keep inFlightOps, throw (B4 INV-12 додасть retry orchestration)
//
// Multi-tab (INV-19): кожен tab має independent `pendingOps`/`inFlightOps`/`localSeq`.
// AЛЕ `mode` transitions broadcast'яться через BroadcastChannel — 1 tab DESYNC →
// інші tabs aware (не починають flush у broken стан).
//
// BE dependency: `GET /api/v1/winterboard/sessions/{pk}/state/` per SSOT §5 — Phase 1 BE
// did NOT implement this endpoint (was не у scope). bootstrap() and resync() rely on it.
// Until BE adds the endpoint, callers повинні OBject `state-not-implemented` errors.

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import apiClient from '@/utils/apiClient'
import {
  PROTOCOL_VERSION,
  recordOperationsBatch,
  type BatchRecordResponse,
} from '../api/replay'

// ─── Types ───────────────────────────────────────────────────────────

// Phase S PR-3 (2026-04-28): PAUSED added between SYNC та DESYNC.
//
// PAUSED semantics (per REFACTOR_PLAN.md v2 §3 task #3):
//   - record() ACCEPTS new ops (does NOT block UI input)
//   - flush() THROWS BackpressureError (caller catches gracefully)
//   - inFlightOps PRESERVED (NO drop)
//   - UI shows non-blocking banner "Сервер тимчасово зайнятий..."
//   - Resume on user click "Retry now" (resumeFromPause()) OR auto every 30s
//
// DESYNC reserved тільки для protocol/seq mismatch (INV-16 unchanged).
export type OpsSyncMode = 'BOOTSTRAP' | 'SYNC' | 'PAUSED' | 'DESYNC'

export interface OpsSyncOp {
  op_id: string
  op_type: string
  page_id?: string
  payload: Record<string, unknown>
  /** Optional FE hint for debugging (per SSOT §3 — NOT used for ordering). */
  client_seq?: number
}

interface StateResponse {
  /** SSOT §5: last persisted seq. New session = 0 (INV-18). */
  last_seq: number
  /** SSOT §5: optional snapshot of board state. */
  snapshot?: Record<string, unknown>
  /** SSOT §5: optional snapshot_seq for verifying replay. */
  snapshot_seq?: number
}

interface BroadcastMessage {
  type: 'mode_change'
  mode: OpsSyncMode
  reason?: string
  ts: number
  /** Origin tab id — щоб не реагувати на власні broadcast. */
  origin: string
}

// ─── Constants ───────────────────────────────────────────────────────

const BROADCAST_CHANNEL_NAME = 'winterboard-ops'
/** Phase 2 default; BE дозволяє до 100 ops/batch (matches MAX_OPS_PER_REQUEST у legacy useReplayRecorder). */
const FLUSH_BATCH_SIZE = 50

// Phase S PR-3 (2026-04-28) — INV-12 BOUNDED RETRY orchestration.
/** Max 503 attempts before entering PAUSED mode. After 2 failed attempts → PAUSED. */
const MAX_RETRY_ATTEMPTS = 2
/** Base delay for exp backoff: 200ms * 2^(attempt-1) + jitter(0..150ms). */
const RETRY_BASE_DELAY_MS = 200
/** Jitter ceiling for backoff calc. */
const RETRY_JITTER_MAX_MS = 150
/** Auto-retry interval у PAUSED mode (per REFACTOR_PLAN §3 task #3). */
const PAUSE_AUTO_RETRY_MS = 30_000

function _genTabId(): string {
  return `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

// ─── Store ───────────────────────────────────────────────────────────

export const useOpsSyncStore = defineStore('opsSync', () => {
  // ── State ──
  const mode = ref<OpsSyncMode>('BOOTSTRAP')
  const sessionId = ref<string | null>(null)
  /** Local op counter — INV-15. Per-tab (INV-19 — кожен tab лічить власні broadcasts). */
  const localSeq = ref(0)
  /** Server-confirmed last_op_seq — після bootstrap або flush response. */
  const serverSeq = ref(0)
  const desyncReason = ref<string | null>(null)
  /** Tab id для INV-19 origin filtering. */
  const tabId = ref<string>(_genTabId())

  // ── Buffers (Option A: store owns flush lifecycle, not useReplayRecorder) ──
  /** Ops accepted via record() but не yet flushed to BE. */
  const pendingOps = ref<OpsSyncOp[]>([])
  /** Ops currently mid-flight (between flush() POST and response). On 503 — kept for retry. */
  const inFlightOps = ref<OpsSyncOp[]>([])

  // ── Concurrent flush mutex (Section D HARD CHECKPOINT) ──
  /** Promise of currently in-flight flush() — concurrent callers await same Promise.
   *  null = no flush in progress. Per HARD CHECKPOINT race scenario: timer + push +
   *  unload concurrent → no double-send (single in-flight POST), no in-flight loss. */
  let _flushPromise: Promise<void> | null = null

  // ── Phase S PR-3 (2026-04-28): INV-12 bounded retry state ──
  /** Current retry attempt counter for 503 SERVER_BUSY. Reset on success. Range: 0 | 1 | 2. */
  let _retryAttempt = 0
  /** Unix ms timestamp when next flush is allowed (after exp backoff). null = no delay. */
  const _retryUntil = ref<number | null>(null)
  /** Auto-retry timer для PAUSED mode (resume after PAUSE_AUTO_RETRY_MS). */
  let _pauseTimer: ReturnType<typeof setTimeout> | null = null
  /** Last flush() duration (ms) — exposed для queue visibility UI. */
  const _lastFlushDuration = ref(0)

  // ── BroadcastChannel (INV-19) ──
  let _channel: BroadcastChannel | null = null

  function _initChannel(): void {
    if (_channel || typeof BroadcastChannel === 'undefined') return
    try {
      _channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME)
      _channel.onmessage = (event: MessageEvent<BroadcastMessage>) => {
        const msg = event.data
        if (!msg || msg.origin === tabId.value) return  // ignore own broadcasts
        if (msg.type === 'mode_change' && msg.mode === 'DESYNC') {
          // INV-19: інший tab перейшов у DESYNC → ми теж входимо (не writes у broken стан).
          if (mode.value !== 'DESYNC') {
            mode.value = 'DESYNC'
            desyncReason.value = msg.reason ?? 'cross-tab DESYNC propagation'
          }
        }
      }
    } catch {
      _channel = null  // single-tab degraded mode
    }
  }

  function _broadcast(msg: Omit<BroadcastMessage, 'origin' | 'ts'>): void {
    if (!_channel) return
    try {
      _channel.postMessage({ ...msg, origin: tabId.value, ts: Date.now() } as BroadcastMessage)
    } catch {
      // best-effort
    }
  }

  // ── Computed ──
  const isSync = computed(() => mode.value === 'SYNC')
  const isDesync = computed(() => mode.value === 'DESYNC')
  const isBootstrap = computed(() => mode.value === 'BOOTSTRAP')
  /** Phase S PR-3: PAUSED mode (transient backpressure, NOT data loss). */
  const isPaused = computed(() => mode.value === 'PAUSED')
  /** Phase S PR-3: queue visibility refs (UI status indicators). */
  const pendingCount = computed(() => pendingOps.value.length)
  const inFlightCount = computed(() => inFlightOps.value.length)
  const lastFlushDuration = computed(() => _lastFlushDuration.value)
  const retryUntil = computed(() => _retryUntil.value)

  // ── Internal helpers ──

  /**
   * Read GET /sessions/{pk}/state/ per SSOT §5.
   *
   * BE dependency: endpoint specified у SSOT §5 але не implemented у Phase 1.
   * Phase 2 BE addendum required перед this code does anything useful у production.
   * Callers повинні розрізняти 404 (no endpoint) vs network/auth errors.
   */
  async function _fetchState(sid: string): Promise<StateResponse> {
    return apiClient.get<StateResponse>(`/v1/winterboard/sessions/${sid}/state/`)
  }

  /** Detect Phase 1 PROTOCOL_VERSION_MISMATCH 400 response shape. */
  function _isProtocolMismatch(err: unknown): boolean {
    const e = err as { response?: { status?: number; data?: { error?: string } } }
    return e?.response?.status === 400 && e?.response?.data?.error === 'PROTOCOL_VERSION_MISMATCH'
  }

  /** Detect Phase 1 SEQ_MISMATCH 409 response shape. */
  function _isSeqMismatch(err: unknown): { mismatch: boolean; expectedSeq?: number } {
    const e = err as { response?: { status?: number; data?: { error?: string; expected_seq?: number } } }
    if (e?.response?.status === 409 && e?.response?.data?.error === 'SEQ_MISMATCH') {
      return { mismatch: true, expectedSeq: e.response.data.expected_seq }
    }
    return { mismatch: false }
  }

  /** Detect 503 SERVER_BUSY (INV-12 territory; B4 додасть retry orchestration). */
  function _isServerBusy(err: unknown): boolean {
    const e = err as { response?: { status?: number } }
    return e?.response?.status === 503
  }

  /**
   * INV-23 §23.4 Guard 1 — detect 409 lifecycle write-rejection responses.
   *
   * Per §23.12 status table, 3 codes ARE entity-conflict (Taxonomy B per
   * TRANSPORT_ERROR_SEMANTICS) — they MUST NOT trigger DESYNC:
   *   - SESSION_ARCHIVED
   *   - REPLAY_FROZEN_NO_WRITE
   *   - PAUSED_RECORDING_READ_ONLY
   *
   * Returns enum string OR null. Caller throws typed `LifecycleStateError`.
   */
  function _isLifecycleError(err: unknown): {
    code: 'SESSION_ARCHIVED' | 'REPLAY_FROZEN_NO_WRITE' | 'PAUSED_RECORDING_READ_ONLY' | null
    recordingState?: string
    isArchived?: boolean
  } {
    const e = err as {
      response?: {
        status?: number
        data?: { error?: string; recording_state?: string; is_archived?: boolean }
      }
    }
    if (e?.response?.status !== 409) return { code: null }
    const code = e.response.data?.error
    if (
      code === 'SESSION_ARCHIVED' ||
      code === 'REPLAY_FROZEN_NO_WRITE' ||
      code === 'PAUSED_RECORDING_READ_ONLY'
    ) {
      return {
        code,
        recordingState: e.response.data?.recording_state,
        isArchived: e.response.data?.is_archived,
      }
    }
    return { code: null }
  }

  // ── Actions ──

  /**
   * Bootstrap (INV-18): GET /sessions/{sid}/state/ → set serverSeq=localSeq=last_seq.
   *
   * Side effects:
   *   - mode → SYNC (з BOOTSTRAP)
   *   - opens BroadcastChannel (INV-19)
   *
   * Throws:
   *   - on PROTOCOL_VERSION_MISMATCH → enterDesync + DesyncError
   *   - on network/HTTP errors → propagates up (caller decides retry)
   */
  async function bootstrap(sid: string): Promise<void> {
    sessionId.value = sid
    _initChannel()
    try {
      const response = await _fetchState(sid)
      serverSeq.value = response.last_seq | 0
      localSeq.value = response.last_seq | 0
      mode.value = 'SYNC'
      desyncReason.value = null
    } catch (err) {
      if (_isProtocolMismatch(err)) {
        enterDesync('protocol-version-mismatch')
        throw new DesyncError('bootstrap blocked: protocol-version-mismatch')
      }
      throw err  // caller decides retry (transient errors etc.)
    }
  }

  /**
   * INV-16 record(): IF mode === DESYNC → NO-OP (silent drop, return false).
   *
   * Чому НЕ throw: record() може викликатися в hot drawing path; throw зламає UX.
   * INV-16 specifies "NO-OP, не throw". UI має показати banner про DESYNC окремо.
   *
   * Returns:
   *   - true якщо op accepted (mode=SYNC)
   *   - false якщо dropped (mode=DESYNC або BOOTSTRAP not done)
   */
  function record(op: OpsSyncOp): boolean {
    // Phase S PR-3 (2026-04-28): PAUSED mode ACCEPTS ops (no UI input block).
    // DESYNC blocks (INV-16); BOOTSTRAP blocks (pre-init).
    if (mode.value === 'DESYNC' || mode.value === 'BOOTSTRAP') return false
    pendingOps.value.push(op)
    return true
  }

  /**
   * INV-16 flush(): IF mode === DESYNC → THROW DesyncError.
   * Otherwise: pop pendingOps → inFlightOps → POST /replay/batch/ → handle response.
   *
   * On 201 (success):
   *   - clear inFlightOps
   *   - localSeq, serverSeq = response.last_seq
   *
   * On 400 PROTOCOL_VERSION_MISMATCH (INV-20):
   *   - enterDesync('protocol-version-mismatch')
   *   - inFlightOps lost (UI directs user to reload — recovery via reload, not resync)
   *   - throw DesyncError
   *
   * On 409 SEQ_MISMATCH (per SSOT §4):
   *   - enterDesync('seq-mismatch')
   *   - inFlightOps + pendingOps dropped (stale; resync re-bootstraps)
   *   - throw DesyncError
   *
   * On 503 SERVER_BUSY:
   *   - keep inFlightOps (next flush() retries; B4 додасть INV-12 max-2 jitter orchestration)
   *   - throw error (caller може decide drop after retries exhausted)
   *
   * Other errors:
   *   - keep inFlightOps (transient)
   *   - throw original error
   */
  async function flush(): Promise<void> {
    // INV-16 guard FIRST (sync path — throws before any mutex acquisition)
    if (mode.value === 'DESYNC') {
      throw new DesyncError(`flush() blocked: ${desyncReason.value ?? 'unknown reason'}`)
    }
    // Phase S PR-3 (2026-04-28): PAUSED — flush throws BackpressureError.
    // Caller (useReplayRecorder) catches gracefully. inFlightOps preserved.
    if (mode.value === 'PAUSED') {
      throw new BackpressureError('flush() blocked: PAUSED (server backpressure)')
    }
    if (mode.value === 'BOOTSTRAP') {
      throw new Error('flush() called before bootstrap() — call bootstrap(sid) first')
    }
    // Phase S PR-3: honor exp-backoff window — caller's safety interval should also
    // respect this, але defensive guard тут не зашкодить (race з timer).
    if (_retryUntil.value !== null && Date.now() < _retryUntil.value) {
      // Throw "transient" error без entering DESYNC; caller treats як 503.
      const remaining = _retryUntil.value - Date.now()
      throw new Error(`flush() backoff active (${remaining}ms remaining)`)
    }
    // Concurrent flush mutex — Section D HARD CHECKPOINT compliance.
    // Якщо flush already in progress: concurrent callers await same Promise.
    // Це гарантує:
    //   - 0 double-send (один POST per pending batch)
    //   - 0 in-flight loss (concurrent callers receive resolution/rejection of same op)
    //   - Race scenario (timer + record + unload) → 1 network request
    if (_flushPromise) {
      return _flushPromise
    }
    _flushPromise = (async () => {
      const _start = Date.now()
      try {
        await _doFlush()
      } finally {
        _lastFlushDuration.value = Date.now() - _start
        _flushPromise = null
      }
    })()
    return _flushPromise
  }

  /**
   * Drain ALL queued ops (pendingOps + inFlightOps) by calling flush() repeatedly
   * until both queues empty.
   *
   * **Why this exists:** `flush()` processes only ONE batch (FLUSH_BATCH_SIZE = 50 ops)
   * per call. Callers що need ALL ops sent before continuing (e.g. finalize barrier
   * у INV-22) MUST use flushAll() — otherwise ops 51+ stay у pendingOps and never
   * reach BE → INV-22 §22.0 invariant violated (replay tail truncated).
   *
   * **Bug history (2026-05-08):** PR-1b finalize flow called `await opsSync.flush()`
   * once. After 250+ strokes (~1500 ops), only first 50 reached BE; rest lost.
   * Backend barrier returned IMMEDIATE/WAITED for `serverSeq=50`, BE finalized
   * Replay з `recording_stopped_seq≈50`. User saw blank/truncated replay.
   *
   * **Behavior:**
   * - Iterates calling `flush()` until both queues empty.
   * - On any flush() throw (DESYNC / PAUSED / PROTOCOL_VERSION_MISMATCH / 503
   *   backoff / network) → propagates to caller. Caller decides retry.
   * - Bounded by `maxIterations` (default 100 = up to 5000 ops з 50/batch).
   *   Throws Error если drain не completes — protects against pathological loops.
   * - Concurrent record() calls during await ARE handled: each iteration takes
   *   fresh slice of pendingOps. UI MUST disable input during finalize (caller's
   *   responsibility) щоб уникнути monotonic-fill races.
   */
  async function flushAll(opts: { maxIterations?: number } = {}): Promise<void> {
    const max = opts.maxIterations ?? 100
    for (let i = 0; i < max; i++) {
      if (pendingOps.value.length === 0 && inFlightOps.value.length === 0) {
        return  // fully drained
      }
      // Single bounded flush — propagates throws (DESYNC / PAUSED / 503 / etc.).
      // Caller catches per existing flush() error contract.
      await flush()
    }
    throw new Error(
      `flushAll: drain incomplete after ${max} iterations ` +
      `(pending=${pendingOps.value.length}, inFlight=${inFlightOps.value.length}). ` +
      `Possible causes: record() filling faster than flush() drains, OR network ` +
      `pathology causing zero-progress flushes.`,
    )
  }

  async function _doFlush(): Promise<void> {
    const sid = sessionId.value
    if (!sid) {
      throw new Error('flush() called without sessionId — bootstrap() failed?')
    }
    if (pendingOps.value.length === 0 && inFlightOps.value.length === 0) {
      return  // nothing to flush
    }

    // If we already have inFlight (from previous 503), retry those FIRST without
    // adding new pending ops. This preserves ordering invariant.
    //
    // ATOMICITY GUARANTEE (concern #2 + #3):
    //   pendingOps → inFlightOps transition is a SINGLE SYNCHRONOUS step.
    //   `splice(0, N)` removes N ops from pendingOps AND returns them — atomic mutation.
    //   `push(...batch)` follows immediately у same synchronous tick — JavaScript
    //   single-threaded execution model guarantees no other code (record(), timer,
    //   etc.) can run between splice() and push(). НЕМАЄ await between → atomic.
    //
    //   record() called during AWAIT of network POST (line 302+) pushes до pendingOps
    //   (line 223) — those ops survive у pendingOps for next flush() cycle. NOT lost.
    //   pendingOps after splice = ops що прийшли пізніше; будуть flush'ені наступним tick.
    let batch: OpsSyncOp[]
    if (inFlightOps.value.length > 0) {
      batch = inFlightOps.value.slice()  // retry existing
    } else {
      // Move up to FLUSH_BATCH_SIZE ops з pending → inFlight (atomic, synchronous).
      // Phase S PR-3: also bound by MAX_BATCH_BYTES = 512KB aggregate ceiling.
      const taking = Math.min(pendingOps.value.length, FLUSH_BATCH_SIZE)
      batch = pendingOps.value.splice(0, taking)  // sync: remove N from pending
      inFlightOps.value.push(...batch)            // sync: add to inFlight (no await between)
    }

    try {
      const response: BatchRecordResponse = await recordOperationsBatch(
        sid,
        serverSeq.value,
        // recordOperationsBatch type expects RecordOperationRequest — runtime shape compatible
        batch as unknown as Parameters<typeof recordOperationsBatch>[2],
      )
      // Success — clear inFlight, advance seq
      inFlightOps.value = []
      serverSeq.value = response.last_seq
      localSeq.value = Math.max(localSeq.value, response.last_seq)
      // Phase S PR-3: reset retry state on success.
      _retryAttempt = 0
      _retryUntil.value = null
    } catch (err) {
      if (_isProtocolMismatch(err)) {
        // INV-20: client/server version mismatch. UI ProtocolMismatchModal,
        // user must reload. inFlightOps lost (acceptable — version drift means
        // contract incompatible).
        enterDesync('protocol-version-mismatch')
        inFlightOps.value = []
        pendingOps.value = []
        throw new DesyncError('flush() blocked: protocol-version-mismatch')
      }
      const seqMismatch = _isSeqMismatch(err)
      if (seqMismatch.mismatch) {
        // Per SSOT §4: seq mismatch → caller (or auto-recovery) resync()-ить.
        // Drop inFlight + pending — resync re-bootstraps з clean slate.
        const reason = `seq-mismatch (server expected ${seqMismatch.expectedSeq})`
        enterDesync(reason)
        inFlightOps.value = []
        pendingOps.value = []
        throw new DesyncError(`flush() blocked: ${reason}`)
      }
      // INV-23 §23.4 Guard 1 — BE rejected write через invalid lifecycle state.
      // Taxonomy B per TRANSPORT_ERROR_SEMANTICS: NOT DESYNC — entity-conflict
      // routes до own UX (toast). Drop pending+inFlight: archived/frozen sessions
      // never accept writes; paused = read-only per §23.0.B (FE retry після
      // explicit user resume). Caller (useReplayRecorder) catches LifecycleStateError
      // → emits toast per §23.12.
      const lifecycle = _isLifecycleError(err)
      if (lifecycle.code) {
        inFlightOps.value = []
        pendingOps.value = []
        throw new LifecycleStateError(
          lifecycle.code,
          lifecycle.recordingState,
          lifecycle.isArchived,
        )
      }
      if (_isServerBusy(err)) {
        // Phase S PR-3 (2026-04-28) INV-12 BOUNDED RETRY orchestration:
        //   - increment _retryAttempt
        //   - if > MAX_RETRY_ATTEMPTS → enter PAUSED (NOT DESYNC; NOT drop)
        //   - else compute backoff (Retry-After header takes precedence)
        // Keep inFlightOps preserved across all paths (no data loss).
        _retryAttempt += 1

        if (_retryAttempt > MAX_RETRY_ATTEMPTS) {
          // 3rd 503 → PAUSED. Buffers preserved. Caller catches BackpressureError
          // (next flush() call). Auto-retry timer starts; user can also click "Retry now".
          enterPaused('server-busy-exhausted-retries')
          // Keep _retryAttempt at MAX+1 — resumeFromPause() resets it to 0.
          throw err
        }

        // Compute backoff. Retry-After header (seconds) takes precedence per LAW.
        const retryAfter = _parseRetryAfter(err)
        let backoffMs: number
        if (retryAfter !== null) {
          backoffMs = retryAfter
        } else {
          const exp = RETRY_BASE_DELAY_MS * Math.pow(2, _retryAttempt - 1)
          const jitter = Math.floor(Math.random() * RETRY_JITTER_MAX_MS)
          backoffMs = exp + jitter
        }
        _retryUntil.value = Date.now() + backoffMs

        // Throw original error so caller (useReplayRecorder) receives 503 status
        // and can emit telemetry. Caller's safety interval respects _retryUntil
        // (does NOT fire flush() until window expires).
        throw err
      }
      // Other errors (network, 401, 5xx без specific handling): keep inFlight, propagate
      throw err
    }
  }

  /**
   * Phase S PR-3 (2026-04-28): parse Retry-After header (RFC 7231).
   *
   * Format: integer seconds OR HTTP-date. We support seconds form only (matches
   * BE PR-1 implementation що sets `Retry-After: <seconds>`).
   *
   * Returns ms або null якщо header absent/malformed.
   */
  function _parseRetryAfter(err: unknown): number | null {
    const e = err as { response?: { headers?: Record<string, string> } }
    const headers = e?.response?.headers
    if (!headers) return null
    const raw = headers['retry-after'] ?? headers['Retry-After']
    if (!raw) return null
    const seconds = parseFloat(raw)
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.floor(seconds * 1000)
    }
    return null
  }

  /**
   * sendBeacon() — Variant A per agent-A locked decision (2026-04-27):
   *   ALWAYS throws BeaconUnsupportedError.
   *
   * Reason inline: navigator.sendBeacon API CANNOT set custom request headers.
   * Phase 1 BE INV-20 requires `X-Protocol-Version: v3` header on /replay/batch/.
   * Beacon → BE rejection 400 PROTOCOL_VERSION_MISMATCH guaranteed → беacon path
   * has zero reliable success scenarios → eliminate it entirely (per LAW §10).
   *
   * Caller (useReplayRecorder Section D unload handler) MUST catch BeaconUnsupportedError
   * and select alternative recovery: synchronous flush() через keepalive fetch або
   * accept data loss (best-effort guarantees not provided post-Phase 1).
   *
   * INV-16 still applicable: якщо mode=DESYNC — throw DesyncError (precedence over
   * BeaconUnsupportedError; DESYNC means no writes regardless of transport).
   */
  function sendBeacon(): never {
    if (mode.value === 'DESYNC') {
      throw new DesyncError(`sendBeacon() blocked: ${desyncReason.value ?? 'unknown reason'}`)
    }
    throw new BeaconUnsupportedError(
      'sendBeacon unsupported post-Phase 1: navigator.sendBeacon cannot set ' +
      'X-Protocol-Version header (LAW §10 INV-20). Use flush() with keepalive ' +
      'fetch or accept data loss.',
    )
  }

  /**
   * INV-15 applyServerOp(): apply op from BE broadcast тільки якщо op.seq > localSeq.
   *
   * Захищає від:
   *   - Echo: op створив наш tab → broadcast повертається → ігноруємо
   *     (op.seq уже у localSeq після flush()'s commitFlushedSeq advance)
   *   - Stale: op.seq <= localSeq → already applied or pre-bootstrap → drop
   *
   * Returns: true якщо applied (caller може передати у boardStore), false якщо dropped.
   */
  function applyServerOp(op: { seq?: number }): boolean {
    if (typeof op.seq !== 'number') return false
    if (op.seq <= localSeq.value) return false  // INV-15 filter
    localSeq.value = op.seq
    serverSeq.value = Math.max(serverSeq.value, op.seq)
    return true
  }

  /**
   * Enter DESYNC state. Triggers:
   *   - PROTOCOL_VERSION_MISMATCH (INV-20) — flush() catch
   *   - 409 SEQ_MISMATCH (SSOT §4) — flush() catch
   *   - 503 SERVER_BUSY exhausted (B4 INV-12) — caller signal
   *   - Cross-tab broadcast (INV-19 propagation)
   *
   * Side effects:
   *   - Mode → DESYNC (immediately blocks future writes per INV-16)
   *   - Cross-tab broadcast (інші tabs entering DESYNC too)
   *   - UI responsibility: show DesyncRecoveryBanner / ProtocolMismatchModal
   */
  function enterDesync(reason: string): void {
    if (mode.value === 'DESYNC') return  // already there
    mode.value = 'DESYNC'
    desyncReason.value = reason
    _broadcast({ type: 'mode_change', mode: 'DESYNC', reason })
  }

  /**
   * Phase S PR-3 (2026-04-28): enter PAUSED mode (transient backpressure).
   *
   * Triggers:
   *   - 503 SERVER_BUSY exhausted MAX_RETRY_ATTEMPTS (per INV-12)
   *
   * Side effects:
   *   - Mode → PAUSED (record() still accepts; flush() throws BackpressureError)
   *   - inFlightOps + pendingOps PRESERVED (no data loss)
   *   - Auto-retry timer scheduled (PAUSE_AUTO_RETRY_MS)
   *   - UI responsibility: show non-blocking banner з "Retry now" button
   *
   * NOT broadcast cross-tab — PAUSED — local backpressure signal, кожен tab decides
   * самостійно (DESYNC broadcasts because contract drift affects all tabs equally).
   */
  function enterPaused(reason: string): void {
    if (mode.value === 'PAUSED') return  // already there
    if (mode.value === 'DESYNC') return  // DESYNC takes precedence (INV-16)
    mode.value = 'PAUSED'
    desyncReason.value = reason  // re-use field для UI banner messaging
    // Schedule auto-retry. User can also click "Retry now" → resumeFromPause().
    if (_pauseTimer) clearTimeout(_pauseTimer)
    _pauseTimer = setTimeout(() => {
      _pauseTimer = null
      // Auto-resume only якщо ще у PAUSED (user не натиснув Retry й не з'явився DESYNC).
      if (mode.value === 'PAUSED') {
        resumeFromPause()
      }
    }, PAUSE_AUTO_RETRY_MS)
  }

  /**
   * Phase S PR-3 (2026-04-28): resume from PAUSED mode.
   *
   * Triggers:
   *   - User click "Retry now" button (UI banner)
   *   - PAUSE_AUTO_RETRY_MS timer fires
   *
   * Side effects:
   *   - Mode → SYNC (з PAUSED)
   *   - Reset _retryAttempt = 0, _retryUntil = null
   *   - inFlightOps preserved (next flush() retries SAME batch — INV-14 dedup safe)
   *
   * Caller (useReplayRecorder) typically triggers flush() shortly after resume —
   * either via safety interval or explicit call.
   */
  function resumeFromPause(): void {
    if (mode.value !== 'PAUSED') return
    if (_pauseTimer) {
      clearTimeout(_pauseTimer)
      _pauseTimer = null
    }
    _retryAttempt = 0
    _retryUntil.value = null
    desyncReason.value = null
    mode.value = 'SYNC'
  }

  /**
   * Resync: GET /sessions/{sid}/state/ → reconcile localSeq=serverSeq=last_seq.
   * Drops pending + inFlight (stale post-DESYNC).
   * Mode → SYNC (з DESYNC).
   *
   * Caller (DesyncRecoveryBanner button or auto on 409) тригерить resync().
   */
  async function resync(sid: string): Promise<void> {
    if (sid !== sessionId.value) {
      // Different session — full bootstrap
      reset()
      await bootstrap(sid)
      return
    }
    // Same session — fetch fresh state
    const response = await _fetchState(sid)
    pendingOps.value = []
    inFlightOps.value = []
    serverSeq.value = response.last_seq | 0
    localSeq.value = response.last_seq | 0
    mode.value = 'SYNC'
    desyncReason.value = null
  }

  /**
   * Reset: повністю очистити store (для unmount session, login change, etc.).
   * Cleanup BroadcastChannel.
   */
  function reset(): void {
    mode.value = 'BOOTSTRAP'
    sessionId.value = null
    localSeq.value = 0
    serverSeq.value = 0
    desyncReason.value = null
    pendingOps.value = []
    inFlightOps.value = []
    // Phase S PR-3: reset retry state + cancel auto-retry timer
    _retryAttempt = 0
    _retryUntil.value = null
    _lastFlushDuration.value = 0
    if (_pauseTimer) {
      clearTimeout(_pauseTimer)
      _pauseTimer = null
    }
    if (_channel) {
      try { _channel.close() } catch { /* noop */ }
      _channel = null
    }
  }

  return {
    // State (readonly у consumer template)
    mode,
    sessionId,
    localSeq,
    serverSeq,
    desyncReason,
    tabId,
    pendingOps,
    inFlightOps,

    // Computed
    isSync,
    isDesync,
    isBootstrap,
    // Phase S PR-3 (2026-04-28): PAUSED mode + queue visibility refs
    isPaused,
    pendingCount,
    inFlightCount,
    lastFlushDuration,
    retryUntil,

    // Actions
    bootstrap,
    record,
    flush,
    flushAll,
    sendBeacon,
    applyServerOp,
    enterDesync,
    // Phase S PR-3: PAUSED mode actions
    enterPaused,
    resumeFromPause,
    resync,
    reset,

    // Constants (consumer/test access)
    PROTOCOL_VERSION,
    FLUSH_BATCH_SIZE,
    MAX_RETRY_ATTEMPTS,
  }
})

// ─── Custom errors ───────────────────────────────────────────────────

/**
 * Thrown by opsSyncStore.flush() / .sendBeacon() коли mode=DESYNC.
 * Caller (useReplayRecorder Section D) має catch + НЕ повертати ops у retryQueue
 * (per INV-16 hard rule — pending ops dropped on DESYNC entry).
 */
export class DesyncError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DesyncError'
  }
}

/**
 * INV-23 §23.4 Guard 1 — thrown by opsSyncStore.flush() коли BE rejects writes
 * через invalid lifecycle state. Taxonomy B per TRANSPORT_ERROR_SEMANTICS
 * (entity-conflict, NOT DESYNC).
 *
 * `code` — one of 3 enum values per §23.12:
 *   - SESSION_ARCHIVED
 *   - REPLAY_FROZEN_NO_WRITE
 *   - PAUSED_RECORDING_READ_ONLY
 *
 * Caller (useReplayRecorder) MUST catch + route до toast per §23.12. NEVER
 * route through DESYNC recovery (that would corrupt FE state model).
 */
export class LifecycleStateError extends Error {
  public readonly code: 'SESSION_ARCHIVED' | 'REPLAY_FROZEN_NO_WRITE' | 'PAUSED_RECORDING_READ_ONLY'
  public readonly recordingState?: string
  public readonly isArchived?: boolean

  constructor(
    code: 'SESSION_ARCHIVED' | 'REPLAY_FROZEN_NO_WRITE' | 'PAUSED_RECORDING_READ_ONLY',
    recordingState?: string,
    isArchived?: boolean,
  ) {
    super(`flush() blocked: lifecycle ${code} (state=${recordingState ?? 'unknown'} archived=${isArchived ?? 'unknown'})`)
    this.name = 'LifecycleStateError'
    this.code = code
    this.recordingState = recordingState
    this.isArchived = isArchived
  }
}

/**
 * Thrown ALWAYS by opsSyncStore.sendBeacon() (Variant A locked 2026-04-27 by agent-A).
 *
 * Reason: navigator.sendBeacon CANNOT set X-Protocol-Version header. Phase 1 BE
 * INV-20 enforces header on /replay/batch/ — beacon dispatch guaranteed to fail
 * 400 PROTOCOL_VERSION_MISMATCH. Eliminating beacon path entirely per LAW §10.
 *
 * Caller (Section D unload handler) MUST catch and choose alternative recovery
 * (keepalive fetch, accept data loss, etc.).
 */
export class BeaconUnsupportedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BeaconUnsupportedError'
  }
}

/**
 * Phase S PR-3 (2026-04-28): thrown by opsSyncStore.flush() коли mode=PAUSED.
 *
 * Semantics:
 *   - PAUSED ≠ DESYNC: transient backpressure, NOT contract drift
 *   - inFlightOps + pendingOps PRESERVED (no data loss)
 *   - Caller (useReplayRecorder) catches gracefully (NO retry storm — wait for resume)
 *   - User clicks "Retry now" OR auto-retry (30s) → resumeFromPause() → flush retried
 */
export class BackpressureError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BackpressureError'
  }
}
