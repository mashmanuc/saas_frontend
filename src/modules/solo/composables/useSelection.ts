import { ref, computed, Ref } from 'vue'
import type { Stroke, Shape, TextElement, Point } from '../types/solo'

export type SelectionMode = 'none' | 'lasso' | 'rect' | 'move' | 'resize'
export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | null

export interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}

export interface SelectionState {
  selectedIds: Set<string>
  mode: SelectionMode
  lassoPoints: Point[]
  selectionRect: { x: number; y: number; w: number; h: number } | null
  resizeHandle: ResizeHandle
  moveStart: Point | null
  initialBounds: Map<string, BoundingBox>
}

export interface SelectableItem {
  id: string
  type: 'stroke' | 'shape' | 'text'
  bounds: BoundingBox
  data: Stroke | Shape | TextElement
}

export interface UseSelectionOptions {
  gridSize?: number
  snapEnabled?: boolean
  onItemsUpdate?: (updates: Array<{ id: string; type: 'stroke' | 'shape' | 'text'; changes: Partial<BoundingBox> }>) => void
}

// Utility: Check if point is inside polygon (lasso)
function pointInPolygon(point: Point, polygon: Point[]): boolean {
  if (polygon.length < 3) return false

  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y
    const xj = polygon[j].x, yj = polygon[j].y

    if (((yi > point.y) !== (yj > point.y)) &&
        (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
      inside = !inside
    }
  }
  return inside
}

// Utility: Check if rect intersects with polygon
function rectIntersectsPolygon(rect: BoundingBox, polygon: Point[]): boolean {
  // Check if any corner of rect is inside polygon
  const corners: Point[] = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ]

  for (const corner of corners) {
    if (pointInPolygon(corner, polygon)) return true
  }

  // Check if rect center is inside polygon
  const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
  if (pointInPolygon(center, polygon)) return true

  return false
}

// Utility: Check if two rects intersect
function rectsIntersect(a: BoundingBox, b: BoundingBox): boolean {
  return !(a.x + a.width < b.x ||
           b.x + b.width < a.x ||
           a.y + a.height < b.y ||
           b.y + b.height < a.y)
}

