// WB: Unit tests for Yjs Document Model (Phase 6: A6.1)
// Tests: document creation, page/stroke/asset CRUD, conversion, hydration, points serialization

import { describe, it, expect, beforeEach } from 'vitest'
import * as Y from 'yjs'
import {
  createWBDocument,
  setMeta,
  getMeta,
  getPages,
  getPageCount,
  getPageAt,
  addPage,
  removePage,
  addStroke,
  removeStroke,
  updateStroke,
  addAsset,
  removeAsset,
  updateAsset,
  readAllPages,
  readPageStrokes,
  readPageAssets,
  hydrateFromState,
  yMapToWBPage,
  yMapToWBStroke,
  yMapToWBAsset,
  flattenPoints,
  unflattenPoints,
  getPageStrokesArray,
} from '../engine/collaboration/yjsDocument'
import type { WBPage, WBStroke, WBAsset, WBPoint } from '../types/winterboard'

// ─── Fixtures ───────────────────────────────────────────────────────────────

function makePage(id = 'p1', name = 'Page 1'): WBPage {
  return {
    id,
    name,
    strokes: [],
    assets: [],
    background: 'white',
  }
}

function makeStroke(id = 's1'): WBStroke {
  return {
    id,
    tool: 'pen',
    color: '#ff0000',
    size: 3,
    opacity: 1,
    points: [
      { x: 10, y: 20, pressure: 0.5 },
      { x: 30, y: 40, pressure: 0.8 },
      { x: 50, y: 60, pressure: 0.3 },
    ],
  }
}

