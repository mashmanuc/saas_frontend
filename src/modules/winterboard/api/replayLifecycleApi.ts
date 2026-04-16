// Replay Lifecycle v4.1 — API client for Replay content entity CRUD.
// Ref: saas_docs/plans/REPLAY_LIFECYCLE_PLAN.md §6.F.2

import apiClient from '@/utils/apiClient'

const BASE = '/v1/winterboard'

// ─── Types ─────────────────────────────────────────────────────────

export type ReplayStatus = 'active' | 'archived' | 'trashed'
export type ReplayVisibility = 'private' | 'unlisted' | 'public'

export interface Replay {
  id: string
  title: string
  source_session?: string
  recorded_at: string
  duration_ms: number
  start_seq?: number
  end_seq?: number
  status: ReplayStatus
  visibility: ReplayVisibility
  public_token: string | null
  folder: string | null
  view_count: number
  created_at?: string
  updated_at?: string
  archived_at: string | null
  trashed_at: string | null
}

export interface ReplayFolder {
  id: string
  name: string
  parent: string | null
  position: number
  created_at: string
  updated_at: string
}

export interface ReplayListParams {
  status?: ReplayStatus | 'all'
  folder?: string | 'root' | 'all'
  search?: string
}

// ─── List & detail ─────────────────────────────────────────────────

export async function listReplays(params: ReplayListParams = {}): Promise<{ replays: Replay[] }> {
  return apiClient.get<{ replays: Replay[] }>(`${BASE}/replays/`, { params })
}

export async function getReplay(id: string): Promise<Replay> {
  return apiClient.get<Replay>(`${BASE}/replays/${id}/`)
}

export async function updateReplay(
  id: string,
  patch: Partial<Pick<Replay, 'title' | 'visibility'>>,
): Promise<Replay> {
  return apiClient.patch<Replay>(`${BASE}/replays/${id}/`, patch)
}

// ─── Lifecycle ─────────────────────────────────────────────────────

export async function archiveReplay(id: string): Promise<Replay> {
  return apiClient.post<Replay>(`${BASE}/replays/${id}/archive/`, {})
}

export async function restoreReplay(id: string): Promise<Replay> {
  return apiClient.post<Replay>(`${BASE}/replays/${id}/restore/`, {})
}

export async function trashReplay(id: string): Promise<Replay> {
  return apiClient.post<Replay>(`${BASE}/replays/${id}/trash/`, {})
}

export async function changeReplayVisibility(
  id: string,
  visibility: ReplayVisibility,
): Promise<Replay> {
  return apiClient.post<Replay>(`${BASE}/replays/${id}/visibility/`, { visibility })
}

export async function moveReplayToFolder(
  id: string,
  folderId: string | null,
): Promise<Replay> {
  return apiClient.post<Replay>(`${BASE}/replays/${id}/move-folder/`, {
    folder_id: folderId,
  })
}

// ─── Folders ───────────────────────────────────────────────────────

export async function listReplayFolders(): Promise<{ folders: ReplayFolder[] }> {
  return apiClient.get<{ folders: ReplayFolder[] }>(`${BASE}/replay-folders/`)
}

export async function createReplayFolder(
  data: { name: string; parent?: string | null; position?: number },
): Promise<ReplayFolder> {
  return apiClient.post<ReplayFolder>(`${BASE}/replay-folders/`, data)
}

export async function updateReplayFolder(
  id: string,
  patch: Partial<{ name: string; parent: string | null; position: number }>,
): Promise<ReplayFolder> {
  return apiClient.patch<ReplayFolder>(`${BASE}/replay-folders/${id}/`, patch)
}

export async function deleteReplayFolder(id: string): Promise<void> {
  return apiClient.delete<void>(`${BASE}/replay-folders/${id}/`)
}
