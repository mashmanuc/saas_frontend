// A11: Library API composable
// Ref: DAY16_AGENT-A.md
// Zone: AGENT-A (api/)
// Note: apiClient response interceptor already unwraps .data — no need for .then(r => r.data)

import apiClient from '@/utils/apiClient'
import type {
  LibraryTag,
  LibraryFolder,
  LibraryFolderTree,
  LibraryAsset,
  LibraryAssetListResponse,
  LibraryAssetCreateRequest,
  LibraryAssetUpdateRequest,
  LibraryAssetConfirmRequest,
  LibraryAssetsQuery,
} from '../types/library'

const BASE = '/v1/winterboard/library'

// ─── Tags ──────────────────────────────────────────────────────────────────

export async function fetchTags(): Promise<LibraryTag[]> {
  return apiClient.get<LibraryTag[]>(`${BASE}/tags/`)
}

export async function createTag(data: { name: string; color?: string }): Promise<LibraryTag> {
  return apiClient.post<LibraryTag>(`${BASE}/tags/`, data)
}

export async function updateTag(id: number, data: Partial<LibraryTag>): Promise<LibraryTag> {
  return apiClient.patch<LibraryTag>(`${BASE}/tags/${id}/`, data)
}

export async function deleteTag(id: number): Promise<void> {
  await apiClient.delete(`${BASE}/tags/${id}/`)
}

// ─── Folders ───────────────────────────────────────────────────────────────

export async function fetchFolders(params?: { parent?: number }): Promise<LibraryFolder[]> {
  return apiClient.get<LibraryFolder[]>(`${BASE}/folders/`, { params })
}

export async function fetchFoldersTree(): Promise<LibraryFolderTree[]> {
  return apiClient.get<LibraryFolderTree[]>(`${BASE}/folders/`, { params: { tree: 'true' } })
}

export async function createFolder(data: { name: string; parent?: number | null }): Promise<LibraryFolder> {
  return apiClient.post<LibraryFolder>(`${BASE}/folders/`, data)
}

export async function updateFolder(
  id: number,
  data: { name?: string; parent?: number | null },
): Promise<LibraryFolder> {
  return apiClient.patch<LibraryFolder>(`${BASE}/folders/${id}/`, data)
}

export async function deleteFolder(id: number): Promise<void> {
  await apiClient.delete(`${BASE}/folders/${id}/`)
}

// ─── Assets ────────────────────────────────────────────────────────────────

export async function fetchAssets(query?: LibraryAssetsQuery): Promise<LibraryAssetListResponse> {
  return apiClient.get<LibraryAssetListResponse>(`${BASE}/assets/`, { params: query })
}

export async function fetchAsset(id: number): Promise<LibraryAsset> {
  return apiClient.get<LibraryAsset>(`${BASE}/assets/${id}/`)
}

export async function createAsset(data: LibraryAssetCreateRequest): Promise<LibraryAsset> {
  return apiClient.post<LibraryAsset>(`${BASE}/assets/`, data)
}

export async function updateAsset(id: number, data: LibraryAssetUpdateRequest): Promise<LibraryAsset> {
  return apiClient.patch<LibraryAsset>(`${BASE}/assets/${id}/`, data)
}

export async function confirmAsset(id: number, data: LibraryAssetConfirmRequest): Promise<LibraryAsset> {
  return apiClient.post<LibraryAsset>(`${BASE}/assets/${id}/confirm/`, data)
}

export async function deleteAsset(id: number): Promise<void> {
  // Soft delete — backend sets status='deleted', returns 204
  await apiClient.delete(`${BASE}/assets/${id}/`)
}

// ⚠️ НЕМАЄ toggle_favorite endpoint! Використовуємо updateAsset PATCH is_favorite
export async function toggleFavorite(id: number, current: boolean): Promise<LibraryAsset> {
  return updateAsset(id, { is_favorite: !current })
}

// ─── Recent ────────────────────────────────────────────────────────────────

export async function fetchRecentAssets(): Promise<LibraryAsset[]> {
  return apiClient.get<LibraryAsset[]>(`${BASE}/recent/`)
}
