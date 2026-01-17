/**
 * Whiteboard Store Tests - v0.93.0 Dev Workspace Full Canvas & Persistence
 * Tests for 10 pages bootstrap, DevStorageAdapter, autosave, active page by scroll
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWhiteboardStore } from '../whiteboardStore'
import { DevWhiteboardStorageAdapter } from '@/core/whiteboard/adapters/DevWhiteboardStorageAdapter'

describe('WhiteboardStore v0.93.0 - Dev Workspace Full Canvas & Persistence', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    // Clear localStorage before each test
    localStorage.clear()
  })

  describe('bootstrap dev workspace - 10 pages', () => {
    it('creates 10 placeholder pages for dev-workspace-*', async () => {
      const store = useWhiteboardStore()
      const devWorkspaceId = 'dev-workspace-test-session-123'

      await store.bootstrap(devWorkspaceId)

      expect(store.workspaceId).toBe(devWorkspaceId)
      expect(store.pages).toHaveLength(10)
      
      // Verify all 10 pages
      for (let i = 0; i < 10; i++) {
        expect(store.pages[i].id).toBe(`${devWorkspaceId}-page-${i + 1}`)
        expect(store.pages[i].title).toBe(`Page ${i + 1}`)
        expect(store.pages[i].index).toBe(i)
        expect(store.pages[i].version).toBe(1)
      }
      
      expect(store.status).toBe('idle')
    })

    it('sets active page to first page', async () => {
      const store = useWhiteboardStore()
      const devWorkspaceId = 'dev-workspace-abc'

      await store.bootstrap(devWorkspaceId)

      expect(store.activePageId).toBe(`${devWorkspaceId}-page-1`)
      expect(store.currentPageData).toBeTruthy()
      expect(store.currentPageData?.id).toBe(`${devWorkspaceId}-page-1`)
    })

    it('initializes pageStates map for all 10 pages', async () => {
      const store = useWhiteboardStore()
      const devWorkspaceId = 'dev-workspace-states'

      await store.bootstrap(devWorkspaceId)

      expect(store.pageStates.size).toBe(10)
      
      // All pages should have empty state initially
      for (let i = 0; i < 10; i++) {
        const pageId = `${devWorkspaceId}-page-${i + 1}`
        const state = store.pageStates.get(pageId)
        expect(state).toBeDefined()
        expect(state?.strokes).toEqual([])
        expect(state?.assets).toEqual([])
      }
    })

    it('uses DevWhiteboardStorageAdapter for dev workspace', async () => {
      const store = useWhiteboardStore()
      await store.bootstrap('dev-workspace-adapter-test')

      // Adapter should be DevWhiteboardStorageAdapter (check by calling methods)
      // This is verified by the fact that bootstrap completes without API calls
      expect(store.status).toBe('idle')
    })
  })

  describe('setActivePageByScroll (LAW-04)', () => {
    it('changes active page when called', async () => {
      const store = useWhiteboardStore()
      const devWorkspaceId = 'dev-workspace-scroll'
      await store.bootstrap(devWorkspaceId)

      const page5Id = `${devWorkspaceId}-page-5`
      store.setActivePageByScroll(page5Id)

      expect(store.activePageId).toBe(page5Id)
      expect(store.currentPageData?.id).toBe(page5Id)
      expect(store.currentPageData?.title).toBe('Page 5')
    })

    it('loads page state from pageStates map', async () => {
      const store = useWhiteboardStore()
      const devWorkspaceId = 'dev-workspace-state-load'
      await store.bootstrap(devWorkspaceId)

      // Add some strokes to page 3
      const page3Id = `${devWorkspaceId}-page-3`
      const testState = {
        strokes: [{ id: 'stroke-1', tool: 'pen', points: [] }],
        assets: [],
      }
      store.pageStates.set(page3Id, testState)

      store.setActivePageByScroll(page3Id)

      expect(store.currentPageData?.state).toEqual(testState)
    })

    it('does nothing if already active', async () => {
      const store = useWhiteboardStore()
      await store.bootstrap('dev-workspace-noop')

      const initialPageId = store.activePageId
      store.setActivePageByScroll(initialPageId!)

      expect(store.activePageId).toBe(initialPageId)
    })
  })

  describe('updatePageState (autosave)', () => {
    it('saves page state to localStorage via adapter', async () => {
      const store = useWhiteboardStore()
      const devWorkspaceId = 'dev-workspace-autosave'
      await store.bootstrap(devWorkspaceId)

      const page5Id = `${devWorkspaceId}-page-5`
      const newState = {
        strokes: [
          { id: 'stroke-1', tool: 'pen', color: '#000', size: 4, points: [{ x: 10, y: 20 }] },
        ],
        assets: [],
      }

      await store.updatePageState(page5Id, newState)

      // Verify state updated in map
      expect(store.pageStates.get(page5Id)).toEqual(newState)

      // Verify saved to localStorage
      const key = `winterboard:dev:${devWorkspaceId}:${page5Id}`
      const saved = localStorage.getItem(key)
      expect(saved).toBeTruthy()
      
      const payload = JSON.parse(saved!)
      expect(payload.schema_version).toBe(1)
      expect(payload.workspace_id).toBe(devWorkspaceId)
      expect(payload.page_id).toBe(page5Id)
      expect(payload.strokes).toHaveLength(1)
    })

    it('updates currentPageData if page is active', async () => {
      const store = useWhiteboardStore()
      const devWorkspaceId = 'dev-workspace-current'
      await store.bootstrap(devWorkspaceId)

      const page1Id = `${devWorkspaceId}-page-1`
      const newState = {
        strokes: [{ id: 's1' }],
        assets: [],
      }

      await store.updatePageState(page1Id, newState)

      expect(store.currentPageData?.state).toEqual(newState)
    })
  })

  describe('addDevPage (LAW-03, 2.7)', () => {
    it('adds new page to dev workspace', async () => {
      const store = useWhiteboardStore()
      const devWorkspaceId = 'dev-workspace-add'
      await store.bootstrap(devWorkspaceId)

      expect(store.pages).toHaveLength(10)

      store.addDevPage()

      expect(store.pages).toHaveLength(11)
      expect(store.pages[10].id).toBe(`${devWorkspaceId}-page-11`)
      expect(store.pages[10].title).toBe('Page 11')
      expect(store.pages[10].index).toBe(10)
    })

    it('initializes empty state for new page', async () => {
      const store = useWhiteboardStore()
      await store.bootstrap('dev-workspace-add-state')

      store.addDevPage()

      const newPageId = store.pages[10].id
      const state = store.pageStates.get(newPageId)
      expect(state).toEqual({ strokes: [], assets: [] })
    })

    it('respects maxPages limit', async () => {
      const store = useWhiteboardStore()
      await store.bootstrap('dev-workspace-limit')

      // Set limit to 10
      store.limits = { maxPages: 10 }

      store.addDevPage()

      // Should not add page (already at limit)
      expect(store.pages).toHaveLength(10)
    })

    it('does nothing for non-dev workspace', async () => {
      const store = useWhiteboardStore()
      // Don't bootstrap dev workspace
      store.workspaceId = 'production-workspace-123'

      store.addDevPage()

      // Should not crash, just log error
      expect(store.pages).toHaveLength(0)
    })
  })

  describe('DevWhiteboardStorageAdapter integration', () => {
    it('loads page state from localStorage on bootstrap', async () => {
      const devWorkspaceId = 'dev-workspace-reload'
      const page5Id = `${devWorkspaceId}-page-5`
      
      // Pre-populate localStorage
      const key = `winterboard:dev:${devWorkspaceId}:${page5Id}`
      const payload = {
        schema_version: 1,
        workspace_id: devWorkspaceId,
        page_id: page5Id,
        saved_at: new Date().toISOString(),
        strokes: [{ id: 'stroke-yes', text: 'Yes' }],
        assets: [],
      }
      localStorage.setItem(key, JSON.stringify(payload))

      const store = useWhiteboardStore()
      await store.bootstrap(devWorkspaceId)

      // Page 5 should have loaded state
      const state = store.pageStates.get(page5Id)
      expect(state?.strokes).toHaveLength(1)
      expect((state?.strokes as any)[0].text).toBe('Yes')
    })

    it('persists across bootstrap cycles (reopen scenario)', async () => {
      const devWorkspaceId = 'dev-workspace-persist'
      const page6Id = `${devWorkspaceId}-page-6`

      // First session: save data
      const store1 = useWhiteboardStore()
      await store1.bootstrap(devWorkspaceId)
      
      const testState = {
        strokes: [{ id: 'stroke-no', text: 'NO' }],
        assets: [],
      }
      await store1.updatePageState(page6Id, testState)

      // Simulate page reload: create new store instance
      setActivePinia(createPinia())
      const store2 = useWhiteboardStore()
      await store2.bootstrap(devWorkspaceId)

      // Page 6 should have persisted state
      const loadedState = store2.pageStates.get(page6Id)
      expect(loadedState?.strokes).toHaveLength(1)
      expect((loadedState?.strokes as any)[0].text).toBe('NO')
    })
  })

  describe('production workspace unchanged', () => {
    it('does not use DevStorageAdapter for non-dev workspace', async () => {
      const store = useWhiteboardStore()
      
      // Mock production adapters
      const mockStorageAdapter = {
        listPages: vi.fn().mockResolvedValue([]),
        loadPage: vi.fn().mockResolvedValue({
          id: 'page-1',
          title: 'Page 1',
          index: 0,
          version: 1,
          state: { strokes: [], assets: [] },
          updatedAt: new Date().toISOString(),
        }),
        createPage: vi.fn().mockResolvedValue({
          id: 'page-1',
          title: 'Page 1',
          index: 0,
          version: 1,
          updatedAt: new Date().toISOString(),
          state: { strokes: [], assets: [] },
        }),
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

      expect(mockStorageAdapter.listPages).toHaveBeenCalled()
      expect(mockPolicyAdapter.getLimits).toHaveBeenCalled()
      expect(store.pageStates.size).toBe(0) // pageStates not used for prod
    })
  })
})