function makeAsset(id = 'a1'): WBAsset {
  return {
    id,
    type: 'image',
    src: 'https://cdn.example.com/img.png',
    x: 100,
    y: 200,
    w: 300,
    h: 400,
    rotation: 0,
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Yjs Document Model (A6.1)', () => {
  let doc: Y.Doc

  beforeEach(() => {
    doc = createWBDocument()
  })

  // ── Document creation ─────────────────────────────────────────────────

  describe('createWBDocument', () => {
    it('creates a valid Yjs doc with meta and pages', () => {
      expect(doc).toBeInstanceOf(Y.Doc)
      expect(doc.getMap('meta')).toBeInstanceOf(Y.Map)
      expect(doc.getArray('pages')).toBeInstanceOf(Y.Array)
      expect(getPageCount(doc)).toBe(0)
    })
  })

  // ── Meta ──────────────────────────────────────────────────────────────

  describe('Meta', () => {
    it('sets and gets meta', () => {
      setMeta(doc, { sessionId: 'sess-1', name: 'Test Board', createdAt: 1000, rev: 5 })
      const meta = getMeta(doc)
      expect(meta.sessionId).toBe('sess-1')
      expect(meta.name).toBe('Test Board')
      expect(meta.createdAt).toBe(1000)
      expect(meta.rev).toBe(5)
    })

    it('returns defaults for empty meta', () => {
      const meta = getMeta(doc)
      expect(meta.sessionId).toBe('')
      expect(meta.name).toBe('Untitled')
      expect(meta.rev).toBe(0)
    })
  })

  // ── Pages CRUD ────────────────────────────────────────────────────────

  describe('Pages', () => {
    it('addPage increases page count', () => {
      addPage(doc, makePage('p1'))
      expect(getPageCount(doc)).toBe(1)

      addPage(doc, makePage('p2'))
      expect(getPageCount(doc)).toBe(2)
    })

    it('getPageAt returns correct page', () => {
      addPage(doc, makePage('p1', 'First'))
      addPage(doc, makePage('p2', 'Second'))

      const yPage = getPageAt(doc, 1)
      expect(yPage).not.toBeNull()
      expect(yPage!.get('id')).toBe('p2')
      expect(yPage!.get('name')).toBe('Second')
    })

    it('getPageAt returns null for invalid index', () => {
      expect(getPageAt(doc, 0)).toBeNull()
      expect(getPageAt(doc, -1)).toBeNull()
    })

    it('removePage removes correct page', () => {
      addPage(doc, makePage('p1'))
      addPage(doc, makePage('p2'))
      addPage(doc, makePage('p3'))

      removePage(doc, 1)
      expect(getPageCount(doc)).toBe(2)

      const pages = readAllPages(doc)
      expect(pages[0].id).toBe('p1')
      expect(pages[1].id).toBe('p3')
    })

    it('removePage ignores invalid index', () => {
      addPage(doc, makePage('p1'))
      removePage(doc, 5) // should not throw
      expect(getPageCount(doc)).toBe(1)
    })
  })

  // ── Strokes CRUD ──────────────────────────────────────────────────────

  describe('Strokes', () => {
    beforeEach(() => {
      addPage(doc, makePage('p1'))
    })

    it('addStroke adds to page strokes', () => {
      addStroke(doc, 0, makeStroke('s1'))
      const strokes = readPageStrokes(doc, 0)
      expect(strokes).toHaveLength(1)
      expect(strokes[0].id).toBe('s1')
      expect(strokes[0].color).toBe('#ff0000')
    })

    it('addStroke preserves points with pressure', () => {
      addStroke(doc, 0, makeStroke('s1'))
      const strokes = readPageStrokes(doc, 0)
      expect(strokes[0].points).toHaveLength(3)
      expect(strokes[0].points[0]).toEqual({ x: 10, y: 20, pressure: 0.5 })
      expect(strokes[0].points[1]).toEqual({ x: 30, y: 40, pressure: 0.8 })
    })

    it('removeStroke removes by ID', () => {
      addStroke(doc, 0, makeStroke('s1'))
      addStroke(doc, 0, makeStroke('s2'))

      removeStroke(doc, 0, 's1')
      const strokes = readPageStrokes(doc, 0)
      expect(strokes).toHaveLength(1)
      expect(strokes[0].id).toBe('s2')
    })

    it('removeStroke ignores non-existent ID', () => {
      addStroke(doc, 0, makeStroke('s1'))
      removeStroke(doc, 0, 'non-existent')
      expect(readPageStrokes(doc, 0)).toHaveLength(1)
    })

    it('updateStroke modifies properties', () => {
      addStroke(doc, 0, makeStroke('s1'))
      updateStroke(doc, 0, 's1', { color: '#00ff00', size: 5 })

      const strokes = readPageStrokes(doc, 0)
      expect(strokes[0].color).toBe('#00ff00')
      expect(strokes[0].size).toBe(5)
      // Other props unchanged
      expect(strokes[0].tool).toBe('pen')
    })

    it('updateStroke can update points', () => {
      addStroke(doc, 0, makeStroke('s1'))
      const newPoints: WBPoint[] = [{ x: 100, y: 200, pressure: 1.0 }]
      updateStroke(doc, 0, 's1', { points: newPoints })

      const strokes = readPageStrokes(doc, 0)
      expect(strokes[0].points).toHaveLength(1)
      expect(strokes[0].points[0]).toEqual({ x: 100, y: 200, pressure: 1.0 })
    })

    it('getPageStrokesArray returns null for invalid page', () => {
      expect(getPageStrokesArray(doc, 99)).toBeNull()
    })
  })

  // ── Assets CRUD ───────────────────────────────────────────────────────

  describe('Assets', () => {
    beforeEach(() => {
      addPage(doc, makePage('p1'))
    })

    it('addAsset adds to page assets', () => {
      addAsset(doc, 0, makeAsset('a1'))
      const assets = readPageAssets(doc, 0)
      expect(assets).toHaveLength(1)
      expect(assets[0].id).toBe('a1')
      expect(assets[0].src).toBe('https://cdn.example.com/img.png')
    })

    it('removeAsset removes by ID', () => {
      addAsset(doc, 0, makeAsset('a1'))
      addAsset(doc, 0, makeAsset('a2'))

      removeAsset(doc, 0, 'a1')
      const assets = readPageAssets(doc, 0)
      expect(assets).toHaveLength(1)
      expect(assets[0].id).toBe('a2')
    })

    it('updateAsset modifies properties', () => {
      addAsset(doc, 0, makeAsset('a1'))
      updateAsset(doc, 0, 'a1', { x: 999, y: 888 })

      const assets = readPageAssets(doc, 0)
      expect(assets[0].x).toBe(999)
      expect(assets[0].y).toBe(888)
      expect(assets[0].w).toBe(300) // unchanged
    })
  })

  // ── Conversion: WB → Yjs → WB roundtrip ──────────────────────────────

  describe('Conversion roundtrip', () => {
    it('page roundtrip preserves all fields', () => {
      const page: WBPage = {
        id: 'p-rt',
        name: 'Roundtrip Page',
        strokes: [makeStroke('s-rt')],
        assets: [makeAsset('a-rt')],
        background: 'grid',
        width: 1920,
        height: 1080,
      }

      addPage(doc, page)
      const result = readAllPages(doc)
      expect(result).toHaveLength(1)

      const rp = result[0]
      expect(rp.id).toBe('p-rt')
      expect(rp.name).toBe('Roundtrip Page')
      expect(rp.background).toBe('grid')
      expect(rp.width).toBe(1920)
      expect(rp.height).toBe(1080)
      expect(rp.strokes).toHaveLength(1)
      expect(rp.strokes[0].id).toBe('s-rt')
      expect(rp.assets).toHaveLength(1)
      expect(rp.assets[0].id).toBe('a-rt')
    })

    it('PDF background roundtrip', () => {
      const page: WBPage = {
        id: 'p-pdf',
        name: 'PDF Page',
        strokes: [],
        assets: [],
        background: { type: 'pdf', url: 'https://cdn.example.com/page.png', assetId: 'asset-1' },
      }

      addPage(doc, page)
      const result = readAllPages(doc)
      const bg = result[0].background
      expect(typeof bg).toBe('object')
      expect((bg as { type: string }).type).toBe('pdf')
      expect((bg as { url: string }).url).toBe('https://cdn.example.com/page.png')
      expect((bg as { assetId: string }).assetId).toBe('asset-1')
    })

    it('stroke with optional fields roundtrip', () => {
      const stroke: WBStroke = {
        id: 's-opt',
        tool: 'text',
        color: '#000',
        size: 16,
        opacity: 1,
        points: [{ x: 0, y: 0 }],
        text: 'Hello World',
        width: 200,
        height: 50,
      }

      addPage(doc, makePage('p1'))
      addStroke(doc, 0, stroke)
      const strokes = readPageStrokes(doc, 0)
      expect(strokes[0].text).toBe('Hello World')
      expect(strokes[0].width).toBe(200)
      expect(strokes[0].height).toBe(50)
    })
  })

  // ── Points serialization ──────────────────────────────────────────────

  describe('Points serialization', () => {
    it('flattenPoints creates flat array [x,y,p, ...]', () => {
      const points: WBPoint[] = [
        { x: 1, y: 2, pressure: 0.5 },
        { x: 3, y: 4, pressure: 0.8 },
      ]
      const flat = flattenPoints(points)
      expect(flat).toEqual([1, 2, 0.5, 3, 4, 0.8])
    })

    it('flattenPoints defaults pressure to 0.5', () => {
      const points: WBPoint[] = [{ x: 10, y: 20 }]
      const flat = flattenPoints(points)
      expect(flat).toEqual([10, 20, 0.5])
    })

    it('unflattenPoints reconstructs WBPoint[]', () => {
      const flat = [1, 2, 0.5, 3, 4, 0.8]
      const points = unflattenPoints(flat)
      expect(points).toHaveLength(2)
      expect(points[0]).toEqual({ x: 1, y: 2, pressure: 0.5 })
      expect(points[1]).toEqual({ x: 3, y: 4, pressure: 0.8 })
    })

    it('unflattenPoints handles empty array', () => {
      expect(unflattenPoints([])).toEqual([])
    })

    it('flatten → unflatten roundtrip', () => {
      const original: WBPoint[] = [
        { x: 10.5, y: 20.3, pressure: 0.7 },
        { x: 30.1, y: 40.9, pressure: 0.2 },
      ]
      const result = unflattenPoints(flattenPoints(original))
      expect(result).toEqual(original)
    })
  })

  // ── Hydration ─────────────────────────────────────────────────────────

  describe('Hydration', () => {
    it('hydrateFromState populates empty doc', () => {
      const pages: WBPage[] = [
        { ...makePage('p1'), strokes: [makeStroke('s1')] },
        makePage('p2'),
      ]

      hydrateFromState(doc, pages)
      expect(getPageCount(doc)).toBe(2)

      const result = readAllPages(doc)
      expect(result[0].id).toBe('p1')
      expect(result[0].strokes).toHaveLength(1)
      expect(result[1].id).toBe('p2')
    })

    it('hydrateFromState replaces existing pages', () => {
      addPage(doc, makePage('old-1'))
      addPage(doc, makePage('old-2'))
      expect(getPageCount(doc)).toBe(2)

      hydrateFromState(doc, [makePage('new-1')])
      expect(getPageCount(doc)).toBe(1)
      expect(readAllPages(doc)[0].id).toBe('new-1')
    })

    it('hydrateFromState with empty array clears doc', () => {
      addPage(doc, makePage('p1'))
      hydrateFromState(doc, [])
      expect(getPageCount(doc)).toBe(0)
    })
  })

  // ── Transaction origin ────────────────────────────────────────────────

  describe('Transaction origin', () => {
    it('addPage uses origin for UndoManager tracking', () => {
      const origins: (string | undefined)[] = []
      doc.on('afterTransaction', (tr: Y.Transaction) => {
        origins.push(tr.origin as string | undefined)
      })

      addPage(doc, makePage('p1'), 'user-123')
      expect(origins).toContain('user-123')
    })

    it('addStroke uses origin', () => {
      addPage(doc, makePage('p1'))
      const origins: (string | undefined)[] = []
      doc.on('afterTransaction', (tr: Y.Transaction) => {
        origins.push(tr.origin as string | undefined)
      })

      addStroke(doc, 0, makeStroke('s1'), 'user-456')
      expect(origins).toContain('user-456')
    })
  })

  // ── Multi-doc sync (Yjs core feature) ─────────────────────────────────

  describe('Multi-doc sync', () => {
    it('changes propagate between two docs via Y.applyUpdate', () => {
      const doc2 = new Y.Doc()
      doc2.getMap('meta')
      doc2.getArray('pages')

      // Sync doc → doc2
      const update = Y.encodeStateAsUpdate(doc)
      Y.applyUpdate(doc2, update)

      // Add page to doc
      addPage(doc, makePage('p1'))
      const update2 = Y.encodeStateAsUpdate(doc)
      Y.applyUpdate(doc2, update2)

      // doc2 should have the page
      const pages2 = doc2.getArray<Y.Map<unknown>>('pages')
      expect(pages2.length).toBe(1)
      expect(pages2.get(0).get('id')).toBe('p1')

      doc2.destroy()
    })
  })
})
