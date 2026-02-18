// WB: Yjs Document Model for Winterboard
// Ref: TASK_BOARD_PHASES.md A6.1, LAW-16 (Multi-User Presence), LAW-02 (Sync)
//
// Document structure:
//   doc.getMap('meta')        → { sessionId, name, createdAt, rev }
//   doc.getArray('pages')     → Y.Array<Y.Map>
//     page Y.Map:
//       id: string
//       name: string
//       background: string | { type: 'pdf', url: string, assetId: string }
//       width?: number
//       height?: number
//       strokes: Y.Array<Y.Map>
//         stroke Y.Map:
//           id, tool, color, size, opacity, createdBy, createdAt
//           points: Y.Array<number>  // flat [x,y,p, x,y,p, ...]
//       assets: Y.Array<Y.Map>
//         asset Y.Map:
//           id, type, src, x, y, w, h, rotation

import * as Y from 'yjs'
import type {
  WBPage,
  WBStroke,
  WBAsset,
  WBPoint,
  WBPageBackground,
  WBPdfBackground,
} from '../../types/winterboard'

// ─── Constants ──────────────────────────────────────────────────────────────

const LOG = '[WB:YjsDoc]'

// ─── Document creation ──────────────────────────────────────────────────────

/**
 * Create a new Yjs document with Winterboard structure.
 * The document is empty — call hydrateFromState() to populate.
 */
export function createWBDocument(): Y.Doc {
  const doc = new Y.Doc()
  // Ensure root structures exist
  doc.getMap('meta')
  doc.getArray('pages')
  return doc
}

// ─── Meta helpers ───────────────────────────────────────────────────────────

export function setMeta(
  doc: Y.Doc,
  meta: { sessionId: string; name: string; createdAt?: number; rev?: number },
): void {
  const yMeta = doc.getMap('meta')
  doc.transact(() => {
    yMeta.set('sessionId', meta.sessionId)
    yMeta.set('name', meta.name)
    yMeta.set('createdAt', meta.createdAt ?? Date.now())
    yMeta.set('rev', meta.rev ?? 0)
  })
}

export function getMeta(doc: Y.Doc): { sessionId: string; name: string; createdAt: number; rev: number } {
  const yMeta = doc.getMap('meta')
  return {
    sessionId: (yMeta.get('sessionId') as string) ?? '',
    name: (yMeta.get('name') as string) ?? 'Untitled',
    createdAt: (yMeta.get('createdAt') as number) ?? 0,
    rev: (yMeta.get('rev') as number) ?? 0,
  }
}

// ─── Pages ──────────────────────────────────────────────────────────────────

export function getPages(doc: Y.Doc): Y.Array<Y.Map<unknown>> {
  return doc.getArray<Y.Map<unknown>>('pages')
}

export function getPageCount(doc: Y.Doc): number {
  return getPages(doc).length
}

export function getPageAt(doc: Y.Doc, index: number): Y.Map<unknown> | null {
  const pages = getPages(doc)
  if (index < 0 || index >= pages.length) return null
  return pages.get(index)
}

/**
 * Add a page to the Yjs document.
 * @param origin - Transaction origin (userId) for UndoManager tracking
 */
export function addPage(doc: Y.Doc, page: WBPage, origin?: string): void {
  const yPage = wbPageToYMap(doc, page)
  doc.transact(() => {
    getPages(doc).push([yPage])
  }, origin)
}

/**
 * Remove a page by index.
 */
export function removePage(doc: Y.Doc, pageIndex: number, origin?: string): void {
  const pages = getPages(doc)
  if (pageIndex < 0 || pageIndex >= pages.length) {
    console.warn(LOG, 'removePage: invalid index', pageIndex)
    return
  }
  doc.transact(() => {
    pages.delete(pageIndex, 1)
  }, origin)
}

// ─── Strokes ────────────────────────────────────────────────────────────────

/**
 * Get the strokes Y.Array for a given page index.
 */
export function getPageStrokesArray(doc: Y.Doc, pageIndex: number): Y.Array<Y.Map<unknown>> | null {
  const yPage = getPageAt(doc, pageIndex)
  if (!yPage) return null
  return yPage.get('strokes') as Y.Array<Y.Map<unknown>> | null
}

/**
 * Add a stroke to a page.
 * @param origin - Transaction origin (userId) for UndoManager tracking
 */
