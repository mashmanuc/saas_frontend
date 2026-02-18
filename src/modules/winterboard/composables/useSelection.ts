// WB: Selection composable — single, multi, lasso select
// Ref: TASK_BOARD.md B3.3, ManifestWinterboard_v2.md LAW-09
// Algorithms adapted from SOLO_v2/solo_FE/composables/useSelection.ts

import { ref, computed, type Ref } from 'vue'
import type { WBPoint, WBStroke, WBAsset } from '../types/winterboard'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WBBoundingBox {
  x: number
  y: number
  width: number
  height: number
}

export interface WBSelectableItem {
  id: string
  kind: 'stroke' | 'asset'
  bounds: WBBoundingBox
}

export interface UseSelectionOptions {
  /** Called when selection changes */
  onSelectionChange?: (ids: string[]) => void
}

// ─── Geometry utilities (pure, exported for testing) ────────────────────────

/**
 * Ray-casting point-in-polygon test.
 * Returns true if `point` is inside the closed `polygon`.
 */
export function pointInPolygon(point: WBPoint, polygon: WBPoint[]): boolean {
  if (polygon.length < 3) return false

  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y
    const xj = polygon[j].x, yj = polygon[j].y

    if (
      ((yi > point.y) !== (yj > point.y)) &&
      (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)
    ) {
      inside = !inside
    }
  }
  return inside
}

/**
 * Compute axis-aligned bounding box for a stroke from its points array.
 * Adds stroke.size/2 padding on each side.
 */
export function getStrokeBounds(stroke: WBStroke): WBBoundingBox {
  const pts = stroke.points
  if (!pts || pts.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const pt of pts) {
    if (pt.x < minX) minX = pt.x
    if (pt.y < minY) minY = pt.y
    if (pt.x > maxX) maxX = pt.x
    if (pt.y > maxY) maxY = pt.y
  }

  const pad = stroke.size / 2
  return {
    x: minX - pad,
    y: minY - pad,
    width: maxX - minX + stroke.size,
    height: maxY - minY + stroke.size,
  }
}

/**
 * Compute bounding box for an asset.
 */
export function getAssetBounds(asset: WBAsset): WBBoundingBox {
  return { x: asset.x, y: asset.y, width: asset.w, height: asset.h }
}

/**
 * Check if two axis-aligned bounding boxes overlap.
 */
export function rectsIntersect(a: WBBoundingBox, b: WBBoundingBox): boolean {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  )
}

/**
 * Check if a bounding box intersects with a lasso polygon.
 * Tests all 4 corners + center of the rect against the polygon.
 */
export function rectIntersectsPolygon(
  rect: WBBoundingBox,
  polygon: WBPoint[],
): boolean {
  const testPoints: WBPoint[] = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
    { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
  ]

  for (const pt of testPoints) {
    if (pointInPolygon(pt, polygon)) return true
  }
  return false
}

/**
 * Minimum squared distance from a point to a polyline (stroke path).
 * Used for precise hit-testing on freehand strokes.
 */
export function pointToPolylineDistSq(
  point: WBPoint,
  polyline: WBPoint[],
): number {
  if (polyline.length === 0) return Infinity
  if (polyline.length === 1) {
    const dx = point.x - polyline[0].x
    const dy = point.y - polyline[0].y
    return dx * dx + dy * dy
  }

  let minDistSq = Infinity
  for (let i = 0; i < polyline.length - 1; i++) {
    const ax = polyline[i].x, ay = polyline[i].y
    const bx = polyline[i + 1].x, by = polyline[i + 1].y
    const abx = bx - ax, aby = by - ay
    const apx = point.x - ax, apy = point.y - ay
    const abLenSq = abx * abx + aby * aby

    let t = 0
    if (abLenSq > 0) {
      t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / abLenSq))
    }

    const projX = ax + t * abx
    const projY = ay + t * aby
    const dx = point.x - projX
    const dy = point.y - projY
    const distSq = dx * dx + dy * dy

    if (distSq < minDistSq) minDistSq = distSq
  }
  return minDistSq
}

/**
 * Compute combined bounding box of multiple boxes.
 */
