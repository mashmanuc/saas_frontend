/**
 * Phase 34 Agent A: boardStore unit tests
 * Covers: A1 (getObjectById, getObjectType, updateObject),
 *         A2 (lock fix — moveSelectedUnlocked),
 *         A3 (z-order actions + undo),
 *         A4 (performance limits + selection cap)
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWBStore } from '../board/state/boardStore'
import type { WBStroke, WBAsset } from '../types/winterboard'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeStroke(overrides: Partial<WBStroke> = {}): WBStroke {
  return {
    id: `stroke-${Math.random().toString(36).slice(2, 8)}`,
    tool: 'pen',
    color: '#000',
    size: 2,
    opacity: 1,
    points: [{ x: 10, y: 10 }, { x: 50, y: 50 }],
    ...overrides,
  }
}

function makeAsset(overrides: Partial<WBAsset> = {}): WBAsset {
  return {
    id: `asset-${Math.random().toString(36).slice(2, 8)}`,
    type: 'image',
    src: 'test.png',
    x: 100,
    y: 100,
    w: 200,
    h: 150,
    rotation: 0,
    ...overrides,
  }
}

function seedPage(store: ReturnType<typeof useWBStore>) {
  if (store.pages.length === 0) {
    store.pages = [{ id: 'page-1', name: 'Page 1', strokes: [], assets: [] }]
    store.currentPageIndex = 0
  }
}

// ─── A1: Unified getters ─────────────────────────────────────────────────────

describe('A1: getObjectById', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('finds stroke by id', () => {
    const store = useWBStore()
    seedPage(store)
    const s = makeStroke({ id: 'stroke-1' })
    store.addStroke(s, { skipHistory: true })
    expect(store.getObjectById('stroke-1')).toBeTruthy()
    expect(store.getObjectById('stroke-1')!.id).toBe('stroke-1')
  })

  it('finds asset by id', () => {
    const store = useWBStore()
    seedPage(store)
    const a = makeAsset({ id: 'asset-1' })
    store.addAsset(a, { skipHistory: true })
    expect(store.getObjectById('asset-1')).toBeTruthy()
    expect(store.getObjectById('asset-1')!.id).toBe('asset-1')
  })

  it('returns null for non-existent id', () => {
    const store = useWBStore()
    seedPage(store)
    expect(store.getObjectById('nonexistent')).toBeNull()
  })
})

describe('A1: getObjectType', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('returns tool for strokes', () => {
    const store = useWBStore()
    const s = makeStroke({ tool: 'pen' })
    expect(store.getObjectType(s)).toBe('pen')
  })

  it('returns type for assets', () => {
    const store = useWBStore()
    const a = makeAsset({ type: 'sticky' })
    expect(store.getObjectType(a)).toBe('sticky')
  })
})

describe('A1: updateObject', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('updates stroke field', () => {
    const store = useWBStore()
    seedPage(store)
    const s = makeStroke({ id: 'upd-s1', color: '#000' })
    store.addStroke(s, { skipHistory: true })
    store.updateObject('upd-s1', { color: '#ff0000' })
    const found = store.getObjectById('upd-s1') as WBStroke
    expect(found.color).toBe('#ff0000')
  })

  it('updates asset field', () => {
    const store = useWBStore()
    seedPage(store)
    const a = makeAsset({ id: 'upd-a1', x: 100 })
    store.addAsset(a, { skipHistory: true })
    store.updateObject('upd-a1', { x: 200 })
    const found = store.getObjectById('upd-a1') as WBAsset
    expect(found.x).toBe(200)
  })

  it('creates undo entry', () => {
    const store = useWBStore()
    seedPage(store)
    const s = makeStroke({ id: 'undo-s1' })
    store.addStroke(s, { skipHistory: true })
    const stackBefore = store.undoStack.length
    store.updateObject('undo-s1', { color: '#fff' })
    expect(store.undoStack.length).toBe(stackBefore + 1)
  })

  it('ignores locked object (except unlock)', () => {
    const store = useWBStore()
    seedPage(store)
    const s = makeStroke({ id: 'lock-s1', color: '#000', locked: true })
    store.addStroke(s, { skipHistory: true })
    store.updateObject('lock-s1', { color: '#ff0' })
    expect((store.getObjectById('lock-s1') as WBStroke).color).toBe('#000')
  })

  it('allows unlock on locked object', () => {
    const store = useWBStore()
    seedPage(store)
    const s = makeStroke({ id: 'lock-s2', locked: true })
    store.addStroke(s, { skipHistory: true })
    store.updateObject('lock-s2', { locked: false })
    expect((store.getObjectById('lock-s2') as WBStroke).locked).toBe(false)
  })

  it('undo restores previous state', () => {
    const store = useWBStore()
    seedPage(store)
    const s = makeStroke({ id: 'undo-restore', color: '#000' })
    store.addStroke(s, { skipHistory: true })
    store.updateObject('undo-restore', { color: '#fff' })
    expect((store.getObjectById('undo-restore') as WBStroke).color).toBe('#fff')
    store.undo()
    expect((store.getObjectById('undo-restore') as WBStroke).color).toBe('#000')
  })

  it('redo re-applies update', () => {
    const store = useWBStore()
    seedPage(store)
    const s = makeStroke({ id: 'redo-s1', color: '#000' })
    store.addStroke(s, { skipHistory: true })
    store.updateObject('redo-s1', { color: '#fff' })
    store.undo()
    store.redo()
    expect((store.getObjectById('redo-s1') as WBStroke).color).toBe('#fff')
  })
})

// ─── A2: Lock fix ────────────────────────────────────────────────────────────

describe('A2: moveSelectedUnlocked', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('locked items not moved by moveSelectedUnlocked', () => {
    const store = useWBStore()
    seedPage(store)
    const s = makeStroke({ id: 'lock-mv1', locked: true, points: [{ x: 10, y: 10 }] })
    store.addStroke(s, { skipHistory: true })
    store.selectItems(['lock-mv1'])
    store.moveSelectedUnlocked(50, 50)
    const found = store.getObjectById('lock-mv1') as WBStroke
    expect(found.points[0].x).toBe(10)
    expect(found.points[0].y).toBe(10)
  })

  it('mixed selection moves only unlocked', () => {
    const store = useWBStore()
    seedPage(store)
    const locked = makeStroke({ id: 'mix-locked', locked: true, points: [{ x: 0, y: 0 }] })
    const unlocked = makeStroke({ id: 'mix-unlocked', locked: false, points: [{ x: 0, y: 0 }] })
    store.addStroke(locked, { skipHistory: true })
    store.addStroke(unlocked, { skipHistory: true })
    store.selectItems(['mix-locked', 'mix-unlocked'])
    store.moveSelectedUnlocked(100, 100)
    expect((store.getObjectById('mix-locked') as WBStroke).points[0].x).toBe(0)
    expect((store.getObjectById('mix-unlocked') as WBStroke).points[0].x).toBe(100)
  })
})

// ─── A3: Z-order ─────────────────────────────────────────────────────────────

describe('A3: Z-order actions', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('bringForward: stroke moves +1 in array', () => {
    const store = useWBStore()
    seedPage(store)
    const s1 = makeStroke({ id: 'z-s1' })
    const s2 = makeStroke({ id: 'z-s2' })
    store.addStroke(s1, { skipHistory: true })
    store.addStroke(s2, { skipHistory: true })
    store.bringForward('z-s1')
    const strokes = store.currentStrokes
    expect(strokes[1].id).toBe('z-s1')
    expect(strokes[0].id).toBe('z-s2')
  })

  it('sendBackward: stroke moves -1 in array', () => {
    const store = useWBStore()
    seedPage(store)
    const s1 = makeStroke({ id: 'zb-s1' })
    const s2 = makeStroke({ id: 'zb-s2' })
    store.addStroke(s1, { skipHistory: true })
    store.addStroke(s2, { skipHistory: true })
    store.sendBackward('zb-s2')
    const strokes = store.currentStrokes
    expect(strokes[0].id).toBe('zb-s2')
    expect(strokes[1].id).toBe('zb-s1')
  })

  it('bringToFront: stroke moves to end', () => {
    const store = useWBStore()
    seedPage(store)
    const s1 = makeStroke({ id: 'ztf-s1' })
    const s2 = makeStroke({ id: 'ztf-s2' })
    const s3 = makeStroke({ id: 'ztf-s3' })
    store.addStroke(s1, { skipHistory: true })
    store.addStroke(s2, { skipHistory: true })
    store.addStroke(s3, { skipHistory: true })
    store.bringToFront('ztf-s1')
    const strokes = store.currentStrokes
    expect(strokes[strokes.length - 1].id).toBe('ztf-s1')
  })

  it('sendToBack: stroke moves to start', () => {
    const store = useWBStore()
    seedPage(store)
    const s1 = makeStroke({ id: 'ztb-s1' })
    const s2 = makeStroke({ id: 'ztb-s2' })
    const s3 = makeStroke({ id: 'ztb-s3' })
    store.addStroke(s1, { skipHistory: true })
    store.addStroke(s2, { skipHistory: true })
    store.addStroke(s3, { skipHistory: true })
    store.sendToBack('ztb-s3')
    const strokes = store.currentStrokes
    expect(strokes[0].id).toBe('ztb-s3')
  })

  it('bringForward: no-op for last element', () => {
    const store = useWBStore()
    seedPage(store)
    const s1 = makeStroke({ id: 'noop-s1' })
    const s2 = makeStroke({ id: 'noop-s2' })
    store.addStroke(s1, { skipHistory: true })
    store.addStroke(s2, { skipHistory: true })
    const stackBefore = store.undoStack.length
    store.bringForward('noop-s2')
    expect(store.undoStack.length).toBe(stackBefore)
  })

  it('sendBackward: no-op for first element', () => {
    const store = useWBStore()
    seedPage(store)
    const s1 = makeStroke({ id: 'noop2-s1' })
    const s2 = makeStroke({ id: 'noop2-s2' })
    store.addStroke(s1, { skipHistory: true })
    store.addStroke(s2, { skipHistory: true })
    const stackBefore = store.undoStack.length
    store.sendBackward('noop2-s1')
    expect(store.undoStack.length).toBe(stackBefore)
  })

  it('z-order: undo restores original position', () => {
    const store = useWBStore()
    seedPage(store)
    const s1 = makeStroke({ id: 'zundo-s1' })
    const s2 = makeStroke({ id: 'zundo-s2' })
    const s3 = makeStroke({ id: 'zundo-s3' })
    store.addStroke(s1, { skipHistory: true })
    store.addStroke(s2, { skipHistory: true })
    store.addStroke(s3, { skipHistory: true })
    store.bringToFront('zundo-s1')
    expect(store.currentStrokes[2].id).toBe('zundo-s1')
    store.undo()
    expect(store.currentStrokes[0].id).toBe('zundo-s1')
  })
})

// ─── A4: Performance limits ──────────────────────────────────────────────────

describe('A4: Performance limits', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('objectCount: returns strokes + assets count', () => {
    const store = useWBStore()
    seedPage(store)
    store.addStroke(makeStroke(), { skipHistory: true })
    store.addAsset(makeAsset(), { skipHistory: true })
    expect(store.objectCount).toBe(2)
  })

  it('canAddObject: true when < 300', () => {
    const store = useWBStore()
    seedPage(store)
    expect(store.canAddObject).toBe(true)
  })

  it('canAddObject: false when >= 300', () => {
    const store = useWBStore()
    seedPage(store)
    const page = store.pages[0]
    const strokes: WBStroke[] = []
    for (let i = 0; i < 300; i++) {
      strokes.push(makeStroke({ id: `fill-${i}` }))
    }
    store.pages[0] = { ...page, strokes }
    expect(store.canAddObject).toBe(false)
  })

  it('addStroke: blocked when objectCount >= 300', () => {
    const store = useWBStore()
    seedPage(store)
    const page = store.pages[0]
    const strokes: WBStroke[] = []
    for (let i = 0; i < 300; i++) {
      strokes.push(makeStroke({ id: `block-${i}` }))
    }
    store.pages[0] = { ...page, strokes }
    const countBefore = store.currentStrokes.length
    store.addStroke(makeStroke({ id: 'overflow' }))
    expect(store.currentStrokes.length).toBe(countBefore)
  })

  it('addAsset: blocked when objectCount >= 300', () => {
    const store = useWBStore()
    seedPage(store)
    const page = store.pages[0]
    const strokes: WBStroke[] = []
    for (let i = 0; i < 300; i++) {
      strokes.push(makeStroke({ id: `block-a-${i}` }))
    }
    store.pages[0] = { ...page, strokes }
    const countBefore = store.currentAssets.length
    store.addAsset(makeAsset({ id: 'overflow-a' }))
    expect(store.currentAssets.length).toBe(countBefore)
  })

  it('selectItems: caps at 50 items', () => {
    const store = useWBStore()
    seedPage(store)
    const ids = Array.from({ length: 60 }, (_, i) => `sel-${i}`)
    store.selectItems(ids)
    expect(store.selectedIds.length).toBe(50)
  })

  it('addToSelection: respects 50 cap', () => {
    const store = useWBStore()
    seedPage(store)
    const ids = Array.from({ length: 50 }, (_, i) => `cap-${i}`)
    store.selectItems(ids)
    store.addToSelection('cap-extra')
    expect(store.selectedIds.length).toBe(50)
    expect(store.selectedIds).not.toContain('cap-extra')
  })

  it('isNearObjectLimit: true at 280+', () => {
    const store = useWBStore()
    seedPage(store)
    const page = store.pages[0]
    const strokes: WBStroke[] = []
    for (let i = 0; i < 280; i++) {
      strokes.push(makeStroke({ id: `near-${i}` }))
    }
    store.pages[0] = { ...page, strokes }
    expect(store.isNearObjectLimit).toBe(true)
  })
})
