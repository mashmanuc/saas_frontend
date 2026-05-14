// A11: Replay API composable
// Ref: DAY16_AGENT-A.md
// Zone: AGENT-A (api/)
// Note: apiClient response interceptor already unwraps .data — no need for .then(r => r.data)
//
// Phase 2 (2026-04-27) updates per `saas_docs/domains/winterboard/ops_sync/`:
//   - INV-20: 4 winterboard write endpoints вимагають `X-Protocol-Version: v3` header.
//     Mismatch → 400 PROTOCOL_VERSION_MISMATCH. apiClient detect + opsSyncStore.enterDesync.
//   - SSOT §4: replay/batch contract change `{seq, ops}` → `{last_seq, applied_count}`.
//   - INV-14: each op MUST include `op_id` (UUID NOT NULL per migration 0038).

import apiClient from '@/utils/apiClient'
import type {
  ReplayTimeline,
  BoardOperation,
  RecordOperationRequest,
  ReplayQuery,
  ReplaySnapshot,
} from '../types/replay'
import type { WBLessonMarker } from '../types/winterboard'

const BASE = '/v1/winterboard'

// INV-20: required header on 4 write endpoints (replay/batch, lock, page, state-update)
export const PROTOCOL_VERSION = 'v3'
const PROTOCOL_HEADERS = { 'X-Protocol-Version': PROTOCOL_VERSION } as const

// ─── Replay Timeline ───────────────────────────────────────────────────────

/**
 * GET /winterboard/sessions/{uuid}/replay/
 * Returns full operation log for replay, sorted ASC by created_at.
 * Supports page_id / op_type / limit / offset filtering.
 */
export async function fetchReplayTimeline(
  sessionId: string,  // UUID
  query?: ReplayQuery,
  signal?: AbortSignal,
): Promise<ReplayTimeline> {
  return apiClient.get<ReplayTimeline>(
    `${BASE}/sessions/${sessionId}/replay/`,
    { params: query, ...(signal ? { signal } : {}) },
  )
}

// ─── Record single operation ───────────────────────────────────────────────

/**
 * POST /winterboard/sessions/{uuid}/replay/operation/
 * Records a single board operation in the session timeline.
 * Returns the created BoardOperation with server-assigned id/created_at.
 */
export async function recordOperation(
  sessionId: string,
  op: RecordOperationRequest,
): Promise<BoardOperation> {
  return apiClient.post<BoardOperation>(
    `${BASE}/sessions/${sessionId}/replay/operation/`,
    op,
  )
}

// ─── Batch record operations ───────────────────────────────────────────────

/**
 * Phase 1 (2026-04-27) batch contract per OPS_SYNC_SSOT §4:
 *
 * Request:  {seq, ops: [{op_id, op_type, page_id, payload, client_seq?}, ...]}
 * Response: {last_seq, applied_count}
 * Errors:
 *   400 {error: 'PROTOCOL_VERSION_MISMATCH', client_version, server_version}
 *   400 {error: 'validation_failed', invalid_op_index?, reason}
 *   409 {error: 'SEQ_MISMATCH', expected_seq}
 *   503 {error: 'SERVER_BUSY'} (with Retry-After header)
 *
 * Header: X-Protocol-Version: v3 REQUIRED (INV-20).
 *
 * Each op MUST include `op_id` (UUID NOT NULL per migration 0038, INV-14).
 */
export interface BatchRecordResponse {
  last_seq: number
  applied_count: number
  /**
   * Phase V Round 2 (2026-05-10) — transport-internal metadata extracted from
   * `X-WB-Write-Path` response header (BE adds when feature flag enabled).
   *
   * NOT part of API contract (`{last_seq, applied_count}` залишається canonical).
   * `_` prefix marks transport-internal field, не business data.
   *
   * Possible values: 'solo' | 'legacy' | undefined (header absent during
   * mid-rollout / older BE deploy). Phase V scope reduction (2026-05-10):
   * 'classroom' value removed — data model permits max 1 student per WBSession
   * (Lesson.wb_session OneToOneField) so multi-writer contention scenario does
   * not exist у production. Ref: VARIANT_D_COORDINATION.md §11.
   */
  _writePath?: string
}

