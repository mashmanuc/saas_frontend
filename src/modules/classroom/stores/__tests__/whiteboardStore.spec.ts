/**
 * Whiteboard Store Tests
 * v0.82.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWhiteboardStore } from '../whiteboardStore'
import type { StorageAdapter, PolicyAdapter, PageData } from '@/core/whiteboard/adapters'

// Mock adapters
const mockStorageAdapter: StorageAdapter = {
  listPages: vi.fn(),
  createPage: vi.fn(),
  loadPage: vi.fn(),
  savePage: vi.fn(),
}

const mockPolicyAdapter: PolicyAdapter = {
  getLimits: vi.fn(),
}

describe('WhiteboardStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('bootstrap', () => {
    it('loads pages and sets first as active', async () => {
      const mockPages = [
        { id: 'page-1', title: 'Page 1', index: 0, version: 1, updatedAt: '2024-01-01' },
        { id: 'page-2', title: 'Page 2', index: 1, version: 1, updatedAt: '2024-01-02' },
      ]

      const mockPageData: PageData = {
        ...mockPages[0],
        state: { strokes: [], assets: [] },
      }

      vi.mocked(mockPolicyAdapter.getLimits).mockResolvedValue({ maxPages: null })
      vi.mocked(mockStorageAdapter.listPages).mockResolvedValue(mockPages)
      vi.mocked(mockStorageAdapter.loadPage).mockResolvedValue(mockPageData)

      const store = useWhiteboardStore()
      store.$patch({
        storageAdapter: mockStorageAdapter,
        policyAdapter: mockPolicyAdapter,
      })

      await store.bootstrap('workspace-123')

      expect(store.workspaceId).toBe('workspace-123')
      expect(store.pages).toHaveLength(2)
      expect(store.activePageId).toBe('page-1')
      expect(store.status).toBe('idle')
      expect(mockPolicyAdapter.getLimits).toHaveBeenCalledWith('workspace-123')
      expect(mockStorageAdapter.listPages).toHaveBeenCalledWith('workspace-123')
    })

    it('creates first page if workspace is empty', async () => {
      const mockNewPage: PageData = {
        id: 'page-1',
        title: 'Page 1',
        index: 0,
        version: 1,
        updatedAt: '2024-01-01',
        state: { strokes: [], assets: [] },
      }

      vi.mocked(mockPolicyAdapter.getLimits).mockResolvedValue({ maxPages: null })
      vi.mocked(mockStorageAdapter.listPages).mockResolvedValue([])
      vi.mocked(mockStorageAdapter.createPage).mockResolvedValue(mockNewPage)
      vi.mocked(mockStorageAdapter.loadPage).mockResolvedValue(mockNewPage)

      const store = useWhiteboardStore()
      store.$patch({
        storageAdapter: mockStorageAdapter,
        policyAdapter: mockPolicyAdapter,
      })

      await store.bootstrap('workspace-123')

      expect(store.pages).toHaveLength(1)
      expect(store.activePageId).toBe('page-1')
      expect(mockStorageAdapter.createPage).toHaveBeenCalled()
    })

    it('sets error status on failure', async () => {
      vi.mocked(mockPolicyAdapter.getLimits).mockRejectedValue(new Error('Network error'))

      const store = useWhiteboardStore()
      store.$patch({
        storageAdapter: mockStorageAdapter,
        policyAdapter: mockPolicyAdapter,
      })

      await expect(store.bootstrap('workspace-123')).rejects.toThrow('Network error')
      expect(store.status).toBe('error')
      expect(store.error).toBeTruthy()
    })
  })

  describe('createPage', () => {
    it('creates new page and switches to it', async () => {
      const mockNewPage: PageData = {
        id: 'page-2',
        title: 'New Page',
        index: 1,
        version: 1,
        updatedAt: '2024-01-02',
        state: { strokes: [], assets: [] },
      }

      vi.mocked(mockStorageAdapter.createPage).mockResolvedValue(mockNewPage)
      vi.mocked(mockStorageAdapter.loadPage).mockResolvedValue(mockNewPage)

      const store = useWhiteboardStore()
      store.$patch({
        workspaceId: 'workspace-123',
        pages: [{ id: 'page-1', title: 'Page 1', index: 0, version: 1, updatedAt: '2024-01-01' }],
        activePageId: 'page-1',
        storageAdapter: mockStorageAdapter,
        policyAdapter: mockPolicyAdapter,
      })

      const result = await store.createPage('New Page')

      expect(result.id).toBe('page-2')
      expect(store.pages).toHaveLength(2)
      expect(store.activePageId).toBe('page-2')
      expect(mockStorageAdapter.createPage).toHaveBeenCalledWith('workspace-123', { title: 'New Page' })
    })

    it('throws error when limit is exceeded', async () => {
      const store = useWhiteboardStore()
      store.$patch({
        workspaceId: 'workspace-123',
        pages: [
          { id: 'page-1', title: 'Page 1', index: 0, version: 1, updatedAt: '2024-01-01' },
          { id: 'page-2', title: 'Page 2', index: 1, version: 1, updatedAt: '2024-01-02' },
        ],
        limits: { maxPages: 2 },
        storageAdapter: mockStorageAdapter,
        policyAdapter: mockPolicyAdapter,
      })

      await expect(store.createPage()).rejects.toThrow('PAGE_LIMIT_EXCEEDED')
      expect(mockStorageAdapter.createPage).not.toHaveBeenCalled()
    })

    it('allows creation when maxPages is null', async () => {
      const mockNewPage: PageData = {
        id: 'page-3',
        title: 'Page 3',
        index: 2,
        version: 1,
        updatedAt: '2024-01-03',
        state: { strokes: [], assets: [] },
      }

      vi.mocked(mockStorageAdapter.createPage).mockResolvedValue(mockNewPage)
      vi.mocked(mockStorageAdapter.loadPage).mockResolvedValue(mockNewPage)

      const store = useWhiteboardStore()
      store.$patch({
        workspaceId: 'workspace-123',
        pages: [
          { id: 'page-1', title: 'Page 1', index: 0, version: 1, updatedAt: '2024-01-01' },
          { id: 'page-2', title: 'Page 2', index: 1, version: 1, updatedAt: '2024-01-02' },
        ],
        limits: { maxPages: null },
        storageAdapter: mockStorageAdapter,
        policyAdapter: mockPolicyAdapter,
      })

      await store.createPage()

      expect(store.pages).toHaveLength(3)
      expect(mockStorageAdapter.createPage).toHaveBeenCalled()
    })
  })

  describe('switchToPage', () => {
    it('switches to different page', async () => {
      const mockPageData: PageData = {
        id: 'page-2',
        title: 'Page 2',
        index: 1,
        version: 1,
        updatedAt: '2024-01-02',
        state: { strokes: [], assets: [] },
      }

      vi.mocked(mockStorageAdapter.loadPage).mockResolvedValue(mockPageData)

      const store = useWhiteboardStore()
      store.$patch({
        pages: [
          { id: 'page-1', title: 'Page 1', index: 0, version: 1, updatedAt: '2024-01-01' },
          { id: 'page-2', title: 'Page 2', index: 1, version: 1, updatedAt: '2024-01-02' },
        ],
        activePageId: 'page-1',
        storageAdapter: mockStorageAdapter,
        policyAdapter: mockPolicyAdapter,
      })

      await store.switchToPage('page-2')

      expect(store.activePageId).toBe('page-2')
      expect(store.currentPageData?.id).toBe('page-2')
      expect(mockStorageAdapter.loadPage).toHaveBeenCalledWith('page-2')
    })

    it('does nothing when switching to same page', async () => {
      const store = useWhiteboardStore()
      store.$patch({
        pages: [{ id: 'page-1', title: 'Page 1', index: 0, version: 1, updatedAt: '2024-01-01' }],
        activePageId: 'page-1',
        storageAdapter: mockStorageAdapter,
        policyAdapter: mockPolicyAdapter,
      })

      await store.switchToPage('page-1')

      expect(mockStorageAdapter.loadPage).not.toHaveBeenCalled()
    })
  })

  describe('savePage', () => {
    it('saves page state and updates version', async () => {
      const newState = { strokes: [{ id: '1', points: [] }], assets: [] }

      vi.mocked(mockStorageAdapter.savePage).mockResolvedValue({ version: 2 })

      const store = useWhiteboardStore()
      store.$patch({
        activePageId: 'page-1',
        currentPageData: {
          id: 'page-1',
          title: 'Page 1',
          index: 0,
          version: 1,
          updatedAt: '2024-01-01',
          state: { strokes: [], assets: [] },
        },
        pages: [{ id: 'page-1', title: 'Page 1', index: 0, version: 1, updatedAt: '2024-01-01' }],
        storageAdapter: mockStorageAdapter,
        policyAdapter: mockPolicyAdapter,
      })

      await store.savePage(newState)

      expect(mockStorageAdapter.savePage).toHaveBeenCalledWith('page-1', {
        state: newState,
        version: 1,
      })
      expect(store.currentPageData?.version).toBe(2)
      expect(store.pages[0].version).toBe(2)
    })

    it('throws error when no active page', async () => {
      const store = useWhiteboardStore()
      store.$patch({
        activePageId: null,
        currentPageData: null,
        storageAdapter: mockStorageAdapter,
        policyAdapter: mockPolicyAdapter,
      })

      await expect(store.savePage({ strokes: [], assets: [] })).rejects.toThrow('No active page to save')
    })
  })

  describe('deletePage', () => {
    it('deletes page and switches to another', async () => {
      const store = useWhiteboardStore()
      store.$patch({
        pages: [
          { id: 'page-1', title: 'Page 1', index: 0, version: 1, updatedAt: '2024-01-01' },
          { id: 'page-2', title: 'Page 2', index: 1, version: 1, updatedAt: '2024-01-02' },
        ],
        activePageId: 'page-1',
        storageAdapter: mockStorageAdapter,
        policyAdapter: mockPolicyAdapter,
      })

      vi.mocked(mockStorageAdapter.loadPage).mockResolvedValue({
        id: 'page-2',
        title: 'Page 2',
        index: 1,
        version: 1,
        updatedAt: '2024-01-02',
        state: { strokes: [], assets: [] },
      })

      await store.deletePage('page-1')

      expect(store.pages).toHaveLength(1)
      expect(store.pages[0].id).toBe('page-2')
      expect(store.activePageId).toBe('page-2')
    })

    it('throws error when trying to delete last page', async () => {
      const store = useWhiteboardStore()
      store.$patch({
        pages: [{ id: 'page-1', title: 'Page 1', index: 0, version: 1, updatedAt: '2024-01-01' }],
        activePageId: 'page-1',
        storageAdapter: mockStorageAdapter,
        policyAdapter: mockPolicyAdapter,
      })

      await expect(store.deletePage('page-1')).rejects.toThrow('Cannot delete last page')
    })
  })

  describe('computed properties', () => {
    it('canCreatePage returns true when maxPages is null', () => {
      const store = useWhiteboardStore()
      store.$patch({
        pages: [{ id: 'page-1', title: 'Page 1', index: 0, version: 1, updatedAt: '2024-01-01' }],
        limits: { maxPages: null },
      })

      expect(store.canCreatePage).toBe(true)
    })

    it('canCreatePage returns false when limit reached', () => {
      const store = useWhiteboardStore()
      store.$patch({
        pages: [
          { id: 'page-1', title: 'Page 1', index: 0, version: 1, updatedAt: '2024-01-01' },
          { id: 'page-2', title: 'Page 2', index: 1, version: 1, updatedAt: '2024-01-02' },
        ],
        limits: { maxPages: 2 },
      })

      expect(store.canCreatePage).toBe(false)
    })

    it('activePage returns current active page', () => {
      const store = useWhiteboardStore()
      store.$patch({
        pages: [
          { id: 'page-1', title: 'Page 1', index: 0, version: 1, updatedAt: '2024-01-01' },
          { id: 'page-2', title: 'Page 2', index: 1, version: 1, updatedAt: '2024-01-02' },
        ],
        activePageId: 'page-2',
      })

      expect(store.activePage?.id).toBe('page-2')
    })
  })
})