export function addStroke(
  doc: Y.Doc,
  pageIndex: number,
  stroke: WBStroke,
  origin?: string,
): void {
  const yStrokes = getPageStrokesArray(doc, pageIndex)
  if (!yStrokes) {
    console.warn(LOG, 'addStroke: no strokes array at page', pageIndex)
    return
  }

  const yStroke = wbStrokeToYMap(doc, stroke)
  doc.transact(() => {
    yStrokes.push([yStroke])
  }, origin)
}

/**
 * Remove a stroke by ID from a page.
 */
export function removeStroke(
  doc: Y.Doc,
  pageIndex: number,
  strokeId: string,
  origin?: string,
): void {
  const yStrokes = getPageStrokesArray(doc, pageIndex)
  if (!yStrokes) return

  doc.transact(() => {
    for (let i = 0; i < yStrokes.length; i++) {
      const yStroke = yStrokes.get(i)
      if (yStroke.get('id') === strokeId) {
        yStrokes.delete(i, 1)
        return
      }
    }
  }, origin)
}

/**
 * Update a stroke's properties (color, size, points, etc.).
 */
export function updateStroke(
  doc: Y.Doc,
  pageIndex: number,
  strokeId: string,
  updates: Partial<WBStroke>,
  origin?: string,
): void {
  const yStrokes = getPageStrokesArray(doc, pageIndex)
  if (!yStrokes) return

  doc.transact(() => {
    for (let i = 0; i < yStrokes.length; i++) {
      const yStroke = yStrokes.get(i)
      if (yStroke.get('id') === strokeId) {
        if (updates.color !== undefined) yStroke.set('color', updates.color)
        if (updates.size !== undefined) yStroke.set('size', updates.size)
        if (updates.opacity !== undefined) yStroke.set('opacity', updates.opacity)
        if (updates.tool !== undefined) yStroke.set('tool', updates.tool)
        if (updates.text !== undefined) yStroke.set('text', updates.text)
        if (updates.width !== undefined) yStroke.set('width', updates.width)
        if (updates.height !== undefined) yStroke.set('height', updates.height)
        if (updates.points !== undefined) {
          const yPoints = yStroke.get('points') as Y.Array<number>
          yPoints.delete(0, yPoints.length)
          yPoints.push(flattenPoints(updates.points))
        }
        return
      }
    }
  }, origin)
}

// ─── Assets ─────────────────────────────────────────────────────────────────

export function getPageAssetsArray(doc: Y.Doc, pageIndex: number): Y.Array<Y.Map<unknown>> | null {
  const yPage = getPageAt(doc, pageIndex)
  if (!yPage) return null
  return yPage.get('assets') as Y.Array<Y.Map<unknown>> | null
}

export function addAsset(
  doc: Y.Doc,
  pageIndex: number,
  asset: WBAsset,
  origin?: string,
): void {
  const yAssets = getPageAssetsArray(doc, pageIndex)
  if (!yAssets) return

  const yAsset = wbAssetToYMap(doc, asset)
  doc.transact(() => {
    yAssets.push([yAsset])
  }, origin)
}

export function removeAsset(
  doc: Y.Doc,
  pageIndex: number,
  assetId: string,
  origin?: string,
): void {
  const yAssets = getPageAssetsArray(doc, pageIndex)
  if (!yAssets) return

  doc.transact(() => {
    for (let i = 0; i < yAssets.length; i++) {
      const yAsset = yAssets.get(i)
      if (yAsset.get('id') === assetId) {
        yAssets.delete(i, 1)
        return
      }
    }
  }, origin)
}

export function updateAsset(
  doc: Y.Doc,
  pageIndex: number,
  assetId: string,
  updates: Partial<WBAsset>,
  origin?: string,
): void {
  const yAssets = getPageAssetsArray(doc, pageIndex)
  if (!yAssets) return

  doc.transact(() => {
    for (let i = 0; i < yAssets.length; i++) {
      const yAsset = yAssets.get(i)
      if (yAsset.get('id') === assetId) {
        if (updates.src !== undefined) yAsset.set('src', updates.src)
        if (updates.x !== undefined) yAsset.set('x', updates.x)
        if (updates.y !== undefined) yAsset.set('y', updates.y)
        if (updates.w !== undefined) yAsset.set('w', updates.w)
        if (updates.h !== undefined) yAsset.set('h', updates.h)
        if (updates.rotation !== undefined) yAsset.set('rotation', updates.rotation)
        return
      }
    }
  }, origin)
}

