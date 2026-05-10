// Phase V WS3 (2026-05-10) — write-path telemetry emitter.
//
// Покриває: distinguish solo vs legacy write path + measure
// time-to-first-server-confirmation per /replay/batch/ POST.
// Scope reduction (2026-05-10): classroom branch removed (data model permits
// max 1 student per session). Ref: VARIANT_D_COORDINATION.md §11.
//
// Authoritative spec: saas_docs/domains/winterboard/ops_sync/VARIANT_D_COORDINATION.md §3 WS3.
//
// Дизайн:
//   - Емітимо `wb_write_path` події у існуючий pipeline `winterboardApi.ingestTelemetry`.
//   - Окремий буфер з власним flush таймером — bo opsSyncStore (Pinia) не має access
//     до `useTelemetry()` composable lifecycle (composable тільки у Vue компонентах).
//   - НЕ створюємо нового HTTP transport — тільки існуючий `/v1/winterboard/telemetry/ingest/`.
//   - Telemetry failures НЕ blockують ops recorder. Усі shipping паті catch + одноразовий
//     `console.warn` per session (per session = per page load — module-scoped variable).
//     Justified exception per LAW §12 (silent error suppression):
//        Ops recorder є critical write path. Якщо telemetry endpoint падає, recorder
//        НЕ повинен втратити ops або throw exception назовні. Один warning на сесію
//        = NOT silent (LAW §12 prohibits *silent* suppression — single console.warn
//        is observable).
//
// API contract: NO change. Cей модуль читає response timing only, нічого не модифікує.

import { winterboardApi } from '../api/winterboardApi'

// ── Constants ────────────────────────────────────────────────────────

/** Періодичний flush буфера (ms). Aligned з `useTelemetry.ts` FLUSH_INTERVAL_MS. */
const FLUSH_INTERVAL_MS = 30_000
/** Cap буфера; flush достроково якщо переповнено. */
const MAX_BUFFER_SIZE = 200

// Phase V Round 2 (2026-05-10): sampling.
//
// Rationale: під FE retry storms / multi-tab учитель може генерувати burst-и
// до сотень events/min. Buffer 200 forces sub-30s flushes; telemetry endpoint
// may not absorb. Sample at 0.1 (10% emit, 90% drop at emit time) → 10×
// reduction with preserved aggregate accuracy. Metadata event
// `wb_write_path_sample_meta` once per minute lets backend reverse-extrapolate
// exact totals.

/** Default sampling rate (10%). Overridable via VITE_WB_TELEMETRY_SAMPLE_RATE. */
const DEFAULT_SAMPLE_RATE = 0.1
/** Metadata event emission interval. */
const SAMPLE_META_INTERVAL_MS = 60_000

/** Resolve sampling rate from env. Clamp to [0.0, 1.0]. Invalid → default. */
function _resolveSampleRate(): number {
  // import.meta.env access guarded — Vitest jsdom не завжди має import.meta.env.
  let raw: unknown
  try {
    raw = (import.meta as unknown as { env?: Record<string, unknown> })?.env?.[
      'VITE_WB_TELEMETRY_SAMPLE_RATE'
    ]
  } catch {
    raw = undefined
  }
  if (raw === undefined || raw === null || raw === '') return DEFAULT_SAMPLE_RATE
  const parsed = typeof raw === 'number' ? raw : parseFloat(String(raw))
  if (!Number.isFinite(parsed)) return DEFAULT_SAMPLE_RATE
  if (parsed < 0) return 0
  if (parsed > 1) return 1
  return parsed
}

// ── Types ────────────────────────────────────────────────────────────

/**
 * Минимальний обов'язковий контракт події `wb_write_path`.
 *
 * Status semantics:
 *   - 200..299  → success
 *   - 4xx / 5xx → HTTP error (ops still у inFlightOps for retry)
 *   - 0         → network-level failure (no response received)
 */
export interface WbWritePathEvent {
  /** seq sent у request body (`{seq, ops}`). */
  seq: number
  /** довжина `ops` array. */
  ops_count: number
  /** performance.now() delta між request start та response received. */
  roundtrip_ms: number
  /** HTTP status code; 0 для network-level fail. */
  status: number
  /**
   * Optional path inference if BE adds `X-WB-Write-Path` response header (Phase V WS1
   * deliverable). Якщо absent → undefined (lead aggregates raw roundtrip_ms only).
   */
  write_path?: 'solo' | 'legacy' | string
}

interface BufferedEvent {
  event_type: 'wb_write_path'
  timestamp: string
  session_id: string | null
  payload: Record<string, unknown>
}

// ── Module-scoped buffer ─────────────────────────────────────────────

let buffer: BufferedEvent[] = []
let flushTimer: ReturnType<typeof setInterval> | null = null
let warnedThisSession = false

// Sampling state (Phase V Round 2). Re-resolved per-call so test envs can
// override `import.meta.env` lazily; cost negligible (string parse).
let _sampledCount = 0
let _droppedCount = 0
let _sampleMetaWindowStart = 0
let _lastSampleSessionId: string | null = null

// ── Internal helpers ─────────────────────────────────────────────────

function ensureFlushTimer(): void {
  if (flushTimer || typeof setInterval === 'undefined') return
  flushTimer = setInterval(() => {
    void doFlush()
  }, FLUSH_INTERVAL_MS)
}

