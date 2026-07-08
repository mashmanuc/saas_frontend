/**
 * insertRegistry SSOT — Фаза 0 (ТЗ: m4sh_graph/MASH_PANEL_ARCHITECTURE_TZ.md §9).
 *
 * Інваріанти:
 *   INV-REG-1  реєстр дзеркалить джерела трейв (NMT3D_TEMPLATE_ORDER,
 *              CALCULUS_PRESETS, singletons) — без розбіжностей і без зайвого.
 *   INV-REG-2  кожен entry.dragMime має гілку-резолвер у addAtPosition
 *              (useContentDrop.ts:1000) — перевіряємо проти незалежного списку MIME.
 *   INV-REG-3  searchInserts детермінований; порожній q = всі; ловить укр+латинь.
 *   INV-REG-4  geo (планіметрія) = рантайм: без window.GEO_PRESETS порожньо,
 *              з ним — дзеркалить.
 */
import { describe, it, expect, afterEach } from 'vitest'
import {
  STATIC_INSERTS,
  allInserts,
  geoInserts,
  searchInserts,
  insertsByFamily,
  type InsertEntry,
} from '../insertRegistry'
import { NMT3D_DRAG_MIME, NMT3D_TEMPLATE_ORDER } from '../../../constants/nmt3dDefaults'
import { CALCULUS_DRAG_MIME, CALCULUS_PRESETS } from '../../../constants/calculusDefaults'
import { GRAPH_CALCULATOR_MIME } from '../../../constants/graphCalculatorDefaults'
import { QUAD_DRAG_MIME } from '../../../constants/quadDefaults'
import { TRIG_CIRCLE_DRAG_MIME } from '../../../constants/trigCircleDefaults'
import { HELIX_DRAG_MIME } from '../../../constants/helixDefaults'
import { TRIG_SOLVER_DRAG_MIME } from '../../../constants/trigSolverDefaults'
import { GEOMETRY_2D_V2_DRAG_MIME } from '../../../constants/geometry2dV2Defaults'

/**
 * MIME-и, що МАЮТЬ гілку-резолвер у useContentDrop.addAtPosition (useContentDrop.ts:1000)
 * + дзеркальні drag-drop гілки handleCanvasDrop. Незалежне джерело правди для INV-REG-2:
 * якщо у реєстр додадуть MIME без резолвера — тест впаде, нагадавши додати гілку.
 */
const RESOLVER_MIMES = new Set<string>([
  GRAPH_CALCULATOR_MIME,   // graph_calculator
  CALCULUS_DRAG_MIME,      // calculus_card
  TRIG_CIRCLE_DRAG_MIME,   // trig_circle
  HELIX_DRAG_MIME,         // helix
  TRIG_SOLVER_DRAG_MIME,   // trig_solver
  NMT3D_DRAG_MIME,         // nmt3d
  QUAD_DRAG_MIME,          // quadratic_card
  GEOMETRY_2D_V2_DRAG_MIME, // geometry_2d_v2
])

function ids(entries: readonly InsertEntry[]): string[] {
  return entries.map((e) => e.id)
}

afterEach(() => {
  // прибрати рантайм-моки geo між тестами
  delete (window as unknown as { GEO_PRESETS?: unknown }).GEO_PRESETS
})

