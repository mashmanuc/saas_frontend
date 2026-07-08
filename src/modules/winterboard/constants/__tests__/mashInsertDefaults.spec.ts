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
})