export async function recordOperationsBatch(
  sessionId: string,
  seq: number,
  ops: RecordOperationRequest[],  // max 100; кожен з op_id (UUID)
): Promise<BatchRecordResponse> {
  // Phase V Round 2 (2026-05-10): use fullResponse meta so we can read
  // `X-WB-Write-Path` header. Body shape unchanged — `_writePath` додається
  // як transport-internal field (NOT API contract — see BatchRecordResponse).
  const res = (await apiClient.post(
    `${BASE}/sessions/${sessionId}/replay/batch/`,
    { seq, ops },
    {
      headers: PROTOCOL_HEADERS,
      meta: { fullResponse: true },
    },
  )) as { data: BatchRecordResponse; headers?: Record<string, unknown> }

  const body: BatchRecordResponse = res?.data
  // Header lookup case-insensitive (axios lowercases response headers, але
  // bracket access безпечний для both cases). Header present → string value;
  // absent → undefined.
  const headers = res?.headers ?? {}
  const rawHeader =
    (headers as Record<string, unknown>)['x-wb-write-path']
    ?? (headers as Record<string, unknown>)['X-WB-Write-Path']
  const writePath = typeof rawHeader === 'string' && rawHeader.length > 0
    ? rawHeader
    : undefined

  return writePath !== undefined
    ? { ...body, _writePath: writePath }
    : body
}

// ─── PR4 (2026-04-26): Recovery — check which op_ids already saved ─────────────

/**
 * POST /winterboard/sessions/{uuid}/replay/check-ops/
 *
 * Reconciliation endpoint. Викликається ТІЛЬКИ з recovery flows:
 * retryQueue overflow або 409 storm cap hit. НЕ для routine sync.
 *
 * Limit: 500 op_ids per request.
 */
export async function checkOps(
  sessionId: string,
  opIds: string[],
): Promise<{ saved: string[]; missing: string[] }> {
  return apiClient.post<{ saved: string[]; missing: string[] }>(
    `${BASE}/sessions/${sessionId}/replay/check-ops/`,
    { op_ids: opIds },
  )
}

// ─── Snapshots (Phase 10 P4: fast seek support) ─────────────────────────────

/**
 * GET /winterboard/sessions/{uuid}/replay/snapshots/{operationIndex}/?seq=N
 * A.3 (INV-AD): Запитує найближчий snapshot at-or-before заданого seq.
 * Параметр seq — single source of truth (не operation_index).
 *
 * @param sessionId - session UUID
 * @param targetSeq - target seq (replay timeline position)
 * @returns snapshot або null якщо не знайдено / помилка
 */
export async function fetchNearestSnapshot(
  sessionId: string,
  targetSeq: number,
): Promise<ReplaySnapshot | null> {
  try {
    return await apiClient.get<ReplaySnapshot>(
      // path index лишаємо як 0 (legacy compat) — backend читає seq з query string
      `${BASE}/sessions/${sessionId}/replay/snapshots/${targetSeq}/`,
      { params: { seq: targetSeq } },
    )
  } catch {
    return null
  }
}

/**
 * Phase B: GET /winterboard/replay/public/{token}/snapshots/nearest/?seq=N
 * Anonymous snapshot endpoint для ReplayV2 fast seek (public viewers).
 *
 * INV-V2-PUB-1: тільки publicToken — НЕ знає sessionId.
 * INV-V2-PUB-6: silent null при будь-якій помилці (404/429/timeout) → fallback.
 */
