/**
 * Phase 20: Store Operation Emitter Tests
 *
 * Validates that boardStore automatically emits operations via _emitOperation
 * for all 10 core action types, respects mode guards, and skipHistory guards.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWBStore, _resetOperationListeners } from '@/modules/winterboard/board/state/boardStore'
import type { RecordOperationRequest } from '@/modules/winterboard/types/replay'
import type { WBStroke, WBAsset } from '@/modules/winterboard/types/winterboard'

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeStroke(id = 'stroke-1'): WBStroke {
  return {
    id,
    points: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
    color: '#000',
    size: 2,
    tool: 'pen',
    opacity: 1,
  } as WBStroke
}

function makeAsset(id = 'asset-1'): WBAsset {
  return {
    id,
    type: 'image',
    x: 0,
    y: 0,
    w: 100,
    h: 100,
    rotation: 0,
    src: 'https://example.com/img.png',
  } as WBAsset
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Phase 20: Store Operation Emitter', () => {
  let store: ReturnType<typeof useWBStore>
  let emitted: RecordOperationRequest[]
  let unsub: () => void

  beforeEach(() => {
    _resetOperationListeners()
    setActivePinia(createPinia())
    store = useWBStore()
    store.setMode('edit')
    emitted = []
    unsub = store.onOperation((op) => {
      emitted.push(op)
    })
  })

  // ── T1: Recording — core operations emit correctly ────────────────────

  describe('T1: Recording in edit mode', () => {
    it('addStroke → emits stroke_add', () => {
      const stroke = makeStroke()
      store.addStroke(stroke)

      expect(emitted).toHaveLength(1)
      expect(emitted[0].op_type).toBe('stroke_add')
      expect(emitted[0].page_id).toBe(store.pages[0].id)
      expect((emitted[0].payload as Record<string, unknown>).stroke).toEqual(stroke)
      expect(emitted[0].timestamp).toBeTypeOf('number')
    })

    it('updateStroke → emits stroke_update', () => {
      const stroke = makeStroke()
      store.addStroke(stroke)
      emitted.length = 0

      const updated = { ...stroke, color: '#ff0000' }
      store.updateStroke(updated)

      expect(emitted).toHaveLength(1)
      expect(emitted[0].op_type).toBe('stroke_update')
      expect((emitted[0].payload as Record<string, unknown>).stroke).toEqual(updated)
    })

    it('deleteStroke → emits stroke_delete', () => {
      const stroke = makeStroke()
      store.addStroke(stroke)
      emitted.length = 0

      store.deleteStroke(stroke.id)

      expect(emitted).toHaveLength(1)
      expect(emitted[0].op_type).toBe('stroke_delete')
      expect((emitted[0].payload as Record<string, unknown>).stroke_id).toBe(stroke.id)
    })

    it('addAsset → emits asset_add', () => {
      const asset = makeAsset()
      store.addAsset(asset)

      expect(emitted).toHaveLength(1)
      expect(emitted[0].op_type).toBe('asset_add')
      expect(emitted[0].page_id).toBe(store.pages[0].id)
      expect((emitted[0].payload as Record<string, unknown>).asset).toEqual(asset)
    })

    it('updateAsset → emits asset_update', () => {
      const asset = makeAsset()
      store.addAsset(asset)
      emitted.length = 0

      const updated = { ...asset, x: 50 }
      store.updateAsset(updated)

      expect(emitted).toHaveLength(1)
      expect(emitted[0].op_type).toBe('asset_update')
      expect((emitted[0].payload as Record<string, unknown>).asset).toEqual(updated)
    })

    it('deleteAsset → emits asset_delete', () => {
      const asset = makeAsset()
      store.addAsset(asset)
      emitted.length = 0

      store.deleteAsset(asset.id)

      expect(emitted).toHaveLength(1)
      expect(emitted[0].op_type).toBe('asset_delete')
      expect((emitted[0].payload as Record<string, unknown>).asset_id).toBe(asset.id)
    })

    it('addPage → emits page_add', () => {
      store.addPage({ name: 'Test Page' })
      // addPage also emits page_navigate implicitly (goToPage inside), filter for page_add
      const pageAddOps = emitted.filter(o => o.op_type === 'page_add')

      expect(pageAddOps).toHaveLength(1)
      expect(pageAddOps[0].op_type).toBe('page_add')
      const payload = pageAddOps[0].payload as Record<string, unknown>
      const page = payload.page as Record<string, unknown>
      expect(page.name).toBe('Test Page')
      expect(pageAddOps[0].page_id).toBe(store.pages[store.pages.length - 1].id)
    })

    it('goToPage → emits page_navigate when page changes', () => {
      store.addPage() // now on page 1
      emitted.length = 0

      store.goToPage(0)

      expect(emitted).toHaveLength(1)
      expect(emitted[0].op_type).toBe('page_navigate')
      expect((emitted[0].payload as Record<string, unknown>).pageIndex).toBe(0)
    })

    it('goToPage → does NOT emit when page index unchanged', () => {
      emitted.length = 0
      store.goToPage(store.currentPageIndex) // same page

      expect(emitted).toHaveLength(0)
    })

    it('deletePageUndoable → emits page_delete', () => {
      store.addPage()
      emitted.length = 0

      const pageId = store.pages[0].id
      store.deletePageUndoable(0)

      const delOps = emitted.filter(o => o.op_type === 'page_delete')
      expect(delOps).toHaveLength(1)
      expect((delOps[0].payload as Record<string, unknown>).page_id).toBe(pageId)
    })

    it('clearPage → emits clear_page', () => {
      const stroke = makeStroke()
      store.addStroke(stroke)
      emitted.length = 0

      const pageId = store.pages[0].id
      store.clearPage()

      const clearOps = emitted.filter(o => o.op_type === 'clear_page')
      expect(clearOps).toHaveLength(1)
      expect(clearOps[0].page_id).toBe(pageId)
    })

    it('clearCurrentPage → emits clear_page', () => {
      const stroke = makeStroke()
      store.addStroke(stroke)
      emitted.length = 0

      const pageId = store.pages[0].id
      store.clearCurrentPage()

      const clearOps = emitted.filter(o => o.op_type === 'clear_page')
      expect(clearOps).toHaveLength(1)
      expect(clearOps[0].page_id).toBe(pageId)
    })

    it('addPageUndoable → emits page_add', () => {
      store.addPageUndoable({ name: 'Undoable Page' })

      const addOps = emitted.filter(o => o.op_type === 'page_add')
      expect(addOps).toHaveLength(1)
      const page = (addOps[0].payload as Record<string, unknown>).page as Record<string, unknown>
      expect(page.name).toBe('Undoable Page')
    })
  })

  // ── T2: No emit in non-edit modes ─────────────────────────────────────

  describe('T2: No emit in non-edit modes', () => {
    it('replay mode → no emission', () => {
      store.setMode('replay')
      store.addStroke(makeStroke())

      expect(emitted).toHaveLength(0)
    })

    it('readonly mode → no emission', () => {
      store.setMode('readonly')
      store.addStroke(makeStroke())

      expect(emitted).toHaveLength(0)
    })

    it('skipHistory=true → no emission (replay source)', () => {
      store.addStroke(makeStroke(), { skipHistory: true })

      expect(emitted).toHaveLength(0)
    })

    it('skipHistory=true on asset → no emission', () => {
      store.addAsset(makeAsset(), { skipHistory: true })

      expect(emitted).toHaveLength(0)
    })
  })

  // ── T3: Unsubscribe ───────────────────────────────────────────────────

  describe('T3: Unsubscribe', () => {
    it('onOperation returns unsub function', () => {
      expect(typeof unsub).toBe('function')
    })

    it('after unsub, listener NOT called', () => {
      unsub()
      store.addStroke(makeStroke())

      expect(emitted).toHaveLength(0)
    })

    it('multiple listeners work independently', () => {
      const emitted2: RecordOperationRequest[] = []
      const unsub2 = store.onOperation((op) => emitted2.push(op))

      store.addStroke(makeStroke())

      expect(emitted).toHaveLength(1)
      expect(emitted2).toHaveLength(1)

      unsub()
      store.addStroke(makeStroke('stroke-2'))

      // First listener unsubbed, second still active
      expect(emitted).toHaveLength(1)
      expect(emitted2).toHaveLength(2)

      unsub2()
    })
  })

  // ── T4: Timestamp present ─────────────────────────────────────────────

  describe('T4: Timestamp', () => {
    it('all emitted ops have timestamp', () => {
      store.addStroke(makeStroke())
      store.addAsset(makeAsset())
      store.addPage()

      for (const op of emitted) {
        expect(op.timestamp).toBeTypeOf('number')
        expect(op.timestamp).toBeGreaterThan(0)
      }
    })
  })

  // ── T5: page_id guard ─────────────────────────────────────────────────

  describe('T5: page_id present', () => {
    it('stroke ops have correct page_id', () => {
      const stroke = makeStroke()
      store.addStroke(stroke)

      expect(emitted[0].page_id).toBe(store.pages[0].id)
      expect(emitted[0].page_id).not.toBe('')
    })

    it('asset ops have correct page_id', () => {
      const asset = makeAsset()
      store.addAsset(asset)

      expect(emitted[0].page_id).toBe(store.pages[0].id)
      expect(emitted[0].page_id).not.toBe('')
    })
  })

  // ── T6: Listener error isolation ──────────────────────────────────────

  describe('T6: Listener error isolation', () => {
    it('throwing listener does not break other listeners', () => {
      const emitted2: RecordOperationRequest[] = []
      store.onOperation(() => { throw new Error('bad listener') })
      store.onOperation((op) => emitted2.push(op))

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      store.addStroke(makeStroke())
      consoleSpy.mockRestore()

      // First listener threw but second still received
      expect(emitted).toHaveLength(1)
      expect(emitted2).toHaveLength(1)
    })
  })
})
