/**
 * DevWhiteboardStorageAdapter Tests - v0.93.0
 * Tests for localStorage-based dev workspace persistence
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { DevWhiteboardStorageAdapter } from '../DevWhiteboardStorageAdapter'

describe('DevWhiteboardStorageAdapter', () => {
  let adapter: DevWhiteboardStorageAdapter

  beforeEach(() => {
    adapter = new DevWhiteboardStorageAdapter()
    localStorage.clear()
  })

  describe('savePage', () => {
    it('saves page state to localStorage with correct key schema', async () => {
      const pageId = 'dev-workspace-test-123-page-5'
      const state = {
        strokes: [{ id: 's1', tool: 'pen', points: [] }],
        assets: [],
      }

      await adapter.savePage(pageId, { state, version: 1 })

      const key = 'winterboard:dev:dev-workspace-test-123:dev-workspace-test-123-page-5'
      const saved = localStorage.getItem(key)
      expect(saved).toBeTruthy()

      const payload = JSON.parse(saved!)
      expect(payload.schema_version).toBe(1)
      expect(payload.workspace_id).toBe('dev-workspace-test-123')
      expect(payload.page_id).toBe(pageId)
      expect(payload.strokes).toHaveLength(1)
      expect(payload.assets).toHaveLength(0)
      expect(payload.saved_at).toBeTruthy()
    })

    it('returns version 1', async () => {
      const result = await adapter.savePage('dev-workspace-x-page-1', {
        state: { strokes: [], assets: [] },
        version: 1,
      })

      expect(result.version).toBe(1)
    })

    it('overwrites existing data', async () => {
      const pageId = 'dev-workspace-overwrite-page-1'
      
      await adapter.savePage(pageId, {
        state: { strokes: [{ id: 'old' }], assets: [] },
        version: 1,
      })

      await adapter.savePage(pageId, {
        state: { strokes: [{ id: 'new' }], assets: [] },
        version: 1,
      })

      const loaded = await adapter.loadPage(pageId)
      expect(loaded.state.strokes).toHaveLength(1)
      expect((loaded.state.strokes as any)[0].id).toBe('new')
    })
  })

  describe('loadPage', () => {
    it('loads page state from localStorage', async () => {
      const pageId = 'dev-workspace-load-page-3'
      const key = 'winterboard:dev:dev-workspace-load:dev-workspace-load-page-3'
      
      const payload = {
        schema_version: 1,
        workspace_id: 'dev-workspace-load',
        page_id: pageId,
        saved_at: '2026-01-17T12:00:00.000Z',
        strokes: [{ id: 'stroke-1', text: 'Test' }],
        assets: [{ id: 'asset-1', type: 'image' }],
      }
      localStorage.setItem(key, JSON.stringify(payload))

      const loaded = await adapter.loadPage(pageId)

      expect(loaded.id).toBe(pageId)
      expect(loaded.title).toBe('Page 3')
      expect(loaded.index).toBe(2)
      expect(loaded.version).toBe(1)
      expect(loaded.state.strokes).toHaveLength(1)
      expect(loaded.state.assets).toHaveLength(1)
      expect(loaded.updatedAt).toBe('2026-01-17T12:00:00.000Z')
    })

    it('returns empty state if no data in localStorage', async () => {
      const pageId = 'dev-workspace-empty-page-7'

      const loaded = await adapter.loadPage(pageId)

      expect(loaded.id).toBe(pageId)
      expect(loaded.title).toBe('Page 7')
      expect(loaded.index).toBe(6)
      expect(loaded.state.strokes).toEqual([])
      expect(loaded.state.assets).toEqual([])
    })

    it('handles corrupted localStorage data gracefully', async () => {
      const pageId = 'dev-workspace-corrupt-page-2'
      const key = 'winterboard:dev:dev-workspace-corrupt:dev-workspace-corrupt-page-2'
      
      localStorage.setItem(key, 'invalid json {{{')

      const loaded = await adapter.loadPage(pageId)

      expect(loaded.state.strokes).toEqual([])
      expect(loaded.state.assets).toEqual([])
    })

    it('resets data if schema_version is unknown', async () => {
      const pageId = 'dev-workspace-schema-page-1'
      const key = 'winterboard:dev:dev-workspace-schema:dev-workspace-schema-page-1'
      
      const payload = {
        schema_version: 999, // Unknown version
        workspace_id: 'dev-workspace-schema',
        page_id: pageId,
        saved_at: new Date().toISOString(),
        strokes: [{ id: 'old-format' }],
        assets: [],
      }
      localStorage.setItem(key, JSON.stringify(payload))

      const loaded = await adapter.loadPage(pageId)

      expect(loaded.state.strokes).toEqual([])
      expect(loaded.state.assets).toEqual([])
    })
  })

  describe('extractWorkspaceId', () => {
    it('extracts workspace ID from page ID correctly', async () => {
      const pageId = 'dev-workspace-abc-123-page-5'
      
      await adapter.savePage(pageId, {
        state: { strokes: [], assets: [] },
        version: 1,
      })

      const key = 'winterboard:dev:dev-workspace-abc-123:dev-workspace-abc-123-page-5'
      expect(localStorage.getItem(key)).toBeTruthy()
    })

    it('throws error for invalid page ID format', async () => {
      const invalidPageId = 'invalid-page-id'

      await expect(
        adapter.savePage(invalidPageId, {
          state: { strokes: [], assets: [] },
          version: 1,
        })
      ).rejects.toThrow('Invalid dev pageId format')
    })
  })

  describe('extractPageTitle and extractPageIndex', () => {
    it('extracts correct title and index from page ID', async () => {
      const pageId = 'dev-workspace-test-page-10'

      const loaded = await adapter.loadPage(pageId)

      expect(loaded.title).toBe('Page 10')
      expect(loaded.index).toBe(9) // 0-indexed
    })

    it('handles page-1 correctly', async () => {
      const pageId = 'dev-workspace-x-page-1'

      const loaded = await adapter.loadPage(pageId)

      expect(loaded.title).toBe('Page 1')
      expect(loaded.index).toBe(0)
    })
  })

  describe('listPages', () => {
    it('returns empty array (noop for dev workspace)', async () => {
      const pages = await adapter.listPages('dev-workspace-test')

      expect(pages).toEqual([])
    })
  })

  describe('createPage', () => {
    it('throws error (noop for dev workspace)', async () => {
      await expect(
        adapter.createPage('dev-workspace-test', { title: 'New Page' })
      ).rejects.toThrow('DevStorageAdapter.createPage is not implemented')
    })
  })

  describe('persistence across sessions (reopen scenario)', () => {
    it('AC2: "Yes/NO" scenario - save and reload', async () => {
      const workspaceId = 'dev-workspace-session-456'
      const page5Id = `${workspaceId}-page-5`
      const page6Id = `${workspaceId}-page-6`

      // Session 1: Draw "Yes" on page 5
      await adapter.savePage(page5Id, {
        state: {
          strokes: [{ id: 'stroke-yes', text: 'Yes', tool: 'text' }],
          assets: [],
        },
        version: 1,
      })

      // Session 1: Draw "NO" on page 6
      await adapter.savePage(page6Id, {
        state: {
          strokes: [{ id: 'stroke-no', text: 'NO', tool: 'text' }],
          assets: [],
        },
        version: 1,
      })

      // Simulate Ctrl+R (hard reload) - create new adapter instance
      const adapter2 = new DevWhiteboardStorageAdapter()

      // Session 2: Load page 5
      const loaded5 = await adapter2.loadPage(page5Id)
      expect(loaded5.state.strokes).toHaveLength(1)
      expect((loaded5.state.strokes as any)[0].text).toBe('Yes')

      // Session 2: Load page 6
      const loaded6 = await adapter2.loadPage(page6Id)
      expect(loaded6.state.strokes).toHaveLength(1)
      expect((loaded6.state.strokes as any)[0].text).toBe('NO')

      // Verify localStorage keys exist
      const key5 = `winterboard:dev:${workspaceId}:${page5Id}`
      const key6 = `winterboard:dev:${workspaceId}:${page6Id}`
      expect(localStorage.getItem(key5)).toBeTruthy()
      expect(localStorage.getItem(key6)).toBeTruthy()
    })
  })
})
