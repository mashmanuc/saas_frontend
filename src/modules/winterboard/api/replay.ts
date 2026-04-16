// A11: Replay API composable
// Ref: DAY16_AGENT-A.md
// Zone: AGENT-A (api/)
// Note: apiClient response interceptor already unwraps .data — no need for .then(r => r.data)

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
 * POST /winterboard/sessions/{uuid}/replay/batch/
 * Records up to 100 operations in a single request.
 * Returns { recorded: N } — count of successfully persisted operations.
 */
export async function recordOperationsBatch(
  sessionId: string,
  operations: RecordOperationRequest[],  // max 100
): Promise<{ recorded: number; total_operations: number }> {
  return apiClient.post<{ recorded: number; total_operations: number }>(
    `${BASE}/sessions/${sessionId}/replay/batch/`,
    { operations },
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
 * POST /winterboard/sessions/{uuid}/start-recording/
 * Починає запис уроку. Тільки owner.
 */
export async function startRecording(
  sessionId: string,
): Promise<{ recording_started_at: string; recording_started_seq: number }> {
  return apiClient.post(`${BASE}/sessions/${sessionId}/start-recording/`)
}

/**
 * POST /winterboard/sessions/{uuid}/stop-recording/
 * Зупиняє запис уроку. Фіксує replay boundary (INV-AF).
 */
export async function stopRecording(
  sessionId: string,
): Promise<{
  recording_stopped_at: string
  recording_stopped_seq: number
  is_replay_frozen: boolean
  /** Share Layer v1: BE тепер повертає Replay id створеного hook'ом. */
  replay_id?: string
}> {
  return apiClient.post(`${BASE}/sessions/${sessionId}/stop-recording/`)
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

// ─── Phase B: Public Replay Access ─────────────────────────────────────

export type ReplayVisibility = 'private' | 'link' | 'public'

export interface ReplayVisibilityResponse {
  visibility: ReplayVisibility
  share_token: string | null
}

export interface ReplayShareLinkResponse {
  share_token: string
  visibility: ReplayVisibility
  relative_url: string
}

/** PATCH /winterboard/sessions/{uuid}/replay/visibility/ — owner only */
export async function updateReplayVisibility(
  sessionId: string,
  visibility: ReplayVisibility,
): Promise<ReplayVisibilityResponse> {
  return apiClient.patch<ReplayVisibilityResponse>(
    `${BASE}/sessions/${sessionId}/replay/visibility/`,
    { visibility },
  )
}

/** POST /winterboard/sessions/{uuid}/replay/share-link/ — owner only */
export async function createReplayShareLink(
  sessionId: string,
): Promise<ReplayShareLinkResponse> {
  return apiClient.post<ReplayShareLinkResponse>(
    `${BASE}/sessions/${sessionId}/replay/share-link/`,
  )
}

/** POST /winterboard/sessions/{uuid}/replay/rotate-token/ — INV-V: old URL dies */
export async function rotateReplayShareToken(
  sessionId: string,
): Promise<ReplayShareLinkResponse> {
  return apiClient.post<ReplayShareLinkResponse>(
    `${BASE}/sessions/${sessionId}/replay/rotate-token/`,
  )
}

/** GET /winterboard/replay/public/{token}/ — PUBLIC (no auth).
 *
 * Share Layer v2: canonical endpoint resolves через Replay.public_token
 * (не legacy WBSession.replay_share_token). Includes analytics tracking.
 *
 * Response superset legacy schema — додано replay_id, duration_ms, view_count.
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
  return apiClient.get(`${BASE}/replay/public/${token}/`)
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