export async function fetchPublicNearestSnapshot(
  publicToken: string,
  targetSeq: number,
): Promise<ReplaySnapshot | null> {
  try {
    return await apiClient.get<ReplaySnapshot>(
      `${BASE}/replay/public/${publicToken}/snapshots/nearest/`,
      { params: { seq: targetSeq } },
    )
  } catch {
    return null
  }
}

/**
 * POST /winterboard/sessions/{uuid}/replay/snapshots/create/
 * Creates a board state snapshot at the given operation index.
 * Called automatically by useReplayRecorder every SNAPSHOT_EVERY ops.
 */
export async function createSnapshot(
  sessionId: string,
  operationIndex: number,
  boardState: Record<string, unknown>,
): Promise<void> {
  await apiClient.post(
    `${BASE}/sessions/${sessionId}/replay/snapshots/create/`,
    { operation_index: operationIndex, board_state: boardState },
  )
}

// ─── A.1: Manual Recording Control ────────────────────────────────────

/**
 * RecordingState (Plan v3 — server-authoritative state machine).
 */
export type RecordingState = 'idle' | 'recording' | 'paused' | 'finalized'

/**
 * POST /winterboard/sessions/{uuid}/start-recording/
 * IDLE → RECORDING (start) або FINALIZED → RECORDING (re-record).
 * BE handles BC routing: PAUSED → routes to resume internally.
 */
export async function startRecording(
  sessionId: string,
): Promise<{
  status: 'started' | 'resumed'
  recording_state: RecordingState
  recording_started_at: string | null
  recording_started_seq: number
}> {
  return apiClient.post(`${BASE}/sessions/${sessionId}/start-recording/`)
}

/**
 * POST /winterboard/sessions/{uuid}/pause-recording/
 * RECORDING → PAUSED. NO Replay yet.
 */
export async function pauseRecording(
  sessionId: string,
): Promise<{
  status: 'paused'
  recording_state: RecordingState
  recording_started_seq: number
}> {
  return apiClient.post(`${BASE}/sessions/${sessionId}/pause-recording/`)
}

/**
 * POST /winterboard/sessions/{uuid}/resume-recording/
 * PAUSED → RECORDING. Продовжує той самий Replay.
 */
export async function resumeRecording(
  sessionId: string,
): Promise<{
  status: 'resumed'
  recording_state: RecordingState
  recording_started_seq: number
}> {
  return apiClient.post(`${BASE}/sessions/${sessionId}/resume-recording/`)
}

/**
 * POST /winterboard/sessions/{uuid}/finalize-recording/
 * Plan v2.3: RECORDING|PAUSED → FINALIZED. Creates Replay exactly once.
 * INV-REC-FINALIZE.
 *
 * INV-22 §22.3 (PR-1b): legacy signature retained for backwards compat
 * (graceful migration). New callers MUST use `finalizeWithBarrier()`
 * which supplies `flushed_last_seq` to gate against apply-pipeline lag.
 */
export interface FinalizeRecordingResult {
  status: 'finalized'
  recording_state: RecordingState
  recording_stopped_at: string | null
  recording_stopped_seq: number
  is_replay_frozen: boolean
  replay_id: string
}

export async function finalizeRecording(
  sessionId: string,
): Promise<FinalizeRecordingResult> {
  return apiClient.post(`${BASE}/sessions/${sessionId}/finalize-recording/`)
}

// ─── INV-22 FINALIZE-BARRIER (PR-1b) ──────────────────────────────────────
//
// Per OPS_SYNC_SSOT.md INV-22 v4 + FIRST_FIX_SPRINT_PROPOSAL §1:
//   FE flushes pending ops, then calls finalize with the seq up to which
//   apply pipeline must catch up. BE blocks bounded 10s waiting for
//   `session.snapshot_seq >= flushed_last_seq`. On lag → 504 (blocking
//   modal, user-driven retry). On concurrent attempt → 429.
//
// Status code rules (per §22.13):
//   200 → success, replay materialized
//   400 → FLUSHED_SEQ_REQUIRED (programmer error — should never reach prod)
//   429 → FINALIZE_ALREADY_PENDING (another barrier active for session)
//   504 → APPLY_BACKLOG_TIMEOUT (apply pipeline lagging)
//
// HARD INVARIANT (per §22.7): 429 / 504 from this endpoint MUST NOT trigger
// DESYNC. They are operational states, not consistency corruption. The
// `finalizeWithBarrier()` helper translates them into typed errors that
// callers handle через blocking modal — opsSyncStore stays SYNC.