async function doFlush(): Promise<void> {
  if (buffer.length === 0) return
  const batch = buffer
  buffer = []
  let ok = false
  try {
    ok = await winterboardApi.ingestTelemetry(batch)
  } catch {
    // ingestTelemetry уже catch-ить внутрішньо і повертає false; цей catch — додаткова
    // safety net на випадок зміни сигнатури.
    ok = false
  }
  if (!ok && !warnedThisSession) {
    warnedThisSession = true
    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
      console.warn(
        '[wb_write_path] telemetry ingest failed (further failures suppressed this session).',
      )
    }
  }
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Push metadata event `wb_write_path_sample_meta` if window elapsed.
 *
 * Phase V Round 2 (2026-05-10): backend uses `{rate, sampled_count,
 * dropped_count}` to reverse-extrapolate raw totals from sampled stream.
 *
 * The metadata event itself is NOT sampled. Emitted on first sampling decision
 * after each ~60s window boundary. Inline (no setInterval) — no extra timer
 * lifecycle, fires only when there's traffic.
 *
 * Idempotent: if no events occurred in window, no meta event emitted.
 */
function _maybeEmitSampleMeta(rate: number, now: number, sessionId: string | null): void {
  if (_sampleMetaWindowStart === 0) {
    _sampleMetaWindowStart = now
    return
  }
  if (now - _sampleMetaWindowStart < SAMPLE_META_INTERVAL_MS) return
  if (_sampledCount === 0 && _droppedCount === 0) {
    _sampleMetaWindowStart = now
    return
  }
  buffer.push({
    event_type: 'wb_write_path',
    timestamp: new Date().toISOString(),
    session_id: sessionId ?? _lastSampleSessionId,
    payload: {
      _meta_event: 'wb_write_path_sample_meta',
      rate,
      sampled_count: _sampledCount,
      dropped_count: _droppedCount,
    },
  })
  _sampledCount = 0
  _droppedCount = 0
  _sampleMetaWindowStart = now
}

/**
 * Emit single `wb_write_path` event у buffer. Non-blocking, non-throwing.
 *
 * Caller (opsSyncStore._doFlush) wraps виклик у try/catch (defense-in-depth) — але
 * саме ця функція вже sufficiently robust: усі побічні effects ізольовані.
 *
 * Phase V Round 2 sampling: drops 90% of events at emit time (default rate=0.1,
 * configurable via VITE_WB_TELEMETRY_SAMPLE_RATE). Dropped events DO NOT push
 * to buffer. A `wb_write_path_sample_meta` event is emitted ~once per 60s with
 * counts so BE can reverse-extrapolate. Metadata event itself NOT sampled.
 *
 * @param sessionId — session UUID або null (preserve same shape with useTelemetry).
 * @param event — payload per WbWritePathEvent shape.
 */
export function emitWritePathEvent(
  sessionId: string | null,
  event: WbWritePathEvent,
): void {
  ensureFlushTimer()
  _lastSampleSessionId = sessionId

  const rate = _resolveSampleRate()
  const now = typeof Date !== 'undefined' ? Date.now() : 0

  // Sampling decision. rate=1.0 → always emit (current behavior). rate=0 → never.
  // Math.random() ∈ [0, 1); strict-less yields correct probability при rate=1.0
  // тільки якщо ми trap edge: at rate=1.0 always emit (Math.random() < 1.0 is
  // true except for exact 1.0 which never returns; safe).
  const shouldEmit = rate >= 1 ? true : rate <= 0 ? false : Math.random() < rate

  if (shouldEmit) {
    _sampledCount += 1
    buffer.push({
      event_type: 'wb_write_path',
      timestamp: new Date().toISOString(),
      session_id: sessionId,
      payload: {
        seq: event.seq,
        ops_count: event.ops_count,
        roundtrip_ms: event.roundtrip_ms,
        status: event.status,
        ...(event.write_path !== undefined ? { write_path: event.write_path } : {}),
      },
    })
    if (buffer.length >= MAX_BUFFER_SIZE) {
      void doFlush()
    }
  } else {
    _droppedCount += 1
  }

  // Window check happens after counter increment so first event у window
  // встановлює _sampleMetaWindowStart, а ~60s later наступний event triggers
  // emit. Meta event підраховує ALL події цього window (sampled + dropped).
  _maybeEmitSampleMeta(rate, now, sessionId)
}

/**
 * Force flush буфер. Викликається lifecycle-hooks (тестами або teardown).
 */
export async function flushWritePathTelemetry(): Promise<void> {
  await doFlush()
}

/**
 * Reset module state. Для unit tests тільки.
 *
 * @internal
 */
export function _resetWritePathTelemetryForTests(): void {
  buffer = []
  warnedThisSession = false
  _sampledCount = 0
  _droppedCount = 0
  _sampleMetaWindowStart = 0
  _lastSampleSessionId = null
  if (flushTimer) {
    clearInterval(flushTimer)
    flushTimer = null
  }
}

/**
 * Read current buffer length. Для unit tests тільки.
 *
 * @internal
 */
export function _peekBufferForTests(): BufferedEvent[] {
  return buffer.slice()
}
