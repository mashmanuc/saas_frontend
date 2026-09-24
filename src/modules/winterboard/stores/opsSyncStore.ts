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
//   4. on 409 SEQ_MISMATCH: AUTO-RESYNC (serverSeq = expected_seq, KEEP inFlight і
//      pending — 2026-09-24, рішення власника, LAW §5) → throw SeqResyncError. Mode
//      stays SYNC (NO DESYNC). Caller (useReplayRecorder) catches SeqResyncError → logs,
//      next natural tick sends the same batch first with correct seq. No user action.
//      Old behavior (enterDesync) dropped all ops — data loss. SeqResyncError preserves
//      pendingOps that haven't reached server yet.
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
  checkOps,
  type BatchRecordResponse,
} from '../api/replay'
import { emitWritePathEvent } from '../telemetry/writePathTelemetry'
import { writeBlocked, readBlocked, removeBlocked, blockedKey } from '../composables/useBlockedOps'
import {
  backupKey, clearBackup, readAllBackups, readLegacyBackup, removeBackupKeys, saveBackup, setOpsOwner, setOpsTab,
} from '../composables/useOpsBackup'
import { holdTabLock, liveTabIds, mayAdopt, mayRemove } from '../composables/tabLiveness'

// ─── Types ───────────────────────────────────────────────────────────

// Phase S PR-3 (2026-04-28): PAUSED added between SYNC та DESYNC.
//
// PAUSED semantics (TLV2-G1b, SYSTEM_LAW §5 / SSOT INV-12):
//   - record() ACCEPTS new ops (does NOT block UI input)
//   - flush() THROWS BackpressureError, крім одного дозволеного flush на спробу
//   - inFlightOps + pendingOps PRESERVED з тими самими op_id (NO drop)
//   - UI: OpsPausedBanner — видимий стан + «Повторити зараз» (retryNow())
//   - спроба відновлення: один HTTP раз на 30 с (єдиний таймер) або за кнопкою;
//     503 / без відповіді → лишаємось у PAUSED; інша відповідь → SYNC
//
// DESYNC reserved тільки для protocol/seq mismatch (INV-16 unchanged).
//
// SAVE_BLOCKED (2026-09-23, SYSTEM_LAW §4–§5, P0 ТЗ чесного збереження):
//   - сервер ОСТАТОЧНО відмовив пакету (400 validation_failed, інший 4xx, 429) або
//     результат не підтверджено (5xx≠503, немає відповіді);
//   - flush() THROWS SaveBlockedError ДО будь-якого HTTP — для всіх викликачів;
//   - черги цілі (ті самі op_id), аварійний запис `useBlockedOps` з перевіркою;
//   - record() приймає до стелі MAX_BLOCKED_QUEUE_OPS, далі — false + лічильник;
//   - вихід лише дією вчителя (retryBlocked / discardBlocked); НЕ cross-tab.
export type OpsSyncMode = 'BOOTSTRAP' | 'SYNC' | 'PAUSED' | 'DESYNC' | 'SAVE_BLOCKED'

/** Чому збереження зупинено (SYSTEM_LAW §5 «Остаточні відмови»). */
export type SaveBlockKind =
  | 'rejected'          // 400 validation_failed, конкретний op з вихідного пакета
  | 'request_rejected'  // 400 без коректного індексу, 415, інший 4xx
  | 'forbidden'         // 403
  | 'not_found'         // 404
  | 'too_large'         // 413
  | 'rate_limited'      // 429
  | 'unconfirmed'       // 5xx≠503 або немає HTTP-відповіді — невідомо, чи застосовано
  | 'storage_unreadable' // аварійний запис цієї дошки є, але його не вдалося прочитати

export interface SaveBlockInfo {
  kind: SaveBlockKind
  /** 0 — немає HTTP-відповіді. */
  httpStatus: number
  /** Машинний код сервера (`reason`/`error`), без даних учителя. */
  reason: string | null
  invalidOpIndex: number | null
  invalidOpId: string | null
  invalidOpType: string | null
  /** Не раніше цього моменту (мс) дозволена спроба для `rate_limited`. */
  retryNotBefore: number | null
  at: number
  /** Відбиток збірки клієнта, що отримав відмову (повтор `rejected` — лише з іншою). */
  feBuild: string
  /** Аварійний запис ліг і перевірений. false → введення блокується. */
  storageOk: boolean
  /** Стан відновлено з аварійного запису після reload. */
  restored: boolean
}

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
  /** SSOT §5: board state під ключем `state` (реальний BE контракт WBSessionStateView). */
  state?: Record<string, unknown>
  /** INV-24: BE-сигнал що state несвіжий (fallback path). true → skip hydrate. */
  stale?: boolean
  /** SSOT §5: optional snapshot of board state (legacy поле, BE не шле). */
  snapshot?: Record<string, unknown>
  /** SSOT §5: optional snapshot_seq for verifying replay. */
  snapshot_seq?: number
}

// ─── INV-24 WS-CATCHUP types ─────────────────────────────────────────

export type CatchUpStatus = 'applied' | 'current' | 'stale' | 'blocked' | 'flush-failed'

/** Б-28: результат звірки відновлених із копії дій. */
export type RestoreResult =
  | 'applied' | 'blocked' | 'flush-failed' | 'fetch-failed' | 'stale' | 'busy' | 'no-applier' | 'apply-failed'

export interface CatchUpResult {
  status: CatchUpStatus
  /** localSeq після catch-up (advance лише при status='applied'). */
  lastSeq: number
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
/** TLV2-G1b: у PAUSED — одна спроба відновлення раз на цей інтервал (SYSTEM_LAW §5, §12). */
const PAUSE_AUTO_RETRY_MS = 30_000

/**
 * Стеля черги в SAVE_BLOCKED і PAUSED: далі record() відмовляє, кімната блокує
 * введення (LAW §4; PAUSED — рішення власника 2026-09-24).
 */
const MAX_BLOCKED_QUEUE_OPS = 3000

/**
 * Сумарна стеля одного POST /replay/batch/ (поверх 50 ops). 128 KB = 2× ліміту
 * однієї операції (64 KB): великі проміжні проксі/CDN не ріжуть запит, а один
 * великий op завжди проходить сам. Раніше стеля була лише в коментарі.
 */
export const MAX_BATCH_BYTES = 128 * 1024
const _enc = new TextEncoder()
function _opBytes(op: OpsSyncOp): number {
  try { return _enc.encode(JSON.stringify(op)).byteLength } catch { return MAX_BATCH_BYTES }
}

/**
 * Відбиток збірки: у проді URL модуля містить хеш файлу й міняється з кожною
 * новою версією. Повтор відхиленого (`rejected`) пакета дозволено лише іншій збірці.
 */
const FE_BUILD: string = (() => {
  try { return new URL(import.meta.url).pathname } catch { return 'unknown' }
})()

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
  /**
   * Акаунт, якому належать копії черги цієї вкладки. Кімната ставить
   * `setBlockedOwner(userId)` після входу; у межах store, не модуля — новий store
   * (нова вкладка / тест) починає без власника.
   */
  let _blockedOwnerId: string | null = null
  setOpsOwner(null)
  setOpsTab(tabId.value)  // звичайна копія черги — своя на кожну вкладку (рев'ю P0, 2026-09-24)
  holdTabLock(tabId.value)  // «вкладка жива»: її копії інші вкладки не підхоплюють і не стирають
  /**
   * Копії старого формату без власника для цієї дошки: не відновлюються й не
   * надсилаються, лише показуються для ручного завантаження / прибирання.
   */
  const legacyCopies = ref<Array<{ key: string; raw: string }>>([])

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
  /** TLV2-G1b: єдиний таймер PAUSED — через PAUSE_AUTO_RETRY_MS дозволяє одну спробу. */
  let _pauseTimer: ReturnType<typeof setTimeout> | null = null
  /** TLV2-G1b: дозвіл рівно на один flush() у PAUSED (таймер або «Повторити зараз»). */
  let _probeArmed = false
  /** TLV2-G1b: лічильник запитаних спроб — виконавець (рекордер кімнати) слухає його. */
  const pauseProbeSeq = ref(0)
  /** TLV2-G1b: спроба з PAUSED зараз у мережі (кнопка банера неактивна). */
  const probeInFlight = ref(false)
  /** Last flush() duration (ms) — exposed для queue visibility UI. */
  const _lastFlushDuration = ref(0)

