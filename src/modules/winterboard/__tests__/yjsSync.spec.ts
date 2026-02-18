// WB: Unit tests for Yjs Sync (Phase 6: A6.1)
// Tests: Yjs→Store sync, Store→Yjs sync, no circular updates, initial hydration, feature flag

import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as Y from 'yjs'
import {
  createWBDocument,
  addPage as yjsAddPage,
  addStroke as yjsAddStroke,
  removeStroke as yjsRemoveStroke,
  readAllPages,
  readPageStrokes,
  getPageCount,
} from '../engine/collaboration/yjsDocument'
import { setupYjsSync, type WBStoreAdapter } from '../engine/collaboration/yjsSync'
import type { WBPage, WBStroke } from '../types/winterboard'

// ─── Mock store adapter ─────────────────────────────────────────────────────

function createMockStore(pages: WBPage[] = []): WBStoreAdapter & { patchCalls: Record<string, unknown>[] } {
  const patchCalls: Record<string, unknown>[] = []
  return {
    pages: [...pages],
    currentPageIndex: 0,
    isDirty: false,
    patchCalls,
    $patch(partial: Record<string, unknown>) {
      patchCalls.push(partial)
      if (partial.pages) {
        this.pages = partial.pages as WBPage[]
      }
    },
    markDirty() {
      this.isDirty = true
    },
    goToPage(index: number) {
      this.currentPageIndex = index
    },
  }
}

// ─── Fixtures ───────────────────────────────────────────────────────────────

function makePage(id = 'p1', name = 'Page 1'): WBPage {
  return { id, name, strokes: [], assets: [], background: 'white' }
}