describe('insertRegistry (Фаза 0)', () => {
  it('INV-REG-1: stereo дзеркалить NMT3D_TEMPLATE_ORDER 1:1 (той самий MIME + payload)', () => {
    const stereo = STATIC_INSERTS.filter((e) => e.family === 'stereo')
    expect(stereo).toHaveLength(NMT3D_TEMPLATE_ORDER.length) // 25, без зайвого
    for (const key of NMT3D_TEMPLATE_ORDER) {
      const entry = stereo.find((e) => e.id === `stereo.${key}`)
      expect(entry, key).toBeDefined()
      expect(entry!.dragMime).toBe(NMT3D_DRAG_MIME)
      expect(entry!.payload).toBe(JSON.stringify({ templateKey: key }))
      expect(entry!.labelFallback.length).toBeGreaterThan(0)
    }
  })

  it('INV-REG-1: analysis дзеркалить graphCalc + CALCULUS_PRESETS', () => {
    const analysis = STATIC_INSERTS.filter((e) => e.family === 'analysis')
    // 1 graphCalc + N calculus modes
    expect(analysis).toHaveLength(1 + CALCULUS_PRESETS.length)
    const gc = analysis.find((e) => e.id === 'analysis.graphCalc')!
    expect(gc.dragMime).toBe(GRAPH_CALCULATOR_MIME)
    expect(gc.payload).toBe('{}')
    for (const p of CALCULUS_PRESETS) {
      const entry = analysis.find((e) => e.id === `analysis.calculus.${p.mode}`)!
      expect(entry, p.mode).toBeDefined()
      expect(entry.dragMime).toBe(CALCULUS_DRAG_MIME)
      expect(entry.payload).toBe(JSON.stringify({ mode: p.mode }))
    }
  })

  it('INV-REG-1: singletons quadratic + trig (3) з правильними payload', () => {
    const quad = STATIC_INSERTS.filter((e) => e.family === 'quadratic')
    expect(ids(quad)).toEqual(['quadratic.card'])
    expect(quad[0].dragMime).toBe(QUAD_DRAG_MIME)
    expect(quad[0].payload).toBe('{}')

    const trig = STATIC_INSERTS.filter((e) => e.family === 'trig')
    expect(ids(trig).sort()).toEqual(['trig.circle', 'trig.helix', 'trig.solver'])
    const byId = Object.fromEntries(trig.map((e) => [e.id, e]))
    expect(byId['trig.circle'].dragMime).toBe(TRIG_CIRCLE_DRAG_MIME)
    expect(byId['trig.circle'].payload).toBe(JSON.stringify({ type: 'trig_circle' }))
    expect(byId['trig.helix'].dragMime).toBe(HELIX_DRAG_MIME)
    expect(byId['trig.helix'].payload).toBe(JSON.stringify({ type: 'helix' }))
    expect(byId['trig.solver'].dragMime).toBe(TRIG_SOLVER_DRAG_MIME)
    expect(byId['trig.solver'].payload).toBe(JSON.stringify({ type: 'sin' }))
  })

  it('INV-REG-1: усі id унікальні', () => {
    const all = ids(STATIC_INSERTS)
    expect(new Set(all).size).toBe(all.length)
  })

  it('INV-REG-1b: кожен entry має непорожній iconKey (для <InsertIcon>)', () => {
    for (const e of STATIC_INSERTS) {
      expect(typeof e.iconKey === 'string' && e.iconKey.length > 0, e.id).toBe(true)
    }
    // stereo iconKey == tplKey (для точної SVG-іконки)
    const cube = STATIC_INSERTS.find((e) => e.id === 'stereo.cube')!
    expect(cube.iconKey).toBe('cube')
  })

  it('INV-REG-2: кожен dragMime має резолвер у addAtPosition', () => {
    for (const e of STATIC_INSERTS) {
      expect(RESOLVER_MIMES.has(e.dragMime), `${e.id} → ${e.dragMime}`).toBe(true)
    }
    // geo (рантайм) теж
    ;(window as unknown as { GEO_PRESETS: unknown }).GEO_PRESETS = [
      { type: 'triangle', short: 'A·B·C', full: 'Трикутник', desc: 'медіани' },
    ]
    for (const e of geoInserts()) {
      expect(RESOLVER_MIMES.has(e.dragMime), `${e.id} → ${e.dragMime}`).toBe(true)
    }
  })

  it('INV-REG-2: кожен payload — валідний JSON', () => {
    for (const e of STATIC_INSERTS) {
      expect(() => JSON.parse(e.payload), e.id).not.toThrow()
    }
  })

  it('INV-REG-3: searchInserts — порожній q = всі; детермінований; укр+латинь', () => {
    expect(searchInserts('', STATIC_INSERTS as InsertEntry[])).toHaveLength(STATIC_INSERTS.length)
    // укр
    const kub = searchInserts('куб', STATIC_INSERTS as InsertEntry[])
    expect(kub.some((e) => e.id === 'stereo.cube')).toBe(true)
    // латинь (ключ)
    const cube = searchInserts('cube', STATIC_INSERTS as InsertEntry[])
    expect(cube.some((e) => e.id === 'stereo.cube')).toBe(true)
    // детермінізм
    expect(ids(searchInserts('циліндр', STATIC_INSERTS as InsertEntry[])))
      .toEqual(ids(searchInserts('циліндр', STATIC_INSERTS as InsertEntry[])))
    // міс
    expect(searchInserts('zzz-нема-такого', STATIC_INSERTS as InsertEntry[])).toHaveLength(0)
  })

  it('INV-REG-4: geo порожньо без window.GEO_PRESETS, дзеркалить з ним', () => {
    expect(geoInserts()).toHaveLength(0)
    ;(window as unknown as { GEO_PRESETS: unknown }).GEO_PRESETS = [
      { type: 'triangle', short: 'A·B·C', full: 'Трикутник', desc: 'медіани · висоти' },
      { type: 'circle', short: 'O·r', full: 'Коло', desc: 'радіус' },
    ]
    const geo = geoInserts()
    expect(ids(geo)).toEqual(['planimetry.triangle', 'planimetry.circle'])
    expect(geo[0].dragMime).toBe(GEOMETRY_2D_V2_DRAG_MIME)
    expect(geo[0].payload).toBe(JSON.stringify({ preset: 'triangle' }))
    expect(geo[0].labelFallback).toBe('Трикутник')
    // пошук ловить рантайм-geo
    expect(searchInserts('коло', geo).some((e) => e.id === 'planimetry.circle')).toBe(true)
  })

  it('allInserts + insertsByFamily: об’єднує статичні + рантайм-geo', () => {
    ;(window as unknown as { GEO_PRESETS: unknown }).GEO_PRESETS = [
      { type: 'triangle', short: 'A·B·C', full: 'Трикутник', desc: '' },
    ]
    const all = allInserts()
    expect(all.length).toBe(STATIC_INSERTS.length + 1)
    const byFam = insertsByFamily(all)
    expect(byFam.stereo).toHaveLength(NMT3D_TEMPLATE_ORDER.length)
    expect(byFam.planimetry).toHaveLength(1)
    expect(byFam.trig).toHaveLength(3)
  })
})
