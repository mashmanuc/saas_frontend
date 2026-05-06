/**
 * Phase O PR-O1: Type-level tests для geometry_solid asset types.
 *
 * Ref:
 * - saas_docs/domains/winterboard/WINTERBOARD_SSOT.md §3.7.1
 * - saas_docs/domains/winterboard/phase_O_solid_objects/PLAN.md PR-O1
 *
 * Перевіряє що:
 *  - WBAsset.type union accepts 'geometry_solid'
 *  - SolidType union містить рівно 10 fixed values per SSOT
 *  - SolidAssetData має version=1 + 8-field state
 *  - SolidAsset typed alias enforce-ить mandatory data + src=SolidType
 */
import { describe, it, expect } from 'vitest'
import type {
  SolidAsset,
  SolidAssetData,
  SolidAssetState,
  SolidType,
  WBAsset,
} from '../types/winterboard'

// ── Helper: assertable runtime list синхронний з SolidType union ─────────
// Якщо SolidType union змінюється, цей const перестане compile-ity, бо TS
// перевірить exhaustiveness через satisfies.
const SOLID_TYPES = [
  'cube',
  'cuboid',
  'sphere',
  'cylinder',
  'cone',
  'tetrahedron',
  'pyramid3',
  'pyramid4',
  'prism3',
  'prism6',
] as const satisfies readonly SolidType[]

// Compile-time check: усі значення const мають належати SolidType
const _check: Record<SolidType, true> = {
  cube: true,
  cuboid: true,
  sphere: true,
  cylinder: true,
  cone: true,
  tetrahedron: true,
  pyramid3: true,
  pyramid4: true,
  prism3: true,
  prism6: true,
}
void _check

describe('Phase O — SolidType union', () => {
  it('contains exactly 10 fixed values per SSOT §3.7.1', () => {
    expect(SOLID_TYPES).toHaveLength(10)
    expect(new Set(SOLID_TYPES).size).toBe(10)
  })

  it('matches SSOT enumeration', () => {
    expect(SOLID_TYPES).toEqual([
      'cube',
      'cuboid',
      'sphere',
      'cylinder',
      'cone',
      'tetrahedron',
      'pyramid3',
      'pyramid4',
      'prism3',
      'prism6',
    ])
  })
})

describe('Phase O — SolidAssetState shape', () => {
  it('has exactly 8 keys per SSOT §3.7.1', () => {
    const state: SolidAssetState = {
      showFaces: true,
      showEdges: true,
      showVertices: false,
      transparent: false,
      showNet: false,
      showCut: false,
      cutHeight: 0.5,
      autoRotate: true,
    }
    expect(Object.keys(state).sort()).toEqual([
      'autoRotate',
      'cutHeight',
      'showCut',
      'showEdges',
      'showFaces',
      'showNet',
      'showVertices',
      'transparent',
    ])
  })

  it('cutHeight is numeric (0..1 enforced at validator level)', () => {
    const state: SolidAssetState = {
      showFaces: true,
      showEdges: true,
      showVertices: false,
      transparent: false,
      showNet: false,
      showCut: true,
      cutHeight: 0.7,
      autoRotate: false,
    }
    expect(typeof state.cutHeight).toBe('number')
  })
})

describe('Phase O — SolidAssetData envelope', () => {
  it('version literal is 1', () => {
    const data: SolidAssetData = {
      version: 1,
      state: {
        showFaces: true,
        showEdges: true,
        showVertices: false,
        transparent: false,
        showNet: false,
        showCut: false,
        cutHeight: 0.5,
        autoRotate: true,
      },
    }
    expect(data.version).toBe(1)
    // @ts-expect-error — version=2 must not type-check (replay schema migration)
    const _bad: SolidAssetData = { version: 2, state: data.state }
    void _bad
  })
})

describe('Phase O — WBAsset.type accepts geometry_solid', () => {
  it('typed alias SolidAsset enforces type+src+data', () => {
    const asset: SolidAsset = {
      id: 'solid-1',
      type: 'geometry_solid',
      src: 'cube',
      x: 0,
      y: 0,
      w: 240,
      h: 240,
      rotation: 0,
      data: {
        version: 1,
        state: {
          showFaces: true,
          showEdges: true,
          showVertices: false,
          transparent: false,
          showNet: false,
          showCut: false,
          cutHeight: 0.5,
          autoRotate: true,
        },
      },
    }
    expect(asset.type).toBe('geometry_solid')
    expect(asset.src).toBe('cube')
    expect(asset.data.version).toBe(1)
  })

  it('WBAsset accepts type=geometry_solid w/ optional data field', () => {
    // Generic WBAsset.data is optional (бо є інші types).
    // Type-safe access pattern: narrow by type.
    const a: WBAsset = {
      id: 'a',
      type: 'geometry_solid',
      src: 'sphere',
      x: 0,
      y: 0,
      w: 100,
      h: 100,
      rotation: 0,
      data: {
        version: 1,
        state: {
          showFaces: true,
          showEdges: false,
          showVertices: true,
          transparent: true,
          showNet: false,
          showCut: false,
          cutHeight: 0.5,
          autoRotate: false,
        },
      },
    }
    if (a.type === 'geometry_solid' && a.data) {
      // Phase G: WBAsset.data union'd із GraphCalculatorData — narrow по type='geometry_solid'
      // гарантує SolidAssetData payload.
      const s = a.data.state as SolidAssetState
      expect(s.showVertices).toBe(true)
    } else {
      throw new Error('narrow failed')
    }
  })

  it('preserves backward compat: existing types still allowed', () => {
    const img: WBAsset = {
      id: 'img-1',
      type: 'image',
      src: 'https://example.com/img.png',
      x: 0,
      y: 0,
      w: 100,
      h: 100,
      rotation: 0,
    }
    expect(img.type).toBe('image')
  })
})
