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

export type OpsSyncMode = 'BOOTSTRAP' | 'SYNC' | 'DESYNC'

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
    if (mode.value !== 'SYNC') return false  // NO-OP for DESYNC OR BOOTSTRAP
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
    if (mode.value === 'BOOTSTRAP') {
      throw new Error('flush() called before bootstrap() — call bootstrap(sid) first')
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
      try {
        await _doFlush()
      } finally {
        _flushPromise = null
      }
    })()
    return _flushPromise
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
      // Move up to FLUSH_BATCH_SIZE ops з pending → inFlight (atomic, synchronous)
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
      if (_isServerBusy(err)) {
        // Keep inFlight for next retry. B4 (INV-12) додасть max-2 attempts
        // orchestration з jitter 100-500ms. Поки caller вирішує retry/drop.
        throw err
      }
      // Other errors (network, 401, 5xx без specific handling): keep inFlight, propagate
      throw err
    }
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

    // Actions
    bootstrap,
    record,
    flush,
    sendBeacon,
    applyServerOp,
    enterDesync,
    resync,
    reset,

    // Constants (consumer/test access)
    PROTOCOL_VERSION,
    FLUSH_BATCH_SIZE,
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
