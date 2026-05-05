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
}

export async function recordOperationsBatch(
  sessionId: string,
  seq: number,
  ops: RecordOperationRequest[],  // max 100; кожен з op_id (UUID)
): Promise<BatchRecordResponse> {
  return apiClient.post<BatchRecordResponse>(
    `${BASE}/sessions/${sessionId}/replay/batch/`,
    { seq, ops },
    { headers: PROTOCOL_HEADERS },
  )
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
 */
export async function finalizeRecording(
  sessionId: string,
): Promise<{
  status: 'finalized'
  recording_state: RecordingState
  recording_stopped_at: string | null
  recording_stopped_seq: number
  is_replay_frozen: boolean
  replay_id: string
}> {
  return apiClient.post(`${BASE}/sessions/${sessionId}/finalize-recording/`)
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