// ─── Read helpers (Yjs → WB types) ──────────────────────────────────────────

/**
 * Read all pages from Yjs document as WBPage[].
 */
export function readAllPages(doc: Y.Doc): WBPage[] {
  const yPages = getPages(doc)
  const result: WBPage[] = []
  for (let i = 0; i < yPages.length; i++) {
    result.push(yMapToWBPage(yPages.get(i)))
  }
  return result
}

/**
 * Read strokes from a page as WBStroke[].
 */
export function readPageStrokes(doc: Y.Doc, pageIndex: number): WBStroke[] {
  const yStrokes = getPageStrokesArray(doc, pageIndex)
  if (!yStrokes) return []
  const result: WBStroke[] = []
  for (let i = 0; i < yStrokes.length; i++) {
    result.push(yMapToWBStroke(yStrokes.get(i)))
  }
  return result
}

/**
 * Read assets from a page as WBAsset[].
 */
export function readPageAssets(doc: Y.Doc, pageIndex: number): WBAsset[] {
  const yAssets = getPageAssetsArray(doc, pageIndex)
  if (!yAssets) return []
  const result: WBAsset[] = []
  for (let i = 0; i < yAssets.length; i++) {
    result.push(yMapToWBAsset(yAssets.get(i)))
  }
  return result
}

// ─── Hydration ──────────────────────────────────────────────────────────────

/**
 * Hydrate Yjs document from WBPage[] (first user or migration).
 * Clears existing pages and replaces with provided state.
 */
export function hydrateFromState(
  doc: Y.Doc,
  pages: WBPage[],
  origin?: string,
): void {
  doc.transact(() => {
    const yPages = getPages(doc)
    // Clear existing
    if (yPages.length > 0) {
      yPages.delete(0, yPages.length)
    }
    // Add all pages
    for (const page of pages) {
      yPages.push([wbPageToYMap(doc, page)])
    }
  }, origin)
}

// ─── Conversion: WB → Y.Map ────────────────────────────────────────────────

function wbPageToYMap(doc: Y.Doc, page: WBPage): Y.Map<unknown> {
  const yPage = new Y.Map<unknown>()
  yPage.set('id', page.id)
  yPage.set('name', page.name)
  yPage.set('background', serializeBackground(page.background))
  if (page.width !== undefined) yPage.set('width', page.width)
  if (page.height !== undefined) yPage.set('height', page.height)

  // Strokes
  const yStrokes = new Y.Array<Y.Map<unknown>>()
  for (const stroke of page.strokes) {
    yStrokes.push([wbStrokeToYMap(doc, stroke)])
  }
  yPage.set('strokes', yStrokes)

  // Assets
  const yAssets = new Y.Array<Y.Map<unknown>>()
  for (const asset of page.assets) {
    yAssets.push([wbAssetToYMap(doc, asset)])
  }
  yPage.set('assets', yAssets)

  return yPage
}

function wbStrokeToYMap(_doc: Y.Doc, stroke: WBStroke): Y.Map<unknown> {
  const yStroke = new Y.Map<unknown>()
  yStroke.set('id', stroke.id)
  yStroke.set('tool', stroke.tool)
  yStroke.set('color', stroke.color)
  yStroke.set('size', stroke.size)
  yStroke.set('opacity', stroke.opacity)
  if (stroke.text !== undefined) yStroke.set('text', stroke.text)
  if (stroke.width !== undefined) yStroke.set('width', stroke.width)
  if (stroke.height !== undefined) yStroke.set('height', stroke.height)

  // Points as flat array [x,y,p, x,y,p, ...]
  const yPoints = new Y.Array<number>()
  yPoints.push(flattenPoints(stroke.points))
  yStroke.set('points', yPoints)

  return yStroke
}

function wbAssetToYMap(_doc: Y.Doc, asset: WBAsset): Y.Map<unknown> {
  const yAsset = new Y.Map<unknown>()
  yAsset.set('id', asset.id)
  yAsset.set('type', asset.type)
  yAsset.set('src', asset.src)
  yAsset.set('x', asset.x)
  yAsset.set('y', asset.y)
  yAsset.set('w', asset.w)
  yAsset.set('h', asset.h)
  yAsset.set('rotation', asset.rotation)
  return yAsset
}