export interface FinalizeBarrierTimeoutPayload {
  error: 'APPLY_BACKLOG_TIMEOUT'
  expected_seq: number
  current_seq: number
  waited_ms: number
}

export interface FinalizeBarrierContentionPayload {
  error: 'FINALIZE_ALREADY_PENDING'
  detail?: string
  retry_after_ms: number
}

/**
 * Thrown when BE returns 504 — apply pipeline did not catch up within 10s.
 * Caller MUST show blocking modal з retry button. NO auto retry (LAW §12).
 */
export class FinalizeBarrierTimeoutError extends Error {
  readonly expected_seq: number
  readonly current_seq: number
  readonly waited_ms: number
  constructor(payload: FinalizeBarrierTimeoutPayload) {
    super(`APPLY_BACKLOG_TIMEOUT: expected_seq=${payload.expected_seq} current_seq=${payload.current_seq} waited_ms=${payload.waited_ms}`)
    this.name = 'FinalizeBarrierTimeoutError'
    this.expected_seq = payload.expected_seq
    this.current_seq = payload.current_seq
    this.waited_ms = payload.waited_ms
  }
}

/**
 * Thrown when BE returns 429 — another concurrent finalize is active for
 * this session (double-click, multi-tab, or network retry storm). Caller
 * shows the same blocking modal; retry button disabled for retry_after_ms.
 */
export class FinalizeBarrierContentionError extends Error {
  readonly retry_after_ms: number
  constructor(payload: FinalizeBarrierContentionPayload) {
    super(`FINALIZE_ALREADY_PENDING (retry_after_ms=${payload.retry_after_ms})`)
    this.name = 'FinalizeBarrierContentionError'
    this.retry_after_ms = payload.retry_after_ms
  }
}

/**
 * Thrown when BE returns 400 FLUSHED_SEQ_REQUIRED. Programmer error —
 * indicates a regression у the helper itself. Surfaces loudly (not silent).
 */
export class FinalizeBarrierContractError extends Error {
  constructor(detail: string) {
    super(`FLUSHED_SEQ_REQUIRED: ${detail}`)
    this.name = 'FinalizeBarrierContractError'
  }
}

/**
 * Thrown when finalize-recording HTTP call fails з network-level error
 * (no `response` on axios error). Включає:
 *   - CORS-shadowed 5xx (BE response stripped CORS header → browser blocks)
 *   - Genuine network glitches (DNS, connection reset, TLS timeout)
 *   - Fly proxy intermediary failures (502/504 без CORS)
 *
 * 2026-05-09: added after 10×60min stress test показав що під 10× concurrent
 * finalize, 5/20 fail with CORS-shadowed 504 → axios throws `Network Error`
 * без `err.response` → раніше fall-through to recording-broken banner ("Запис
 * не працює"). Тепер surfaces typed error → caller shows retry modal (same
 * UX як TimeoutError). Apply pipeline catches up по time of user retry.
 */
export class FinalizeBarrierNetworkError extends Error {
  readonly causeMessage: string
  constructor(cause: unknown) {
    const msg = (cause as { message?: string })?.message ?? String(cause)
    super(`Finalize network error: ${msg}`)
    this.name = 'FinalizeBarrierNetworkError'
    this.causeMessage = msg
  }
}

