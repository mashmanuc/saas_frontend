/**
 * overlayRegistry.spec.ts — Coverage test для OVERLAY_RENDERERS.
 *
 * Refinement A (Z_ORDER_UNIFIED_PLAN v4.0):
 *   Compiler-time coverage: KONVA_PROXY_TYPES (WBCanvas SSOT) ⊆ ключі registry.
 *   Новий overlay-тип без entry тут → тест падає (fail-on-missing, не silently).
 *
 * КОНВЕНЦІЯ: KONVA_PROXY_TYPES = канонічний список overlay-типів (коментар :903
 * у WBCanvas.vue). Registry ПОВИНЕН покривати всі ці типи.
 */
import { describe, it, expect } from 'vitest'
import { OVERLAY_RENDERERS, OVERLAY_ASSET_TYPES, isOverlayType } from '../components/canvas/overlayRegistry'

// Канонічний список з KONVA_PROXY_TYPES (WBCanvas.vue:907-920).
// При додаванні нового типу → оновити ТУТ і в registry.
const KONVA_PROXY_TYPES_CANONICAL = new Set([
  'geometry_solid',
  'graph_calculator',
  'geometry_2d_v2',
  'calculus_card',
  'trig_circle',
  'helix',
  'trig_solver',
  'nmt3d',
  'nmt_task',
  'quadratic_card',
  'formula_card',
  'theory_card',
])

describe('overlayRegistry — coverage (Refinement A, INV-RENDER-1)', () => {
  it('registry покриває всі KONVA_PROXY_TYPES (fail on missing type)', () => {
    for (const type of KONVA_PROXY_TYPES_CANONICAL) {
      expect(
        OVERLAY_RENDERERS,
        `Overlay type '${type}' є у KONVA_PROXY_TYPES але відсутній у OVERLAY_RENDERERS. ` +
        `Додай entry у overlayRegistry.ts.`,
      ).toHaveProperty(type)
    }
  })

  it('жоден зайвий тип не потрапив у registry (KONVA_PROXY_TYPES ↔ registry symmetric)', () => {
    for (const type of OVERLAY_ASSET_TYPES) {
      expect(
        KONVA_PROXY_TYPES_CANONICAL.has(type),
        `Тип '${type}' є у OVERLAY_RENDERERS але відсутній у KONVA_PROXY_TYPES_CANONICAL. ` +
        `Оновити KONVA_PROXY_TYPES_CANONICAL у цьому тесті.`,
      ).toBe(true)
    }
  })

  it("кожен entry має обов'язкові поля", () => {
    for (const [type, entry] of Object.entries(OVERLAY_RENDERERS)) {
      expect(entry.component, `${type}: component missing`).toBeDefined()
      expect(typeof entry.wrapperClass, `${type}: wrapperClass must be string`).toBe('string')
      expect(typeof entry.dataAttr, `${type}: dataAttr must be string`).toBe('string')
      expect(typeof entry.testidPrefix, `${type}: testidPrefix must be string`).toBe('string')
      expect(typeof entry.expandable, `${type}: expandable must be boolean`).toBe('boolean')
      expect(typeof entry.buildProps, `${type}: buildProps must be function`).toBe('function')
      expect(typeof entry.buildEvents, `${type}: buildEvents must be function`).toBe('function')
    }
  })

  it('isOverlayType: true для всіх registry-типів', () => {
    for (const type of OVERLAY_ASSET_TYPES) {
      expect(isOverlayType(type)).toBe(true)
    }
  })

  it('isOverlayType: false для media та невідомих типів', () => {
    expect(isOverlayType('audio_player')).toBe(false)
    expect(isOverlayType('video_player')).toBe(false)
    expect(isOverlayType('youtube_player')).toBe(false)
    expect(isOverlayType('unknown_type')).toBe(false)
    expect(isOverlayType('stroke')).toBe(false)
  })

  it('graph_calculator: expandable=true і buildEvents включає 9 graph-методів', () => {
    const entry = OVERLAY_RENDERERS['graph_calculator']
    expect(entry.expandable).toBe(true)

    // Мінімальний mock ctx щоб перевірити keys
    const mockCtx = {
      isSelected: () => false,
      interactive: false,
      boardMode: 'edit',
      disableAnimation: false,
      expandedId: null,
      toggleExpand: () => {},
      onUpdate: () => {},
      onDelete: () => {},
      onFormulaEdit: () => {},
      onSpawnCompanions: () => {},
      graph: {
        paramSet: () => {},
        syncParams: () => {},
        setParamRange: () => {},
        pointAdd: () => {},
        pointSet: () => {},
        pointDelete: () => {},
        pointPromote: () => {},
      },
    } as any

    const mockAsset = { id: 'test-id', type: 'graph_calculator' } as any
    const events = entry.buildEvents(mockAsset, mockCtx)

    const graphEventKeys = [
      'update:asset', 'delete', 'expand',
      'param-set', 'param-sync', 'range-set',
      'point-add', 'point-set', 'point-delete', 'point-promote',
    ]
    for (const key of graphEventKeys) {
      expect(events, `graph_calculator events missing: ${key}`).toHaveProperty(key)
    }
  })

  it('formula_card: НЕ має update:asset, має request-edit + delete', () => {
    const entry = OVERLAY_RENDERERS['formula_card']
    expect(entry.expandable).toBe(false)

    const mockCtx = {
      isSelected: () => false,
      interactive: false,
      boardMode: 'edit',
      disableAnimation: false,
      expandedId: null,
      toggleExpand: () => {},
      onUpdate: () => {},
      onDelete: () => {},
      onFormulaEdit: () => {},
      onSpawnCompanions: () => {},
      graph: {} as any,
    } as any

    const mockAsset = { id: 'fc-id', type: 'formula_card' } as any
    const events = entry.buildEvents(mockAsset, mockCtx)

    expect(events).toHaveProperty('request-edit')
    expect(events).toHaveProperty('delete')
    expect(events).not.toHaveProperty('update:asset')
  })

  it('nmt_task: має spawn-companions', () => {
    const entry = OVERLAY_RENDERERS['nmt_task']
    const mockCtx = {
      isSelected: () => false,
      interactive: false,
      boardMode: 'edit',
      disableAnimation: false,
      expandedId: null,
      toggleExpand: () => {},
      onUpdate: () => {},
      onDelete: () => {},
      onFormulaEdit: () => {},
      onSpawnCompanions: () => {},
      graph: {} as any,
    } as any

    const mockAsset = { id: 'task-id', type: 'nmt_task' } as any
    const events = entry.buildEvents(mockAsset, mockCtx)

    expect(events).toHaveProperty('spawn-companions')
    expect(events).toHaveProperty('update:asset')
    expect(events).toHaveProperty('delete')
  })
})