export function combinedBounds(boxes: WBBoundingBox[]): WBBoundingBox | null {
  if (boxes.length === 0) return null

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const b of boxes) {
    if (b.x < minX) minX = b.x
    if (b.y < minY) minY = b.y
    if (b.x + b.width > maxX) maxX = b.x + b.width
    if (b.y + b.height > maxY) maxY = b.y + b.height
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

// ─── Composable ─────────────────────────────────────────────────────────────

export function useSelection(
  strokes: Ref<WBStroke[]>,
  assets: Ref<WBAsset[]>,
  options: UseSelectionOptions = {},
) {
  // ── State ───────────────────────────────────────────────────────────────
  const selectedIds = ref<Set<string>>(new Set())

  // ── Computed ────────────────────────────────────────────────────────────

  const selectedIdsList = computed<string[]>(() => Array.from(selectedIds.value))

  const hasSelection = computed(() => selectedIds.value.size > 0)

  const selectionCount = computed(() => selectedIds.value.size)

  /** All selectable items with precomputed bounds */
  const selectableItems = computed<WBSelectableItem[]>(() => {
    const items: WBSelectableItem[] = []
    for (const s of strokes.value) {
      items.push({ id: s.id, kind: 'stroke', bounds: getStrokeBounds(s) })
    }
    for (const a of assets.value) {
      items.push({ id: a.id, kind: 'asset', bounds: getAssetBounds(a) })
    }
    return items
  })

  /** Combined bounding box of all selected items */
  const selectionBounds = computed<WBBoundingBox | null>(() => {
    const boxes: WBBoundingBox[] = []
    for (const item of selectableItems.value) {
      if (selectedIds.value.has(item.id)) {
        boxes.push(item.bounds)
      }
    }
    return combinedBounds(boxes)
  })

  // ── Notify helper ──────────────────────────────────────────────────────

  function notifyChange(): void {
    options.onSelectionChange?.(Array.from(selectedIds.value))
  }

  // ── Actions ────────────────────────────────────────────────────────────

  /** Select a single item by id (replaces current selection) */
  function selectById(id: string): void {
    selectedIds.value = new Set([id])
    notifyChange()
  }

  /** Add an item to the current selection (Shift+click) */
  function addToSelection(id: string): void {
    const next = new Set(selectedIds.value)
    next.add(id)
    selectedIds.value = next
    notifyChange()
  }

  /** Toggle an item in/out of selection (Shift+click) */
  function toggleSelection(id: string): void {
    const next = new Set(selectedIds.value)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    selectedIds.value = next
    notifyChange()
  }

  /** Clear all selection */
  function deselectAll(): void {
    if (selectedIds.value.size === 0) return
    selectedIds.value = new Set()
    notifyChange()
  }

  /** Select all items on the current page */
  function selectAll(): void {
    const all = new Set<string>()
    for (const s of strokes.value) all.add(s.id)
    for (const a of assets.value) all.add(a.id)
    selectedIds.value = all
    notifyChange()
  }

  /**
   * Hit-test: find the topmost item at a given point.
   * For strokes: checks if point is within stroke.size/2 distance of the polyline.
   * For assets: checks if point is inside the asset bounding box.
   * Returns the item id or null.
   */
  function hitTest(point: WBPoint): string | null {
    // Check assets first (they render on top)
    for (let i = assets.value.length - 1; i >= 0; i--) {
      const a = assets.value[i]
      const b = getAssetBounds(a)
      if (
        point.x >= b.x && point.x <= b.x + b.width &&
        point.y >= b.y && point.y <= b.y + b.height
      ) {
        return a.id
      }
    }

    // Check strokes (reverse order = topmost first)
    for (let i = strokes.value.length - 1; i >= 0; i--) {
      const s = strokes.value[i]
      if (s.tool === 'eraser') continue // eraser strokes are not selectable

      const threshold = Math.max(s.size / 2, 5) // min 5px for thin strokes
      const distSq = pointToPolylineDistSq(point, s.points)
      if (distSq <= threshold * threshold) {
        return s.id
      }
    }

    return null
  }

  /**
   * Lasso select: select all items whose bounding box intersects the lasso polygon.
   * @param polygon - Array of points forming the lasso path (closed automatically)
   * @param additive - If true, adds to current selection instead of replacing
   */
  function lassoSelect(polygon: WBPoint[], additive = false): void {
    if (polygon.length < 3) return

    const hits = new Set<string>(additive ? selectedIds.value : [])

    for (const item of selectableItems.value) {
      // Skip eraser strokes
      const stroke = strokes.value.find((s) => s.id === item.id)
      if (stroke?.tool === 'eraser') continue

      if (rectIntersectsPolygon(item.bounds, polygon)) {
        hits.add(item.id)
      }
    }

    selectedIds.value = hits
    notifyChange()
  }

  /**
   * Rectangle select: select all items whose bounding box intersects the selection rect.
   * @param rect - Selection rectangle
   * @param additive - If true, adds to current selection
   */
  function rectSelect(rect: WBBoundingBox, additive = false): void {
    const hits = new Set<string>(additive ? selectedIds.value : [])

    for (const item of selectableItems.value) {
      const stroke = strokes.value.find((s) => s.id === item.id)
      if (stroke?.tool === 'eraser') continue

      if (rectsIntersect(item.bounds, rect)) {
        hits.add(item.id)
      }
    }

    selectedIds.value = hits
    notifyChange()
  }

  // ── Public API ─────────────────────────────────────────────────────────

  return {
    // State
    selectedIds,
    selectedIdsList,
    hasSelection,
    selectionCount,
    selectionBounds,
    selectableItems,

    // Actions
    selectById,
    addToSelection,
    toggleSelection,
    deselectAll,
    selectAll,
    hitTest,
    lassoSelect,
    rectSelect,
  }
}