/**
 * INV-22 PR-1b — finalize із barrier confirmation that apply pipeline
 * caught up to a specified seq.
 *
 * Caller is responsible for flushing the ops queue first (e.g. via
 * `opsSync.flush()`) and providing the resulting `flushed_last_seq`
 * (typically `opsSync.serverSeq.value` after flush resolves).
 *
 * Throws (caller MUST catch):
 *   - FinalizeBarrierTimeoutError (504 — show blocking modal, manual retry)
 *   - FinalizeBarrierContentionError (429 — same modal, retry disabled)
 *   - FinalizeBarrierContractError (400 — programmer error)
 *   - other errors propagate as-is (network / 500 / etc.)
 *
 * Returns FinalizeRecordingResult on 200.
 *
 * Forbidden: NO auto retry inside this helper (LAW §12, INV-22 §22.7).
 * User-driven retry only — caller decides via UI action.
 */
export async function finalizeWithBarrier(
  sessionId: string,
  flushed_last_seq: number,
): Promise<FinalizeRecordingResult> {
  if (!Number.isInteger(flushed_last_seq) || flushed_last_seq < 0) {
    throw new FinalizeBarrierContractError(
      `flushed_last_seq must be non-negative integer, got ${String(flushed_last_seq)}`,
    )
  }
  try {
    return await apiClient.post(
      `${BASE}/sessions/${sessionId}/finalize-recording/`,
      { flushed_last_seq },
      // INV-22 §22.7 — suppress generic 5xx toast for 504 only (FE renders
      // its own blocking modal). Single-purpose flag (NOT a generic
      // `_skipErrorToastOnStatus` array — see apiClient.js FORBIDDEN comment).
      // 429 doesn't need it (apiClient already silent on 429).
      { _finalizeBarrierToastSuppressed: true } as any,
    )
  } catch (err) {
    const response = (err as any)?.response
    const status = response?.status
    const data = response?.data
    if (status === 504 && data?.error === 'APPLY_BACKLOG_TIMEOUT') {
      throw new FinalizeBarrierTimeoutError(data as FinalizeBarrierTimeoutPayload)
    }
    if (status === 429 && data?.error === 'FINALIZE_ALREADY_PENDING') {
      throw new FinalizeBarrierContentionError(data as FinalizeBarrierContentionPayload)
    }
    if (status === 400 && data?.error === 'FLUSHED_SEQ_REQUIRED') {
      throw new FinalizeBarrierContractError(data?.detail ?? 'unknown')
    }
    // Network-level error (no `response` on axios error) — could be CORS-shadowed
    // 504 (BE returned 504 but Fly proxy / middleware stripped CORS header → browser
    // blocks → axios sees no response) OR genuine network glitch. Surface як typed
    // error so caller може show retry modal замість scary "Запис не працює" banner.
    // Server-side state likely transitions cleanly on retry (apply pipeline catches
    // up). Auto_finalize_stale_recordings Celery task ще acts як safety net.
    if (!response) {
      throw new FinalizeBarrierNetworkError(err)
    }
    throw err
  }
}


/**
 * POST /winterboard/sessions/{uuid}/create-replay-from-ops/
 *
 * Ретроспективне створення replay з УСІХ існуючих операцій.
 * Якщо вчитель забув натиснути "Записати урок" — ops вже в базі,
 * цей endpoint ставить recording boundaries на весь діапазон.
 */
export async function createReplayFromExistingOps(
  sessionId: string,
): Promise<{
  recording_started_seq: number
  recording_stopped_seq: number
  total_operations: number
  is_replay_frozen: boolean
  /** Share Layer v1: BE повертає Replay id для нового content-entity. */
  replay_id?: string
}> {
  return apiClient.post(`${BASE}/sessions/${sessionId}/create-replay-from-ops/`)
}

// ─── Public Replay Access (Share Layer v2) ─────────────────────────────

/**
 * Replay visibility tier (canonical, Phase C).
 *
 * Legacy 'link' → migrated to 'unlisted' у Replay entity. Для нових
 * операцій використовуй replayLifecycleApi.changeReplayVisibility().
 */
