/**
 * BoardMASH Ф3.1 — default-білдери sidebar-вставки graphmash_3d / geomash_scene.
 *
 * INV-BM-7 (shape parity): sidebar default-білдер і funnel-scene (mashImport)
 * дають ОДНАКОВИЙ board object (той самий type + data-ключі) — «два входи,
 * один об'єкт». ТЗ: m4sh_graph/MASH_BOARDMASH_UNIFIED_TZ.md §5/§10.
 */
import { describe, expect, it } from 'vitest'
import {
  buildDefaultGraphmash3dAsset,
  buildDefaultGeomashSceneAsset,
  defaultGraphmash3dScene,
} from '../mashInsertDefaults'
import { buildGraphmash3dAsset, buildGeomashSceneAsset } from '../../utils/mashImport'
// INV-BM-3 — інспектор-стейти 4 scene-tools (диспатч по asset.type у GroupContentSidebar)
import { graphmash3dInspectorState } from '../../board/state/graphmash3dInspectorState'
import { geomashInspectorState } from '../../board/state/geomashInspectorState'
import { graphCalcInspectorState } from '../../board/state/graphCalcInspectorState'
import { nmt3dUiState } from '../../board/state/nmt3dUiState'

describe('mashInsertDefaults (BoardMASH Ф3.1)', () => {
  it('INV-BM-7: 3D sidebar default-білдер == funnel-scene shape (той самий kind + data-ключі)', () => {
    const sidebar = buildDefaultGraphmash3dAsset('surface')
    const funnel = buildGraphmash3dAsset({
      format: 'graphmash-scene', version: 2,
      objects: [{ id: 'e1', src: 'z=x', color: '#000' }], params: {},
    })!
    expect(sidebar.type).toBe('graphmash_3d')
    expect(sidebar.type).toBe(funnel.type)
    expect(Object.keys(sidebar.data as object).sort())
      .toEqual(Object.keys(funnel.data as object).sort())
  })

  it('стартери: surface/curve/vectorField → 1 об\'єкт з валідним src; blank → 0', () => {
    expect((defaultGraphmash3dScene('surface').objects as unknown[])).toHaveLength(1)
    expect((defaultGraphmash3dScene('curve').objects as unknown[])).toHaveLength(1)
    expect((defaultGraphmash3dScene('vectorField').objects as unknown[])).toHaveLength(1)
    expect((defaultGraphmash3dScene('blank').objects as unknown[])).toHaveLength(0)
    expect((defaultGraphmash3dScene(undefined).objects as unknown[])).toHaveLength(0)
    // src-и — не порожні (двигун-сумісні: surfaceZ / param / vectorField3D)
    const surf = (defaultGraphmash3dScene('surface').objects as Array<{ src: string }>)[0]
    expect(surf.src).toContain('z =')
  })

  it('INV-BM-7: geomash sidebar == funnel shape', () => {
    const gSidebar = buildDefaultGeomashSceneAsset()
    const gFunnel = buildGeomashSceneAsset({ format: 'geomash-scene', version: 1, objects: [], cs: { ox: 1, oy: 1, sc: 1 } })!
    expect(gSidebar.type).toBe('geomash_scene')
    expect(gSidebar.type).toBe(gFunnel.type)
    expect(Object.keys(gSidebar.data as object).sort()).toEqual(Object.keys(gFunnel.data as object).sort())
  })

  // ── INV-BM-3 inspector parity — кожен scene-tool має інспектор-стейт (диспатч по type) ──
  it('INV-BM-3: 4 scene-tools мають інспектор-стейт (той самий інспектор незалежно від входу)', () => {
    // Диспатч у GroupContentSidebar.hasActiveInspector — по цих reactive-стейтах.
    // Sidebar-вставлений і funnel-об'єкт мають ОДНАКОВИЙ asset.type → той самий стейт.
    expect('bridge' in graphmash3dInspectorState).toBe(true) // graphmash_3d
    expect('bridge' in geomashInspectorState).toBe(true)     // geomash_scene
    expect('bridge' in graphCalcInspectorState).toBe(true)   // graph_calculator
    expect('ws' in nmt3dUiState).toBe(true)                  // nmt3d
  })

  // ── INV-BM-7 edit parity — після редагування поля об'єкт лишається валідним ──
  it('INV-BM-7 edit: правка поля sidebar-об\'єкта зберігає валідний shape', () => {
    const asset = buildDefaultGraphmash3dAsset('surface')
    // Симулюємо inspector-edit (як patchObj у Graphmash3dRenderer): opacity 1→0.4
    const data = asset.data as unknown as { scene: { objects: Array<{ style: Record<string, unknown>; src: string }> } }
    data.scene.objects[0].style.opacity = 0.4
    // Об'єкт лишається валідним graphmash_3d з непорожнім src
    expect(asset.type).toBe('graphmash_3d')
    expect(Array.isArray(data.scene.objects)).toBe(true)
    expect(data.scene.objects[0].src.length).toBeGreaterThan(0)
    expect(data.scene.objects[0].style.opacity).toBe(0.4)
  })
})