// Utility: Get bounding box for stroke
function getStrokeBounds(stroke: Stroke): BoundingBox {
  if (!stroke.points || stroke.points.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

  for (const pt of stroke.points) {
    minX = Math.min(minX, pt.x)
    minY = Math.min(minY, pt.y)
    maxX = Math.max(maxX, pt.x)
    maxY = Math.max(maxY, pt.y)
  }

  // Add stroke size padding
  const padding = stroke.size / 2
  return {
    x: minX - padding,
    y: minY - padding,
    width: maxX - minX + stroke.size,
    height: maxY - minY + stroke.size,
  }
}

// Utility: Get bounding box for shape
function getShapeBounds(shape: Shape): BoundingBox {
  if (shape.type === 'circle') {
    const radius = shape.radius || 0
    return {
      x: (shape.x || 0) - radius,
      y: (shape.y || 0) - radius,
      width: radius * 2,
      height: radius * 2,
    }
  }

  if (shape.type === 'line' || shape.type === 'arrow') {
    const x1 = shape.startX || 0
    const y1 = shape.startY || 0
    const x2 = shape.endX || 0
    const y2 = shape.endY || 0
    const padding = shape.size / 2
    return {
      x: Math.min(x1, x2) - padding,
      y: Math.min(y1, y2) - padding,
      width: Math.abs(x2 - x1) + shape.size,
      height: Math.abs(y2 - y1) + shape.size,
    }
  }

  // Rectangle
  return {
    x: shape.x || 0,
    y: shape.y || 0,
    width: shape.width || 0,
    height: shape.height || 0,
  }
}

// Utility: Get bounding box for text element
function getTextBounds(text: TextElement): BoundingBox {
  return {
    x: text.x,
    y: text.y,
    width: text.width || 100,
    height: text.height || text.fontSize * 1.5,
  }
}

export function useSelection(
  strokes: Ref<Stroke[]>,
  shapes: Ref<Shape[]>,
  texts: Ref<TextElement[]>,
  options: UseSelectionOptions = {}
) {
  const { gridSize = 10, snapEnabled = true, onItemsUpdate } = options

  // State
  const selectedIds = ref<Set<string>>(new Set())
  const mode = ref<SelectionMode>('none')
  const lassoPoints = ref<Point[]>([])
  const selectionRect = ref<{ x: number; y: number; w: number; h: number } | null>(null)
  const resizeHandle = ref<ResizeHandle>(null)
  const moveStart = ref<Point | null>(null)
  const initialBounds = ref<Map<string, BoundingBox>>(new Map())
  const initialPositions = ref<Map<string, { x: number; y: number }>>(new Map())

  // Get all selectable items with their bounds
  const selectableItems = computed<SelectableItem[]>(() => {
    const items: SelectableItem[] = []

    for (const stroke of strokes.value) {
      items.push({
        id: stroke.id,
        type: 'stroke',
        bounds: getStrokeBounds(stroke),
        data: stroke,
      })
    }

    for (const shape of shapes.value) {
      items.push({
        id: shape.id,
        type: 'shape',
        bounds: getShapeBounds(shape),
        data: shape,
      })
    }

    for (const text of texts.value) {
      items.push({
        id: text.id,
        type: 'text',
        bounds: getTextBounds(text),
        data: text,
      })
    }

    return items
  })

  // Selected items
  const selectedItems = computed(() => {
    return selectableItems.value.filter(item => selectedIds.value.has(item.id))
  })

  // Combined bounding box of all selected items
  const boundingBox = computed<BoundingBox | null>(() => {
    const items = selectedItems.value
    if (items.length === 0) return null

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

    for (const item of items) {
      minX = Math.min(minX, item.bounds.x)
      minY = Math.min(minY, item.bounds.y)
      maxX = Math.max(maxX, item.bounds.x + item.bounds.width)
      maxY = Math.max(maxY, item.bounds.y + item.bounds.height)
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    }
  })

  // 8 resize handles positions
  const resizeHandles = computed(() => {
    const box = boundingBox.value
    if (!box) return []

    const size = 8
    const half = size / 2

    return [
      { id: 'nw', x: box.x - half, y: box.y - half, cursor: 'nwse-resize' },
      { id: 'n', x: box.x + box.width / 2 - half, y: box.y - half, cursor: 'ns-resize' },
      { id: 'ne', x: box.x + box.width - half, y: box.y - half, cursor: 'nesw-resize' },
      { id: 'e', x: box.x + box.width - half, y: box.y + box.height / 2 - half, cursor: 'ew-resize' },
      { id: 'se', x: box.x + box.width - half, y: box.y + box.height - half, cursor: 'nwse-resize' },
      { id: 's', x: box.x + box.width / 2 - half, y: box.y + box.height - half, cursor: 'ns-resize' },
      { id: 'sw', x: box.x - half, y: box.y + box.height - half, cursor: 'nesw-resize' },
      { id: 'w', x: box.x - half, y: box.y + box.height / 2 - half, cursor: 'ew-resize' },
    ]
  })

  // Snap to grid utility
  function snapToGrid(value: number, disabled: boolean = false): number {
    if (!snapEnabled || disabled) return value
    return Math.round(value / gridSize) * gridSize
  }

  // Select single item
  function selectItem(id: string, addToSelection: boolean = false): void {
    if (addToSelection) {
      // Toggle selection
      if (selectedIds.value.has(id)) {
        selectedIds.value.delete(id)
      } else {
        selectedIds.value.add(id)
      }
      selectedIds.value = new Set(selectedIds.value)
    } else {
      selectedIds.value = new Set([id])
    }
  }

  // Deselect all
  function deselectAll(): void {
    selectedIds.value = new Set()
    mode.value = 'none'
    lassoPoints.value = []
    selectionRect.value = null
    resizeHandle.value = null
    moveStart.value = null
  }

  // Check if item is selected
  function isSelected(id: string): boolean {
    return selectedIds.value.has(id)
  }

  // Start lasso selection
  function startLassoSelection(point: Point): void {
    mode.value = 'lasso'
    lassoPoints.value = [point]
  }

  // Update lasso selection
  function updateLassoSelection(point: Point): void {
    if (mode.value !== 'lasso') return
    lassoPoints.value.push(point)
  }

  // End lasso selection
  function endLassoSelection(addToSelection: boolean = false): void {
    if (mode.value !== 'lasso' || lassoPoints.value.length < 3) {
      mode.value = 'none'
      lassoPoints.value = []
      return
    }

    // Find items that intersect with lasso polygon
    const newSelection = new Set(addToSelection ? selectedIds.value : [])

    for (const item of selectableItems.value) {
      if (rectIntersectsPolygon(item.bounds, lassoPoints.value)) {
        if (addToSelection && newSelection.has(item.id)) {
          newSelection.delete(item.id) // Toggle off if already selected
        } else {
          newSelection.add(item.id)
        }
      }
    }

    selectedIds.value = newSelection
    mode.value = 'none'
    lassoPoints.value = []
  }

  // Start rectangle selection
  function startRectSelection(point: Point): void {
    mode.value = 'rect'
    selectionRect.value = { x: point.x, y: point.y, w: 0, h: 0 }
  }

  // Update rectangle selection
  function updateRectSelection(point: Point, startPoint: Point): void {
    if (mode.value !== 'rect') return
    selectionRect.value = {
      x: Math.min(startPoint.x, point.x),
      y: Math.min(startPoint.y, point.y),
      w: Math.abs(point.x - startPoint.x),
      h: Math.abs(point.y - startPoint.y),
    }
  }

  // End rectangle selection
  function endRectSelection(addToSelection: boolean = false): void {
    if (mode.value !== 'rect' || !selectionRect.value) {
      mode.value = 'none'
      selectionRect.value = null
      return
    }

    const rect: BoundingBox = {
      x: selectionRect.value.x,
      y: selectionRect.value.y,
      width: selectionRect.value.w,
      height: selectionRect.value.h,
    }

    // Find items that intersect with selection rectangle
    const newSelection = new Set(addToSelection ? selectedIds.value : [])

    for (const item of selectableItems.value) {
      if (rectsIntersect(item.bounds, rect)) {
        if (addToSelection && newSelection.has(item.id)) {
          newSelection.delete(item.id)
        } else {
          newSelection.add(item.id)
        }
      }
    }

    selectedIds.value = newSelection
    mode.value = 'none'
    selectionRect.value = null
  }

  // Start move operation
  function startMove(point: Point): void {
    if (selectedIds.value.size === 0) return

    mode.value = 'move'
    moveStart.value = point

    // Store initial positions
    initialPositions.value = new Map()
    for (const item of selectedItems.value) {
      if (item.type === 'stroke') {
        const stroke = item.data as Stroke
        // Store first point as reference
        if (stroke.points.length > 0) {
          initialPositions.value.set(item.id, { x: stroke.points[0].x, y: stroke.points[0].y })
        }
      } else if (item.type === 'shape') {
        const shape = item.data as Shape
        if (shape.type === 'circle') {
          initialPositions.value.set(item.id, { x: shape.x || 0, y: shape.y || 0 })
        } else if (shape.type === 'line' || shape.type === 'arrow') {
          initialPositions.value.set(item.id, { x: shape.startX || 0, y: shape.startY || 0 })
        } else {
          initialPositions.value.set(item.id, { x: shape.x || 0, y: shape.y || 0 })
        }
      } else if (item.type === 'text') {
        const text = item.data as TextElement
        initialPositions.value.set(item.id, { x: text.x, y: text.y })
      }
    }

    // Store initial bounds
    initialBounds.value = new Map()
    for (const item of selectedItems.value) {
      initialBounds.value.set(item.id, { ...item.bounds })
    }
  }

  // Calculate move updates without applying them
  function calculateMoveUpdates(point: Point, disableSnap: boolean = false): Array<{ id: string; type: 'stroke' | 'shape' | 'text'; changes: any }> {
    if (mode.value !== 'move' || !moveStart.value) return []

    let dx = point.x - moveStart.value.x
    let dy = point.y - moveStart.value.y

    // Snap to grid
    if (!disableSnap && snapEnabled) {
      dx = snapToGrid(dx, disableSnap)
      dy = snapToGrid(dy, disableSnap)
    }

    const updates: Array<{ id: string; type: 'stroke' | 'shape' | 'text'; changes: any }> = []

    for (const item of selectedItems.value) {
      const initialPos = initialPositions.value.get(item.id)
      if (!initialPos) continue

      if (item.type === 'stroke') {
        const stroke = item.data as Stroke
        // Move all points
        const newPoints = stroke.points.map(pt => ({
          x: pt.x + dx,
          y: pt.y + dy,
        }))
        updates.push({ id: item.id, type: 'stroke', changes: { points: newPoints } })
      } else if (item.type === 'shape') {
        const shape = item.data as Shape
        if (shape.type === 'circle') {
          updates.push({
            id: item.id,
            type: 'shape',
            changes: { x: initialPos.x + dx, y: initialPos.y + dy },
          })
        } else if (shape.type === 'line' || shape.type === 'arrow') {
          const initialEnd = { x: shape.endX || 0, y: shape.endY || 0 }
          updates.push({
            id: item.id,
            type: 'shape',
            changes: {
              startX: initialPos.x + dx,
              startY: initialPos.y + dy,
              endX: initialEnd.x + dx,
              endY: initialEnd.y + dy,
            },
          })
        } else {
          updates.push({
            id: item.id,
            type: 'shape',
            changes: { x: initialPos.x + dx, y: initialPos.y + dy },
          })
        }
      } else if (item.type === 'text') {
        updates.push({
          id: item.id,
          type: 'text',
          changes: { x: initialPos.x + dx, y: initialPos.y + dy },
        })
      }
    }

    return updates
  }

  // End move operation
  function endMove(point: Point, disableSnap: boolean = false): Array<{ id: string; type: 'stroke' | 'shape' | 'text'; changes: any }> {
    const updates = calculateMoveUpdates(point, disableSnap)

    mode.value = 'none'
    moveStart.value = null
    initialPositions.value = new Map()

    if (updates.length > 0 && onItemsUpdate) {
      onItemsUpdate(updates)
    }

    return updates
  }

  // Start resize operation
  function startResize(handle: ResizeHandle, point: Point): void {
    if (selectedIds.value.size === 0 || !handle) return

    mode.value = 'resize'
    resizeHandle.value = handle
    moveStart.value = point

    // Store initial bounds
    initialBounds.value = new Map()
    for (const item of selectedItems.value) {
      initialBounds.value.set(item.id, { ...item.bounds })
    }
  }

  // Calculate resize updates
  function calculateResizeUpdates(
    point: Point,
    maintainAspect: boolean = false,
    fromCenter: boolean = false
  ): Array<{ id: string; type: 'stroke' | 'shape' | 'text'; changes: any }> {
    if (mode.value !== 'resize' || !moveStart.value || !resizeHandle.value || !boundingBox.value) {
      return []
    }

    const box = boundingBox.value
    const handle = resizeHandle.value
    const dx = point.x - moveStart.value.x
    const dy = point.y - moveStart.value.y

    // Calculate new bounding box based on handle
    let newBox = { ...box }

    switch (handle) {
      case 'nw':
        newBox.x += dx
        newBox.y += dy
        newBox.width -= dx
        newBox.height -= dy
        break
      case 'n':
        newBox.y += dy
        newBox.height -= dy
        break
      case 'ne':
        newBox.y += dy
        newBox.width += dx
        newBox.height -= dy
        break
      case 'e':
        newBox.width += dx
        break
      case 'se':
        newBox.width += dx
        newBox.height += dy
        break
      case 's':
        newBox.height += dy
        break
      case 'sw':
        newBox.x += dx
        newBox.width -= dx
        newBox.height += dy
        break
      case 'w':
        newBox.x += dx
        newBox.width -= dx
        break
    }

    // Maintain aspect ratio if Shift is pressed
    if (maintainAspect && box.width > 0 && box.height > 0) {
      const aspect = box.width / box.height
      if (['nw', 'ne', 'sw', 'se'].includes(handle)) {
        const newAspect = newBox.width / newBox.height
        if (newAspect > aspect) {
          newBox.height = newBox.width / aspect
        } else {
          newBox.width = newBox.height * aspect
        }
      }
    }

    // Resize from center if Alt is pressed
    if (fromCenter) {
      const centerX = box.x + box.width / 2
      const centerY = box.y + box.height / 2
      newBox.x = centerX - newBox.width / 2
      newBox.y = centerY - newBox.height / 2
    }

    // Prevent negative dimensions
    if (newBox.width < 10) newBox.width = 10
    if (newBox.height < 10) newBox.height = 10

    // Calculate scale factors
    const scaleX = newBox.width / box.width
    const scaleY = newBox.height / box.height

    const updates: Array<{ id: string; type: 'stroke' | 'shape' | 'text'; changes: any }> = []

    for (const item of selectedItems.value) {
      const initialBox = initialBounds.value.get(item.id)
      if (!initialBox) continue

      // Calculate new position relative to selection bounding box
      const relX = (initialBox.x - box.x) / box.width
      const relY = (initialBox.y - box.y) / box.height
      const relW = initialBox.width / box.width
      const relH = initialBox.height / box.height

      const newItemX = newBox.x + relX * newBox.width
      const newItemY = newBox.y + relY * newBox.height
      const newItemW = relW * newBox.width
      const newItemH = relH * newBox.height

      if (item.type === 'shape') {
        const shape = item.data as Shape
        if (shape.type === 'circle') {
          // For circles, use average of width/height for radius
          const newRadius = Math.min(newItemW, newItemH) / 2
          updates.push({
            id: item.id,
            type: 'shape',
            changes: {
              x: newItemX + newItemW / 2,
              y: newItemY + newItemH / 2,
              radius: newRadius,
            },
          })
        } else if (shape.type === 'rectangle') {
          updates.push({
            id: item.id,
            type: 'shape',
            changes: {
              x: newItemX,
              y: newItemY,
              width: newItemW,
              height: newItemH,
            },
          })
        } else if (shape.type === 'line' || shape.type === 'arrow') {
          // Scale line endpoints
          const startX = shape.startX || 0
          const startY = shape.startY || 0
          const endX = shape.endX || 0
          const endY = shape.endY || 0

          const relStartX = (startX - box.x) / box.width
          const relStartY = (startY - box.y) / box.height
          const relEndX = (endX - box.x) / box.width
          const relEndY = (endY - box.y) / box.height

          updates.push({
            id: item.id,
            type: 'shape',
            changes: {
              startX: newBox.x + relStartX * newBox.width,
              startY: newBox.y + relStartY * newBox.height,
              endX: newBox.x + relEndX * newBox.width,
              endY: newBox.y + relEndY * newBox.height,
            },
          })
        }
      } else if (item.type === 'text') {
        updates.push({
          id: item.id,
          type: 'text',
          changes: {
            x: newItemX,
            y: newItemY,
            width: newItemW,
            height: newItemH,
          },
        })
      } else if (item.type === 'stroke') {
        // Scale stroke points
        const stroke = item.data as Stroke
        const newPoints = stroke.points.map(pt => {
          const relPtX = (pt.x - box.x) / box.width
          const relPtY = (pt.y - box.y) / box.height
          return {
            x: newBox.x + relPtX * newBox.width,
            y: newBox.y + relPtY * newBox.height,
          }
        })
        updates.push({
          id: item.id,
          type: 'stroke',
          changes: { points: newPoints },
        })
      }
    }

    return updates
  }

  // End resize operation
  function endResize(
    point: Point,
    maintainAspect: boolean = false,
    fromCenter: boolean = false
  ): Array<{ id: string; type: 'stroke' | 'shape' | 'text'; changes: any }> {
    const updates = calculateResizeUpdates(point, maintainAspect, fromCenter)

    mode.value = 'none'
    resizeHandle.value = null
    moveStart.value = null
    initialBounds.value = new Map()

    if (updates.length > 0 && onItemsUpdate) {
      onItemsUpdate(updates)
    }

    return updates
  }

  // Check if point is over a resize handle
  function getHandleAtPoint(point: Point): ResizeHandle {
    const handles = resizeHandles.value
    const hitSize = 12 // Larger hit area

    for (const handle of handles) {
      if (point.x >= handle.x - hitSize / 2 &&
          point.x <= handle.x + hitSize + hitSize / 2 &&
          point.y >= handle.y - hitSize / 2 &&
          point.y <= handle.y + hitSize + hitSize / 2) {
        return handle.id as ResizeHandle
      }
    }
    return null
  }

  // Check if point is inside bounding box (for move)
  function isPointInBoundingBox(point: Point): boolean {
    const box = boundingBox.value
    if (!box) return false

    return point.x >= box.x &&
           point.x <= box.x + box.width &&
           point.y >= box.y &&
           point.y <= box.y + box.height
  }

  // Get item at point (for single click selection)
  function getItemAtPoint(point: Point): SelectableItem | null {
    // Check in reverse order (top items first)
    const items = [...selectableItems.value].reverse()

    for (const item of items) {
      const bounds = item.bounds
      if (point.x >= bounds.x &&
          point.x <= bounds.x + bounds.width &&
          point.y >= bounds.y &&
          point.y <= bounds.y + bounds.height) {
        return item
      }
    }
    return null
  }

  // Select all items
  function selectAll(): void {
    selectedIds.value = new Set(selectableItems.value.map(item => item.id))
  }

  // Delete selected items (returns IDs to delete)
  function deleteSelected(): { strokes: string[]; shapes: string[]; texts: string[] } {
    const result = { strokes: [] as string[], shapes: [] as string[], texts: [] as string[] }

    for (const item of selectedItems.value) {
      if (item.type === 'stroke') result.strokes.push(item.id)
      else if (item.type === 'shape') result.shapes.push(item.id)
      else if (item.type === 'text') result.texts.push(item.id)
    }

    deselectAll()
    return result
  }

  return {
    // State
    selectedIds,
    mode,
    lassoPoints,
    selectionRect,
    resizeHandle,

    // Computed
    selectableItems,
    selectedItems,
    boundingBox,
    resizeHandles,

    // Methods
    selectItem,
    deselectAll,
    isSelected,
    selectAll,
    deleteSelected,

    // Lasso selection
    startLassoSelection,
    updateLassoSelection,
    endLassoSelection,

    // Rectangle selection
    startRectSelection,
    updateRectSelection,
    endRectSelection,

    // Move
    startMove,
    calculateMoveUpdates,
    endMove,

    // Resize
    startResize,
    calculateResizeUpdates,
    endResize,

    // Hit testing
    getHandleAtPoint,
    isPointInBoundingBox,
    getItemAtPoint,
  }
}

export default useSelection
