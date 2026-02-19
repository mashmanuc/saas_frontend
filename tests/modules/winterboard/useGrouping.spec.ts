// WB5: Unit tests for useGrouping composable and boardStore group actions
// Ref: TASK_BOARD_V5.md A2

import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWBStore } from '@/modules/winterboard/board/state/boardStore'
import { useGrouping } from '@/modules/winterboard/composables/useGrouping'
import type { WBStroke } from '@/modules/winterboard/types/winterboard'

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

// ─── boardStore group actions ────────────────────────────────────────────────

describe('boardStore group actions', () => {
  let store: ReturnType<typeof useWBStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useWBStore()
  })

  it('createGroup with 2+ items creates a group', () => {
    const s1 = makePenStroke('s1', 10, 10, 20, 20)
    const s2 = makePenStroke('s2', 30, 30, 40, 40)
    store.addStroke(s1)
    store.addStroke(s2)

    const group = store.createGroup(['s1', 's2'])
    expect(group).not.toBeNull()
    expect(group!.itemIds).toEqual(['s1', 's2'])
    expect(store.currentPage!.groups).toHaveLength(1)
  })

  it('createGroup with 1 item returns null', () => {
    const s1 = makePenStroke('s1', 10, 10, 20, 20)
    store.addStroke(s1)

    const group = store.createGroup(['s1'])
    expect(group).toBeNull()
    expect(store.currentPage!.groups ?? []).toHaveLength(0)
  })

  it('createGroup with items already in a group returns null (no nested groups)', () => {
    const s1 = makePenStroke('s1', 10, 10, 20, 20)
    const s2 = makePenStroke('s2', 30, 30, 40, 40)
    const s3 = makePenStroke('s3', 50, 50, 60, 60)
    store.addStroke(s1)
    store.addStroke(s2)
    store.addStroke(s3)

    store.createGroup(['s1', 's2'])
    const group2 = store.createGroup(['s2', 's3'])
    expect(group2).toBeNull()
    expect(store.currentPage!.groups).toHaveLength(1)
  })

  it('deleteGroup removes the group', () => {
    const s1 = makePenStroke('s1', 10, 10, 20, 20)
    const s2 = makePenStroke('s2', 30, 30, 40, 40)
    store.addStroke(s1)
    store.addStroke(s2)

    const group = store.createGroup(['s1', 's2'])!
    expect(store.currentPage!.groups).toHaveLength(1)

    store.deleteGroup(group.id)
    expect(store.currentPage!.groups).toHaveLength(0)
  })

  it('undo createGroup removes the group', () => {
    const s1 = makePenStroke('s1', 10, 10, 20, 20)
    const s2 = makePenStroke('s2', 30, 30, 40, 40)
    store.addStroke(s1)
    store.addStroke(s2)

    store.createGroup(['s1', 's2'])
    expect(store.currentPage!.groups).toHaveLength(1)

    store.undo()
    expect(store.currentPage!.groups ?? []).toHaveLength(0)
  })

  it('undo deleteGroup restores the group', () => {
    const s1 = makePenStroke('s1', 10, 10, 20, 20)
    const s2 = makePenStroke('s2', 30, 30, 40, 40)
    store.addStroke(s1)
    store.addStroke(s2)

    const group = store.createGroup(['s1', 's2'])!
    store.deleteGroup(group.id)
    expect(store.currentPage!.groups).toHaveLength(0)

    store.undo()
    expect(store.currentPage!.groups).toHaveLength(1)
    expect(store.currentPage!.groups![0].id).toBe(group.id)
  })

  it('redo createGroup re-adds the group', () => {
    const s1 = makePenStroke('s1', 10, 10, 20, 20)
    const s2 = makePenStroke('s2', 30, 30, 40, 40)
    store.addStroke(s1)
    store.addStroke(s2)

    const group = store.createGroup(['s1', 's2'])!
    store.undo() // undo create
    expect(store.currentPage!.groups ?? []).toHaveLength(0)

    store.redo() // redo create
    expect(store.currentPage!.groups).toHaveLength(1)
    expect(store.currentPage!.groups![0].id).toBe(group.id)
  })

  it('removeItemsFromGroups removes items and auto-deletes group if < 2 items', () => {
    const s1 = makePenStroke('s1', 10, 10, 20, 20)
    const s2 = makePenStroke('s2', 30, 30, 40, 40)
    const s3 = makePenStroke('s3', 50, 50, 60, 60)
    store.addStroke(s1)
    store.addStroke(s2)
    store.addStroke(s3)

    store.createGroup(['s1', 's2', 's3'])
    expect(store.currentPage!.groups).toHaveLength(1)

    // Remove one item — group still has 2 items
    store.removeItemsFromGroups(['s1'])
    expect(store.currentPage!.groups).toHaveLength(1)
    expect(store.currentPage!.groups![0].itemIds).toEqual(['s2', 's3'])

    // Remove another — group drops to 1 item → auto-deleted
    store.removeItemsFromGroups(['s2'])
    expect(store.currentPage!.groups ?? []).toHaveLength(0)
  })

  it('removeItemsFromGroups with all items deleted auto-deletes group', () => {
    const s1 = makePenStroke('s1', 10, 10, 20, 20)
    const s2 = makePenStroke('s2', 30, 30, 40, 40)
    store.addStroke(s1)
    store.addStroke(s2)

    store.createGroup(['s1', 's2'])
    store.removeItemsFromGroups(['s1', 's2'])
    expect(store.currentPage!.groups ?? []).toHaveLength(0)
  })
})