export type ReplayVisibility = 'private' | 'unlisted' | 'public'

// [Phase C 2026-04-16] REMOVED (replaced by replayLifecycleApi):
//   updateReplayVisibility()   → replayLifecycleApi.changeReplayVisibility(id, v)
//   createReplayShareLink()    → auto on stop_recording (Replay.public_token)
//   rotateReplayShareToken()   → replayLifecycleApi.rotateReplayToken(id)

/** Custom error classes для public replay flow. */
export class ReplayGoneError extends Error {
  detail: string
  trashed_at: string | null
  constructor(data: { detail?: string; trashed_at?: string | null }) {
    super(data.detail || 'Запис видалено автором')
    this.name = 'ReplayGoneError'
    this.detail = data.detail || 'Запис видалено автором'
    this.trashed_at = data.trashed_at ?? null
  }
}

export class ReplayNotFoundError extends Error {
  constructor() {
    super('Replay not found')
    this.name = 'ReplayNotFoundError'
  }
}

/** Resolve API base URL — match logic у apiClient.js. */
function getApiBase(): string {
  // import.meta.env.DEV true in vite dev server, false у production build
  const isProduction = !import.meta.env.DEV
  if (isProduction) {
    return (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'https://api.m4sh.org/api'
  }
  return '/api'
}

/** GET /winterboard/replay/public/{token}/ — PUBLIC (no auth).
 *
 * Share Layer v2: canonical endpoint resolves через Replay.public_token
 * (не legacy WBSession.replay_share_token).
 *
 * **Phase 2.5 cache plan (B1 fix, 2026-04-25):** використовуємо raw `fetch()`,
 * НЕ apiClient. Причини:
 * - apiClient interceptor додає `Authorization: Bearer <jwt>` для залогінених
 * - CF за замовчуванням bypass-ить cache при наявності Authorization header
 * - Залогінені тьютори (target audience продукту) ніколи не отримували HIT
 *
 * Тут:
 * - `credentials: 'omit'` — НЕ слати cookies (sessionid, csrftoken)
 * - БЕЗ Authorization header — backend все одно AllowAny
 * - Custom error classes для 410/404 (без apiClient interceptor handling)
 *
 * Analytics: викликати reportReplayView(token) через 5с playback (D6 invariant).
 *
 * Response superset legacy schema — додано replay_id, duration_ms, view_count.
 *
 * @throws ReplayGoneError on 410 (replay trashed)
 * @throws ReplayNotFoundError on 404 (token не існує / private)
 * @throws Error on інші failures
 */
export async function fetchPublicReplayByToken(
  token: string,
): Promise<import('../types/replay').ReplayTimeline & {
  session_name?: string
  visibility?: ReplayVisibility
  tutor?: { id: number; name: string }
  replay_id?: string
  recorded_at?: string | null
  duration_ms?: number
  view_count?: number
}> {
  const url = `${getApiBase()}/v1/winterboard/replay/public/${encodeURIComponent(token)}/`
  const res = await fetch(url, {
    method: 'GET',
    credentials: 'omit', // C8: НЕ шлемо cookies/Authorization → CF cache friendly
    headers: { Accept: 'application/json' },
  })

  if (res.status === 410) {
    const data = await res.json().catch(() => ({}))
    throw new ReplayGoneError(data)
  }
  if (res.status === 404) {
    throw new ReplayNotFoundError()
  }
  if (res.status === 429) {
    throw new Error('rate_limited')
  }
  if (!res.ok) {
    throw new Error(`Fetch public replay failed: ${res.status}`)
  }
  return res.json()
}

/** POST /winterboard/replay/public/{token}/view-ping/ — analytics-only.
 *
 * Phase 3 cache plan: викликати ЧЕРЕЗ 5 секунд після playback start
 * (D6: real viewers, не URL opens).
 *
 * Backend має 5-min debounce per ip_hash + idempotent з op_id pattern.
 * Silent fail у catch — analytics ніколи не блокує playback.
 *
 * @returns true якщо ping успішно надіслано, false при failure (для дебагу)
 */
export async function reportReplayView(token: string): Promise<boolean> {
  try {
    const url = `${getApiBase()}/v1/winterboard/replay/public/${encodeURIComponent(token)}/view-ping/`
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'omit', // C8: і для ping — без cookies/auth
      keepalive: true, // витривалий до closing tab у межах 64KB request
    })
    if (!res.ok && res.status !== 204) {
      console.warn('[replay] view-ping non-OK', { status: res.status })
      return false
    }
    return true
  } catch (err) {
    // Silent fail у UX, але видимий у console для debug.
    // Типовий case: CF DDoS challenge, мережева помилка, rate limit.
    console.warn('[replay] view-ping network error', err)
    return false
  }
}