  // ── SAVE_BLOCKED (2026-09-23) ──
  const saveBlock = ref<SaveBlockInfo | null>(null)
  /** Дії, яким record() відмовив через стелю черги в SAVE_BLOCKED / PAUSED (видимо в банері). */
  const droppedWhileBlocked = ref(0)
  /**
   * Останній запис звичайної копії черги (SYNC/PAUSED) не ліг. Разом із непорожньою
   * чергою = «черга без копії»: у PAUSED блокує введення, будь-де — вихід (LAW §4–§5).
   */
  const backupFailed = ref(false)
  /**
   * Стан дошки при відкритті не отримано: store лишився в BOOTSTRAP і record()
   * відкидає дії. Кімната показує банер і блокує малювання (рев'ю P0, 2026-09-24).
   */
  const bootstrapFailed = ref(false)

  // ── Б-28 (2026-09-24): відновлені з копії дії — одразу на полотні ──
  /** Іде звірка відновлених дій (запис → свіжий стан сервера → полотно). Малювання стоїть. */
  const restoring = ref(false)
  /** У черзі є дії з копії, яких ще нема на полотні (до успішної звірки). */
  const restoredPending = ref(false)
  /**
   * Звірка не вдалася — копію НЕ знято, полотно НЕ чіпали. 'flush' — запис не пройшов
   * (без SAVE_BLOCKED/PAUSED); 'busy' — поки читали стан, з'явилась нова дія (оновлення
   * полотна стерло б її); 'fetch' — стан не прочитано; 'stale' — сервер позначив стан
   * несвіжим або не віддав його.
   */
  const restoreProblem = ref<null | 'flush' | 'busy' | 'fetch' | 'stale' | 'apply'>(null)
  /** Лічильник прийнятих record() — звірка бачить дію, що встигла записатись під час GET. */
  let _recordCount = 0
  /** Копії мертвих вкладок, з яких узято дії, — знімаються лише після успішної звірки. */
  let _restoreKeys: string[] = []
  /**
   * Дії, відновлені з копії, поки їх нема на полотні. Власна копія вкладки тримає їх
   * (разом із чергою), навіть коли вони вже записані й черга порожня: знімається
   * лише після успішного оновлення полотна (рев'ю Б-28, 2026-09-24).
   */
  let _restoredOps: OpsSyncOp[] = []
  /** Застосувати стан сервера до полотна (реєструє рекордер кімнати: boardStore.applyCatchUpState). */
  let _canvasApplier: ((state: Record<string, unknown>) => void) | null = null
  let _reconcilePromise: Promise<RestoreResult> | null = null
  /** Іде дія вчителя «Перевірити й надіслати» / «Відкинути». */
  const blockResolving = ref(false)
  /** Ключі аварійних записів інших вкладок / попередньої сесії, які ця вкладка підхопила. */
  let _adoptedBlockedKeys: string[] = []
  /** Нечитабельні аварійні записи цієї дошки — лише для експорту вчителем. */
  let _unreadableBlocked: Array<{ key: string; raw: string }> = []
  /** Ключ, під яким ЦЯ вкладка востаннє записала аварійну чергу ЦІЄЇ дошки. */
  let _ownBlockedKey: string | null = null
  /**
   * Іде ручна спроба «Перевірити й надіслати». Режим лишається SAVE_BLOCKED до
   * підтвердженого результату; будь-яка невдача — знову SAVE_BLOCKED, без
   * автоматичних повторів 503 і без скидання inFlight на 409 (рев'ю P0, 2026-09-24).
   */
  let _manualAttempt = false

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
            _resetRetryState()
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
  /** SAVE_BLOCKED: сервер відмовив або результат не підтверджено — черга стоїть. */
  const isSaveBlocked = computed(() => mode.value === 'SAVE_BLOCKED')
  /**
   * Кімната має заблокувати введення: черга досягла стелі або аварійний запис
   * не вдався (зміни лише в пам'яті вкладки). Не тихий no-op — банер пояснює.
   */
  const _queued = (): number => pendingOps.value.length + inFlightOps.value.length
  const inputLocked = computed(() =>
    (mode.value === 'BOOTSTRAP' && bootstrapFailed.value) ||
    // Б-28: поки звіряємо відновлені дії, нове малювання чекає — оновлення полотна
    // станом сервера стерло б його з екрана.
    restoring.value ||
    (mode.value === 'SAVE_BLOCKED' && (
      saveBlock.value?.storageOk === false || _queued() >= MAX_BLOCKED_QUEUE_OPS
    )) ||
    // PAUSED (рішення власника 2026-09-24): черга росте хвилинами — та сама стеля, і
    // без копії у сховищі нові дії не приймаємо, доки копія не ляже або сервер не прийме.
    (mode.value === 'PAUSED' && (
      _queued() >= MAX_BLOCKED_QUEUE_OPS || (backupFailed.value && _queued() > 0)
    )))
  /** Для банера PAUSED: чому введення заблоковано. */
  const pausedUnsecured = computed(() => mode.value === 'PAUSED' && backupFailed.value && _queued() > 0)
  /**
   * Незбережена черга без жодної копії у сховищі (`storage_failed`, LAW §4): вихід
   * із дошки, reload чи закриття вкладки її знищить. Кімнати питають підтвердження
   * (`useUnsecuredQueueGuard`).
   */
  const hasUnsecuredQueue = computed(() =>
    _queued() > 0 && (mode.value === 'SAVE_BLOCKED'
      ? saveBlock.value?.storageOk === false
      : backupFailed.value))

  // ── Internal helpers ──

  // TLV2-G1b: retry-стан і таймер PAUSED живуть тут і скидаються в одному місці.
  function _clearPauseTimer(): void {
    if (_pauseTimer) {
      clearTimeout(_pauseTimer)
      _pauseTimer = null
    }
  }

  /** Знімає таймер, дозвіл спроби і лічильник 503; буфери не чіпає. */
  function _resetRetryState(): void {
    _clearPauseTimer()
    _probeArmed = false
    _retryAttempt = 0
    _retryUntil.value = null
  }

  /** Єдиний таймер: попередній завжди знімається перед новим. */
  function _armPauseTimer(): void {
    _clearPauseTimer()
    _pauseTimer = setTimeout(() => {
      _pauseTimer = null
      _requestProbe()
    }, PAUSE_AUTO_RETRY_MS)
  }

  /** Дозволити одну спробу з PAUSED і повідомити виконавця. Порожня черга → просто SYNC. */
  function _requestProbe(): void {
    if (mode.value !== 'PAUSED') return
    if (pendingOps.value.length === 0 && inFlightOps.value.length === 0) {
      _exitPause()
      return
    }
    _probeArmed = true
    pauseProbeSeq.value += 1
  }

  function _exitPause(): void {
    _resetRetryState()
    desyncReason.value = null
    droppedWhileBlocked.value = 0
    mode.value = 'SYNC'
  }