// ─── useGrouping composable ──────────────────────────────────────────────────

describe('useGrouping composable', () => {
  let store: ReturnType<typeof useWBStore>
  let grp: ReturnType<typeof useGrouping>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useWBStore()
    grp = useGrouping(store)
  })

  it('groupSelected with 2+ selected items creates group', () => {
    const s1 = makePenStroke('g1', 10, 10, 20, 20)
    const s2 = makePenStroke('g2', 30, 30, 40, 40)
    store.addStroke(s1)
    store.addStroke(s2)
    store.selectItems(['g1', 'g2'])

    const group = grp.groupSelected()
    expect(group).not.toBeNull()
    expect(group!.itemIds).toEqual(['g1', 'g2'])
  })

  it('groupSelected with 1 item returns null', () => {
    const s1 = makePenStroke('g1', 10, 10, 20, 20)
    store.addStroke(s1)
    store.selectItems(['g1'])

    expect(grp.groupSelected()).toBeNull()
  })

  it('ungroupSelected removes groups containing selected items', () => {
    const s1 = makePenStroke('u1', 10, 10, 20, 20)
    const s2 = makePenStroke('u2', 30, 30, 40, 40)
    store.addStroke(s1)
    store.addStroke(s2)
    store.selectItems(['u1', 'u2'])

    grp.groupSelected()
    expect(store.currentPage!.groups).toHaveLength(1)

    // Select one item from the group and ungroup
    store.selectItems(['u1'])
    grp.ungroupSelected()
    expect(store.currentPage!.groups ?? []).toHaveLength(0)
  })

  it('getGroupForItem returns correct group', () => {
    const s1 = makePenStroke('f1', 10, 10, 20, 20)
    const s2 = makePenStroke('f2', 30, 30, 40, 40)
    store.addStroke(s1)
    store.addStroke(s2)
    store.selectItems(['f1', 'f2'])

    const group = grp.groupSelected()!
    expect(grp.getGroupForItem('f1')).not.toBeNull()
    expect(grp.getGroupForItem('f1')!.id).toBe(group.id)
    expect(grp.getGroupForItem('nonexistent')).toBeNull()
  })

  it('isItemInGroup returns true/false correctly', () => {
    const s1 = makePenStroke('i1', 10, 10, 20, 20)
    const s2 = makePenStroke('i2', 30, 30, 40, 40)
    const s3 = makePenStroke('i3', 50, 50, 60, 60)
    store.addStroke(s1)
    store.addStroke(s2)
    store.addStroke(s3)
    store.selectItems(['i1', 'i2'])

    grp.groupSelected()
    expect(grp.isItemInGroup('i1')).toBe(true)
    expect(grp.isItemInGroup('i2')).toBe(true)
    expect(grp.isItemInGroup('i3')).toBe(false)
  })

  it('selectGroup selects all items in the group', () => {
    const s1 = makePenStroke('sg1', 10, 10, 20, 20)
    const s2 = makePenStroke('sg2', 30, 30, 40, 40)
    store.addStroke(s1)
    store.addStroke(s2)
    store.selectItems(['sg1', 'sg2'])

    const group = grp.groupSelected()!
    store.clearSelection()
    expect(store.selectedIds).toEqual([])

    grp.selectGroup(group.id)
    expect(store.selectedIds).toContain('sg1')
    expect(store.selectedIds).toContain('sg2')
  })

  it('getGroupItems returns item IDs for a group', () => {
    const s1 = makePenStroke('gi1', 10, 10, 20, 20)
    const s2 = makePenStroke('gi2', 30, 30, 40, 40)
    store.addStroke(s1)
    store.addStroke(s2)
    store.selectItems(['gi1', 'gi2'])

    const group = grp.groupSelected()!
    expect(grp.getGroupItems(group.id)).toEqual(['gi1', 'gi2'])
    expect(grp.getGroupItems('nonexistent')).toEqual([])
  })

  it('canGroup is true when 2+ ungrouped items selected', () => {
    const s1 = makePenStroke('cg1', 10, 10, 20, 20)
    const s2 = makePenStroke('cg2', 30, 30, 40, 40)
    store.addStroke(s1)
    store.addStroke(s2)

    store.selectItems(['cg1'])
    expect(grp.canGroup.value).toBe(false) // only 1

    store.selectItems(['cg1', 'cg2'])
    expect(grp.canGroup.value).toBe(true)

    // After grouping, canGroup should be false (items already in group)
    grp.groupSelected()
    store.selectItems(['cg1', 'cg2'])
    expect(grp.canGroup.value).toBe(false)
  })

  it('canUngroup is true when selected item is in a group', () => {
    const s1 = makePenStroke('cu1', 10, 10, 20, 20)
    const s2 = makePenStroke('cu2', 30, 30, 40, 40)
    store.addStroke(s1)
    store.addStroke(s2)

    store.selectItems(['cu1', 'cu2'])
    expect(grp.canUngroup.value).toBe(false) // not grouped yet

    grp.groupSelected()
    store.selectItems(['cu1'])
    expect(grp.canUngroup.value).toBe(true)
  })
})