function makeStroke(id = 's1'): WBStroke {
  return {
    id,
    tool: 'pen',
    color: '#ff0000',
    size: 3,
    opacity: 1,
    points: [{ x: 10, y: 20, pressure: 0.5 }],
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Yjs Sync (A6.1)', () => {
  let doc: Y.Doc
  let store: ReturnType<typeof createMockStore>

  beforeEach(() => {
    doc = createWBDocument()
    store = createMockStore()
  })

  // ── Yjs → Store sync ─────────────────────────────────────────────────

  describe('Yjs → Store sync', () => {
    it('remote Yjs change updates store', () => {
      // Setup sync
      const handle = setupYjsSync(doc, store, 'user-local')

      // Simulate remote change (different origin)
      yjsAddPage(doc, makePage('p-remote'), 'user-remote')

      // Store should be patched
      expect(store.pages).toHaveLength(1)
      expect(store.pages[0].id).toBe('p-remote')

      handle.destroy()
    })

    it('remote stroke addition updates store', () => {
      // Pre-populate with a page
      yjsAddPage(doc, makePage('p1'), 'init')
      const handle = setupYjsSync(doc, store, 'user-local')

      // Simulate remote stroke
      yjsAddStroke(doc, 0, makeStroke('s-remote'), 'user-remote')

      expect(store.pages[0].strokes).toHaveLength(1)
      expect(store.pages[0].strokes[0].id).toBe('s-remote')

      handle.destroy()
    })

    it('remote stroke removal updates store', () => {
      yjsAddPage(doc, makePage('p1'), 'init')
      yjsAddStroke(doc, 0, makeStroke('s1'), 'init')
      const handle = setupYjsSync(doc, store, 'user-local')

      yjsRemoveStroke(doc, 0, 's1', 'user-remote')

      expect(store.pages[0].strokes).toHaveLength(0)

      handle.destroy()
    })
  })

  // ── Store → Yjs sync ─────────────────────────────────────────────────

  describe('Store → Yjs sync', () => {
    it('pushAddStroke adds to Yjs doc', () => {
      yjsAddPage(doc, makePage('p1'), 'init')
      const handle = setupYjsSync(doc, store, 'user-local')

      handle.pushAddStroke(0, makeStroke('s-local'))

      const strokes = readPageStrokes(doc, 0)
      expect(strokes).toHaveLength(1)
      expect(strokes[0].id).toBe('s-local')

      handle.destroy()
    })

    it('pushRemoveStroke removes from Yjs doc', () => {
      yjsAddPage(doc, makePage('p1'), 'init')
      yjsAddStroke(doc, 0, makeStroke('s1'), 'init')
      const handle = setupYjsSync(doc, store, 'user-local')

      handle.pushRemoveStroke(0, 's1')

      const strokes = readPageStrokes(doc, 0)
      expect(strokes).toHaveLength(0)

      handle.destroy()
    })

    it('pushUpdateStroke modifies Yjs doc', () => {
      yjsAddPage(doc, makePage('p1'), 'init')
      yjsAddStroke(doc, 0, makeStroke('s1'), 'init')
      const handle = setupYjsSync(doc, store, 'user-local')

      handle.pushUpdateStroke(0, 's1', { color: '#00ff00' })

      const strokes = readPageStrokes(doc, 0)
      expect(strokes[0].color).toBe('#00ff00')

      handle.destroy()
    })

    it('pushAddPage adds to Yjs doc', () => {
      const handle = setupYjsSync(doc, store, 'user-local')

      handle.pushAddPage(makePage('p-new'))

      expect(getPageCount(doc)).toBe(1)
      const pages = readAllPages(doc)
      expect(pages[0].id).toBe('p-new')

      handle.destroy()
    })

    it('pushRemovePage removes from Yjs doc', () => {
      yjsAddPage(doc, makePage('p1'), 'init')
      yjsAddPage(doc, makePage('p2'), 'init')
      const handle = setupYjsSync(doc, store, 'user-local')

      handle.pushRemovePage(0)

      expect(getPageCount(doc)).toBe(1)
      expect(readAllPages(doc)[0].id).toBe('p2')

      handle.destroy()
    })
  })

  // ── No circular updates ───────────────────────────────────────────────

  describe('No circular updates', () => {
    it('local push with same origin does NOT trigger store patch', () => {
      yjsAddPage(doc, makePage('p1'), 'init')
      const handle = setupYjsSync(doc, store, 'user-local')

      // Clear patch calls from initial hydration
      store.patchCalls.length = 0

      // Push stroke with local origin — should update Yjs but NOT re-patch store
      handle.pushAddStroke(0, makeStroke('s-local'))

      // The Yjs observer should skip because origin === 'user-local'
      expect(store.patchCalls).toHaveLength(0)

      handle.destroy()
    })

    it('isYjsUpdate flag prevents store→Yjs during Yjs→Store sync', () => {
      const handle = setupYjsSync(doc, store, 'user-local')

      // During a remote change, isYjsUpdate should be true inside the observer
      // and push methods should be no-ops
      // We verify this indirectly: remote change should not cause double-write

      yjsAddPage(doc, makePage('p-remote'), 'user-remote')

      // Only 1 page in Yjs (not duplicated)
      expect(getPageCount(doc)).toBe(1)

      handle.destroy()
    })
  })

  // ── Initial hydration ─────────────────────────────────────────────────

  describe('Initial hydration', () => {
    it('empty Yjs doc → hydrates from store (first user)', () => {
      store.pages = [makePage('p-store')]

      const handle = setupYjsSync(doc, store, 'user-local')

      // Yjs should now have the store's page
      expect(getPageCount(doc)).toBe(1)
      expect(readAllPages(doc)[0].id).toBe('p-store')

      handle.destroy()
    })

    it('existing Yjs doc → hydrates store from Yjs (joining user)', () => {
      // Pre-populate Yjs
      yjsAddPage(doc, makePage('p-yjs'), 'init')

      const handle = setupYjsSync(doc, store, 'user-local')

      // Store should have the Yjs page
      expect(store.pages).toHaveLength(1)
      expect(store.pages[0].id).toBe('p-yjs')

      handle.destroy()
    })

    it('both empty → no crash', () => {
      const handle = setupYjsSync(doc, store, 'user-local')

      expect(getPageCount(doc)).toBe(0)
      expect(store.pages).toHaveLength(0)

      handle.destroy()
    })
  })

  // ── Destroy ───────────────────────────────────────────────────────────

  describe('Destroy', () => {
    it('after destroy, remote changes do not update store', () => {
      const handle = setupYjsSync(doc, store, 'user-local')
      handle.destroy()

      store.patchCalls.length = 0
      yjsAddPage(doc, makePage('p-after-destroy'), 'user-remote')

      // Store should NOT be updated
      expect(store.patchCalls).toHaveLength(0)
    })

    it('after destroy, push methods are no-ops', () => {
      yjsAddPage(doc, makePage('p1'), 'init')
      const handle = setupYjsSync(doc, store, 'user-local')
      handle.destroy()

      handle.pushAddStroke(0, makeStroke('s-after'))

      // Yjs should still have only the original page with no strokes
      expect(readPageStrokes(doc, 0)).toHaveLength(0)
    })
  })

  // ── Feature flag ──────────────────────────────────────────────────────

  describe('Feature flag', () => {
    it('isYjsEnabled returns false by default', async () => {
      const { isYjsEnabled } = await import('../composables/useCollaboration')
      // In test env, VITE_WB_USE_YJS is not set
      expect(isYjsEnabled()).toBe(false)
    })
  })
})