  function _hasHttpResponse(err: unknown): boolean {
    return typeof (err as { response?: { status?: number } })?.response?.status === 'number'
  }

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
    // INV-CROSS-SESSION: при зміні сесії — очистити pending/inFlight ops.
    // Без цього ops від попередньої сесії (що не встигли flush) будуть надіслані
    // на новий session_id → крос-сесійне забруднення.
    // Обидва шаблони мають однакові page_id (з одного S3 snapshot) →
    // старий stroke_add op з'являється на тій самій сторінці нової сесії.
    // saveBeforeLeave() робить best-effort flush перед навігацією,
    // але якщо flush не вдається → ops залишаються → цей guard їх дропає.
    if (sessionId.value && sessionId.value !== sid) {
      pendingOps.value = []
      inFlightOps.value = []
      _flushPromise = null
      // TLV2-G1b: таймер і лічильник 503 попередньої дошки не переходять на нову.
      _resetRetryState()
      backupFailed.value = false
      legacyCopies.value = []
      _forgetRestore()
      // SAVE_BLOCKED попередньої дошки лишається в ЇЇ аварійному записі; пам'ять про
      // нього (ключі, причина) на нову дошку не переходить — інакше вирішення на Б
      // стерло б записи А (рев'ю P0, 2026-09-24).
      _forgetBlockMemory()
    }
    sessionId.value = sid
    _initChannel()
    bootstrapFailed.value = false
    try {
      const response = await _fetchState(sid)
      // Які вкладки живі — ДО переходу в SYNC (далі без await: record() не вклиниться).
      const live = await liveTabIds()
      serverSeq.value = response.last_seq | 0
      localSeq.value = response.last_seq | 0
      _resetRetryState()
      mode.value = 'SYNC'
      desyncReason.value = null
      // SAVE_BLOCKED переживає reload і повторний bootstrap: невирішена черга НЕ
      // повертається у звичайну відправку (LAW §5 «Остаточні відмови»).
      _restoreBlocked(sid, live)
    } catch (err) {
      if (_isProtocolMismatch(err)) {
        enterDesync('protocol-version-mismatch')
        throw new DesyncError('bootstrap blocked: protocol-version-mismatch')
      }
      // Не мовчки: без стану сервера жодна дія не збережеться (record() → false).
      if (mode.value === 'BOOTSTRAP') bootstrapFailed.value = true
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
    if (
      (mode.value === 'SAVE_BLOCKED' || mode.value === 'PAUSED') &&
      pendingOps.value.length + inFlightOps.value.length >= MAX_BLOCKED_QUEUE_OPS
    ) {
      // Стеля: не тихий no-op — лічильник у банері, кімната блокує введення (inputLocked).
      droppedWhileBlocked.value += 1
      return false
    }
    pendingOps.value.push(op)
    _recordCount++
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
   * On 503 SERVER_BUSY (INV-12, TLV2-G1b):
   *   - keep inFlightOps + pendingOps (same op_id) — ніколи не викидаються
   *   - SYNC: до 2 повторів з backoff; третя 503 поспіль → PAUSED
   *   - PAUSED: flush() дозволений лише один раз на спробу (таймер 30 с або retryNow())
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
    // SAVE_BLOCKED (LAW §4): жоден викликач — safety interval, debounce, поріг 50,
    // flushAll(), спроба з PAUSED — не відправляє чергу автоматично.
    if (mode.value === 'SAVE_BLOCKED') {
      throw new SaveBlockedError(saveBlock.value, false)
    }
    // Phase S PR-3 (2026-04-28): PAUSED — flush throws BackpressureError.
    // Caller (useReplayRecorder) catches gracefully. inFlightOps preserved.
    // TLV2-G1b: виняток — рівно один дозволений flush на спробу відновлення.
    if (mode.value === 'PAUSED') {
      if (!_probeArmed) {
        throw new BackpressureError('flush() blocked: PAUSED (server backpressure)')
      }
      _probeArmed = false
      return _runExclusive(true)
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
    return _runExclusive(false)
  }

  function _runExclusive(probe: boolean): Promise<void> {
    if (_flushPromise) {
      return _flushPromise
    }
    probeInFlight.value = probe
    _flushPromise = (async () => {
      const _start = Date.now()
      try {
        await _doFlush()
      } finally {
        _lastFlushDuration.value = Date.now() - _start
        _flushPromise = null
        probeInFlight.value = false
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
      // І не більше MAX_BATCH_BYTES сумарно; перший op іде завжди (сам ≤ 64 KB).
      const limit = Math.min(pendingOps.value.length, FLUSH_BATCH_SIZE)
      let taking = 0
      let bytes = 0
      while (taking < limit) {
        const b = _opBytes(pendingOps.value[taking])
        if (taking > 0 && bytes + b > MAX_BATCH_BYTES) break
        bytes += b
        taking++
      }
      batch = pendingOps.value.splice(0, taking)  // sync: remove N from pending
      inFlightOps.value.push(...batch)            // sync: add to inFlight (no await between)
    }

    // Phase V WS3 (2026-05-10): write-path telemetry — capture roundtrip_ms.
    // Uses performance.now() для monotonic clock (`Date.now()` may regress on NTP sync).
    const _now = (): number =>
      typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now()
    const _seqSent = serverSeq.value
    const _opsCount = batch.length
    const fromPause = mode.value === 'PAUSED'
    const _t0 = _now()
    /** Emit telemetry без throw. NEVER blocks recorder (LAW §12 justified exception:
     *  failure surfaces у writePathTelemetry's одноразовому console.warn).
     *
     *  Phase V Round 2 (2026-05-10): optional `writePath` arg — populated only on
     *  successful response when BE returned `X-WB-Write-Path` header. Absence
     *  (older BE deploy / mid-rollout / error path) → field omitted з event. */
    const _emit = (status: number, writePath?: string): void => {
      try {
        emitWritePathEvent(sid, {
          seq: _seqSent,
          ops_count: _opsCount,
          roundtrip_ms: _now() - _t0,
          status,
          ...(writePath !== undefined ? { write_path: writePath } : {}),
        })
      } catch {
        // Swallowed: telemetry never blocks the write path. writePathTelemetry
        // вже emits warn on its own failure path.
      }
    }

    try {
      const response: BatchRecordResponse = await recordOperationsBatch(
        sid,
        serverSeq.value,
        // recordOperationsBatch type expects RecordOperationRequest — runtime shape compatible
        batch as unknown as Parameters<typeof recordOperationsBatch>[2],
      )
      // Phase V Round 2: read transport-internal `_writePath` (if BE sent header).
      _emit(201, response._writePath)
      // Success — clear inFlight, advance seq
      inFlightOps.value = []
      serverSeq.value = response.last_seq
      localSeq.value = Math.max(localSeq.value, response.last_seq)
      // Phase S PR-3: reset retry state on success. TLV2-G1b: успішна спроба з PAUSED → SYNC.
      if (mode.value === 'PAUSED') {
        _exitPause()
      } else {
        _retryAttempt = 0
        _retryUntil.value = null
      }
    } catch (err) {
      // Read HTTP status (0 для network-level failure без response).
      const _status =
        ((err as { response?: { status?: number } })?.response?.status as number | undefined) ?? 0
      _emit(_status)
      // TLV2-G1b: спроба з PAUSED. 503 або відсутня HTTP-відповідь → лишаємось у PAUSED,
      // черга ціла, наступна спроба через 30 с. Інша відповідь сервера → вихід із PAUSED
      // і звичайна обробка нижче.
      if (fromPause && mode.value === 'PAUSED') {
        if (_isServerBusy(err) || !_hasHttpResponse(err)) {
          _armPauseTimer()
          if (_isServerBusy(err)) {
            throw new BackpressureError('flush() recovery attempt: server still busy (503)')
          }
          throw err
        }
        _exitPause()
      }
      if (_isProtocolMismatch(err)) {
        // INV-20: client/server version mismatch. UI ProtocolMismatchModal,
        // user must reload. inFlightOps lost (acceptable — version drift means
        // contract incompatible).
        enterDesync('protocol-version-mismatch')
        inFlightOps.value = []
        pendingOps.value = []
        throw new DesyncError('flush() blocked: protocol-version-mismatch')
      }
      if (_manualAttempt) {
        // Одна спроба з дії вчителя. 409 SEQ_MISMATCH тут означає «seq зсунувся між
        // звіркою і відправкою» — пакет НЕ застосовано, inFlight не скидаємо; 503 —
        // сервер зайнятий, теж не застосовано. Обидва → повтор знову лише кнопкою.
        const seqM = _isSeqMismatch(err)
        let block = _classifyFinal(err, batch)
        if (!block) throw err  // 401: зупинка лишається з попередньою причиною, auth flow
        if (seqM.mismatch) block = { ...block, kind: 'unconfirmed', reason: 'seq_mismatch' }
        else if (_isServerBusy(err)) block = { ...block, kind: 'unconfirmed', reason: block.reason ?? 'server_busy' }
        _enterSaveBlocked(block)
        throw new SaveBlockedError(saveBlock.value, true)
      }
      const seqMismatch = _isSeqMismatch(err)
      if (seqMismatch.mismatch) {
        // AUTO-RESYNC (Def 1, 2026-05-13), без втрати пакета (2026-09-24, рішення
        // власника, LAW §5).
        //
        // 409 SEQ_MISMATCH: seq зсунувся (друга вкладка, пульт, учень). Сервер перевіряє
        // seq ДО дедупу й застосування (ops_apply_service: крок 2 → 3), тож пакет НЕ
        // записано. Раніше inFlight скидали як «уже оброблене» — дії першої вкладки
        // зникали. Тепер:
        //   - serverSeq/localSeq ← expected_seq;
        //   - inFlightOps: KEEP — наступний flush шле ЦЕЙ самий пакет першим (порядок
        //     не змінюється); якщо щось із нього таки було записано, сервер відсіє за
        //     op_id (INV-14);
        //   - pendingOps: KEEP;
        //   - mode лишається SYNC; throw SeqResyncError (рекордер пише копію й чекає).
        //
        // LAW §12: жодного негайного повтору й жодного лічильника 409 — наступна спроба
        // лише з природного тику (safety interval / наступна дія). Повторний 409 знову
        // лише виправляє seq; черга не губиться.
        const correctedSeq = seqMismatch.expectedSeq ?? (serverSeq.value + 1)
        serverSeq.value = correctedSeq
        localSeq.value = Math.max(localSeq.value, correctedSeq)
        const reason = `seq-mismatch auto-resynced (serverSeq → ${correctedSeq})`
        throw new SeqResyncError(reason)
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
          // (next flush() call). Таймер 30 с; учитель може натиснути «Повторити зараз».
          enterPaused('server-busy-exhausted-retries')
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
      // SAVE_BLOCKED (2026-09-23, LAW §5 «Остаточні відмови»): 400 validation_failed,
      // інші остаточні 4xx, 429, 5xx≠503 і відсутність відповіді більше НЕ лишаються
      // «тимчасовими» з повтором кожні 2 с. Черга ціла, відправка стоїть до дії вчителя.
      const block = _classifyFinal(err, batch)
      if (block) {
        _enterSaveBlocked(block)
        throw new SaveBlockedError(saveBlock.value, true)
      }
      // 401: штатний auth flow (LAW §6) — inFlight лишається, рекордер чекає auth.
      throw err
    }
  }

  /** Відповідь сервера → причина SAVE_BLOCKED, або null (401 / auth flow). */
  function _classifyFinal(err: unknown, batch: OpsSyncOp[]): SaveBlockInfo | null {
    const e = err as {
      response?: {
        status?: number
        data?: {
          error?: string
          reason?: string
          invalid_op_index?: unknown
          invalid_op_id?: unknown
        }
      }
    }
    const status = e?.response?.status
    const base = {
      reason: null as string | null,
      invalidOpIndex: null as number | null,
      invalidOpId: null as string | null,
      invalidOpType: null as string | null,
      retryNotBefore: null as number | null,
      at: Date.now(),
      feBuild: FE_BUILD,
      storageOk: true,
      restored: false,
    }
    if (typeof status !== 'number') {
      return { ...base, kind: 'unconfirmed', httpStatus: 0, reason: 'no_response' }
    }
    const data = e.response?.data ?? {}
    const code = (typeof data.reason === 'string' && data.reason) ||
      (typeof data.error === 'string' && data.error) || null
    if (status === 401) return null
    if (status === 400) {
      const idx = data.invalid_op_index
      const id = typeof data.invalid_op_id === 'string' ? data.invalid_op_id : null
      const pointed = data.error === 'validation_failed' &&
        typeof idx === 'number' && Number.isInteger(idx) && idx >= 0 && idx < batch.length &&
        (id === null || batch[idx]?.op_id === id)
      if (pointed) {
        const bad = batch[idx as number]
        return {
          ...base, kind: 'rejected', httpStatus: 400, reason: code,
          invalidOpIndex: idx as number, invalidOpId: bad?.op_id ?? null, invalidOpType: bad?.op_type ?? null,
        }
      }
      // Request-level або індекс, що не збігся з пакетом → не розбирати навмання (ТЗ §4.2).
      return { ...base, kind: 'request_rejected', httpStatus: 400, reason: code }
    }
    if (status === 403) return { ...base, kind: 'forbidden', httpStatus: 403, reason: code }
    if (status === 404) return { ...base, kind: 'not_found', httpStatus: 404, reason: code }
    if (status === 413) return { ...base, kind: 'too_large', httpStatus: 413, reason: code }
    if (status === 429) {
      const ra = _parseRetryAfter(err)
      return { ...base, kind: 'rate_limited', httpStatus: 429, reason: code, retryNotBefore: ra === null ? null : Date.now() + ra }
    }
    if (status >= 500) return { ...base, kind: 'unconfirmed', httpStatus: status, reason: code }
    // 409 з невідомим error, 415, інші 4xx
    return { ...base, kind: 'request_rejected', httpStatus: status, reason: code }
  }

  function _enterSaveBlocked(info: SaveBlockInfo): void {
    _resetRetryState()
    mode.value = 'SAVE_BLOCKED'
    saveBlock.value = info
    persistBlocked()
    // НЕ _broadcast: стан черги цієї вкладки, не контракту (LAW §4).
  }

  /**
   * Аварійний запис поточної черги (LAW §4). Викликають вхід у SAVE_BLOCKED і
   * рекордер (замість звичайного backup, поки дошка заблокована). Невдача → storageOk=false.
   */
  function persistBlocked(): boolean {
    const sid = sessionId.value
    const info = saveBlock.value
    if (!sid || !info || mode.value !== 'SAVE_BLOCKED') return false
    const ok = writeBlocked(sid, tabId.value, _blockedOwnerId, info,
      inFlightOps.value.slice(), pendingOps.value.slice())
    // Нечитабельну звичайну копію не чіпаємо: її сирі дані — лише для експорту вчителем.
    const key = blockedKey(sid, _blockedOwnerId, tabId.value)
    // Попередній ключ ЦІЄЇ ж дошки (змінився власник) знімаємо лише після того, як
    // новий запис підтверджено; ключ іншої дошки тут не буває (_forgetBlockMemory).
    if (ok && _ownBlockedKey && _ownBlockedKey !== key) removeBlocked([_ownBlockedKey])
    if (ok || !_ownBlockedKey) _ownBlockedKey = key
    if (ok !== info.storageOk) saveBlock.value = { ...info, storageOk: ok }
    // Звичайний backup більше не має відправити цю чергу. Але поки дії з копії не на
    // полотні (Б-28), він тримає їх — навіть уже записані; знімає лише успішна звірка.
    if (ok && !restoredPending.value && !_unreadableBlocked.some(u => u.key === backupKey(sid))) clearBackup(sid)
    return ok
  }

  /** Після bootstrap: підхопити аварійні записи цієї дошки й повернути SAVE_BLOCKED. */
  function _restoreBlocked(sid: string, live: Set<string> | null): void {
    const read = readBlocked(sid, _blockedOwnerId)
    // Звичайні копії цієї дошки цього акаунта (усі вкладки): пошкоджена ≠ «немає».
    const nb = readAllBackups(sid)
    if (nb.readFailed) read.readFailed = true
    read.unreadable.push(...nb.unreadable)
    const legacy = readLegacyBackup(sid)
    legacyCopies.value = [...(legacy ? [legacy] : []), ...read.legacyUnknown]
    // Записи ЖИВИХ інших вкладок — їхня справа: не підхоплюємо й не стираємо (жива
    // вкладка могла б дописати дію між нашим читанням і видаленням). Рев'ю P0, 2026-09-24.
    const own = tabId.value
    const found = read.records.filter(f => mayAdopt(f.key, own, live))
    _unreadableBlocked = read.unreadable.filter(u => mayAdopt(u.key, own, live))
    const unreadable = read.readFailed || _unreadableBlocked.length > 0
    if (found.length === 0 && !unreadable) return
    // Дії з аварійних записів — з копії, на полотні їх немає (Б-28): після успішного
    // «Перевірити й надіслати» полотно оновиться станом сервера.
    if (found.some(f => f.record.inFlight.length + f.record.pending.length > 0)) {
      restoredPending.value = true
      _rememberRestored(found.flatMap(f => [...f.record.inFlight, ...f.record.pending]))
    }
    const known = new Set([...inFlightOps.value, ...pendingOps.value].map(o => o.op_id))
    const inFlight: OpsSyncOp[] = [...inFlightOps.value]
    const pending: OpsSyncOp[] = [...pendingOps.value]
    // inFlight — лише пакет, результат якого невідомий (звірка check-ops). Записи
    // кількох вкладок разом дали б > 100 ops в одному POST → 400 → глухий кут. Тож
    // «у мережі» лишається тільки перший такий пакет (≤ FLUSH_BATCH_SIZE), решта — у
    // pending у порядку запису; вже застосоване сервер відсіє за op_id (рев'ю P0, 2026-09-24).
    for (const { record } of found) {
      const takeAsInFlight = inFlight.length === 0
      for (const o of record.inFlight) {
        if (!o?.op_id || known.has(o.op_id)) continue
        known.add(o.op_id)
        if (takeAsInFlight && inFlight.length < FLUSH_BATCH_SIZE) inFlight.push(o)
        else pending.push(o)
      }
      for (const o of record.pending) if (o?.op_id && !known.has(o.op_id)) { known.add(o.op_id); pending.push(o) }
    }
    inFlightOps.value = inFlight
    pendingOps.value = pending
    _adoptedBlockedKeys = [
      ...found.map(f => f.key),
      ..._unreadableBlocked.map(u => u.key),
    ].filter(k => k !== blockedKey(sid, _blockedOwnerId, tabId.value) && mayRemove(k, own, live))
    mode.value = 'SAVE_BLOCKED'
    if (unreadable) {
      // Не «нічого немає»: запис є, але прочитати його не вдалося. Видима зупинка,
      // повтор заборонений; учитель може завантажити сирі дані або відкинути (рев'ю P0).
      saveBlock.value = {
        kind: 'storage_unreadable', httpStatus: 0,
        reason: read.readFailed ? 'storage_read_failed' : 'record_unreadable',
        invalidOpIndex: null, invalidOpId: null, invalidOpType: null, retryNotBefore: null,
        at: Date.now(), feBuild: FE_BUILD, storageOk: !read.readFailed, restored: true,
      }
    } else {
      const latest = found[found.length - 1].record.info
      saveBlock.value = { ...latest, restored: true, storageOk: true }
    }
    persistBlocked()
  }

  function _dropBlockedStorage(sid: string): void {
    removeBlocked([blockedKey(sid, _blockedOwnerId, tabId.value),
      ...(_ownBlockedKey ? [_ownBlockedKey] : []), ..._adoptedBlockedKeys])
    _adoptedBlockedKeys = []
    _unreadableBlocked = []
    _ownBlockedKey = null
  }

  /** Чи можна зараз запропонувати «Перевірити й надіслати». */
  const canRetryBlocked = computed(() => {
    const info = saveBlock.value
    if (mode.value !== 'SAVE_BLOCKED' || !info) return false
    if (info.kind === 'unconfirmed') return true
    // Без Date.now(): computed не оновлюється сам, і кнопка лишалась би неактивною
    // назавжди. Час перевіряє retryBlocked() у момент натискання ('too-early').
    if (info.kind === 'rate_limited') return true
    if (info.kind === 'rejected') return info.feBuild !== FE_BUILD
    return false
  })

  /**
   * «Перевірити й надіслати» — дія вчителя (LAW §5, §12): одна звірка й не більше
   * одного HTTP-пакета. Дозволено для `unconfirmed`, `rate_limited` (не раніше
   * Retry-After) і `rejected` лише з іншою збіркою клієнта.
   */
  async function retryBlocked(): Promise<'sent' | 'sent-held' | 'already-saved' | 'unproven' | 'not-allowed' | 'blocked' | 'too-early'> {
    const sid = sessionId.value
    const info = saveBlock.value
    if (!sid || !info || mode.value !== 'SAVE_BLOCKED' || blockResolving.value) return 'not-allowed'
    if (!canRetryBlocked.value) return 'not-allowed'
    if (info.kind === 'rate_limited' && info.retryNotBefore !== null && Date.now() < info.retryNotBefore) {
      return 'too-early'  // без HTTP; банер показує, скільки чекати
    }
    blockResolving.value = true
    try {
      // Невідомо, чи сервер застосував пакет → звірка за op_id (не лише за last_seq:
      // паралельна вкладка чи учень теж рухають seq).
      if (inFlightOps.value.length > 0 && (info.kind === 'unconfirmed' || info.restored)) {
        const ids = inFlightOps.value.map(o => o.op_id)
        const res = await checkOps(sid, ids)
        const saved = new Set(res?.saved ?? [])
        const savedCount = ids.filter(id => saved.has(id)).length
        if (savedCount === ids.length) {
          inFlightOps.value = []
        } else if (savedCount > 0) {
          return 'unproven'  // частково — не можу довести; черга лишається
        }
      }
      const state = await _fetchState(sid)
      serverSeq.value = state.last_seq | 0
      localSeq.value = Math.max(localSeq.value, state.last_seq | 0)
      if (pendingOps.value.length === 0 && inFlightOps.value.length === 0) {
        _unblock()
        _dropBlockedStorage(sid)
        return 'already-saved'
      }
      // Режим лишається SAVE_BLOCKED, поки пакет у мережі: банер видно, рекордер
      // нічого не шле сам, аварійний запис живий (закриють вкладку — reload поверне
      // SAVE_BLOCKED, а звірка check-ops за op_id не дасть задвоїти). Рев'ю P0, 2026-09-24.
      _manualAttempt = true
      try {
        await _runExclusive(false)  // рівно один пакет; далі — звичайний ритм рекордера
      } catch (err) {
        if (err instanceof SaveBlockedError) return 'blocked'
        throw err
      } finally {
        _manualAttempt = false
      }
      // Поки пакет був у мережі, дошка приймала нові дії, а їхній аварійний запис
      // рекордер відкладає на ~1 с. Оновлюємо його ЗАРАЗ, ще в SAVE_BLOCKED і без
      // await до saveBackup(): якщо backup нижче відмовить, лишиться копія з цими
      // діями, а не стара (рев'ю P0, 2026-09-24).
      // Якщо звичайна копія нижче не ляже, аварійний запис лишиться і після reload
      // поверне зупинку. Причина в ньому — «не підтверджено» (повтор дозволено, звірка
      // check-ops), а не стара `rejected`, з якої нові дії вийшли б лише «Відкинути».
      if (saveBlock.value) {
        saveBlock.value = { ...saveBlock.value, kind: 'unconfirmed', reason: 'held_after_retry', restored: false }
      }
      const recordOk = persistBlocked()
      const rest = pendingOps.value.length + inFlightOps.value.length
      if (!recordOk && rest > 0) {
        // Аварійний запис нових дій не ліг. Знімати зупинку можна, лише якщо ліг
        // звичайний backup; інакше ці дії — тільки в пам'яті вкладки: лишаємось у
        // SAVE_BLOCKED (storage_failed: введення заблоковано, вихід із підтвердженням),
        // наступна спроба — знову кнопкою (LAW §4, рев'ю P0, 2026-09-24).
        if (!_writeOwnBackup(sid)) return 'sent-held'
        _unblock()
        _dropBlockedStorage(sid)  // старий запис містить лише вже надіслане
        return 'sent'
      }
      _unblock()  // лише після підтвердженого 2xx
      // Знімаємо аварійний запис лише коли решта черги ПІДТВЕРДЖЕНО лягла у
      // звичайний backup. Сховище відмовило → запис лишається (безпечно: дедуп op_id).
      if (_writeOwnBackup(sid)) {
        _dropBlockedStorage(sid)
      } else {
        console.warn('[opsSync] retryBlocked: backup not confirmed — emergency record kept')
      }
      return 'sent'
    } finally {
      blockResolving.value = false
    }
  }

  function _forgetBlockMemory(): void {
    if (mode.value === 'SAVE_BLOCKED') mode.value = 'SYNC'  // bootstrap нижче однаково ставить SYNC
    saveBlock.value = null
    droppedWhileBlocked.value = 0
    _adoptedBlockedKeys = []
    _unreadableBlocked = []
    _ownBlockedKey = null
    _manualAttempt = false
  }

  function _unblock(): void {
    _resetRetryState()
    saveBlock.value = null
    droppedWhileBlocked.value = 0
    desyncReason.value = null
    mode.value = 'SYNC'
  }

  /**
   * «Відкинути незбережені зміни» — дія вчителя з підтвердженням (UI). Черга й
   * аварійні записи знімаються; полотно UI перезавантажує з сервера.
   */
  async function discardBlocked(): Promise<void> {
    const sid = sessionId.value
    if (!sid || mode.value !== 'SAVE_BLOCKED') return
    blockResolving.value = true
    try {
      // Спершу стан сервера: упаде запит — нічого не стерто, зупинка лишається
      // (рев'ю P0, 2026-09-24: раніше черга зникала до відповіді).
      const state = await _fetchState(sid)
      _dropBlockedStorage(sid)
      clearBackup(sid)
      // Б-28: копії мертвих вкладок, з яких підхоплено відкинуті дії, — теж геть;
      // інакше після reload вони підхопились би знову і зупинка поверталась би.
      removeBackupKeys(_restoreKeys)
      _forgetRestore()
      pendingOps.value = []
      inFlightOps.value = []
      saveBlock.value = null
      droppedWhileBlocked.value = 0
      serverSeq.value = state.last_seq | 0
      localSeq.value = state.last_seq | 0
      desyncReason.value = null
      mode.value = 'SYNC'
    } finally {
      blockResolving.value = false
    }
  }

  /** Копія невирішеної черги для завантаження вчителем (нікуди не відправляється). */
  function exportBlocked(): Record<string, unknown> {
    return {
      format: 'm4sh-unsaved-board-ops',
      version: 1,
      session_id: sessionId.value,
      exported_at: new Date().toISOString(),
      reason: saveBlock.value
        ? { kind: saveBlock.value.kind, http_status: saveBlock.value.httpStatus, code: saveBlock.value.reason }
        : null,
      ops: [...inFlightOps.value, ...pendingOps.value],
      ...(_unreadableBlocked.length > 0
        ? { unreadable_records: _unreadableBlocked.map(u => ({ key: u.key, raw: u.raw })) }
        : {}),
    }
  }

  /** Прив'язка аварійних записів до акаунта (кімната після входу). */
  function setBlockedOwner(userId: string | number | null | undefined): void {
    const next = userId === undefined || userId === null || userId === '' ? null : String(userId)
    // Вихід / смерть сесії (user → null) НЕ робить чергу «анонімною»: інакше наступний
    // запис переїхав би на ключ `anon` і після повторного входу став би невидимим
    // (рев'ю P0, 2026-09-24). Черга в пам'яті належить тому, хто її зробив.
    if (next === null && _blockedOwnerId !== null) return
    if (next !== null && _blockedOwnerId !== null && next !== _blockedOwnerId) {
      // Інший акаунт у тій самій вкладці: чергу попереднього — в його копії, з пам'яті геть.
      persistQueue()
      reset()
    }
    _blockedOwnerId = next
    setOpsOwner(_blockedOwnerId)  // звичайна копія черги теж прив'язана до акаунта
  }

  /** Старі копії без власника — для файлу, який завантажує вчитель (нікуди не надсилається). */
  function exportLegacyCopies(): Record<string, unknown> {
    return {
      format: 'm4sh-unsaved-board-ops-legacy',
      version: 1,
      session_id: sessionId.value,
      exported_at: new Date().toISOString(),
      note: 'owner unknown — saved before 2026-09-24; not restored automatically',
      records: legacyCopies.value.map(c => ({ key: c.key, raw: c.raw })),
    }
  }

  // ── Б-28: звірка відновлених дій ──────────────────────────────────

  function _forgetRestore(): void {
    restoring.value = false
    restoredPending.value = false
    restoreProblem.value = null
    _restoreKeys = []
    _restoredOps = []
  }

  /**
   * Чи містить стан сервера те, що ми щойно записали з копії: принаймні одна сторінка
   * і кожен доданий із копії штрих (крім тих, що в копії ж і видалені). Інакше це
   * не той стан, який можна показати як «відновлено».
   */
  function _stateShowsRestored(state: Record<string, unknown>): boolean {
    const pages = (state as { pages?: Array<{ strokes?: Array<{ id?: unknown }> }> }).pages
    if (!Array.isArray(pages) || pages.length === 0) return false
    const expected = new Set<string>()
    for (const o of _restoredOps) {
      const p = (o.payload ?? {}) as { stroke?: { id?: unknown }; strokes?: Array<{ id?: unknown }>; stroke_id?: unknown }
      if (o.op_type === 'stroke_add' && typeof p.stroke?.id === 'string') expected.add(p.stroke.id)
      else if (o.op_type === 'strokes_add_batch' && Array.isArray(p.strokes)) {
        for (const st of p.strokes) if (typeof st?.id === 'string') expected.add(st.id)
      } else if (o.op_type === 'stroke_delete' && typeof p.stroke_id === 'string') expected.delete(p.stroke_id)
    }
    if (expected.size === 0) return true
    const present = new Set<string>()
    for (const pg of pages) for (const st of pg?.strokes ?? []) if (typeof st?.id === 'string') present.add(st.id)
    for (const id of expected) if (!present.has(id)) return false
    return true
  }

  function _rememberRestored(ops: OpsSyncOp[]): void {
    const known = new Set(_restoredOps.map(o => o.op_id))
    for (const o of ops) if (o?.op_id && !known.has(o.op_id)) { known.add(o.op_id); _restoredOps.push(o) }
  }

  /**
   * Єдиний запис власної звичайної копії. Поки дії з копії не на полотні — вони в копії
   * теж (перед чергою, без дублів op_id), навіть якщо черга порожня: інакше збій
   * наступного читання стану лишив би їх без жодної копії. Після reload їх підхопить
   * знову, сервер відсіє вже записане, звірка покаже на полотні.
   */
  function _writeOwnBackup(sid: string): boolean {
    if (!restoredPending.value || _restoredOps.length === 0) {
      return saveBackup(sid, pendingOps.value.slice(), inFlightOps.value.slice())
    }
    const queued = new Set([...inFlightOps.value, ...pendingOps.value].map(o => o.op_id))
    const keep = _restoredOps.filter(o => !queued.has(o.op_id))
    return saveBackup(sid, [...keep, ...pendingOps.value], inFlightOps.value.slice())
  }

  /** Рекордер кімнати реєструє, як застосувати стан сервера до полотна (null — зняти). */
  function setCanvasApplier(fn: ((state: Record<string, unknown>) => void) | null): void {
    _canvasApplier = fn
  }

  /** Зняти полотно, лише якщо воно досі те саме (інша кімната могла вже зареєструвати своє). */
  function clearCanvasApplier(fn: (state: Record<string, unknown>) => void): void {
    if (_canvasApplier === fn) _canvasApplier = null
  }

  /** У черзі дії з копії; `keys` — копії мертвих вкладок, знімати після звірки. */
  function noteRestored(keys: string[], ops: OpsSyncOp[] = []): void {
    restoredPending.value = true
    for (const k of keys) if (!_restoreKeys.includes(k)) _restoreKeys.push(k)
    _rememberRestored(ops)
  }

  /**
   * Б-28: показати відновлені з копії дії на полотні. Той самий контракт, що INV-24
   * catchUp (flushAll → GET /state/ → stale-guard → applyState), але з примусовим
   * оновленням полотна: після запису `localSeq = last_seq`, тож catchUp відповів би
   * «current», а WS-відлуння відсікає фільтр INV-15 — полотно лишалося без цих дій
   * до наступного reload.
   *
   * Без окремого шляху запису (звичайний flushAll) і без повторів (LAW §12): одна
   * спроба. Невдача → копію НЕ знято, полотно НЕ чіпали, `restoreProblem` видно в
   * кімнаті. Дублів немає: полотно стає канонічним станом сервера, а вже записане
   * сервер відсіює за op_id.
   */
  function reconcileRestored(): Promise<RestoreResult> {
    if (!_canvasApplier) return Promise.resolve('no-applier')
    if (_reconcilePromise) return _reconcilePromise
    _reconcilePromise = (async () => {
      if (_catchUpPromise) {
        try { await _catchUpPromise } catch { /* помилку catchUp бачить його викликач */ }
      }
      try {
        return await _doReconcile()
      } finally {
        restoring.value = false
      }
    })().finally(() => { _reconcilePromise = null })
    return _reconcilePromise
  }

  async function _doReconcile(): Promise<RestoreResult> {
    const sid = sessionId.value
    const apply = _canvasApplier
    // SAVE_BLOCKED / PAUSED / DESYNC мають власні банери; дії лишаються «відновленими»
    // до успішного виходу з цих станів.
    if (!sid || !apply || mode.value !== 'SYNC') return 'blocked'
    try {
      await flushAll()
    } catch (err) {
      console.warn('[opsSync] Б-28 reconcile: flush failed — copy kept, canvas untouched:', err)
      if (mode.value === 'SYNC' && sessionId.value === sid) restoreProblem.value = 'flush'
      return 'flush-failed'
    }
    if (mode.value !== 'SYNC' || sessionId.value !== sid) return 'blocked'
    // Відрізок «читання стану → полотно»: нове малювання чекає (оновлення полотна
    // стерло б його з екрана). Раніше блокували й на весь flushAll — зайве.
    restoring.value = true
    const seqAtRead = localSeq.value
    const recordsAtRead = _recordCount
    let response: StateResponse
    try {
      response = await _fetchState(sid)
    } catch (err) {
      console.warn('[opsSync] Б-28 reconcile: state read failed — copy kept, canvas untouched:', err)
      if (sessionId.value === sid) restoreProblem.value = 'fetch'
      return 'fetch-failed'
    }
    if (sessionId.value !== sid || mode.value !== 'SYNC') return 'blocked'
    if (!response || typeof response !== 'object' || response.stale === true ||
        !response.state || typeof response.state !== 'object' || !_stateShowsRestored(response.state)) {
      // Несвіжий або неповний стан (напр. збірка з чанків без знімка сторінок одразу
      // після запису) — полотно не чіпаємо, копію лишаємо: жодного удаваного успіху.
      restoreProblem.value = 'stale'
      return 'stale'
    }
    const last = response.last_seq | 0
    if (pendingOps.value.length + inFlightOps.value.length > 0 ||
        _recordCount !== recordsAtRead || localSeq.value !== seqAtRead || last < localSeq.value) {
      // Нова дія (своя — у черзі чи вже записана, або чужа через WS), поки читали стан:
      // цей стан її не містить, і оновлення полотна стерло б її з екрана.
      restoreProblem.value = 'busy'
      return 'busy'
    }
    // 4: полотно могли зняти (вихід із кімнати) або замінити, поки читали стан.
    if (_canvasApplier !== apply) return 'blocked'
    try {
      apply(response.state)
    } catch (err) {
      console.warn('[opsSync] Б-28 reconcile: canvas apply failed — copy kept:', err)
      restoreProblem.value = 'apply'
      return 'apply-failed'
    }
    localSeq.value = Math.max(localSeq.value, last)
    serverSeq.value = Math.max(serverSeq.value, last)
    // Лише тепер — запис підтверджено, стан сервера на полотні: копії можна знімати.
    removeBackupKeys(_restoreKeys)
    _restoreKeys = []
    restoredPending.value = false
    restoreProblem.value = null
    _restoredOps = []
    persistQueue()  // черга порожня → власну копію знято — лише тепер
    return 'applied'
  }

  /** «Прибрати» старі копії (після підтвердження в UI). */
  function dismissLegacyCopies(): void {
    removeBackupKeys(legacyCopies.value.map(c => c.key))
    legacyCopies.value = []
  }

  /**
   * Записати чергу у сховище ЗАРАЗ і з перевіркою: у SAVE_BLOCKED — аварійний запис,
   * інакше — звичайна копія (порожня черга → копію знято). `false` → «черга без
   * копії» (`hasUnsecuredQueue`), не лише рядок у консолі (рев'ю P0, 2026-09-24).
   */
  function persistQueue(): boolean {
    const sid = sessionId.value
    if (!sid) return false
    if (mode.value === 'SAVE_BLOCKED') return persistBlocked()
    if (mode.value !== 'SYNC' && mode.value !== 'PAUSED') return false
    const ok = _writeOwnBackup(sid)
    backupFailed.value = !ok
    return ok
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
    _resetRetryState()  // TLV2-G1b: DESYNC не лишає таймер PAUSED
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
   *   - TLV2-G1b: єдиний таймер PAUSE_AUTO_RETRY_MS → одна спроба відновлення
   *   - UI: OpsPausedBanner (видимий стан + «Повторити зараз» → retryNow())
   *
   * NOT broadcast cross-tab — PAUSED — local backpressure signal, кожен tab decides
   * самостійно (DESYNC broadcasts because contract drift affects all tabs equally).
   */
  function enterPaused(reason: string): void {
    if (mode.value === 'PAUSED') return  // already there
    if (mode.value === 'DESYNC') return  // DESYNC takes precedence (INV-16)
    if (mode.value === 'SAVE_BLOCKED') return  // зупинку знімає лише вчитель
    mode.value = 'PAUSED'
    desyncReason.value = reason  // re-use field для UI banner messaging
    _retryUntil.value = null
    _probeArmed = false
    _armPauseTimer()
  }

  /**
   * TLV2-G1b: «Повторити зараз» з банера PAUSED.
   *
   * Знімає таймер і дозволяє одну спробу відновлення прямо зараз. Якщо спроба вже
   * дозволена або batch у мережі — нічого (без паралельних запитів). Результат:
   * успіх → SYNC; 503 / без відповіді → PAUSED і новий таймер 30 с.
   */
  function retryNow(): void {
    if (mode.value !== 'PAUSED') return
    if (_probeArmed || _flushPromise) return
    _clearPauseTimer()
    _requestProbe()
  }

  /**
   * TLV2-G1b: вихід із кімнати. Знімає таймер PAUSED, дозвіл спроби і лічильник 503.
   * Черги (ті самі op_id) і режим не чіпає: наступний bootstrap цієї дошки поверне SYNC
   * і відправить їх, а backup рекордера зберігає їх при зміні дошки.
   */
  function stopPauseRecovery(): void {
    _resetRetryState()
  }

  /**
   * Phase S PR-3 (2026-04-28): службовий вихід із PAUSED без запиту.
   *
   * TLV2-G1b: UI цим не користується — кнопка банера викликає retryNow(), а таймер
   * дозволяє одну спробу. Лишено для явного скидання (тести, майбутні виклики).
   *
   * Side effects:
   *   - Mode → SYNC (з PAUSED); таймер, дозвіл спроби, лічильник 503 скинуто
   *   - inFlightOps preserved (next flush() retries SAME batch — INV-14 dedup safe)
   */
  function resumeFromPause(): void {
    if (mode.value !== 'PAUSED') return
    _exitPause()
  }

  /**
   * Resync: GET /sessions/{sid}/state/ → reconcile localSeq=serverSeq=last_seq.
   * Drops pending + inFlight (stale post-DESYNC).
   * Mode → SYNC (з DESYNC).
   *
   * Caller (DesyncRecoveryBanner button or auto on 409) тригерить resync().
   */
  async function resync(sid: string): Promise<void> {
    // SAVE_BLOCKED (LAW §4, ТЗ §5.3): resync скидає черги — тут це мовчки викинуло б
    // невирішені дії й зняло зупинку. Вихід із SAVE_BLOCKED — лише дія вчителя.
    if (mode.value === 'SAVE_BLOCKED' && sid === sessionId.value) {
      throw new SaveBlockedError(saveBlock.value, false)
    }
    if (sid !== sessionId.value) {
      // Different session — full bootstrap
      reset()
      await bootstrap(sid)
      return
    }
    // Same session — fetch fresh state
    const response = await _fetchState(sid)
    _resetRetryState()  // TLV2-G1b: після resync знову первинна спроба + 2 повтори
    // Б-28: черга (з діями з копії) скинута — пам'ять про відновлення теж; самі копії
    // лишаються: після reload дії підхопляться знову, успіх не вдаватимемо.
    _forgetRestore()
    pendingOps.value = []
    inFlightOps.value = []
    serverSeq.value = response.last_seq | 0
    localSeq.value = response.last_seq | 0
    mode.value = 'SYNC'
    desyncReason.value = null
  }

  // ── INV-24 WS-CATCHUP (2026-06-13) ──────────────────────────────────

  /** Coalescing mutex: конкурентні catchUp() повертають той самий Promise. */
  let _catchUpPromise: Promise<CatchUpResult> | null = null

  /**
   * INV-24 WS-CATCHUP: read-side reconciliation після WS (re)subscribe.
   *
   * Live-канал (stroke.broadcast) — lossy за дизайном: BE rate-limit drops,
   * `wsBroadcast()` silent-skip при isConnected=false, не-підписаний peer не
   * отримує broadcast-и взагалі. Ops-log — істина (LAW §1) → після кожного
   * successful (re)connect клієнт зобов'язаний звіритись із GET /state/.
   *
   * Контракт (SSOT INV-24):
   *   1. SYNC-only — інакше 'blocked' (DESYNC recovery = resync()).
   *   2. flushAll-first — щоб hydrate не стер власні незаписані ops з канви;
   *      flush failure → ABORT ('flush-failed'), канва не чіпається.
   *   3. stale-guard — body.stale=true → no hydrate, no seq advance (інакше
   *      stale-канва маскується свіжим localSeq назавжди).
   *   4. Hydrate ТІЛЬКИ якщо last_seq > localSeq; counters advance атомарно
   *      ПІСЛЯ applyState.
   *   5. Coalesced single-flight; trigger ВИКЛЮЧНО подієвий — NO timers,
   *      NO retry loops (LAW §12). Fetch-помилки пропагуються caller-у.
   *
   * На відміну від resync(): pendingOps НЕ дропаються (здоровий SYNC-стан).
   *
   * @param applyState board applier (boardStore.applyCatchUpState) —
   *   викликається синхронно перед advance лічильників.
   */
  async function catchUp(
    applyState: (state: Record<string, unknown>) => void,
  ): Promise<CatchUpResult> {
    if (_catchUpPromise) return _catchUpPromise
    if (_reconcilePromise) {
      await _reconcilePromise  // Б-28: звірка відновлення вже оновлює полотно
      if (_catchUpPromise) return _catchUpPromise  // інший виклик встиг стартувати, поки чекали
    }
    _catchUpPromise = _doCatchUp(applyState).finally(() => {
      _catchUpPromise = null
    })
    return _catchUpPromise
  }

  async function _doCatchUp(
    applyState: (state: Record<string, unknown>) => void,
  ): Promise<CatchUpResult> {
    const sid = sessionId.value
    if (mode.value !== 'SYNC' || !sid) {
      return { status: 'blocked', lastSeq: localSeq.value }
    }
    if (pendingOps.value.length > 0 || inFlightOps.value.length > 0) {
      try {
        await flushAll()
      } catch (err) {
        console.warn('[opsSync] INV-24 catchUp: flushAll failed — abort (canvas untouched):', err)
        return { status: 'flush-failed', lastSeq: localSeq.value }
      }
      // flushAll міг змінити mode (409→SeqResync лишає SYNC, але 503×3→PAUSED,
      // protocol-mismatch→DESYNC кинули б; cross-tab DESYNC — мовчки). Re-check.
      if (mode.value !== 'SYNC') {
        return { status: 'blocked', lastSeq: localSeq.value }
      }
    }
    const response = await _fetchState(sid)
    const serverLast = response.last_seq | 0
    if (response.stale === true) {
      console.warn('[opsSync] INV-24 catchUp: BE state stale — skip hydrate (no seq advance)')
      return { status: 'stale', lastSeq: localSeq.value }
    }
    if (serverLast <= localSeq.value) {
      serverSeq.value = Math.max(serverSeq.value, serverLast)
      return { status: 'current', lastSeq: localSeq.value }
    }
    // Розрив: пропущені ops існують (ephemeral канал їх не доставив).
    const state = response.state
    if (!state || typeof state !== 'object') {
      // Contract guard: advance без hydrate замаскував би розрив назавжди.
      console.warn('[opsSync] INV-24 catchUp: gap detected but no state payload — skip')
      return { status: 'stale', lastSeq: localSeq.value }
    }
    applyState(state)
    localSeq.value = serverLast
    serverSeq.value = serverLast
    return { status: 'applied', lastSeq: serverLast }
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
    // SAVE_BLOCKED: у пам'яті скидаємо, аварійний запис лишається у сховищі й
    // повернеться при наступному bootstrap цієї дошки.
    saveBlock.value = null
    droppedWhileBlocked.value = 0
    backupFailed.value = false
    bootstrapFailed.value = false
    legacyCopies.value = []
    _forgetRestore()
    _adoptedBlockedKeys = []
    _unreadableBlocked = []
    _ownBlockedKey = null
    _manualAttempt = false
    // Phase S PR-3: reset retry state + cancel auto-retry timer (TLV2-G1b: + дозвіл спроби)
    _resetRetryState()
    probeInFlight.value = false
    _lastFlushDuration.value = 0
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
    // TLV2-G1b: спроби відновлення з PAUSED
    pauseProbeSeq,
    probeInFlight,
    // SAVE_BLOCKED (2026-09-23)
    saveBlock,
    isSaveBlocked,
    hasUnsecuredQueue,
    inputLocked,
    pausedUnsecured,
    backupFailed,
    bootstrapFailed,
    restoring,
    restoredPending,
    restoreProblem,
    legacyCopies,
    droppedWhileBlocked,
    blockResolving,
    canRetryBlocked,

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
    retryNow,
    stopPauseRecovery,
    resync,
    // INV-24 WS-CATCHUP (2026-06-13): read-side reconciliation після (re)connect
    catchUp,
    reset,
    // SAVE_BLOCKED: дії вчителя + аварійний запис
    persistBlocked,
    persistQueue,
    setCanvasApplier,
    clearCanvasApplier,
    noteRestored,
    reconcileRestored,
    exportLegacyCopies,
    dismissLegacyCopies,
    retryBlocked,
    discardBlocked,
    exportBlocked,
    setBlockedOwner,

    // Constants (consumer/test access)
    PROTOCOL_VERSION,
    FLUSH_BATCH_SIZE,
    MAX_RETRY_ATTEMPTS,
    PAUSE_AUTO_RETRY_MS,
    MAX_BLOCKED_QUEUE_OPS,
    MAX_BATCH_BYTES,
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
 *   - TLV2-G1b: «Повторити зараз» (retryNow()) або таймер 30 с дозволяють один flush;
 *     також кидається, коли ця спроба знову отримала 503
 */
export class BackpressureError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BackpressureError'
  }
}

/**
 * SAVE_BLOCKED (2026-09-23, LAW §4): flush() відмовляє без HTTP, бо сервер
 * остаточно відмовив пакету або результат не підтверджено. `entered=true` — саме
 * цей виклик перевів store у SAVE_BLOCKED (для одноразової телеметрії).
 */
export class SaveBlockedError extends Error {
  public readonly info: SaveBlockInfo | null
  public readonly entered: boolean

  constructor(info: SaveBlockInfo | null, entered: boolean) {
    super(`flush() blocked: save-blocked (${info?.kind ?? 'unknown'})`)
    this.name = 'SaveBlockedError'
    this.info = info
    this.entered = entered
  }
}

/**
 * 2026-05-13 (Def 1): thrown by opsSyncStore.flush() after 409 SEQ_MISMATCH
 * AUTO-RESYNC (instead of DESYNC).
 *
 * Semantics:
 *   - 409 received → serverSeq corrected from `expected_seq` in response body
 *   - inFlightOps DROPPED (server processed them or rejected — can't resend)
 *   - pendingOps PRESERVED (haven't reached server — will be sent with correct seq)
 *   - Mode stays SYNC — NO user action required, NO DesyncRecoveryBanner
 *
 * Caller (useReplayRecorder.flush()) MUST catch + log + persist backup.
 * Next safety interval will flush remaining pendingOps with corrected serverSeq.
 *
 * MUST NOT be confused with DesyncError — this is self-healing, not a hard lock.
 */
export class SeqResyncError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SeqResyncError'
  }
}
