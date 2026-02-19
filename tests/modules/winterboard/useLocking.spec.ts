// WB5: Unit tests for useLocking composable and boardStore lock actions
// Ref: TASK_BOARD_V5.md A3

import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWBStore } from '@/modules/winterboard/board/state/boardStore'
import { useLocking } from '@/modules/winterboard/composables/useLocking'
import type { WBStroke, WBAsset } from '@/modules/winterboard/types/winterboard'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePenStroke(id: string, x1: number, y1: number, x2: number, y2: number): WBStroke {
  return {
    id,
    tool: 'pen',
    color: '#000',
    size: 2,
    opacity: 1,
    points: [
      { x: x1, y: y1, t: Date.now() },
      { x: x2, y: y2, t: Date.now() },
    ],
  }
}

function makeAsset(id: string, x: number, y: number): WBAsset {
  return {
    id,
    type: 'image',
    src: 'data:image/png;base64,test',
    x,
    y,
    w: 100,
    h: 100,
    rotation: 0,
  }
}

// ─── boardStore lock actions ─────────────────────────────────────────────────

describe('boardStore lock actions', () => {
  let store: ReturnType<typeof useWBStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useWBStore()
  })

  it('lockItems locks strokes and clears selection', () => {
    const s1 = makePenStroke('s1', 10, 10, 20, 20)
    const s2 = makePenStroke('s2', 30, 30, 40, 40)
    store.addStroke(s1)
    store.addStroke(s2)
    store.selectItems(['s1', 's2'])

    store.lockItems(['s1', 's2'], 'teacher1')

    expect(store.currentPage!.strokes[0].locked).toBe(true)
    expect(store.currentPage!.strokes[0].lockedBy).toBe('teacher1')
    expect(store.currentPage!.strokes[1].locked).toBe(true)
    // Selection should be cleared after lock
    expect(store.selectedIds).toEqual([])
  })

  it('lockItems with 0 items is noop', () => {
    store.lockItems([])
    expect(store.undoStack.length).toBe(0)
  })

  it('lockItems skips already locked items', () => {
    const s1 = makePenStroke('s1', 10, 10, 20, 20)
    store.addStroke(s1)
    store.lockItems(['s1'], 'teacher1')

    const undoLenBefore = store.undoStack.length
    store.lockItems(['s1'], 'teacher2') // already locked → noop
    expect(store.undoStack.length).toBe(undoLenBefore)
  })

  it('lockItems locks assets', () => {
    const a1 = makeAsset('a1', 50, 50)
    store.addAsset(a1)
    store.selectItems(['a1'])

    store.lockItems(['a1'], 'teacher1')

    expect(store.currentPage!.assets[0].locked).toBe(true)
    expect(store.currentPage!.assets[0].lockedBy).toBe('teacher1')
  })

  it('unlockItems unlocks strokes', () => {
    const s1 = makePenStroke('s1', 10, 10, 20, 20)
    store.addStroke(s1)
    store.lockItems(['s1'], 'teacher1')
    expect(store.currentPage!.strokes[0].locked).toBe(true)

    store.unlockItems(['s1'])
    expect(store.currentPage!.strokes[0].locked).toBe(false)
    expect(store.currentPage!.strokes[0].lockedBy).toBeUndefined()
  })

  it('unlockItems with no locked items is noop', () => {
    const s1 = makePenStroke('s1', 10, 10, 20, 20)
    store.addStroke(s1)

    const undoLenBefore = store.undoStack.length
    store.unlockItems(['s1']) // not locked → noop
    expect(store.undoStack.length).toBe(undoLenBefore)
  })

  it('isItemLocked returns correct value', () => {
    const s1 = makePenStroke('s1', 10, 10, 20, 20)
    store.addStroke(s1)

    expect(store.isItemLocked('s1')).toBe(false)
    store.lockItems(['s1'])
    expect(store.isItemLocked('s1')).toBe(true)
  })

  it('undo lockItems restores previous state', () => {
    const s1 = makePenStroke('s1', 10, 10, 20, 20)
    store.addStroke(s1)
    store.lockItems(['s1'], 'teacher1')
    expect(store.currentPage!.strokes[0].locked).toBe(true)

    store.undo()
    expect(store.currentPage!.strokes[0].locked).toBeFalsy()
    expect(store.currentPage!.strokes[0].lockedBy).toBeUndefined()
  })

  it('undo unlockItems re-locks items', () => {
    const s1 = makePenStroke('s1', 10, 10, 20, 20)
    store.addStroke(s1)
    store.lockItems(['s1'], 'teacher1')
    store.unlockItems(['s1'])
    expect(store.currentPage!.strokes[0].locked).toBe(false)

    store.undo() // undo unlock → re-lock
    expect(store.currentPage!.strokes[0].locked).toBe(true)
    expect(store.currentPage!.strokes[0].lockedBy).toBe('teacher1')
  })

  it('redo lockItems re-applies lock', () => {
    const s1 = makePenStroke('s1', 10, 10, 20, 20)
    store.addStroke(s1)
    store.lockItems(['s1'], 'teacher1')
    store.undo()
    expect(store.currentPage!.strokes[0].locked).toBeFalsy()

    store.redo()
    expect(store.currentPage!.strokes[0].locked).toBe(true)
  })

  it('redo unlockItems re-applies unlock', () => {
    const s1 = makePenStroke('s1', 10, 10, 20, 20)
    store.addStroke(s1)
    store.lockItems(['s1'], 'teacher1')
    store.unlockItems(['s1'])
    store.undo() // undo unlock → locked again
    expect(store.currentPage!.strokes[0].locked).toBe(true)

    store.redo() // redo unlock → unlocked again
    expect(store.currentPage!.strokes[0].locked).toBe(false)
  })

  it('deleteSelected skips locked items', () => {
    const s1 = makePenStroke('s1', 10, 10, 20, 20)
    const s2 = makePenStroke('s2', 30, 30, 40, 40)
    store.addStroke(s1)
    store.addStroke(s2)
    store.lockItems(['s1'])

    // Select both, but only s2 should be deletable
    store.selectItems(['s1', 's2'])
    // Filter locked before delete (as WBCanvas does)
    const unlocked = store.selectedIds.filter((id) => !store.isItemLocked(id))
    store.selectItems(unlocked)
    store.deleteSelected()

    expect(store.currentPage!.strokes).toHaveLength(1)
    expect(store.currentPage!.strokes[0].id).toBe('s1')
  })
})

