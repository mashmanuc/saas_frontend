/**
 * Phase 34 A5: Template preset generators — unit tests
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWBStore } from '../board/state/boardStore'
import {
  generateCoordinatePlane,
  generateNumberLine,
  generateTable,
} from '../templates/templatePresets'
import { BOARD_TEMPLATES } from '../data/boardTemplates'

// ─── Coordinate Plane ────────────────────────────────────────────────────────

describe('generateCoordinatePlane', () => {
  it('returns array of WBStroke', () => {
    const result = generateCoordinatePlane()
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
  })

  it('has 2 line strokes (axes)', () => {
    const result = generateCoordinatePlane()
    const axes = result.filter(s => s.tool === 'line' && s.id.includes('-xaxis') || s.id.includes('-yaxis'))
    expect(axes.length).toBe(2)
  })

  it('total <= 20 objects (FIX-2 rule)', () => {
    const result = generateCoordinatePlane()
    expect(result.length).toBeLessThanOrEqual(20)
  })

  it('all strokes have valid id, tool, points', () => {
    const result = generateCoordinatePlane()
    for (const s of result) {
      expect(s.id).toBeTruthy()
      expect(s.tool).toBeTruthy()
      expect(Array.isArray(s.points)).toBe(true)
      expect(s.points.length).toBeGreaterThan(0)
    }
  })

  it('accepts custom options', () => {
    const result = generateCoordinatePlane({ cx: 500, cy: 400, range: 10 })
    expect(result.length).toBeGreaterThan(0)
    const labels = result.filter(s => s.tool === 'text')
    const hasRange10 = labels.some(s => s.text === '10' || s.text === '-10')
    expect(hasRange10).toBe(true)
  })
})

// ─── Number Line ─────────────────────────────────────────────────────────────

describe('generateNumberLine', () => {
  it('returns <= 15 objects', () => {
    const result = generateNumberLine()
    expect(result.length).toBeLessThanOrEqual(15)
  })

  it('custom range min/max', () => {
    const result = generateNumberLine({ min: -10, max: 10 })
    const labels = result.filter(s => s.tool === 'text')
    const has10 = labels.some(s => s.text === '10')
    const hasNeg10 = labels.some(s => s.text === '-10')
    expect(has10).toBe(true)
    expect(hasNeg10).toBe(true)
  })

  it('all strokes have valid structure', () => {
    const result = generateNumberLine()
    for (const s of result) {
      expect(s.id).toBeTruthy()
      expect(s.opacity).toBe(1)
      expect(s.points.length).toBeGreaterThan(0)
    }
  })
})

// ─── Table ───────────────────────────────────────────────────────────────────

describe('generateTable', () => {
  it('returns (rows+1)+(cols+1) lines for 3x3', () => {
    const result = generateTable({ rows: 3, cols: 3 })
    // 4 horizontal + 4 vertical = 8 lines
    expect(result.length).toBe(8)
  })

  it('returns <= 10 objects for 3x3', () => {
    const result = generateTable({ rows: 3, cols: 3 })
    expect(result.length).toBeLessThanOrEqual(10)
  })

  it('all lines are line tool', () => {
    const result = generateTable()
    for (const s of result) {
      expect(s.tool).toBe('line')
    }
  })

  it('respects custom cell dimensions', () => {
    const result = generateTable({ rows: 2, cols: 2, cellW: 200, cellH: 100 })
    // 3 horizontal + 3 vertical = 6
    expect(result.length).toBe(6)
  })
})

// ─── BOARD_TEMPLATES integration ─────────────────────────────────────────────

describe('BOARD_TEMPLATES registration', () => {
  it('contains coordinate_plane template', () => {
    const tmpl = BOARD_TEMPLATES.find(t => t.id === 'coordinate_plane')
    expect(tmpl).toBeTruthy()
    expect(tmpl!.generator).toBeDefined()
  })

  it('contains number_line template', () => {
    const tmpl = BOARD_TEMPLATES.find(t => t.id === 'number_line')
    expect(tmpl).toBeTruthy()
    expect(tmpl!.generator).toBeDefined()
  })

  it('contains table_3x3 template', () => {
    const tmpl = BOARD_TEMPLATES.find(t => t.id === 'table_3x3')
    expect(tmpl).toBeTruthy()
    expect(tmpl!.generator).toBeDefined()
  })

  it('generator templates produce valid strokes', () => {
    const generatorTemplates = BOARD_TEMPLATES.filter(t => t.generator)
    for (const tmpl of generatorTemplates) {
      const strokes = tmpl.generator!()
      expect(Array.isArray(strokes)).toBe(true)
      expect(strokes.length).toBeGreaterThan(0)
      expect(strokes.length).toBeLessThanOrEqual(20)
    }
  })
})

// ─── applyTemplate guard ─────────────────────────────────────────────────────

describe('applyTemplate: blocked when canAddObject = false', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('addStroke blocked at limit', () => {
    const store = useWBStore()
    store.pages = [{ id: 'p1', name: 'P1', strokes: [], assets: [] }]
    store.currentPageIndex = 0

    // Fill to 300
    const strokes = Array.from({ length: 300 }, (_, i) => ({
      id: `fill-${i}`,
      tool: 'pen' as const,
      color: '#000',
      size: 1,
      opacity: 1,
      points: [{ x: 0, y: 0 }],
    }))
    store.pages[0] = { ...store.pages[0], strokes }
    expect(store.canAddObject).toBe(false)

    const before = store.currentStrokes.length
    store.addStroke({
      id: 'tmpl-overflow',
      tool: 'line',
      color: '#000',
      size: 1,
      opacity: 1,
      points: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
    })
    expect(store.currentStrokes.length).toBe(before)
  })
})
