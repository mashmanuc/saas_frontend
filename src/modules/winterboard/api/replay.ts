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
} from '../types/replay'

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
): Promise<{ recorded: number }> {
  return apiClient.post<{ recorded: number }>(
    `${BASE}/sessions/${sessionId}/replay/batch/`,
    { operations },
  )
}