// ─── Phase C: Replay Comments ─────────────────────────────────────────

export interface ReplayCommentAuthor {
  id: number | null
  name: string
}

export interface ReplayComment {
  id: string
  operation_index: number
  text: string
  author: ReplayCommentAuthor
  created_at: string
  updated_at: string
}

/** GET /winterboard/sessions/{uuid}/replay/comments/ */
export async function fetchReplayComments(
  sessionId: string,
): Promise<{ comments: ReplayComment[] }> {
  return apiClient.get(`${BASE}/sessions/${sessionId}/replay/comments/`)
}

/** POST /winterboard/sessions/{uuid}/replay/comments/ */
export async function createReplayComment(
  sessionId: string,
  operationIndex: number,
  text: string,
): Promise<ReplayComment> {
  return apiClient.post(`${BASE}/sessions/${sessionId}/replay/comments/`, {
    operation_index: operationIndex,
    text,
  })
}

/** DELETE /winterboard/sessions/{uuid}/replay/comments/{id}/ */
export async function deleteReplayComment(
  sessionId: string,
  commentId: string,
): Promise<void> {
  await apiClient.delete(`${BASE}/sessions/${sessionId}/replay/comments/${commentId}/`)
}

// ─── Lesson Markers (Phase 10 P5) ─────────────────────────────────────

/**
 * GET /winterboard/sessions/{uuid}/markers/
 * Returns all markers for the session, ordered by [order, operation_index].
 */
export async function fetchLessonMarkers(
  sessionId: string,
): Promise<{ markers: WBLessonMarker[] }> {
  return apiClient.get<{ markers: WBLessonMarker[] }>(
    `${BASE}/sessions/${sessionId}/markers/`,
  )
}

/**
 * POST /winterboard/sessions/{uuid}/markers/
 * Creates a new lesson marker. Max 50 per session.
 */
export async function createLessonMarker(
  sessionId: string,
  marker: Omit<WBLessonMarker, 'id' | 'created_at'>,
): Promise<WBLessonMarker> {
  return apiClient.post<WBLessonMarker>(
    `${BASE}/sessions/${sessionId}/markers/`,
    marker,
  )
}

/**
 * PATCH /winterboard/sessions/{uuid}/markers/{markerId}/
 * Updates marker fields (title, category, order, board_position, etc.).
 */
export async function updateLessonMarker(
  sessionId: string,
  markerId: string,
  updates: Partial<WBLessonMarker>,
): Promise<WBLessonMarker> {
  return apiClient.patch<WBLessonMarker>(
    `${BASE}/sessions/${sessionId}/markers/${markerId}/`,
    updates,
  )
}

/**
 * DELETE /winterboard/sessions/{uuid}/markers/{markerId}/
 * Permanently removes a marker.
 */
export async function deleteLessonMarker(
  sessionId: string,
  markerId: string,
): Promise<void> {
  await apiClient.delete(
    `${BASE}/sessions/${sessionId}/markers/${markerId}/`,
  )
}
