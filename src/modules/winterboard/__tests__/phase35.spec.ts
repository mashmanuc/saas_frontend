/**
 * Phase 35 Agent A: Unit tests
 * Covers: A1 (types — font fields), A2 (font constants),
 *         A3 (boardStore gridSize + backgroundColor),
 *         A4 (buildKonvaFontStyle), A5 (image opacity + borderRadius),
 *         A6 (grid size + background color)
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWBStore } from '../board/state/boardStore'
import type { WBStroke, WBAsset } from '../types/winterboard'
import {
  AVAILABLE_FONTS,
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_WEIGHT,
  DEFAULT_FONT_STYLE,
  DEFAULT_TEXT_ALIGN,
} from '../constants/fonts'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeStroke(overrides: Partial<WBStroke> = {}): WBStroke {
  return {
    id: `stroke-${Math.random().toString(36).slice(2, 8)}`,
    tool: 'pen',
    color: '#000',
    size: 2,
    opacity: 1,
    points: [{ x: 10, y: 10 }, { x: 50, y: 50 }],
    ...overrides,
  }
}

function makeAsset(overrides: Partial<WBAsset> = {}): WBAsset {
  return {
    id: `asset-${Math.random().toString(36).slice(2, 8)}`,
    type: 'image',
    src: 'test.png',
    x: 100,
    y: 100,
    w: 200,
    h: 150,
    rotation: 0,
    ...overrides,
  }
}

function seedPage(store: ReturnType<typeof useWBStore>) {
  // HYG-1: стор більше не стартує порожнім — він одразу створює сторінку
  // з генерованим id (`page-<ts>-<rand>`). Стара умова `length === 0` через
  // це не спрацьовувала ніколи, і `page-1` не існував → `addAsset` кидав
  // «page not found». Тепер гарантуємо саме той id, який очікують тести.
  if (!store.pages.some((p) => p.id === 'page-1')) {
    store.pages = [{ id: 'page-1', name: 'Page 1', strokes: [], assets: [] }]
    store.currentPageIndex = 0
  }
}

// Phase 35: Standalone buildKonvaFontStyle for testing
// (mirrors the implementation in WBCanvas.vue and WBStickyNote.vue)
function buildKonvaFontStyle(fontWeight?: number, fontStyle?: string): string {
  const parts: string[] = []
  if (fontWeight === 700) parts.push('bold')
  if (fontStyle === 'italic') parts.push('italic')
  return parts.length > 0 ? parts.join(' ') : 'normal'
}

// ─── A1: Type fields ────────────────────────────────────────────────────────

describe('A1: WBStroke font fields', () => {
  it('WBStroke accepts optional font fields', () => {
    const stroke = makeStroke({
      tool: 'text',
      text: 'Hello',
      fontFamily: 'Georgia, serif',
      fontWeight: 700,
      fontStyle: 'italic',
      textAlign: 'center',
    })
    expect(stroke.fontFamily).toBe('Georgia, serif')
    expect(stroke.fontWeight).toBe(700)
    expect(stroke.fontStyle).toBe('italic')
    expect(stroke.textAlign).toBe('center')
  })

  it('WBStroke font fields are optional (backward compatible)', () => {
    const stroke = makeStroke({ tool: 'text', text: 'Hi' })
    expect(stroke.fontFamily).toBeUndefined()
    expect(stroke.fontWeight).toBeUndefined()
    expect(stroke.fontStyle).toBeUndefined()
    expect(stroke.textAlign).toBeUndefined()
  })
})

describe('A1: WBAsset opacity/borderRadius + font fields (REC-1)', () => {
  it('WBAsset accepts opacity and borderRadius', () => {
    const asset = makeAsset({ opacity: 0.5, borderRadius: 10 })
    expect(asset.opacity).toBe(0.5)
    expect(asset.borderRadius).toBe(10)
  })

  it('WBAsset accepts font fields for sticky (REC-1)', () => {
    const sticky = makeAsset({
      type: 'sticky',
      text: 'Note',
      fontFamily: '"Courier New", monospace',
      fontWeight: 700,
      fontStyle: 'italic',
      textAlign: 'right',
      fontSize: 18,
    })
    expect(sticky.fontFamily).toBe('"Courier New", monospace')
    expect(sticky.fontWeight).toBe(700)
    expect(sticky.fontStyle).toBe('italic')
    expect(sticky.textAlign).toBe('right')
    expect(sticky.fontSize).toBe(18)
  })

  it('WBAsset new fields are optional (backward compatible)', () => {
    const asset = makeAsset()
    expect(asset.opacity).toBeUndefined()
    expect(asset.borderRadius).toBeUndefined()
    expect(asset.fontFamily).toBeUndefined()
    expect(asset.fontWeight).toBeUndefined()
  })
})

// ─── A2: Font Constants ─────────────────────────────────────────────────────

describe('A2: Font Constants', () => {
  it('AVAILABLE_FONTS has 6 entries', () => {
    expect(AVAILABLE_FONTS).toHaveLength(6)
  })

  it('each font has label and value', () => {
    for (const font of AVAILABLE_FONTS) {
      expect(font.label).toBeTruthy()
      expect(font.value).toBeTruthy()
    }
  })

  it('Inter is first font', () => {
    expect(AVAILABLE_FONTS[0].label).toBe('Inter')
    expect(AVAILABLE_FONTS[0].value).toContain('Inter')
  })

  it('defaults are correct', () => {
    expect(DEFAULT_FONT_FAMILY).toBe('Inter, sans-serif')
    expect(DEFAULT_FONT_WEIGHT).toBe(400)
    expect(DEFAULT_FONT_STYLE).toBe('normal')
    expect(DEFAULT_TEXT_ALIGN).toBe('left')
  })
})

// ─── A3: boardStore — gridSize + backgroundColor ────────────────────────────

describe('A3: boardStore gridSize + backgroundColor', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('default gridSize is 20', () => {
    const store = useWBStore()
    expect(store.gridSize).toBe(20)
  })

  it('default backgroundColor is #ffffff', () => {
    const store = useWBStore()
    expect(store.backgroundColor).toBe('#ffffff')
  })

  it('setGridSize clamps to min 10', () => {
    const store = useWBStore()
    store.setGridSize(5)
    expect(store.gridSize).toBe(10)
  })

  it('setGridSize clamps to max 100', () => {
    const store = useWBStore()
    store.setGridSize(200)
    expect(store.gridSize).toBe(100)
  })

  it('setGridSize sets valid value and marks dirty', () => {
    const store = useWBStore()
    store.isDirty = false
    store.setGridSize(40)
    expect(store.gridSize).toBe(40)
    expect(store.isDirty).toBe(true)
  })

  it('setBackgroundColor sets value and marks dirty', () => {
    const store = useWBStore()
    store.isDirty = false
    store.setBackgroundColor('#f0f0f0')
    // Phase 35: setBackgroundColor writes to current page (per-page only),
    // accessed via currentPageBgColor getter (not state-level backgroundColor)
    expect(store.currentPageBgColor).toBe('#f0f0f0')
    expect(store.isDirty).toBe(true)
  })
})

// ─── A4: buildKonvaFontStyle ────────────────────────────────────────────────

describe('A4: buildKonvaFontStyle', () => {
  it('returns "normal" for no args', () => {
    expect(buildKonvaFontStyle()).toBe('normal')
  })

  it('returns "normal" for undefined args', () => {
    expect(buildKonvaFontStyle(undefined, undefined)).toBe('normal')
  })

  it('returns "normal" for weight=400, style=normal', () => {
    expect(buildKonvaFontStyle(400, 'normal')).toBe('normal')
  })

  it('returns "bold" for weight=700', () => {
    expect(buildKonvaFontStyle(700)).toBe('bold')
  })

  it('returns "italic" for style=italic', () => {
    expect(buildKonvaFontStyle(undefined, 'italic')).toBe('italic')
  })

  it('returns "bold italic" for weight=700 + italic', () => {
    expect(buildKonvaFontStyle(700, 'italic')).toBe('bold italic')
  })

  it('returns "normal" for weight=400 only', () => {
    expect(buildKonvaFontStyle(400)).toBe('normal')
  })
})

// ─── A5: Image opacity + borderRadius ───────────────────────────────────────

describe('A5: Image opacity', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('asset with opacity stores correctly', () => {
    const store = useWBStore()
    seedPage(store)
    const asset = makeAsset({ id: 'img-1', opacity: 0.7 })
    store.addAsset(asset, 'page-1', { skipHistory: true })
    const page = store.currentPage!
    const found = page.assets.find(a => a.id === 'img-1')
    expect(found?.opacity).toBe(0.7)
  })

  it('asset without opacity defaults to undefined (render handles default)', () => {
    const asset = makeAsset({ id: 'img-2' })
    expect(asset.opacity).toBeUndefined()
  })
})

describe('A5: Image borderRadius', () => {
  it('asset with borderRadius stores correctly', () => {
    const asset = makeAsset({ borderRadius: 12 })
    expect(asset.borderRadius).toBe(12)
  })

  it('borderRadius is optional', () => {
    const asset = makeAsset()
    expect(asset.borderRadius).toBeUndefined()
  })
})

// ─── A6: Grid size + background color in store ──────────────────────────────

describe('A6: Grid size integration', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('setGridSize accepts intermediate values', () => {
    const store = useWBStore()
    store.setGridSize(50)
    expect(store.gridSize).toBe(50)
  })

  it('setGridSize boundary: exactly 10 is valid', () => {
    const store = useWBStore()
    store.setGridSize(10)
    expect(store.gridSize).toBe(10)
  })

  it('setGridSize boundary: exactly 100 is valid', () => {
    const store = useWBStore()
    store.setGridSize(100)
    expect(store.gridSize).toBe(100)
  })
})

describe('A6: Background color integration', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('setBackgroundColor accepts any color string', () => {
    const store = useWBStore()
    store.setBackgroundColor('rgb(200, 200, 200)')
    expect(store.currentPageBgColor).toBe('rgb(200, 200, 200)')
  })

  it('setBackgroundColor accepts hex', () => {
    const store = useWBStore()
    store.setBackgroundColor('#1e293b')
    expect(store.currentPageBgColor).toBe('#1e293b')
  })

  it('updateObject can change asset opacity', () => {
    const store = useWBStore()
    seedPage(store)
    const asset = makeAsset({ id: 'asset-op', opacity: 1 })
    store.addAsset(asset, 'page-1', { skipHistory: true })
    store.updateObject('asset-op', { opacity: 0.5 })
    const found = store.currentPage!.assets.find(a => a.id === 'asset-op')
    expect(found?.opacity).toBe(0.5)
  })

  it('updateObject can change stroke font fields', () => {
    const store = useWBStore()
    seedPage(store)
    const stroke = makeStroke({ id: 'text-1', tool: 'text', text: 'Test' })
    store.addStroke(stroke, { skipHistory: true })
    store.updateObject('text-1', { fontFamily: 'Georgia, serif', fontWeight: 700 })
    const found = store.currentPage!.strokes.find(s => s.id === 'text-1')
    expect(found?.fontFamily).toBe('Georgia, serif')
    expect(found?.fontWeight).toBe(700)
  })

  it('updateObject can change sticky font fields (REC-1)', () => {
    const store = useWBStore()
    seedPage(store)
    const sticky = makeAsset({ id: 'sticky-1', type: 'sticky', text: 'Note' })
    store.addAsset(sticky, 'page-1', { skipHistory: true })
    store.updateObject('sticky-1', { fontFamily: '"Courier New", monospace', textAlign: 'center' })
    const found = store.currentPage!.assets.find(a => a.id === 'sticky-1')
    expect(found?.fontFamily).toBe('"Courier New", monospace')
    expect(found?.textAlign).toBe('center')
  })
})
