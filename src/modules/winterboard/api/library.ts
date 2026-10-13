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
  LibraryVideoListResponse,
  LibraryVideosQuery,
  MirrorCleanupResult,
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

/** Відповідь «✂️ Взяти фрагмент»: файл у «Матеріалах» + розмір PNG і сторінка дошки з вікном PDF. */
export interface PdfFragmentResult extends LibraryAsset {
  width: number
  height: number
  dpi: number
  /** true — ця рамка вже була вирізана раніше (той самий файл) */
  reused: boolean
  board_page: string
}

/**
 * «✂️ Взяти фрагмент» (TZ_PDF_FRAGMENT_2026-10-13): сервер вирізає ділянку з ОРИГІНАЛУ PDF і кладе її в
 * «Матеріали». На дошку фрагмент ставить фронт штатним asset_add.
 */
export async function cutPdfFragment(args: {
  contentItem: number
  page: number
  rect: { x: number; y: number; w: number; h: number }
  board: string
  viewer: string
}): Promise<PdfFragmentResult> {
  return apiClient.post<PdfFragmentResult>(`${BASE}/pdf-fragment/`, {
    content_item: args.contentItem, page: args.page, rect: args.rect, board: args.board, viewer: args.viewer,
  })
}

/** «Клік по задачі»: що під кліком на сторінці — задача, абзац чи картинка (рамка в частках сторінки) або нічого. */
export interface PdfFragmentSnap {
  kind: 'task' | 'block' | 'none'
  rect?: { x: number; y: number; w: number; h: number }
  /** Номер задачі, якщо знайдено задачу */
  number?: number
}

/** «Клік по задачі» (2026-10-13): межі з текстового шару документа на сервері, без ШІ. Нічого не створює. */
export async function snapPdfFragment(args: {
  contentItem: number
  page: number
  point: { x: number; y: number }
  board: string
  viewer: string
}): Promise<PdfFragmentSnap> {
  return apiClient.post<PdfFragmentSnap>(`${BASE}/pdf-fragment/snap/`, {
    content_item: args.contentItem, page: args.page, point: args.point, board: args.board, viewer: args.viewer,
  })
}

