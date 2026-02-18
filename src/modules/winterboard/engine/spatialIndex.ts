// WB: Grid-based spatial index for viewport culling
// Ref: TASK_BOARD.md A6.2, ManifestWinterboard_v2.md LAW-20
// Divides canvas into cells, each stroke mapped to cells it intersects.
// query(viewportRect) returns stroke IDs visible in viewport.

import type { WBStroke } from '../types/winterboard'

// ─── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_CELL_SIZE = 500 // px per grid cell

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BBox {
  x: number
  y: number
  w: number
  h: number
}

export interface ViewportRect {
  x: number
  y: number
  w: number
  h: number
}

// ─── Bounding box helpers ───────────────────────────────────────────────────

/**
 * Compute bounding box for a stroke.
 * Returns null for empty strokes.
 */
export function getStrokeBBox(stroke: WBStroke): BBox | null {
  if (stroke.tool === 'rectangle' || stroke.tool === 'circle') {
    const origin = stroke.points[0]
    if (!origin) return null
    const w = stroke.width ?? 0
    const h = stroke.height ?? 0
    // For circle, origin is center — adjust
    if (stroke.tool === 'circle') {
      return {
        x: origin.x - w,
        y: origin.y - h,
        w: w * 2,
        h: h * 2,
      }
    }
    return { x: origin.x, y: origin.y, w, h }
  }

  if (stroke.tool === 'text') {
    const origin = stroke.points[0]
    if (!origin) return null
    // Approximate text bbox — 200x40 default
    return { x: origin.x, y: origin.y, w: 200, h: 40 }
  }

  // Pen, highlighter, line, eraser — compute from points
  const pts = stroke.points
  if (pts.length === 0) return null

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const p of pts) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }

  // Add stroke size as padding
  const pad = (stroke.size ?? 2) / 2
  return {
    x: minX - pad,
    y: minY - pad,
    w: maxX - minX + pad * 2,
    h: maxY - minY + pad * 2,
  }
}

// ─── Spatial Index ──────────────────────────────────────────────────────────

export class WBSpatialIndex {
  private cellSize: number
  private grid = new Map<string, Set<string>>() // cellKey → Set<strokeId>
  private bboxes = new Map<string, BBox>()       // strokeId → bbox

  constructor(cellSize = DEFAULT_CELL_SIZE) {
    this.cellSize = cellSize
  }

  // ── Cell key helpers ────────────────────────────────────────────────────

  private cellKey(col: number, row: number): string {
    return `${col},${row}`
  }

  private getCellRange(bbox: BBox): { minCol: number; maxCol: number; minRow: number; maxRow: number } {
    return {
      minCol: Math.floor(bbox.x / this.cellSize),
      maxCol: Math.floor((bbox.x + bbox.w) / this.cellSize),
      minRow: Math.floor(bbox.y / this.cellSize),
      maxRow: Math.floor((bbox.y + bbox.h) / this.cellSize),
    }
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Add a stroke to the index.
   */
  addStroke(id: string, stroke: WBStroke): void {
    const bbox = getStrokeBBox(stroke)
    if (!bbox) return

    this.bboxes.set(id, bbox)
    const range = this.getCellRange(bbox)

    for (let col = range.minCol; col <= range.maxCol; col++) {
      for (let row = range.minRow; row <= range.maxRow; row++) {
        const key = this.cellKey(col, row)
        let cell = this.grid.get(key)
        if (!cell) {
          cell = new Set()
          this.grid.set(key, cell)
        }
        cell.add(id)
      }
    }
  }

  /**
   * Remove a stroke from the index.
   */
  removeStroke(id: string): void {
    const bbox = this.bboxes.get(id)
    if (!bbox) return

    const range = this.getCellRange(bbox)
    for (let col = range.minCol; col <= range.maxCol; col++) {
      for (let row = range.minRow; row <= range.maxRow; row++) {
        const key = this.cellKey(col, row)
        const cell = this.grid.get(key)
        if (cell) {
          cell.delete(id)
          if (cell.size === 0) this.grid.delete(key)
        }
      }
    }

    this.bboxes.delete(id)
  }

  /**
   * Query visible stroke IDs within a viewport rectangle.
   * Includes margin for smooth scrolling (strokes partially visible).
   */
  query(viewport: ViewportRect, margin = 50): Set<string> {
    const expanded: BBox = {
      x: viewport.x - margin,
      y: viewport.y - margin,
      w: viewport.w + margin * 2,
      h: viewport.h + margin * 2,
    }

    const range = this.getCellRange(expanded)
    const result = new Set<string>()

    for (let col = range.minCol; col <= range.maxCol; col++) {
      for (let row = range.minRow; row <= range.maxRow; row++) {
        const key = this.cellKey(col, row)
        const cell = this.grid.get(key)
        if (cell) {
          for (const id of cell) {
            result.add(id)
          }
        }
      }
    }

    return result
  }

  /**
   * Rebuild index from scratch with a list of strokes.
   */
  rebuild(strokes: WBStroke[]): void {
    this.clear()
    for (const stroke of strokes) {
      this.addStroke(stroke.id, stroke)
    }
  }

  /**
   * Clear entire index.
   */
  clear(): void {
    this.grid.clear()
    this.bboxes.clear()
  }

  /**
   * Get bbox for a stroke (if indexed).
   */
  getBBox(id: string): BBox | null {
    return this.bboxes.get(id) ?? null
  }

  /**
   * Number of indexed strokes.
   */
  get size(): number {
    return this.bboxes.size
  }
}
