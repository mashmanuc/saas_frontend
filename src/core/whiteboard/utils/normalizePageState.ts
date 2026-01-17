/**
 * State Normalization Utility for Winterboard v0.93.0
 * 
 * Ensures all whiteboard state conforms to strict invariants:
 * - strokes and assets are always arrays
 * - stroke.points is always an array
 * - each point has finite x,y numbers
 * - strokes with <2 valid points are discarded
 * 
 * This prevents runtime errors from corrupted localStorage or invalid realtime payloads.
 */

export interface Point {
  x: number
  y: number
  pressure?: number
}

export interface Stroke {
  id: string
  tool: string
  color: string
  size: number
  points: Point[]
  opacity?: number
}

export interface Asset {
  id: string
  type: string
  url: string
  x: number
  y: number
  width: number
  height: number
}

export interface PageState {
  strokes: Stroke[]
  assets: Asset[]
  version?: number
  [key: string]: unknown
}

interface NormalizationStats {
  droppedStrokes: number
  fixedStrokes: number
  droppedAssets: number
}

/**
 * Validates and normalizes a point object
 */
function normalizePoint(p: any): Point | null {
  if (!p || typeof p !== 'object') return null
  
  const x = Number(p.x)
  const y = Number(p.y)
  
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  
  const point: Point = { x, y }
  
  if (p.pressure !== undefined) {
    const pressure = Number(p.pressure)
    if (Number.isFinite(pressure)) {
      point.pressure = pressure
    }
  }
  
  return point
}

/**
 * Validates and normalizes a stroke object
 */
function normalizeStroke(s: any): Stroke | null {
  if (!s || typeof s !== 'object') return null
  if (!s.id || typeof s.id !== 'string') return null
  
  // Normalize points array
  const rawPoints = Array.isArray(s.points) ? s.points : []
  const validPoints: Point[] = []
  
  for (const p of rawPoints) {
    const normalized = normalizePoint(p)
    if (normalized) {
      validPoints.push(normalized)
    }
  }
  
  // Discard strokes with <2 valid points (can't draw a line)
  if (validPoints.length < 2) return null
  
  return {
    id: s.id,
    tool: typeof s.tool === 'string' ? s.tool : 'pen',
    color: typeof s.color === 'string' ? s.color : '#000000',
    size: Number.isFinite(Number(s.size)) ? Number(s.size) : 2,
    points: validPoints,
    opacity: s.opacity !== undefined && Number.isFinite(Number(s.opacity)) 
      ? Number(s.opacity) 
      : undefined,
  }
}

/**
 * Validates and normalizes an asset object
 */
function normalizeAsset(a: any): Asset | null {
  if (!a || typeof a !== 'object') return null
  if (!a.id || typeof a.id !== 'string') return null
  if (!a.type || typeof a.type !== 'string') return null
  if (!a.url || typeof a.url !== 'string') return null
  
  const x = Number(a.x)
  const y = Number(a.y)
  const width = Number(a.width)
  const height = Number(a.height)
  
  if (!Number.isFinite(x) || !Number.isFinite(y) || 
      !Number.isFinite(width) || !Number.isFinite(height)) {
    return null
  }
  
  return {
    id: a.id,
    type: a.type,
    url: a.url,
    x,
    y,
    width,
    height,
  }
}

/**
 * Normalizes page state to ensure all invariants are met.
 * Returns a safe copy with invalid data filtered out.
 * 
 * @param state - Raw state from localStorage, realtime, or autosave
 * @param options - Normalization options
 * @returns Normalized state and statistics
 */
export function normalizePageState(
  state: any,
  options: { warnOnce?: boolean } = {}
): { state: PageState; stats: NormalizationStats } {
  const stats: NormalizationStats = {
    droppedStrokes: 0,
    fixedStrokes: 0,
    droppedAssets: 0,
  }
  
  // Ensure state is an object
  if (!state || typeof state !== 'object') {
    state = {}
  }
  
  // Normalize strokes
  const rawStrokes = Array.isArray(state.strokes) ? state.strokes : []
  const validStrokes: Stroke[] = []
  
  for (const s of rawStrokes) {
    const normalized = normalizeStroke(s)
    if (normalized) {
      validStrokes.push(normalized)
      if (normalized.points.length !== (s.points?.length || 0)) {
        stats.fixedStrokes++
      }
    } else {
      stats.droppedStrokes++
    }
  }
  
  // Normalize assets
  const rawAssets = Array.isArray(state.assets) ? state.assets : []
  const validAssets: Asset[] = []
  
  for (const a of rawAssets) {
    const normalized = normalizeAsset(a)
    if (normalized) {
      validAssets.push(normalized)
    } else {
      stats.droppedAssets++
    }
  }
  
  // Log warning once if data was corrected
  if (options.warnOnce && (stats.droppedStrokes > 0 || stats.fixedStrokes > 0 || stats.droppedAssets > 0)) {
    console.warn('[winterboard] State normalized', stats)
  }
  
  return {
    state: {
      strokes: validStrokes,
      assets: validAssets,
      version: Number.isFinite(Number(state.version)) ? Number(state.version) : 1,
    },
    stats,
  }
}

/**
 * Quick check if state needs normalization (for optimization)
 */
export function needsNormalization(state: any): boolean {
  if (!state || typeof state !== 'object') return true
  if (!Array.isArray(state.strokes)) return true
  if (!Array.isArray(state.assets)) return true
  
  // Quick check first stroke
  if (state.strokes.length > 0) {
    const firstStroke = state.strokes[0]
    if (!Array.isArray(firstStroke?.points)) return true
    if (firstStroke.points.length > 0) {
      const firstPoint = firstStroke.points[0]
      if (!Number.isFinite(firstPoint?.x) || !Number.isFinite(firstPoint?.y)) {
        return true
      }
    }
  }
  
  return false
}
