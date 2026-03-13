// A11: Unit tests for api/library.ts + api/replay.ts
// Ref: DAY16_AGENT-A.md — min 8 tests, mock apiClient
// Strategy: vi.mock('@/utils/apiClient') — перехоплюємо всі виклики

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock apiClient before importing modules that use it ────────────────────
vi.mock('@/utils/apiClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

import apiClient from '@/utils/apiClient'
import {
  fetchTags,
  createTag,
  updateTag,
  deleteTag,
  fetchFolders,
  fetchFoldersTree,
  createFolder,
  updateFolder,
  deleteFolder,
  fetchAssets,
  fetchAsset,
  createAsset,
  updateAsset,
  confirmAsset,
  deleteAsset,
  toggleFavorite,
  fetchRecentAssets,
} from '../api/library'
import {
  fetchReplayTimeline,
  recordOperation,
  recordOperationsBatch,
} from '../api/replay'
import type { LibraryTag, LibraryAsset, LibraryFolder, LibraryFolderTree, LibraryAssetListResponse } from '../types/library'
import type { ReplayTimeline, BoardOperation } from '../types/replay'

// ─── Helpers ────────────────────────────────────────────────────────────────

const mockGet = apiClient.get as ReturnType<typeof vi.fn>
const mockPost = apiClient.post as ReturnType<typeof vi.fn>
const mockPatch = apiClient.patch as ReturnType<typeof vi.fn>
const mockDelete = apiClient.delete as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── Tags ───────────────────────────────────────────────────────────────────

describe('library API — tags', () => {
  it('fetchTags: GET /v1/winterboard/library/tags/', async () => {
    const tags: LibraryTag[] = [{ id: 1, name: 'Math', color: '#ff0', created_at: '2026-01-01T00:00:00Z' }]
    mockGet.mockResolvedValueOnce(tags)

    const result = await fetchTags()

    expect(mockGet).toHaveBeenCalledWith('/v1/winterboard/library/tags/')
    expect(result).toEqual(tags)
  })

  it('createTag: POST /v1/winterboard/library/tags/ with name+color', async () => {
    const tag: LibraryTag = { id: 2, name: 'Science', color: '#00f', created_at: '2026-01-01T00:00:00Z' }
    mockPost.mockResolvedValueOnce(tag)

    const result = await createTag({ name: 'Science', color: '#00f' })

    expect(mockPost).toHaveBeenCalledWith('/v1/winterboard/library/tags/', { name: 'Science', color: '#00f' })
    expect(result.name).toBe('Science')
  })

  it('updateTag: PATCH /v1/winterboard/library/tags/{id}/', async () => {
    const updated: LibraryTag = { id: 1, name: 'Updated', color: '#abc', created_at: '2026-01-01T00:00:00Z' }
    mockPatch.mockResolvedValueOnce(updated)

    const result = await updateTag(1, { name: 'Updated' })

    expect(mockPatch).toHaveBeenCalledWith('/v1/winterboard/library/tags/1/', { name: 'Updated' })
    expect(result.name).toBe('Updated')
  })

  it('deleteTag: DELETE /v1/winterboard/library/tags/{id}/', async () => {
    mockDelete.mockResolvedValueOnce(undefined)

    await deleteTag(3)

    expect(mockDelete).toHaveBeenCalledWith('/v1/winterboard/library/tags/3/')
  })
})

// ─── Folders ────────────────────────────────────────────────────────────────

describe('library API — folders', () => {
  it('fetchFolders: GET /v1/winterboard/library/folders/ with optional parent param', async () => {
    const folders: LibraryFolder[] = [{
      id: 10, name: 'Root', parent: null, children_count: 2,
      assets_count: 5, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    }]
    mockGet.mockResolvedValueOnce(folders)

    const result = await fetchFolders({ parent: 0 })

    expect(mockGet).toHaveBeenCalledWith('/v1/winterboard/library/folders/', { params: { parent: 0 } })
    expect(result).toHaveLength(1)
  })

  it('fetchFoldersTree: passes tree=true param', async () => {
    const tree: LibraryFolderTree[] = [{ id: 1, name: 'Root', parent: null, children: [], assets_count: 0 }]
    mockGet.mockResolvedValueOnce(tree)

    await fetchFoldersTree()

    expect(mockGet).toHaveBeenCalledWith('/v1/winterboard/library/folders/', { params: { tree: 'true' } })
  })

  it('createFolder: POST with name and parent', async () => {
    const folder: LibraryFolder = {
      id: 11, name: 'New Folder', parent: 10, children_count: 0,
      assets_count: 0, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    }
    mockPost.mockResolvedValueOnce(folder)

    const result = await createFolder({ name: 'New Folder', parent: 10 })

    expect(mockPost).toHaveBeenCalledWith('/v1/winterboard/library/folders/', { name: 'New Folder', parent: 10 })
    expect(result.parent).toBe(10)
  })

  it('updateFolder: PATCH renames folder', async () => {
    const folder: LibraryFolder = {
      id: 11, name: 'Renamed', parent: null, children_count: 0,
      assets_count: 0, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    }
    mockPatch.mockResolvedValueOnce(folder)

    const result = await updateFolder(11, { name: 'Renamed' })

    expect(mockPatch).toHaveBeenCalledWith('/v1/winterboard/library/folders/11/', { name: 'Renamed' })
    expect(result.name).toBe('Renamed')
  })

  it('deleteFolder: DELETE /v1/winterboard/library/folders/{id}/', async () => {
    mockDelete.mockResolvedValueOnce(undefined)

    await deleteFolder(11)

    expect(mockDelete).toHaveBeenCalledWith('/v1/winterboard/library/folders/11/')
  })
})

// ─── Assets ─────────────────────────────────────────────────────────────────

describe('library API — assets', () => {
  const mockAsset: LibraryAsset = {
    id: 100, name: 'photo.jpg', storage_key: 'wb/photo.jpg',
    cdn_url: 'https://cdn.example.com/photo.jpg', thumbnail_url: 'https://cdn.example.com/thumb.jpg',
    content_type: 'image/jpeg', size_bytes: 204800, status: 'active',
    folder: null, is_favorite: false, last_used_at: null,
    tags: ['nature'], created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  }

  it('fetchAssets: GET with query params', async () => {
    const response: LibraryAssetListResponse = { count: 1, results: [mockAsset] }
    mockGet.mockResolvedValueOnce(response)

    const result = await fetchAssets({ folder: 10, limit: 20 })

    expect(mockGet).toHaveBeenCalledWith('/v1/winterboard/library/assets/', { params: { folder: 10, limit: 20 } })
    expect(result.count).toBe(1)
    expect(result.results[0].id).toBe(100)
  })

  it('fetchAsset: GET single asset by id', async () => {
    mockGet.mockResolvedValueOnce(mockAsset)

    const result = await fetchAsset(100)

    expect(mockGet).toHaveBeenCalledWith('/v1/winterboard/library/assets/100/')
    expect(result.name).toBe('photo.jpg')
  })

  it('createAsset: POST creates pending asset', async () => {
    const pending = { ...mockAsset, status: 'pending' as const }
    mockPost.mockResolvedValueOnce(pending)

    const result = await createAsset({ name: 'photo.jpg', content_type: 'image/jpeg', size_bytes: 204800 })

    expect(mockPost).toHaveBeenCalledWith('/v1/winterboard/library/assets/', expect.objectContaining({ name: 'photo.jpg' }))
    expect(result.status).toBe('pending')
  })

  it('confirmAsset: POST to confirm/ changes status to active', async () => {
    const active = { ...mockAsset, status: 'active' as const }
    mockPost.mockResolvedValueOnce(active)

    const result = await confirmAsset(100, { cdn_url: 'https://cdn.example.com/photo.jpg' })

    expect(mockPost).toHaveBeenCalledWith(
      '/v1/winterboard/library/assets/100/confirm/',
      { cdn_url: 'https://cdn.example.com/photo.jpg' },
    )
    expect(result.status).toBe('active')
  })

  it('toggleFavorite: calls updateAsset with inverted is_favorite', async () => {
    const favorited = { ...mockAsset, is_favorite: true }
    mockPatch.mockResolvedValueOnce(favorited)

    const result = await toggleFavorite(100, false)  // current=false → patch is_favorite: true

    expect(mockPatch).toHaveBeenCalledWith('/v1/winterboard/library/assets/100/', { is_favorite: true })
    expect(result.is_favorite).toBe(true)
  })

  it('toggleFavorite: un-favorites when current=true', async () => {
    const unfavorited = { ...mockAsset, is_favorite: false }
    mockPatch.mockResolvedValueOnce(unfavorited)

    await toggleFavorite(100, true)  // current=true → patch is_favorite: false

    expect(mockPatch).toHaveBeenCalledWith('/v1/winterboard/library/assets/100/', { is_favorite: false })
  })

  it('fetchRecentAssets: GET /library/recent/', async () => {
    mockGet.mockResolvedValueOnce([mockAsset])

    const result = await fetchRecentAssets()

    expect(mockGet).toHaveBeenCalledWith('/v1/winterboard/library/recent/')
    expect(result).toHaveLength(1)
  })

  it('deleteAsset: DELETE soft-deletes by id', async () => {
    mockDelete.mockResolvedValueOnce(undefined)

    await deleteAsset(100)

    expect(mockDelete).toHaveBeenCalledWith('/v1/winterboard/library/assets/100/')
  })
})

// ─── Replay API ─────────────────────────────────────────────────────────────

describe('replay API', () => {
  const SESSION_UUID = '550e8400-e29b-41d4-a716-446655440000'

  const mockTimeline: ReplayTimeline = {
    session_id: SESSION_UUID,
    total_operations: 2,
    operations: [
      { id: 1, op_type: 'stroke_add', page_id: 'p1', payload: {}, user: 42, created_at: '2026-01-01T00:00:00Z' },
      { id: 2, op_type: 'asset_add', page_id: 'p1', payload: { src: 'img.png' }, user: 42, created_at: '2026-01-01T00:01:00Z' },
    ],
  }

  it('fetchReplayTimeline: GET /sessions/{uuid}/replay/', async () => {
    mockGet.mockResolvedValueOnce(mockTimeline)

    const result = await fetchReplayTimeline(SESSION_UUID)

    expect(mockGet).toHaveBeenCalledWith(
      `/v1/winterboard/sessions/${SESSION_UUID}/replay/`,
      { params: undefined },
    )
    expect(result.session_id).toBe(SESSION_UUID)
    expect(result.total_operations).toBe(2)
    expect(result.operations).toHaveLength(2)
  })

  it('fetchReplayTimeline: passes query params (page_id, limit)', async () => {
    mockGet.mockResolvedValueOnce({ ...mockTimeline, operations: [mockTimeline.operations[0]] })

    await fetchReplayTimeline(SESSION_UUID, { page_id: 'p1', limit: 50 })

    expect(mockGet).toHaveBeenCalledWith(
      `/v1/winterboard/sessions/${SESSION_UUID}/replay/`,
      { params: { page_id: 'p1', limit: 50 } },
    )
  })

  it('recordOperation: POST single operation to /replay/operation/', async () => {
    const created: BoardOperation = {
      id: 10, op_type: 'stroke_add', page_id: 'p1',
      payload: { points: [0, 0, 100, 100] }, user: 42, created_at: '2026-01-01T00:02:00Z',
    }
    mockPost.mockResolvedValueOnce(created)

    const result = await recordOperation(SESSION_UUID, {
      op_type: 'stroke_add',
      page_id: 'p1',
      payload: { points: [0, 0, 100, 100] },
    })

    expect(mockPost).toHaveBeenCalledWith(
      `/v1/winterboard/sessions/${SESSION_UUID}/replay/operation/`,
      { op_type: 'stroke_add', page_id: 'p1', payload: { points: [0, 0, 100, 100] } },
    )
    expect(result.id).toBe(10)
    expect(result.op_type).toBe('stroke_add')
  })

  it('recordOperationsBatch: POST array to /replay/batch/ returns {recorded: N}', async () => {
    mockPost.mockResolvedValueOnce({ recorded: 3 })

    const result = await recordOperationsBatch(SESSION_UUID, [
      { op_type: 'stroke_add', page_id: 'p1' },
      { op_type: 'asset_add', page_id: 'p1', payload: { id: 'a1' } },
      { op_type: 'page_add' },
    ])

    expect(mockPost).toHaveBeenCalledWith(
      `/v1/winterboard/sessions/${SESSION_UUID}/replay/batch/`,
      { operations: expect.arrayContaining([expect.objectContaining({ op_type: 'stroke_add' })]) },
    )
    expect(result.recorded).toBe(3)
  })

  it('recordOperationsBatch: wraps operations in {operations} key', async () => {
    mockPost.mockResolvedValueOnce({ recorded: 1 })

    await recordOperationsBatch(SESSION_UUID, [{ op_type: 'clear_page', page_id: 'p2' }])

    const callArg = mockPost.mock.calls[0][1]
    expect(callArg).toHaveProperty('operations')
    expect(Array.isArray(callArg.operations)).toBe(true)
    expect(callArg.operations[0].op_type).toBe('clear_page')
  })
})