// ─── useLocking composable ───────────────────────────────────────────────────

describe('useLocking composable', () => {
  let store: ReturnType<typeof useWBStore>
  let lock: ReturnType<typeof useLocking>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useWBStore()
    lock = useLocking(store)
  })

  it('lockSelected locks selected items', () => {
    const s1 = makePenStroke('ls1', 10, 10, 20, 20)
    const s2 = makePenStroke('ls2', 30, 30, 40, 40)
    store.addStroke(s1)
    store.addStroke(s2)
    store.selectItems(['ls1', 'ls2'])

    lock.lockSelected('teacher1')

    expect(store.currentPage!.strokes[0].locked).toBe(true)
    expect(store.currentPage!.strokes[1].locked).toBe(true)
    expect(store.selectedIds).toEqual([]) // cleared after lock
  })

  it('lockSelected with 0 items is noop', () => {
    lock.lockSelected()
    expect(store.undoStack.length).toBe(0)
  })

  it('isLocked returns correct value', () => {
    const s1 = makePenStroke('il1', 10, 10, 20, 20)
    store.addStroke(s1)

    expect(lock.isLocked('il1')).toBe(false)
    store.lockItems(['il1'])
    expect(lock.isLocked('il1')).toBe(true)
  })

  it('canModify returns false for locked by other, true for locked by self', () => {
    const s1 = makePenStroke('cm1', 10, 10, 20, 20)
    store.addStroke(s1)

    expect(lock.canModify('cm1', 'teacher1')).toBe(true) // not locked

    store.lockItems(['cm1'], 'teacher1')
    expect(lock.canModify('cm1', 'teacher1')).toBe(true) // locked by self
    expect(lock.canModify('cm1', 'student1')).toBe(false) // locked by other
  })

  it('lockedIds returns all locked item IDs', () => {
    const s1 = makePenStroke('li1', 10, 10, 20, 20)
    const s2 = makePenStroke('li2', 30, 30, 40, 40)
    const a1 = makeAsset('la1', 50, 50)
    store.addStroke(s1)
    store.addStroke(s2)
    store.addAsset(a1)

    expect(lock.lockedIds.value).toEqual([])

    store.lockItems(['li1', 'la1'])
    expect(lock.lockedIds.value).toContain('li1')
    expect(lock.lockedIds.value).toContain('la1')
    expect(lock.lockedIds.value).not.toContain('li2')
  })

  it('canLock is true when unlocked items selected', () => {
    const s1 = makePenStroke('cl1', 10, 10, 20, 20)
    store.addStroke(s1)

    expect(lock.canLock.value).toBe(false) // nothing selected

    store.selectItems(['cl1'])
    expect(lock.canLock.value).toBe(true)

    store.lockItems(['cl1'])
    store.selectItems(['cl1'])
    expect(lock.canLock.value).toBe(false) // already locked
  })

  it('canUnlock is true when locked items selected', () => {
    const s1 = makePenStroke('cu1', 10, 10, 20, 20)
    store.addStroke(s1)

    store.selectItems(['cu1'])
    expect(lock.canUnlock.value).toBe(false) // not locked

    store.lockItems(['cu1'])
    store.selectItems(['cu1'])
    expect(lock.canUnlock.value).toBe(true)
  })

  it('unlockSelected unlocks locked items in selection', () => {
    const s1 = makePenStroke('us1', 10, 10, 20, 20)
    store.addStroke(s1)
    store.lockItems(['us1'], 'teacher1')

    store.selectItems(['us1'])
    lock.unlockSelected()

    expect(store.currentPage!.strokes[0].locked).toBe(false)
  })
})
