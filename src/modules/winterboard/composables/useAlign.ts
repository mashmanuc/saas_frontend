// WB5: Align composable — alignment and distribution tools for multi-select
// Ref: TASK_BOARD_V5.md A6

import { computed } from 'vue'
import type { WBStroke, WBAsset } from '../types/winterboard'
import type { useWBStore } from '../board/state/boardStore'

// ─── Types ───────────────────────────────────────────────────────────────────

type WBStore = ReturnType<typeof useWBStore>

export interface BBox {
  id: string
  x: number
  y: number
  width: number
  height: number
  right: number
  bottom: number
  centerX: number
  centerY: number
}

// ─── Composable ──────────────────────────────────────────────────────────────

export function useAlign(store: WBStore) {
  /**
   * Get bounding box for a stroke (from points min/max).
   */
  function getStrokeBBox(stroke: WBStroke): BBox {
    const points = stroke.points ?? []
    if (points.length === 0) {
      return { id: stroke.id, x: 0, y: 0, width: 0, height: 0, right: 0, bottom: 0, centerX: 0, centerY: 0 }
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const p of points) {
      if (p.x < minX) minX = p.x
      if (p.y < minY) minY = p.y
      if (p.x > maxX) maxX = p.x
      if (p.y > maxY) maxY = p.y
    }
    const width = maxX - minX
    const height = maxY - minY
    return {
      id: stroke.id,
      x: minX, y: minY, width, height,
      right: maxX, bottom: maxY,
      centerX: minX + width / 2,
      centerY: minY + height / 2,
    }
  }

  /**
   * Get bounding box for an asset (from x, y, w, h).
   */
  function getAssetBBox(asset: WBAsset): BBox {
    const x = asset.x ?? 0
    const y = asset.y ?? 0
    const w = asset.w ?? 0
    const h = asset.h ?? 0
    return {
      id: asset.id,
      x, y, width: w, height: h,
      right: x + w, bottom: y + h,
      centerX: x + w / 2, centerY: y + h / 2,
    }
  }

  /**
   * Get bounding box for any item (stroke or asset).
   */
  function getBBox(item: WBStroke | WBAsset): BBox {
    if ('w' in item && 'h' in item) {
      return getAssetBBox(item as WBAsset)
    }
    return getStrokeBBox(item as WBStroke)
  }

  /**
   * Get all selected items with their bounding boxes.
   * Excludes locked items from alignment (but they are still used for reference calculations).
   */
  function getSelectedBBoxes(): BBox[] {
    const page = store.currentPage
    if (!page) return []
    const ids = new Set(store.selectedIds)
    const items: (WBStroke | WBAsset)[] = [
      ...page.strokes.filter((s) => ids.has(s.id)),
      ...page.assets.filter((a) => ids.has(a.id)),
    ]
    return items.map(getBBox)
  }

  /**
   * Get bounding boxes for movable (unlocked) selected items only.
   */
  function getMovableBBoxes(): BBox[] {
    const page = store.currentPage
    if (!page) return []
    const ids = new Set(store.selectedIds)
    const items: (WBStroke | WBAsset)[] = [
      ...page.strokes.filter((s) => ids.has(s.id) && !s.locked),
      ...page.assets.filter((a) => ids.has(a.id) && !a.locked),
    ]
    return items.map(getBBox)
  }

  // === Alignment functions ===

  function alignLeft(): void {
    const allBBoxes = getSelectedBBoxes()
    if (allBBoxes.length < 2) return
    const movable = getMovableBBoxes()
    if (movable.length === 0) return
    const minX = Math.min(...allBBoxes.map((b) => b.x))
    const moves = movable
      .map((b) => ({ id: b.id, dx: minX - b.x, dy: 0 }))
      .filter((m) => m.dx !== 0)
    if (moves.length > 0) store.applyAlign(moves)
  }

  function alignCenter(): void {
    const allBBoxes = getSelectedBBoxes()
    if (allBBoxes.length < 2) return
    const movable = getMovableBBoxes()
    if (movable.length === 0) return
    const allMinX = Math.min(...allBBoxes.map((b) => b.x))
    const allMaxX = Math.max(...allBBoxes.map((b) => b.right))
    const centerX = (allMinX + allMaxX) / 2
    const moves = movable
      .map((b) => ({ id: b.id, dx: centerX - b.centerX, dy: 0 }))
      .filter((m) => m.dx !== 0)
    if (moves.length > 0) store.applyAlign(moves)
  }

  function alignRight(): void {
    const allBBoxes = getSelectedBBoxes()
    if (allBBoxes.length < 2) return
    const movable = getMovableBBoxes()
    if (movable.length === 0) return
    const maxRight = Math.max(...allBBoxes.map((b) => b.right))
    const moves = movable
      .map((b) => ({ id: b.id, dx: maxRight - b.right, dy: 0 }))
      .filter((m) => m.dx !== 0)
    if (moves.length > 0) store.applyAlign(moves)
  }

  function alignTop(): void {
    const allBBoxes = getSelectedBBoxes()
    if (allBBoxes.length < 2) return
    const movable = getMovableBBoxes()
    if (movable.length === 0) return
    const minY = Math.min(...allBBoxes.map((b) => b.y))
    const moves = movable
      .map((b) => ({ id: b.id, dx: 0, dy: minY - b.y }))
      .filter((m) => m.dy !== 0)
    if (moves.length > 0) store.applyAlign(moves)
  }

  function alignMiddle(): void {
    const allBBoxes = getSelectedBBoxes()
    if (allBBoxes.length < 2) return
    const movable = getMovableBBoxes()
    if (movable.length === 0) return
    const allMinY = Math.min(...allBBoxes.map((b) => b.y))
    const allMaxY = Math.max(...allBBoxes.map((b) => b.bottom))
    const centerY = (allMinY + allMaxY) / 2
    const moves = movable
      .map((b) => ({ id: b.id, dx: 0, dy: centerY - b.centerY }))
      .filter((m) => m.dy !== 0)
    if (moves.length > 0) store.applyAlign(moves)
  }

  function alignBottom(): void {
    const allBBoxes = getSelectedBBoxes()
    if (allBBoxes.length < 2) return
    const movable = getMovableBBoxes()
    if (movable.length === 0) return
    const maxBottom = Math.max(...allBBoxes.map((b) => b.bottom))
    const moves = movable
      .map((b) => ({ id: b.id, dx: 0, dy: maxBottom - b.bottom }))
      .filter((m) => m.dy !== 0)
    if (moves.length > 0) store.applyAlign(moves)
  }

  // === Distribution functions (require 3+ items) ===

  function distributeHorizontal(): void {
    const allBBoxes = getSelectedBBoxes()
    if (allBBoxes.length < 3) return
    const movable = getMovableBBoxes()
    if (movable.length < 2) return

    // Sort ALL by X for reference frame
    const sorted = [...allBBoxes].sort((a, b) => a.x - b.x)
    const totalWidth = sorted[sorted.length - 1].right - sorted[0].x
    const totalItemWidth = sorted.reduce((sum, b) => sum + b.width, 0)
    const totalGap = totalWidth - totalItemWidth
    const gap = totalGap / (sorted.length - 1)

    // Calculate target positions
    const targetX = new Map<string, number>()
    let currentX = sorted[0].x
    for (const bbox of sorted) {
      targetX.set(bbox.id, currentX)
      currentX += bbox.width + gap
    }

    // Build moves for movable items only
    const movableSet = new Set(movable.map((b) => b.id))
    const moves: Array<{ id: string; dx: number; dy: number }> = []
    for (const bbox of allBBoxes) {
      if (!movableSet.has(bbox.id)) continue
      const tx = targetX.get(bbox.id) ?? bbox.x
      const dx = tx - bbox.x
      if (dx !== 0) moves.push({ id: bbox.id, dx, dy: 0 })
    }

    if (moves.length > 0) store.applyAlign(moves)
  }

  function distributeVertical(): void {
    const allBBoxes = getSelectedBBoxes()
    if (allBBoxes.length < 3) return
    const movable = getMovableBBoxes()
    if (movable.length < 2) return

    const sorted = [...allBBoxes].sort((a, b) => a.y - b.y)
    const totalHeight = sorted[sorted.length - 1].bottom - sorted[0].y
    const totalItemHeight = sorted.reduce((sum, b) => sum + b.height, 0)
    const totalGap = totalHeight - totalItemHeight
    const gap = totalGap / (sorted.length - 1)

    const targetY = new Map<string, number>()
    let currentY = sorted[0].y
    for (const bbox of sorted) {
      targetY.set(bbox.id, currentY)
      currentY += bbox.height + gap
    }

    const movableSet = new Set(movable.map((b) => b.id))
    const moves: Array<{ id: string; dx: number; dy: number }> = []
    for (const bbox of allBBoxes) {
      if (!movableSet.has(bbox.id)) continue
      const ty = targetY.get(bbox.id) ?? bbox.y
      const dy = ty - bbox.y
      if (dy !== 0) moves.push({ id: bbox.id, dx: 0, dy })
    }

    if (moves.length > 0) store.applyAlign(moves)
  }

  // === Computed flags ===
  const canAlign = computed(() => store.selectedIds.length >= 2)
  const canDistribute = computed(() => store.selectedIds.length >= 3)

  return {
    // Alignment
    alignLeft,
    alignCenter,
    alignRight,
    alignTop,
    alignMiddle,
    alignBottom,
    // Distribution
    distributeHorizontal,
    distributeVertical,
    // Flags
    canAlign,
    canDistribute,
    // Utilities (exported for testing)
    getBBox,
    getSelectedBBoxes,
  }
}
