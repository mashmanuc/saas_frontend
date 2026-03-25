/**
 * Phase 34 A5: Template preset generators.
 *
 * Pure functions that generate arrays of WBStroke[] for math templates.
 * Each generator returns <= 20 objects (FIX-2 rule).
 */
import type { WBStroke } from '../types/winterboard'

// ─── Helpers ─────────────────────────────────────────────────────────────────

let _idCounter = 0

function makeLine(
  prefix: string,
  x1: number, y1: number,
  x2: number, y2: number,
  color: string,
  size: number,
): WBStroke {
  const id = `${prefix}-${Date.now()}-${++_idCounter}`
  return {
    id,
    tool: 'line',
    color,
    size,
    opacity: 1,
    points: [{ x: x1, y: y1 }, { x: x2, y: y2 }],
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  }
}

function makeText(
  prefix: string,
  x: number, y: number,
  text: string,
  fontSize = 14,
  color = '#333333',
): WBStroke {
  const id = `${prefix}-${Date.now()}-${++_idCounter}`
  return {
    id,
    tool: 'text',
    color,
    size: fontSize,
    opacity: 1,
    text,
    points: [{ x, y }],
  }
}

// ─── Coordinate Plane ────────────────────────────────────────────────────────

/**
 * Generate coordinate plane: 2 axes + 4 arrows + key labels.
 * Total: ~13 objects.
 */
export function generateCoordinatePlane(options?: {
  cx?: number; cy?: number; range?: number; axisLength?: number
}): WBStroke[] {
  const cx = options?.cx ?? 400
  const cy = options?.cy ?? 300
  const range = options?.range ?? 5
  const len = options?.axisLength ?? 250

  const strokes: WBStroke[] = []
  const color = '#333333'
  const size = 2
  const arrowLen = 10

  // X axis
  strokes.push(makeLine('tmpl-cp-xaxis', cx - len, cy, cx + len, cy, color, size))
  // Y axis
  strokes.push(makeLine('tmpl-cp-yaxis', cx, cy + len, cx, cy - len, color, size))

  // X axis right arrow
  strokes.push(makeLine('tmpl-cp-xarr1', cx + len - arrowLen, cy - arrowLen / 2, cx + len, cy, color, size))
  strokes.push(makeLine('tmpl-cp-xarr2', cx + len - arrowLen, cy + arrowLen / 2, cx + len, cy, color, size))
  // Y axis top arrow
  strokes.push(makeLine('tmpl-cp-yarr1', cx - arrowLen / 2, cy - len + arrowLen, cx, cy - len, color, size))
  strokes.push(makeLine('tmpl-cp-yarr2', cx + arrowLen / 2, cy - len + arrowLen, cx, cy - len, color, size))

  // Labels
  strokes.push(makeText('tmpl-cp-0', cx - 12, cy + 4, '0'))
  strokes.push(makeText('tmpl-cp-xn', cx - len - 4, cy + 4, String(-range)))
  strokes.push(makeText('tmpl-cp-xp', cx + len - 4, cy + 4, String(range)))
  strokes.push(makeText('tmpl-cp-yn', cx - 16, cy + len - 4, String(-range)))
  strokes.push(makeText('tmpl-cp-yp', cx - 16, cy - len - 4, String(range)))
  strokes.push(makeText('tmpl-cp-xlabel', cx + len + 8, cy - 8, 'x'))
  strokes.push(makeText('tmpl-cp-ylabel', cx + 8, cy - len - 8, 'y'))

  return strokes
}

// ─── Number Line ─────────────────────────────────────────────────────────────

/**
 * Generate number line: 1 line + 2 arrows + tick marks + labels.
 * Total: ~13 objects for min=-5, max=5.
 */
export function generateNumberLine(options?: {
  cx?: number; cy?: number; min?: number; max?: number; length?: number
}): WBStroke[] {
  const cx = options?.cx ?? 400
  const cy = options?.cy ?? 300
  const min = options?.min ?? -5
  const max = options?.max ?? 5
  const totalLen = options?.length ?? 500

  const strokes: WBStroke[] = []
  const color = '#333333'
  const size = 2
  const halfLen = totalLen / 2
  const arrowLen = 10
  const tickH = 8
  const range = max - min

  // Main line
  strokes.push(makeLine('tmpl-nl-line', cx - halfLen, cy, cx + halfLen, cy, color, size))

  // Left arrow
  strokes.push(makeLine('tmpl-nl-larr1', cx - halfLen, cy, cx - halfLen + arrowLen, cy - arrowLen / 2, color, size))
  strokes.push(makeLine('tmpl-nl-larr2', cx - halfLen, cy, cx - halfLen + arrowLen, cy + arrowLen / 2, color, size))
  // Right arrow
  strokes.push(makeLine('tmpl-nl-rarr1', cx + halfLen, cy, cx + halfLen - arrowLen, cy - arrowLen / 2, color, size))
  strokes.push(makeLine('tmpl-nl-rarr2', cx + halfLen, cy, cx + halfLen - arrowLen, cy + arrowLen / 2, color, size))

  // Ticks + labels for min, 0, max
  const keyPoints = [min, 0, max]
  for (const val of keyPoints) {
    const xPos = cx + ((val - (min + max) / 2) / range) * totalLen
    strokes.push(makeLine(`tmpl-nl-tick-${val}`, xPos, cy - tickH, xPos, cy + tickH, color, 1))
    strokes.push(makeText(`tmpl-nl-label-${val}`, xPos - 4, cy + tickH + 4, String(val)))
  }

  return strokes
}

// ─── Table ───────────────────────────────────────────────────────────────────

/**
 * Generate table grid: (rows+1) horizontal + (cols+1) vertical lines.
 * Total: rows+1+cols+1 objects.
 */
export function generateTable(options?: {
  x?: number; y?: number; rows?: number; cols?: number; cellW?: number; cellH?: number
}): WBStroke[] {
  const x = options?.x ?? 200
  const y = options?.y ?? 150
  const rows = options?.rows ?? 3
  const cols = options?.cols ?? 3
  const cellW = options?.cellW ?? 120
  const cellH = options?.cellH ?? 50

  const strokes: WBStroke[] = []
  const color = '#475569'
  const size = 1
  const totalW = cols * cellW
  const totalH = rows * cellH

  // Horizontal lines
  for (let r = 0; r <= rows; r++) {
    const yPos = y + r * cellH
    strokes.push(makeLine(`tmpl-tbl-h${r}`, x, yPos, x + totalW, yPos, color, r === 0 ? 2 : size))
  }

  // Vertical lines
  for (let c = 0; c <= cols; c++) {
    const xPos = x + c * cellW
    strokes.push(makeLine(`tmpl-tbl-v${c}`, xPos, y, xPos, y + totalH, color, c === 0 ? 2 : size))
  }

  return strokes
}
