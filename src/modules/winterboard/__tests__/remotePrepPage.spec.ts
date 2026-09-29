/**
 * LAW §9 v1.20 (Інтегралик текстом з пульта): підготовча сторінка — у сховищі й у програвачі запису.
 *   • insertPageAfterCurrent — порожня сторінка ОДРАЗУ після поточної, БЕЗ переходу; штатний
 *     page_add { insertAt, activate: false };
 *   • addStroke({ pageId }) — текст на сторінку, якої на екрані немає;
 *   • runWithoutHistory — матеріал з пульта не лишається в історії ↶ ноутбука;
 *   • програвач: page_add з insertAt стає на місце автора; з activate:false екран не перемикається
 *     (досі insertAt ігнорувався — і для «Дублювати сторінку» теж).
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useWBStore } from '../board/state/boardStore'
import { applyReplayOperation, resetReplayAdoptedPages } from '../engine/applyReplayOperation'
import type { BoardOperation } from '../types/replay'

function boardWith(names: string[], current = 0) {
  const store = useWBStore()
  store.pages = names.map((name) => ({ id: `p-${name}`, name, strokes: [], assets: [] })) as never
  store.currentPageIndex = current
  store.setMode('edit')
  return store
}

const ids = (store: ReturnType<typeof useWBStore>) => store.pages.map((p) => p.id)

beforeEach(() => {
  setActivePinia(createPinia())
  resetReplayAdoptedPages()
})

describe('insertPageAfterCurrent — підготовча сторінка без переходу', () => {
  it('стає одразу після поточної, екран лишається на своїй', () => {
    const store = boardWith(['A', 'B', 'C'], 1)
    const id = store.insertPageAfterCurrent()
    expect(id).toBeTruthy()
    expect(ids(store)).toEqual(['p-A', 'p-B', id, 'p-C'])
    expect(store.currentPageIndex).toBe(1)
    expect(store.currentPage?.id).toBe('p-B')
  })

  it('штатний page_add з insertAt і activate:false (сервер і програвач ставлять туди ж)', () => {
    const store = boardWith(['A', 'B'], 0)
    const ops: Array<{ op_type: string; page_id: string; payload: Record<string, unknown> }> = []
    const off = store.onOperation((op) => ops.push(op as never))
    const id = store.insertPageAfterCurrent()
    off()
    expect(ops).toHaveLength(1)
    expect(ops[0].op_type).toBe('page_add')
    expect(ops[0].page_id).toBe(id)
    expect(ops[0].payload.insertAt).toBe(1)
    expect(ops[0].payload.activate).toBe(false)
    expect((ops[0].payload.page as { id: string }).id).toBe(id)
  })

  it('вигляд поточної сторінки — колір, візерунок, клітинка, розмір (біла серед кольорових «виділяється»)', () => {
    const store = boardWith(['A', 'B'], 0)
    Object.assign(store.pages[0], {
      background: 'dots', backgroundColor: '#cfe8f7', width: 1600, height: 1200,
      grid: { enabled: true, size: 20 },
    })
    const ops: Array<{ payload: { page: Record<string, unknown> } }> = []
    const off = store.onOperation((op) => ops.push(op as never))
    const id = store.insertPageAfterCurrent()
    off()
    const page = store.pages.find((p) => p.id === id)!
    expect([page.background, page.backgroundColor, page.width, page.height]).toEqual(['dots', '#cfe8f7', 1600, 1200])
    expect(page.grid).toEqual({ enabled: true, size: 20 })
    expect(ops[0].payload.page).toMatchObject({ background: 'dots', backgroundColor: '#cfe8f7', width: 1600, height: 1200 })
  })

  it('фото чи PDF у фоні не копіюються — це вміст, а не вигляд; колір лишається', () => {
    const store = boardWith(['A', 'B'], 0)
    Object.assign(store.pages[0], {
      background: { type: 'image', url: 'https://x/p.jpg', assetId: 'a1' }, backgroundColor: '#f6c9d2', width: 1000, height: 700,
    })
    const id = store.insertPageAfterCurrent()
    const page = store.pages.find((p) => p.id === id)!
    expect(page.background).toBe('white')
    expect(page.backgroundColor).toBe('#f6c9d2')
    expect([page.width, page.height]).toEqual([undefined, undefined])
  })

  it('до історії ↶ не йде; на стелі 50 — порожній id', () => {
    const store = boardWith(['A'], 0)
    const undoBefore = store.undoStack.length
    store.insertPageAfterCurrent()
    expect(store.undoStack.length).toBe(undoBefore)
    store.pages = Array.from({ length: 50 }, (_, i) => ({ id: `x${i}`, name: `${i}`, strokes: [], assets: [] })) as never
    expect(store.insertPageAfterCurrent()).toBe('')
    expect(store.pages).toHaveLength(50)
  })
})

describe('addStroke({ pageId }) — текст на сторінку, якої на екрані немає', () => {
  it('лягає на задану, поточна не змінюється; op — з її page_id', () => {
    const store = boardWith(['A', 'B'], 0)
    const ops: Array<{ op_type: string; page_id: string }> = []
    const off = store.onOperation((op) => ops.push(op as never))
    store.addStroke({ id: 's1', tool: 'text', color: '#000', size: 22, opacity: 1, points: [{ x: 1, y: 1 }], text: 'x' } as never, { pageId: 'p-B' })
    off()
    expect(store.pages[1].strokes.map((s) => s.id)).toEqual(['s1'])
    expect(store.pages[0].strokes).toHaveLength(0)
    expect(store.currentPageIndex).toBe(0)
    expect(ops.find((o) => o.op_type === 'stroke_add')?.page_id).toBe('p-B')
  })

  it('без pageId — поточна, як і було', () => {
    const store = boardWith(['A', 'B'], 1)
    store.addStroke({ id: 's2', tool: 'pen', color: '#000', size: 2, opacity: 1, points: [{ x: 1, y: 1 }] } as never)
    expect(store.pages[1].strokes.map((s) => s.id)).toEqual(['s2'])
  })
})

describe('runWithoutHistory — матеріал з пульта не в історії ↶', () => {
  it('те, що додано всередині, з історії прибрано; давніше й redo — як були', async () => {
    const store = boardWith(['A', 'B'], 0)
    store.addStroke({ id: 'mine', tool: 'pen', color: '#000', size: 2, opacity: 1, points: [{ x: 1, y: 1 }] } as never)
    const undoBefore = [...store.undoStack]
    const redo = [{ apply: () => {}, revert: () => {} }]
    store.redoStack = redo as never
    await store.runWithoutHistory(async () => {
      store.addAsset({ id: 'prep', type: 'image', src: 'x', x: 10, y: 10, w: 10, h: 10, rotation: 0, locked: false } as never, 'p-B')
    })
    expect(store.pages[1].assets.map((a) => a.id)).toEqual(['prep'])
    expect(store.undoStack).toEqual(undoBefore)
    expect(store.redoStack).toEqual(redo)
  })
})

function pageAdd(id: string, extra: Record<string, unknown> = {}, seq = 1): BoardOperation {
  return { op_type: 'page_add', page_id: id, payload: { page: { id, name: id }, ...extra }, seq } as unknown as BoardOperation
}

describe('програвач запису: page_add на місце автора', () => {
  it('insertAt + activate:false — сторінка між, екран лишається на поточній (підготовча сторінка)', () => {
    const store = boardWith(['A', 'B', 'C'], 1)
    store.setMode('replay')
    applyReplayOperation(store as never, pageAdd('prep', { insertAt: 2, activate: false }))
    expect(ids(store)).toEqual(['p-A', 'p-B', 'prep', 'p-C'])
    expect(store.currentPage?.id).toBe('p-B')
  })

  it('insertAt без activate («Дублювати сторінку») — на місце автора і перехід на неї', () => {
    const store = boardWith(['A', 'B', 'C'], 0)
    store.setMode('replay')
    applyReplayOperation(store as never, pageAdd('dup', { insertAt: 1 }))
    expect(ids(store)).toEqual(['p-A', 'dup', 'p-B', 'p-C'])
    expect(store.currentPage?.id).toBe('dup')
  })

  it('звичайний page_add — у кінець і перехід, як і було', () => {
    const store = boardWith(['A', 'B'], 0)
    store.setMode('replay')
    applyReplayOperation(store as never, pageAdd('new'))
    expect(ids(store)).toEqual(['p-A', 'p-B', 'new'])
    expect(store.currentPage?.id).toBe('new')
  })

  it('далі перехід за номером веде на ту саму сторінку, що в автора', () => {
    const store = boardWith(['A', 'B', 'C'], 0)
    store.setMode('replay')
    applyReplayOperation(store as never, pageAdd('prep', { insertAt: 1, activate: false }))
    applyReplayOperation(store as never, { op_type: 'page_navigate', page_id: '', payload: { pageIndex: 2 }, seq: 2 } as unknown as BoardOperation)
    expect(store.currentPage?.id).toBe('p-B')   // в автора [A, prep, B, C] → №2 = B
  })
})