// ─── Conversion: Y.Map → WB ────────────────────────────────────────────────

export function yMapToWBPage(yPage: Y.Map<unknown>): WBPage {
  const yStrokes = yPage.get('strokes') as Y.Array<Y.Map<unknown>> | undefined
  const yAssets = yPage.get('assets') as Y.Array<Y.Map<unknown>> | undefined

  const strokes: WBStroke[] = []
  if (yStrokes) {
    for (let i = 0; i < yStrokes.length; i++) {
      strokes.push(yMapToWBStroke(yStrokes.get(i)))
    }
  }

  const assets: WBAsset[] = []
  if (yAssets) {
    for (let i = 0; i < yAssets.length; i++) {
      assets.push(yMapToWBAsset(yAssets.get(i)))
    }
  }

  const page: WBPage = {
    id: (yPage.get('id') as string) ?? '',
    name: (yPage.get('name') as string) ?? '',
    strokes,
    assets,
    background: deserializeBackground(yPage.get('background')),
  }

  const width = yPage.get('width') as number | undefined
  const height = yPage.get('height') as number | undefined
  if (width !== undefined) page.width = width
  if (height !== undefined) page.height = height

  return page
}

export function yMapToWBStroke(yStroke: Y.Map<unknown>): WBStroke {
  const yPoints = yStroke.get('points') as Y.Array<number> | undefined
  const points = yPoints ? unflattenPoints(yPoints.toArray()) : []

  const stroke: WBStroke = {
    id: (yStroke.get('id') as string) ?? '',
    tool: (yStroke.get('tool') as WBStroke['tool']) ?? 'pen',
    color: (yStroke.get('color') as string) ?? '#000000',
    size: (yStroke.get('size') as number) ?? 2,
    opacity: (yStroke.get('opacity') as number) ?? 1,
    points,
  }

  const text = yStroke.get('text') as string | undefined
  const width = yStroke.get('width') as number | undefined
  const height = yStroke.get('height') as number | undefined
  if (text !== undefined) stroke.text = text
  if (width !== undefined) stroke.width = width
  if (height !== undefined) stroke.height = height

  return stroke
}

export function yMapToWBAsset(yAsset: Y.Map<unknown>): WBAsset {
  return {
    id: (yAsset.get('id') as string) ?? '',
    type: (yAsset.get('type') as 'image') ?? 'image',
    src: (yAsset.get('src') as string) ?? '',
    x: (yAsset.get('x') as number) ?? 0,
    y: (yAsset.get('y') as number) ?? 0,
    w: (yAsset.get('w') as number) ?? 100,
    h: (yAsset.get('h') as number) ?? 100,
    rotation: (yAsset.get('rotation') as number) ?? 0,
  }
}

// ─── Points serialization ───────────────────────────────────────────────────
// Flat format: [x, y, pressure, x, y, pressure, ...]
// 3 values per point. Pressure defaults to 0.5 if missing.

export function flattenPoints(points: WBPoint[]): number[] {
  const flat: number[] = []
  for (const p of points) {
    flat.push(p.x, p.y, p.pressure ?? 0.5)
  }
  return flat
}

export function unflattenPoints(flat: number[]): WBPoint[] {
  const points: WBPoint[] = []
  for (let i = 0; i + 2 < flat.length; i += 3) {
    points.push({ x: flat[i], y: flat[i + 1], pressure: flat[i + 2] })
  }
  return points
}

// ─── Background serialization ───────────────────────────────────────────────

function serializeBackground(bg: WBPageBackground | undefined): unknown {
  if (!bg) return 'white'
  if (typeof bg === 'string') return bg
  // PDF background → store as JSON object
  return { type: bg.type, url: bg.url, assetId: bg.assetId }
}

function deserializeBackground(raw: unknown): WBPageBackground {
  if (!raw) return 'white'
  if (typeof raw === 'string') {
    if (raw === 'white' || raw === 'grid' || raw === 'dots' || raw === 'lined') {
      return raw
    }
    return 'white'
  }
  // Object → PDF background
  const obj = raw as Record<string, unknown>
  if (obj.type === 'pdf' && typeof obj.url === 'string' && typeof obj.assetId === 'string') {
    return { type: 'pdf', url: obj.url, assetId: obj.assetId } as WBPdfBackground
  }
  return 'white'
}
