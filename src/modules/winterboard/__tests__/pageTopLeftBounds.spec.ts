/**
 * Власник 2026-09-24: «щоб всі об'єкти і при створенні, і при переміщенні не
 * вилазили за лівий і верхній край». Картка за верхнім краєм ховає заголовок —
 * єдину ручку перетягування, і вчитель її вже не зсуне.
 *
 * Правило живе у сторі (board/pageBounds.ts + boardStore) — тому його отримують
 * УСІ шляхи дій користувача: перетягування (drag-end → updateAsset), зміна
 * розміру, груповий рух, вставка з панелі, Інтегралик, вставка, дублювання,
 * стікер. Replay / чужі операції / undo (`skipHistory`) — як є, інакше
 * локальна дошка розійшлась би з сервером.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useWBStore } from '../board/state/boardStore'
import { cancelPendingUpdates } from '../board/state/assetUpdateBatcher'
import { clampToPageTopLeft, limitDeltaAtEdge, movingMin } from '../board/pageBounds'
import type { WBAsset, WBStroke } from '../types/winterboard'

const asset = (o: Partial<WBAsset> = {}): WBAsset => ({
  id: `a-${Math.random().toString(36).slice(2, 8)}`,
  type: 'theory_card', src: '', x: 100, y: 100, w: 520, h: 380, rotation: 0, ...o,
} as WBAsset)

const stroke = (pts: Array<[number, number]>, o: Partial<WBStroke> = {}): WBStroke => ({
  id: `s-${Math.random().toString(36).slice(2, 8)}`,
  tool: 'pen', color: '#000', size: 2, opacity: 1,
  points: pts.map(([x, y]) => ({ x, y })), ...o,
} as WBStroke)

function freshStore() {
  const store = useWBStore()
  store.pages = [{ id: 'page-1', name: 'Page 1', strokes: [], assets: [] }]
  store.currentPageIndex = 0
  return store
}

describe('pageBounds — чисті правила', () => {
  it('clampToPageTopLeft: мінус → 0, у межах — той самий об\'єкт', () => {
    expect(clampToPageTopLeft({ x: -30, y: -5 })).toEqual({ x: 0, y: 0 })
    const inside = { x: 10, y: 20 }
    expect(clampToPageTopLeft(inside)).toBe(inside)
    // правий/нижній край не чіпаємо
    expect(clampToPageTopLeft({ x: 5000, y: 5000 })).toEqual({ x: 5000, y: 5000 })
  })

  it('limitDeltaAtEdge: група зупиняється на краю; уже за краєм — лише назад', () => {
    expect(limitDeltaAtEdge(30, -100)).toBe(-30)
    expect(limitDeltaAtEdge(30, 50)).toBe(50)
    expect(limitDeltaAtEdge(-10, -5)).toBe(0)
    expect(limitDeltaAtEdge(-10, 7)).toBe(7)
  })

  it('movingMin: найменший кут картки або точка штриха', () => {
    expect(movingMin([stroke([[40, 5], [90, 90]])], [asset({ x: 12, y: 60 })])).toEqual({ minX: 12, minY: 5 })
  })
})

describe('boardStore — створення не за лівий/верхній край', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('addAsset (дія користувача): картка з мінусом стає в кут аркуша', () => {
    const store = freshStore()
    store.addAsset(asset({ id: 'c', x: -200, y: -150 }), 'page-1')
    const a = store.currentPage!.assets.find((x) => x.id === 'c')!
    expect([a.x, a.y]).toEqual([0, 0])
  })

  it('операція в журнал іде вже з виправленими координатами', () => {
    const store = freshStore()
    const ops: any[] = []
    const unsub = store.onOperation((op) => ops.push(op))
    store.addAsset(asset({ id: 'c', x: -10, y: 40 }), 'page-1')
    unsub()
    expect(ops[0].payload.asset.x).toBe(0)
    expect(ops[0].payload.asset.y).toBe(40)
  })

  it('addAssetsBatch і addStickyNote — теж', () => {
    const store = freshStore()
    store.addAssetsBatch([asset({ id: 'b1', x: -1, y: 10 }), asset({ id: 'b2', x: 10, y: -1 })])
    store.addStickyNote(asset({ id: 'st', type: 'sticky', x: -50, y: -50 }))
    const byId = (id: string) => store.currentPage!.assets.find((x) => x.id === id)!
    expect([byId('b1').x, byId('b2').y, byId('st').x, byId('st').y]).toEqual([0, 0, 0, 0])
  })

  it('Replay / чужа операція / undo (skipHistory) — як прийшло', () => {
    const store = freshStore()
    store.addAsset(asset({ id: 'r', x: -40, y: -30 }), 'page-1', { skipHistory: true })
    const a = store.currentPage!.assets.find((x) => x.id === 'r')!
    expect([a.x, a.y]).toEqual([-40, -30])
  })
})

describe('boardStore — пересування не за лівий/верхній край', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    cancelPendingUpdates()
    vi.useFakeTimers()
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) =>
      setTimeout(() => cb(performance.now()), 16) as unknown as number)
    vi.stubGlobal('cancelAnimationFrame', (id: number) =>
      clearTimeout(id as unknown as ReturnType<typeof setTimeout>))
  })
  afterEach(() => {
    cancelPendingUpdates()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('updateAsset (кінець перетягування / зміна розміру): за край не пускає', () => {
    const store = freshStore()
    store.addAsset(asset({ id: 'm', x: 100, y: 100 }), 'page-1', { skipHistory: true })
    store.updateAsset({ ...store.currentPage!.assets[0], x: -120, y: -300 })
    vi.advanceTimersByTime(16)
    const a = store.currentPage!.assets[0]
    expect([a.x, a.y]).toEqual([0, 0])
  })

  it('старі дані за краєм: будь-яка правка користувача повертає картку в межі', () => {
    const store = freshStore()
    store.addAsset(asset({ id: 'old', x: -80, y: -60 }), 'page-1', { skipHistory: true })
    const a0 = store.currentPage!.assets[0]
    store.updateAsset({ ...a0, data: { title: 'нове' } } as WBAsset)
    vi.advanceTimersByTime(16)
    const a = store.currentPage!.assets[0]
    expect([a.x, a.y]).toEqual([0, 0])
  })

  it('груповий рух: зупиняється на краю, взаємне розташування не ламається', () => {
    const store = freshStore()
    store.addAsset(asset({ id: 'g1', x: 30, y: 50 }), 'page-1', { skipHistory: true })
    store.addAsset(asset({ id: 'g2', x: 200, y: 80 }), 'page-1', { skipHistory: true })
    store.addStroke(stroke([[60, 40], [90, 70]], { id: 'gs' }), { skipHistory: true })
    store.selectItems(['g1', 'g2', 'gs'])
    store.moveSelectedUnlocked(-500, -500)
    const p = store.currentPage!
    const g1 = p.assets.find((a) => a.id === 'g1')!
    const g2 = p.assets.find((a) => a.id === 'g2')!
    const gs = p.strokes.find((s) => s.id === 'gs')!
    // зсув обмежено найлівішим (g1.x=30) і найвищим (штрих y=40) об'єктом
    expect([g1.x, g1.y]).toEqual([0, 10])
    expect([g2.x, g2.y]).toEqual([170, 40])
    expect(gs.points[0]).toMatchObject({ x: 30, y: 0 })
  })

  it('moveSelected (без урахування блокування) — те саме правило', () => {
    const store = freshStore()
    store.addAsset(asset({ id: 'k', x: 15, y: 25 }), 'page-1', { skipHistory: true })
    store.selectItems(['k'])
    store.moveSelected(-100, -100)
    const k = store.currentPage!.assets[0]
    expect([k.x, k.y]).toEqual([0, 0])
  })
})
