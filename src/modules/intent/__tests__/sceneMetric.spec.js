// Phase 1 (North Ship, блок A) — wb.scene.* метрика: чистий маппінг board_action.
// Перелік кейсів узгоджено з PHASE_1_SCENE_METRIC.md §7.1 (блок A).
import { describe, it, expect } from 'vitest'
import { sceneMetricFromAction, SCENE_INSERT_IDS, SCENE_INSERT_PREFIXES, NON_SCENE_INSERT_IDS } from '../sceneMetric'
import { STATIC_INSERTS, geoInserts } from '@/modules/winterboard/components/sidebar/insertRegistry'

describe('sceneMetricFromAction', () => {
  it('add_graph → wb.scene.created з kind=graph_calculator', () => {
    const m = sceneMetricFromAction({ kind: 'add_graph', payload: { expressions: [{ src: 'x^2' }] } })
    expect(m).toEqual({ event: 'created', kind: 'graph_calculator' })
  })

  it('add_tool сцена (analysis.graphCalc) → created graph_calculator', () => {
    const m = sceneMetricFromAction({ kind: 'add_tool', payload: { insert_id: 'analysis.graphCalc' } })
    expect(m).toEqual({ event: 'created', kind: 'graph_calculator' })
  })

  it('add_tool сцена (planimetry.*) → created geometry_2d_v2 — префіксна мапа', () => {
    const m = sceneMetricFromAction({ kind: 'add_tool', payload: { insert_id: 'planimetry.triangle' } })
    expect(m).toEqual({ event: 'created', kind: 'geometry_2d_v2' })
  })

  // P0 (рев'ю №001): stereo.* → nmt3d (БЕЗ підкреслення), не geometry_solid
  it('add_tool сцена (stereo.*) → created nmt3d — префіксна мапа', () => {
    const m = sceneMetricFromAction({ kind: 'add_tool', payload: { insert_id: 'stereo.cube' } })
    expect(m).toEqual({ event: 'created', kind: 'nmt3d' })
  })

  // P0 (рев'ю №001): 3d.* → graphmash_3d (utils/mashImport.ts), не nmt_3d
  it('add_tool сцена (3d.*) → created graphmash_3d', () => {
    for (const id of ['3d.blank', '3d.surface', '3d.curve', '3d.vectorField']) {
      const m = sceneMetricFromAction({ kind: 'add_tool', payload: { insert_id: id } })
      expect(m).toEqual({ event: 'created', kind: 'graphmash_3d' })
    }
  })

  // P0 (рев'ю №001): geomash.scene — СЦЕНА (geomash_scene), а не не-сцена
  it('add_tool сцена (geomash.scene) → created geomash_scene', () => {
    const m = sceneMetricFromAction({ kind: 'add_tool', payload: { insert_id: 'geomash.scene' } })
    expect(m).toEqual({ event: 'created', kind: 'geomash_scene' })
  })

  it('add_tool НЕ-сцена (quadratic.card) → null — жодної події', () => {
    const m = sceneMetricFromAction({ kind: 'add_tool', payload: { insert_id: 'quadratic.card' } })
    expect(m).toBeNull()
  })

  it('add_tool НЕ-сцена (calculus/trig.helix/trig.solver) → null', () => {
    for (const id of ['analysis.calculus.derivative', 'trig.helix', 'trig.solver']) {
      expect(sceneMetricFromAction({ kind: 'add_tool', payload: { insert_id: id } })).toBeNull()
    }
  })

  it('set_param graph_expression → word_edit graph_calculator', () => {
    const m = sceneMetricFromAction({ kind: 'set_param', payload: { type: 'graph_expression', value: 'cos(x)' } })
    expect(m).toEqual({ event: 'word_edit', kind: 'graph_calculator', op: 'graph_expression' })
  })

  it('set_geometry → word_edit geometry_2d_v2', () => {
    const m = sceneMetricFromAction({ kind: 'set_geometry', payload: { feature: 'median' } })
    expect(m).toEqual({ event: 'word_edit', kind: 'geometry_2d_v2', op: 'set_geometry' })
  })

  it('не-дійсні дії (add_card / add_text / add_page) → null', () => {
    for (const kind of ['add_card', 'add_text', 'add_formula', 'add_page', 'delete_object']) {
      expect(sceneMetricFromAction({ kind })).toBeNull()
    }
  })

  it('порожній action / без insert_id → null', () => {
    expect(sceneMetricFromAction({})).toBeNull()
    expect(sceneMetricFromAction(null)).toBeNull()
  })
})

// P1 (рев'ю №001 §2.1 + доповнення рев'юера 2026-08-01): guard ПРОТИ ДРЕЙФУ КАТАЛОГУ.
// Джерело правди — insertRegistry.ts: кожен id зі STATIC_INSERTS (+ рантайм geoInserts)
// мусить бути явно класифікований у sceneMetric.js. Новий інструмент у каталозі без
// запису в мапу — цей тест впаде. Раніше guard звіряв модуль сам із собою — тепер ні.
describe('catalog guard (P1, реєстр-driven)', () => {
  it('кожен id зі STATIC_INSERTS класифікований і код узгоджений', () => {
    for (const entry of STATIC_INSERTS) {
      const isExplicitScene = SCENE_INSERT_IDS.includes(entry.id)
      const isExplicitNonScene = NON_SCENE_INSERT_IDS.includes(entry.id)
      const isPrefixScene = SCENE_INSERT_PREFIXES.some((p) => entry.id.startsWith(p + '.'))
      const isSceneByCode = sceneMetricFromAction({ kind: 'add_tool', payload: { insert_id: entry.id } }) !== null

      expect(isExplicitScene || isExplicitNonScene || isPrefixScene,
        `id ${entry.id} не класифікований у sceneMetric.js`).toBe(true)
      expect(!(isExplicitScene && isExplicitNonScene),
        `id ${entry.id} у обох списках (сцена і не-сцена)`).toBe(true)
      expect(isSceneByCode,
        `sceneMetric.js розходиться з класифікацією каталогу для ${entry.id}`).toBe(isExplicitScene || isPrefixScene)
    }
  })

  it('рантайм-планіметрія (geoInserts) класифікується префіксом, якщо присутня', () => {
    const presets = geoInserts()
    if (presets.length === 0) return // без window.GEO_PRESETS рантайм порожній — vendor не завантажено
    for (const entry of presets) {
      expect(sceneMetricFromAction({ kind: 'add_tool', payload: { insert_id: entry.id } }),
        `planimetry id ${entry.id} не розпізнано у sceneMetric.js`).not.toBeNull()
    }
  })

  it('усі SCENE_INSERT_IDS дають подію-створення', () => {
    for (const id of SCENE_INSERT_IDS) {
      const m = sceneMetricFromAction({ kind: 'add_tool', payload: { insert_id: id } })
      expect(m?.event).toBe('created')
    }
  })

  it('усі NON_SCENE_INSERT_IDS не дають жодної події', () => {
    for (const id of NON_SCENE_INSERT_IDS) {
      expect(sceneMetricFromAction({ kind: 'add_tool', payload: { insert_id: id } })).toBeNull()
    }
  })
})
