/**
 * Platform Feedback API client.
 * Base path: /api/v1/platform-feedback/
 *
 * Response envelope: { data, meta }
 * Error envelope:    { error, detail, fields? }
 */
import apiClient from '@/utils/apiClient'

const BASE = '/v1/platform-feedback'

// J1 (2026-05-27): apiClient має global response interceptor що повертає
// `res.data` (axios body). Тобто наш `res` = backend response = {data, meta?}.
// Раніше unwrapWithMeta дивився на res.data.data — то інший шар, undefined →
// fallback на [], FE показував порожній список попри валідну backend response.
// Now: res — backend envelope; res.data — payload; res.meta — pagination.
function unwrap(res) {
  // Legacy support: якщо хтось ще не interceptor-aware і передає raw axios res,
  // res.data може містити backend envelope. Try both.
  return res?.data?.data ?? res?.data ?? res
}

function unwrapWithMeta(res) {
  // Backend envelope: {data: [...], meta: {page, page_size, total}}
  // res — це уже unwrapped backend body завдяки apiClient interceptor.
  return {
    data: res?.data ?? [],
    meta: res?.meta ?? {},
  }
}

// ---------- Threads ----------

export async function listThreads(params = {}) {
  const res = await apiClient.get(`${BASE}/threads/`, { params })
  return unwrapWithMeta(res)
}

export async function getThread(id) {
  const res = await apiClient.get(`${BASE}/threads/${id}/`)
  return unwrap(res)
}

export async function createThread(payload) {
  const res = await apiClient.post(`${BASE}/threads/`, payload)
  return unwrap(res)
}

export async function updateThread(id, payload) {
  const res = await apiClient.patch(`${BASE}/threads/${id}/`, payload)
  return unwrap(res)
}

export async function deleteThread(id) {
  await apiClient.delete(`${BASE}/threads/${id}/`)
}

export async function searchSimilar(q, { type } = {}) {
  const params = { q }
  if (type) params.type = type
  const res = await apiClient.get(`${BASE}/threads/similar/`, { params })
  return unwrap(res)
}

export async function fullSearch(q, { type, limit = 20 } = {}) {
  const params = { q, limit }
  if (type) params.type = type
  const res = await apiClient.get(`${BASE}/threads/search/`, { params })
  return unwrapWithMeta(res)
}

// ---------- Voting ----------

export async function toggleVote(threadId) {
  const res = await apiClient.post(`${BASE}/threads/${threadId}/vote/`)
  return unwrap(res)
}

// ---------- Subscriptions ----------

export async function subscribe(threadId) {
  const res = await apiClient.post(`${BASE}/threads/${threadId}/subscribe/`)
  return unwrap(res)
}

export async function unsubscribe(threadId) {
  const res = await apiClient.delete(`${BASE}/threads/${threadId}/subscribe/`)
  return unwrap(res)
}

// ---------- Comments ----------

export async function listComments(threadId) {
  const res = await apiClient.get(`${BASE}/threads/${threadId}/comments/`)
  return unwrap(res)
}

export async function createComment(threadId, content) {
  const res = await apiClient.post(`${BASE}/threads/${threadId}/comments/`, { content })
  return unwrap(res)
}

export async function deleteComment(commentId) {
  await apiClient.delete(`${BASE}/comments/${commentId}/`)
}

// ---------- Staff moderation ----------

export async function changeStatus(threadId, payload) {
  const res = await apiClient.patch(`${BASE}/threads/${threadId}/status/`, payload)
  return unwrap(res)
}

export async function updateStaffResponse(threadId, staff_response) {
  const res = await apiClient.patch(`${BASE}/threads/${threadId}/staff-response/`, { staff_response })
  return unwrap(res)
}

export async function toggleLock(threadId) {
  const res = await apiClient.patch(`${BASE}/threads/${threadId}/lock/`)
  return unwrap(res)
}

export async function toggleHide(threadId) {
  const res = await apiClient.patch(`${BASE}/threads/${threadId}/hide/`)
  return unwrap(res)
}

// S1: staff може правити author content
export async function staffEditThread(threadId, payload) {
  const res = await apiClient.patch(`${BASE}/threads/${threadId}/staff-edit/`, payload)
  return unwrap(res)
}

// S2: bulk hide/unhide/lock/unlock/archive
export async function bulkAction(threadIds, action) {
  const res = await apiClient.post(`${BASE}/threads/bulk/`, {
    thread_ids: threadIds,
    action,
  })
  return unwrap(res)
}

export async function toggleCommentHide(commentId) {
  const res = await apiClient.patch(`${BASE}/comments/${commentId}/hide/`)
  return unwrap(res)
}

// E2: diagnostic queue
export async function unreviewedCount() {
  const res = await apiClient.get(`${BASE}/threads/unreviewed-count/`)
  return unwrap(res)
}

export async function markReviewed(threadId) {
  const res = await apiClient.patch(`${BASE}/threads/${threadId}/mark-reviewed/`)
  return unwrap(res)
}

export default {
  listThreads,
  getThread,
  createThread,
  updateThread,
  deleteThread,
  searchSimilar,
  fullSearch,
  toggleVote,
  subscribe,
  unsubscribe,
  listComments,
  createComment,
  deleteComment,
  changeStatus,
  updateStaffResponse,
  toggleLock,
  toggleHide,
  staffEditThread,
  bulkAction,
  toggleCommentHide,
  unreviewedCount,
  markReviewed,
}
