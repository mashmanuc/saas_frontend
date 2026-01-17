/**
 * Whiteboard Store Tests - v0.92.0 Dev Workspace
 * Tests for dev-workspace-* bootstrap with placeholder pages
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWhiteboardStore } from '../whiteboardStore'

describe('WhiteboardStore v0.92.0 - Dev Workspace', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('bootstrap dev workspace', () => {
    it('creates placeholder pages for dev-workspace-* without API calls', async () => {
      const store = useWhiteboardStore()
      const devWorkspaceId = 'dev-workspace-test-session-123'

      await store.bootstrap(devWorkspaceId)

      expect(store.workspaceId).toBe(devWorkspaceId)
      expect(store.pages).toHaveLength(4)
      expect(store.pages[0].id).toBe(`${devWorkspaceId}-page-1`)
      expect(store.pages[0].title).toBe('Page 1')
      expect(store.pages[0].index).toBe(0)
      expect(store.pages[1].id).toBe(`${devWorkspaceId}-page-2`)
      expect(store.pages[1].index).toBe(1)
      expect(store.pages[2].id).toBe(`${devWorkspaceId}-page-3`)
      expect(store.pages[2].index).toBe(2)
      expect(store.pages[3].id).toBe(`${devWorkspaceId}-page-4`)
      expect(store.pages[3].index).toBe(3)
      expect(store.status).toBe('idle')
    })

    it('sets active page to first placeholder page', async () => {
      const store = useWhiteboardStore()
      const devWorkspaceId = 'dev-workspace-abc'

      await store.bootstrap(devWorkspaceId)

      expect(store.activePageId).toBe(`${devWorkspaceId}-page-1`)
      expect(store.currentPageData).toBeTruthy()
      expect(store.currentPageData?.id).toBe(`${devWorkspaceId}-page-1`)
      expect(store.currentPageData?.state).toEqual({ strokes: [], assets: [] })
    })

    it('sets dev mode permissions (moderator, no limits, unfrozen)', async () => {
      const store = useWhiteboardStore()
      const devWorkspaceId = 'dev-workspace-xyz'

      await store.bootstrap(devWorkspaceId)

      expect(store.myRole).toBe('moderator')
      expect(store.limits.maxPages).toBeNull()
      expect(store.isBoardFrozen).toBe(false)
      expect(store.canEdit).toBe(true)
      expect(store.canModerate).toBe(true)
    })

    it('does not call storage or policy adapters for dev workspace', async () => {
      const store = useWhiteboardStore()
      const mockStorageAdapter = {
        listPages: vi.fn(),
        createPage: vi.fn(),
        loadPage: vi.fn(),
        savePage: vi.fn(),
      }
      const mockPolicyAdapter = {
        getLimits: vi.fn(),
      }

      store.setStorageAdapter(mockStorageAdapter as any)
      store.setPolicyAdapter(mockPolicyAdapter as any)

      await store.bootstrap('dev-workspace-test')

      expect(mockStorageAdapter.listPages).not.toHaveBeenCalled()
      expect(mockStorageAdapter.loadPage).not.toHaveBeenCalled()
      expect(mockPolicyAdapter.getLimits).not.toHaveBeenCalled()
    })

    it('production workspace still uses normal flow', async () => {
      const store = useWhiteboardStore()
      const mockPages = [
        { id: 'page-1', title: 'Page 1', index: 0, version: 1, updatedAt: '2024-01-01' },
      ]
      const mockPageData = {
        ...mockPages[0],
        state: { strokes: [], assets: [] },
      }

      const mockStorageAdapter = {
        listPages: vi.fn().mockResolvedValue(mockPages),
        loadPage: vi.fn().mockResolvedValue(mockPageData),
        createPage: vi.fn(),
        savePage: vi.fn(),
      }
      const mockPolicyAdapter = {
        getLimits: vi.fn().mockResolvedValue({ maxPages: 10 }),
      }

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ myRole: 'editor', isFrozen: false, presenterUserId: null }),
      })
      globalThis.fetch = mockFetch as any

      store.setStorageAdapter(mockStorageAdapter as any)
      store.setPolicyAdapter(mockPolicyAdapter as any)

      await store.bootstrap('workspace-production-123')

      expect(mockStorageAdapter.listPages).toHaveBeenCalledWith('workspace-production-123')
      expect(mockPolicyAdapter.getLimits).toHaveBeenCalledWith('workspace-production-123')
      expect(store.pages).toHaveLength(1)
      expect(store.myRole).toBe('editor')
    })
  })

  describe('dev workspace page count', () => {
    it('creates exactly 4 placeholder pages', async () => {
      const store = useWhiteboardStore()
      await store.bootstrap('dev-workspace-count-test')

      expect(store.pages).toHaveLength(4)
      expect(store.pageCount).toBe(4)
    })
  })

  describe('dev workspace edge cases', () => {
    it('handles workspace_id with special characters', async () => {
      const store = useWhiteboardStore()
      const wsId = 'dev-workspace-session-123-abc-xyz'

      await store.bootstrap(wsId)

      expect(store.workspaceId).toBe(wsId)
      expect(store.pages).toHaveLength(4)
      expect(store.pages[0].id).toBe(`${wsId}-page-1`)
    })

    it('sets correct version for all placeholder pages', async () => {
      const store = useWhiteboardStore()
      await store.bootstrap('dev-workspace-version-test')

      store.pages.forEach(page => {
        expect(page.version).toBe(1)
      })
    })

    it('sets correct updatedAt timestamp for placeholder pages', async () => {
      const store = useWhiteboardStore()
      const beforeTime = new Date().toISOString()
      
      await store.bootstrap('dev-workspace-timestamp-test')
      
      const afterTime = new Date().toISOString()

      store.pages.forEach(page => {
        expect(page.updatedAt).toBeTruthy()
        expect(page.updatedAt >= beforeTime).toBe(true)
        expect(page.updatedAt <= afterTime).toBe(true)
      })
    })

    it('currentPageData has empty strokes and assets', async () => {
      const store = useWhiteboardStore()
      await store.bootstrap('dev-workspace-empty-state')

      expect(store.currentPageData?.state.strokes).toEqual([])
      expect(store.currentPageData?.state.assets).toEqual([])
    })

    it('canEdit and canModerate are true for dev workspace', async () => {
      const store = useWhiteboardStore()
      await store.bootstrap('dev-workspace-permissions')

      expect(store.canEdit).toBe(true)
      expect(store.canModerate).toBe(true)
    })
  })
})