/** «Прибрати зайві» в теці «🪞 Дзеркало» чи групі: `dryRun` лише рахує, інакше незадіяні — в Архів. */
export async function mirrorCleanup(folderId: number, dryRun: boolean): Promise<MirrorCleanupResult> {
  return apiClient.post<MirrorCleanupResult>(
    `${BASE}/folders/${folderId}/mirror-cleanup/`, null, { params: dryRun ? { dry_run: 1 } : {} },
  )
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

/**
 * Phase 9 SSOT: upload file via multipart/form-data.
 * Backend creates ContentItem (SSOT) + LibraryAsset (organizer) atomically.
 * Returns the created LibraryAsset with content_item_id populated.
 */
export async function uploadAsset(
  file: File,
  folderId?: number | null,
  opts?: { purpose?: 'remote_photo'; mirror?: { board: string; run: string } },
): Promise<LibraryAsset> {
  const formData = new FormData()
  formData.append('file', file)
  if (folderId != null) {
    formData.append('folder', String(folderId))
  }
  // LAW §9 v1.9: фото з телефона — сервер приймає лише перевірені JPEG/PNG/WebP
  if (opts?.purpose) {
    formData.append('purpose', opts.purpose)
  }
  // Правка LAW §9 v1.9 (2026-10-11): знімок «Дзеркала» — дошка й запуск; сервер кладе його в групу запуску
  if (opts?.mirror) {
    formData.append('origin', 'board_mirror')
    formData.append('board', opts.mirror.board)
    formData.append('mirror_run', opts.mirror.run)
  }
  // IMPORTANT: do NOT set Content-Type manually — axios must auto-detect
  // multipart/form-data with boundary from FormData object.
  // Override the default 'application/json' from apiClient by deleting it.
  return apiClient.post<LibraryAsset>(`${BASE}/assets/`, formData, {
    headers: { 'Content-Type': undefined as unknown as string },
  })
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

/**
 * Phase 10: Add YouTube video as library asset (JSON, not multipart).
 * Backend creates ContentItem + LibraryAsset atomically. Dedup by video_id.
 */
export async function addYouTubeAsset(youtubeUrl: string, folderId?: number | null): Promise<LibraryAsset> {
  return apiClient.post<LibraryAsset>(`${BASE}/assets/`, {
    youtube_url: youtubeUrl,
    ...(folderId != null ? { folder: folderId } : {}),
  })
}

// ─── Відео в «Матеріалах» (ТЗ TZ_BOARD_VIDEO_PICKER_AND_LIBRARY_2026-10-11) ─────

/** Тип матеріалу-відео; один запис на пару (учитель, відео) — стежить сервер. */
export const VIDEO_CONTENT_TYPE = 'youtube_link'

/**
 * Відео щойно стало на дошку → у «Матеріали» цього вчителя, без дублів.
 * `added_from: 'board'` — сервер лише створює запис, якого ще немає; архівоване чи
 * видалене сам не повертає (рішення власника 2026-10-11, §6).
 * ⚠️ НЕ `origin`: це поле знімків «Дзеркала» (Б-177), сервер відхиляє інші його значення.
 */
export async function rememberBoardVideo(youtubeUrl: string, title?: string): Promise<LibraryAsset> {
  const name = (title ?? '').trim()
  return apiClient.post<LibraryAsset>(`${BASE}/assets/`, {
    youtube_url: youtubeUrl,
    added_from: 'board',
    ...(name ? { title: name.slice(0, 200) } : {}),
  })
}

/** «Мої відео» (archived=false) або архів відео (archived=true); кошик не входить. */
export async function fetchVideos(opts: { archived?: boolean; limit?: number; offset?: number } = {}): Promise<LibraryAssetListResponse> {
  return fetchAssets({
    content_type: VIDEO_CONTENT_TYPE,
    limit: opts.limit ?? 100,
    offset: opts.offset ?? 0,
    ...(opts.archived ? { archived: 'only' as const } : {}),
  })
}

/**
 * Вкладка «Відео» в «Матеріалах» (етап 2, ТЗ §7): YouTube-посилання і власні відеофайли
 * поруч, з фільтром джерела й порядком. Вікно YouTube на дошці цим НЕ користується —
 * його «Мої відео» й далі читає `fetchVideos()` (лише YouTube).
 */
export async function fetchLibraryVideos(query: LibraryVideosQuery): Promise<LibraryVideoListResponse> {
  return apiClient.get<LibraryVideoListResponse>(`${BASE}/videos/`, {
    params: { limit: 100, offset: 0, ...query },
  })
}

/** Архівувати відео: зникає з «Моїх відео», без строку; картки на дошках лишаються. */
export async function archiveVideo(id: number): Promise<LibraryAsset> {
  return apiClient.post<LibraryAsset>(`${BASE}/assets/${id}/archive/`, {})
}

/** «Повернути до моїх відео» — єдиний шлях з архіву назад у список. */
export async function unarchiveVideo(id: number): Promise<LibraryAsset> {
  return apiClient.post<LibraryAsset>(`${BASE}/assets/${id}/unarchive/`, {})
}

export async function fetchRecentAssets(): Promise<LibraryAsset[]> {
  return apiClient.get<LibraryAsset[]>(`${BASE}/recent/`)
}

// ─── Storage Stats (Phase AM-2) ───────────────────────────────────────

export interface StorageStats {
  total_bytes: number
  upload_bytes: number
  upload_count: number
  paste_bytes: number
  paste_count: number
  limit_bytes: number
}

export interface PastedItem {
  id: number
  filename: string
  cdn_url: string
  thumbnail_url: string
  size_bytes: number
  type: string
  created_at: string
}

export interface PastedListResponse {
  count: number
  total_bytes: number
  results: PastedItem[]
}

export async function fetchStorageStats(): Promise<StorageStats> {
  return apiClient.get<StorageStats>(`${BASE}/storage-stats/`)
}

export async function fetchPastedItems(params?: {
  limit?: number
  offset?: number
}): Promise<PastedListResponse> {
  return apiClient.get<PastedListResponse>(`${BASE}/pasted/`, { params })
}

// ─── Cleanup & Archive (Phase AM-3) ───────────────────────────────────

export interface CleanupResponse {
  archived_count: number
  freed_bytes: number
  skipped_published: number
}

export interface ArchivedItem {
  id: number
  filename: string
  cdn_url: string
  thumbnail_url: string
  size_bytes: number
  type: string
  archived_at: string
  days_left: number
}

export interface ArchivedListResponse {
  count: number
  results: ArchivedItem[]
}

export async function cleanupPasted(data: {
  ids?: number[]
  all_unused?: boolean
}): Promise<CleanupResponse> {
  return apiClient.post<CleanupResponse>(`${BASE}/pasted/cleanup/`, data)
}

export async function restorePasted(ids: number[]): Promise<{ restored_count: number }> {
  return apiClient.post<{ restored_count: number }>(`${BASE}/pasted/restore/`, { ids })
}

export async function fetchArchivedItems(): Promise<ArchivedListResponse> {
  return apiClient.get<ArchivedListResponse>(`${BASE}/archived/`)
}
