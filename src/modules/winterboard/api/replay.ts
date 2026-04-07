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
): Promise<ReplayTimeline> {
  return apiClient.get<ReplayTimeline>(
    `${BASE}/sessions/${sessionId}/replay/`,
    { params: query },
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
 * GET /winterboard/sessions/{uuid}/replay/snapshots/{operationIndex}/
 * Returns the nearest snapshot at or before the given operation index.
 * Returns null if no snapshot exists (graceful degradation).
 */
export async function fetchNearestSnapshot(
  sessionId: string,
  operationIndex: number,
): Promise<ReplaySnapshot | null> {
  try {
    return await apiClient.get<ReplaySnapshot>(
      `${BASE}/sessions/${sessionId}/replay/snapshots/${operationIndex}/`,
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
): Promise<{ recording_stopped_at: string; recording_stopped_seq: number; is_replay_frozen: boolean }> {
  return apiClient.post(`${BASE}/sessions/${sessionId}/stop-recording/`)
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
