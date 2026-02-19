// WB5: Rectangle select composable — drag selection, multi-select, move/delete group
// Ref: TASK_BOARD_V5.md A1

import { ref, computed } from 'vue'
import type { WBSelectionRect, WBStroke, WBAsset, WBPoint } from '../types/winterboard'
import type { useWBStore } from '../board/state/boardStore'

type WBStore = ReturnType<typeof useWBStore>

// ─── Bounding Box Helpers ────────────────────────────────────────────────────

export function getStrokeBBox(stroke: WBStroke): WBSelectionRect {
  if (stroke.tool === 'rectangle' || stroke.tool === 'circle') {
    const p = stroke.points[0]
    if (!p) return { x: 0, y: 0, width: 0, height: 0 }
    return {
      x: p.x,
      y: p.y,
      width: stroke.width || 0,
      height: stroke.height || 0,
    }
  }

  if (stroke.tool === 'text') {
    const p = stroke.points[0]
    if (!p) return { x: 0, y: 0, width: 0, height: 0 }
    const textLen = (stroke.text || '').length
    const estWidth = Math.max(textLen * (stroke.size || 16) * 0.6, 20)
    const estHeight = (stroke.size || 16) * 1.4
    return { x: p.x, y: p.y, width: estWidth, height: estHeight }
  }

  // pen, highlighter, line — compute from points
  if (stroke.points.length === 0) return { x: 0, y: 0, width: 0, height: 0 }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of stroke.points) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }

  // Add stroke size padding
  const pad = stroke.size / 2
  return {
    x: minX - pad,
    y: minY - pad,
    width: maxX - minX + stroke.size,
    height: maxY - minY + stroke.size,
  }
}

export function getAssetBBox(asset: WBAsset): WBSelectionRect {
  return { x: asset.x, y: asset.y, width: asset.w, height: asset.h }
}

export function rectsIntersect(a: WBSelectionRect, b: WBSelectionRect): boolean {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  )
}

// ─── Composable ──────────────────────────────────────────────────────────────

export function useRectSelect(store: WBStore) {
  const isDragging = ref(false)
  const dragStart = ref<{ x: number; y: number } | null>(null)
  const isMoving = ref(false)
  const moveStart = ref<{ x: number; y: number } | null>(null)

  const selectionRect = computed(() => store.selectionRect)
  const selectedIds = computed(() => store.selectedIds)
  const hasSelection = computed(() => store.hasSelection)

  function startRectSelect(pos: WBPoint): void {
    isDragging.value = true
    dragStart.value = { x: pos.x, y: pos.y }
    store.setSelectionRect({ x: pos.x, y: pos.y, width: 0, height: 0 })
  }

  function updateRectSelect(pos: WBPoint): void {
    if (!isDragging.value || !dragStart.value) return

    const x = Math.min(dragStart.value.x, pos.x)
    const y = Math.min(dragStart.value.y, pos.y)
    const width = Math.abs(pos.x - dragStart.value.x)
    const height = Math.abs(pos.y - dragStart.value.y)

    store.setSelectionRect({ x, y, width, height })
  }

  function finishRectSelect(): void {
    if (!isDragging.value) return
    isDragging.value = false
    dragStart.value = null

    const rect = store.selectionRect
    if (!rect || (rect.width < 3 && rect.height < 3)) {
      // Too small — treat as click on empty
      store.clearSelection()
      return
    }

    // Find all strokes/assets inside the selection rect
    const page = store.currentPage
    if (!page) {
      store.clearSelection()
      return
    }

    const ids: string[] = []

    for (const stroke of page.strokes) {
      const bbox = getStrokeBBox(stroke)
      if (rectsIntersect(rect, bbox)) {
        ids.push(stroke.id)
      }
    }

    for (const asset of page.assets) {
      const bbox = getAssetBBox(asset)
      if (rectsIntersect(rect, bbox)) {
        ids.push(asset.id)
      }
    }

    store.setSelectionRect(null)

    if (ids.length > 0) {
      store.selectItems(ids)
    } else {
      store.clearSelection()
    }
  }

  function handleClick(itemId: string, shiftKey: boolean): void {
    if (shiftKey) {
      store.toggleSelection(itemId)
    } else {
      store.selectItems([itemId])
    }
  }

  function handleClickEmpty(): void {
    store.clearSelection()
  }

  // ─── Move selected group ───────────────────────────────────────────────

  function startMoveSelected(pos: WBPoint): void {
    if (!store.hasSelection) return
    isMoving.value = true
    moveStart.value = { x: pos.x, y: pos.y }
  }

  function updateMoveSelected(pos: WBPoint): void {
    if (!isMoving.value || !moveStart.value) return

    const dx = pos.x - moveStart.value.x
    const dy = pos.y - moveStart.value.y

    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return

    store.moveSelected(dx, dy)
    moveStart.value = { x: pos.x, y: pos.y }
  }

  function finishMoveSelected(): void {
    isMoving.value = false
    moveStart.value = null
  }

  function deleteSelected(): void {
    store.deleteSelected()
  }

  return {
    // State
    isDragging,
    isMoving,
    selectionRect,
    selectedIds,
    hasSelection,

    // Rect select
    startRectSelect,
    updateRectSelect,
    finishRectSelect,

    // Click select
    handleClick,
    handleClickEmpty,

    // Move
    startMoveSelected,
    updateMoveSelected,
    finishMoveSelected,

    // Delete
    deleteSelected,
  }
}
