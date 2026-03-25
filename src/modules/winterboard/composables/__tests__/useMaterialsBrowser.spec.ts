import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick } from 'vue'

// Mock library API
const mockFetchFoldersTree = vi.fn()
const mockFetchAssets = vi.fn()
const mockFetchRecentAssets = vi.fn()

vi.mock('../../components/library/LibraryFolderTree.vue', () => ({
  FAVORITES_ID: -1,
  RECENT_ID: -2,
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('../../api/library', () => ({
  fetchFoldersTree: (...args: any[]) => mockFetchFoldersTree(...args),
  fetchAssets: (...args: any[]) => mockFetchAssets(...args),
  fetchRecentAssets: (...args: any[]) => mockFetchRecentAssets(...args),
  updateAsset: vi.fn().mockResolvedValue({}),
}))

vi.mock('../useToast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}))

import { useMaterialsBrowser } from '../useMaterialsBrowser'

describe('useMaterialsBrowser', () => {
  beforeEach(() => {
    mockFetchFoldersTree.mockReset()
    mockFetchAssets.mockReset()
    mockFetchRecentAssets.mockReset()

    mockFetchFoldersTree.mockResolvedValue([])
    mockFetchAssets.mockResolvedValue({ count: 0, results: [] })
    mockFetchRecentAssets.mockResolvedValue([])
  })

  it('initializes with default state', () => {
    const { folders, assets, selectedFolderId, isLoadingFolders, isLoadingAssets, isFoldersPanelOpen } =
      useMaterialsBrowser()

    expect(folders.value).toEqual([])
    expect(assets.value).toEqual([])
    expect(selectedFolderId.value).toBeNull()
    expect(isLoadingFolders.value).toBe(false)
    expect(isLoadingAssets.value).toBe(false)
    expect(isFoldersPanelOpen.value).toBe(true)
  })

  it('loadFolders fetches folder tree', async () => {
    const tree = [{ id: 1, name: 'Math', parent: null, children: [], assets_count: 5 }]
    mockFetchFoldersTree.mockResolvedValue(tree)

    const { loadFolders, folders } = useMaterialsBrowser()
    await loadFolders()

    expect(mockFetchFoldersTree).toHaveBeenCalledOnce()
    expect(folders.value).toEqual(tree)
  })

  // ─── Folder routing: null = all files ───────────────────────────────────────

  it('loadAssets with selectedFolderId=null calls fetchAssets without folder param', async () => {
    mockFetchAssets.mockResolvedValue({ count: 2, results: [
      { id: 1, name: 'file1.pdf', cdn_url: '/cdn/1', thumbnail_url: '/t/1', content_type: 'application/pdf', size_bytes: 100, status: 'active', folder: null, is_favorite: false, last_used_at: null, tags: [], storage_key: '', created_at: '', updated_at: '' },
    ]})

    const { loadAssets, assets } = useMaterialsBrowser()
    await loadAssets()

    expect(mockFetchAssets).toHaveBeenCalledWith({ limit: 50 })
    expect(mockFetchRecentAssets).not.toHaveBeenCalled()
    expect(assets.value).toHaveLength(1)
    expect(assets.value[0].filename).toBe('file1.pdf')
    expect(assets.value[0].id).toBe('1')
  })

  // ─── Folder routing: -1 = favorites ─────────────────────────────────────────

  it('loadAssets with FAVORITES_ID (-1) calls fetchAssets with favorite=true', async () => {
    mockFetchAssets.mockResolvedValue({ count: 0, results: [] })

    const { loadAssets, selectFolder } = useMaterialsBrowser()
    selectFolder(-1)
    await nextTick()
    // watch triggers loadAssets, but we also call it explicitly
    await loadAssets()

    // Should have been called with favorite: true
    const lastCall = mockFetchAssets.mock.calls[mockFetchAssets.mock.calls.length - 1]
    expect(lastCall[0]).toEqual({ limit: 50, favorite: true })
    expect(mockFetchRecentAssets).not.toHaveBeenCalled()
  })

  // ─── Folder routing: -2 = recent ───────────────────────────────────────────

  it('loadAssets with RECENT_ID (-2) calls fetchRecentAssets', async () => {
    mockFetchRecentAssets.mockResolvedValue([
      { id: 10, name: 'recent.png', cdn_url: '/cdn/10', thumbnail_url: '', content_type: 'image/png', size_bytes: 50, status: 'active', folder: null, is_favorite: false, last_used_at: '2026-01-01', tags: [], storage_key: '', created_at: '', updated_at: '' },
    ])

    const { loadAssets, selectFolder, assets } = useMaterialsBrowser()
    selectFolder(-2)
    await nextTick()
    await loadAssets()

    expect(mockFetchRecentAssets).toHaveBeenCalled()
    expect(mockFetchAssets).not.toHaveBeenCalled()
    expect(assets.value).toHaveLength(1)
    expect(assets.value[0].filename).toBe('recent.png')
  })

  // ─── Folder routing: real folder ID ─────────────────────────────────────────

  it('loadAssets with real folder ID calls fetchAssets with folder param', async () => {
    mockFetchAssets.mockResolvedValue({ count: 0, results: [] })

    const { loadAssets, selectFolder } = useMaterialsBrowser()
    selectFolder(42)
    await nextTick()
    await loadAssets()

    const lastCall = mockFetchAssets.mock.calls[mockFetchAssets.mock.calls.length - 1]
    expect(lastCall[0]).toEqual({ limit: 50, folder: 42 })
  })

  // ─── Watch auto-reload ─────────────────────────────────────────────────────

  it('watch triggers loadAssets on folder change', async () => {
    mockFetchAssets.mockResolvedValue({ count: 0, results: [] })

    const { selectFolder } = useMaterialsBrowser()
    selectFolder(5)
    await nextTick()

    // fetchAssets should be called by the watcher
    expect(mockFetchAssets).toHaveBeenCalled()
  })

  // ─── Toggle panel ──────────────────────────────────────────────────────────

  it('toggleFoldersPanel flips state', () => {
    const { isFoldersPanelOpen, toggleFoldersPanel } = useMaterialsBrowser()
    expect(isFoldersPanelOpen.value).toBe(true)
    toggleFoldersPanel()
    expect(isFoldersPanelOpen.value).toBe(false)
    toggleFoldersPanel()
    expect(isFoldersPanelOpen.value).toBe(true)
  })

  // ─── Error handling ────────────────────────────────────────────────────────

  it('handles loadAssets error gracefully', async () => {
    mockFetchAssets.mockRejectedValue(new Error('Network error'))

    const { loadAssets, assets, error } = useMaterialsBrowser()
    await loadAssets()

    expect(error.value).toBe('load_failed')
    expect(assets.value).toEqual([])
  })

  it('handles loadFolders error gracefully', async () => {
    mockFetchFoldersTree.mockRejectedValue(new Error('Network error'))

    const { loadFolders, folders } = useMaterialsBrowser()
    await loadFolders()

    expect(folders.value).toEqual([])
  })

  // ─── Asset mapping ─────────────────────────────────────────────────────────

  it('maps LibraryAsset to SidebarAsset correctly', async () => {
    mockFetchAssets.mockResolvedValue({ count: 1, results: [
      { id: 99, name: 'photo.jpg', cdn_url: 'https://cdn/photo.jpg', thumbnail_url: 'https://cdn/thumb.jpg', content_type: 'image/jpeg', size_bytes: 1024, status: 'active', folder: 3, is_favorite: true, last_used_at: null, tags: ['tag1'], storage_key: 'k', created_at: '', updated_at: '' },
    ]})

    const { loadAssets, assets } = useMaterialsBrowser()
    await loadAssets()

    expect(assets.value[0]).toEqual({
      id: '99',
      filename: 'photo.jpg',
      cdn_url: 'https://cdn/photo.jpg',
      thumbnail_url: 'https://cdn/thumb.jpg',
    })
  })

  // ─── Re-exports ────────────────────────────────────────────────────────────

  it('re-exports FAVORITES_ID and RECENT_ID', () => {
    const { FAVORITES_ID, RECENT_ID } = useMaterialsBrowser()
    expect(FAVORITES_ID).toBe(-1)
    expect(RECENT_ID).toBe(-2)
  })
})
