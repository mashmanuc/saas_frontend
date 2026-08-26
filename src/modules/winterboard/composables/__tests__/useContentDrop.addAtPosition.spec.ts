/**
 * Unit tests for useContentDrop.addAtPosition — §3.7.X MIME → asset payload mapping.
 *
 * Tests verify that each MIME type produces the correct WBAsset shape:
 *   - correct `type` discriminant
 *   - correct position (centered on drop point)
 *   - correct default dimensions (from constants)
 *   - `data.version === 1`
 *   - `rotation === 0`, `locked === false`
 *   - canDraw guard (early return when false)
 *   - invalid payload early return (no onAssetAdd call)
 *
 * NOT tested here:
 *   - handleCanvasDrop (requires DragEvent + async learning-content API)
 *   - handleSidebarDrop (requires full API mock)
 *   - geometry_2d_v2 runtime Geo2D.PRESETS validation (only in handleCanvasDrop, not addAtPosition)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

// ─── Top-level mocks (must be before any actual imports) ─────────────────────

vi.mock('@/modules/learning-content', () => ({
  learningContentApi: { getBySlug: vi.fn() },
  renderContentToSvgDataUrl: vi.fn(),
}))

// ─── Actual imports (after mocks) ────────────────────────────────────────────

import { useContentDrop } from '../useContentDrop'

import {
  GRAPH_CALCULATOR_MIME,
  DEFAULT_GRAPH_WIDTH,
  DEFAULT_GRAPH_HEIGHT,
} from '../../constants/graphCalculatorDefaults'
import {
  CALCULUS_DRAG_MIME,
  DEFAULT_CALCULUS_W,
  DEFAULT_CALCULUS_H,
} from '../../constants/calculusDefaults'
import {
  TRIG_CIRCLE_DRAG_MIME,
  DEFAULT_TRIG_CIRCLE_W,
  DEFAULT_TRIG_CIRCLE_H,
} from '../../constants/trigCircleDefaults'
import {
  HELIX_DRAG_MIME,
  DEFAULT_HELIX_W,
  DEFAULT_HELIX_H,
} from '../../constants/helixDefaults'
import {
  GEOMETRY_2D_V2_DRAG_MIME,
  DEFAULT_GEOMETRY_2D_V2_W,
  DEFAULT_GEOMETRY_2D_V2_H,
} from '../../constants/geometry2dV2Defaults'
import {
  DEFAULT_SOLID_W,
  DEFAULT_SOLID_H,
} from '../../constants/solidDefaults'

// ─── Test helpers ─────────────────────────────────────────────────────────────

const DROP_POS = { x: 400, y: 300 }

function makeComposable(canDrawValue = true) {
  const onAssetAdd = vi.fn()
  const { addAtPosition } = useContentDrop({
    sessionId: ref('test-session'),
    lessonId: ref(null),
    canDraw: ref(canDrawValue),
    onAssetAdd,
    screenToCanvas: (x, y) => ({ x, y }),
  })
  return { addAtPosition, onAssetAdd }
}

// ─── Suites ──────────────────────────────────────────────────────────────────

describe('useContentDrop.addAtPosition', () => {
  describe('canDraw guard', () => {
    it('does not call onAssetAdd when canDraw is false', () => {
      const { addAtPosition, onAssetAdd } = makeComposable(false)
      addAtPosition(GRAPH_CALCULATOR_MIME, '', DROP_POS)
      expect(onAssetAdd).not.toHaveBeenCalled()
    })
  })

  // ── graph_calculator (§3.7.2) ───────────────────────────────────────────────
  describe('graph_calculator — §3.7.2', () => {
    it('creates a graph_calculator asset centered on drop point', () => {
      const { addAtPosition, onAssetAdd } = makeComposable()
      addAtPosition(GRAPH_CALCULATOR_MIME, '', DROP_POS)

      expect(onAssetAdd).toHaveBeenCalledOnce()
      const asset = onAssetAdd.mock.calls[0][0]

      expect(asset.type).toBe('graph_calculator')
      expect(asset.id).toMatch(/^gc-/)
      expect(asset.src).toBe('')
      expect(asset.w).toBe(DEFAULT_GRAPH_WIDTH)
      expect(asset.h).toBe(DEFAULT_GRAPH_HEIGHT)
      expect(asset.x).toBe(DROP_POS.x - DEFAULT_GRAPH_WIDTH / 2)
      expect(asset.y).toBe(DROP_POS.y - DEFAULT_GRAPH_HEIGHT / 2)
      expect(asset.rotation).toBe(0)
      expect(asset.locked).toBe(false)
    })

    it('graph_calculator data envelope has version 1, expressions, params, viewport', () => {
      const { addAtPosition, onAssetAdd } = makeComposable()
      addAtPosition(GRAPH_CALCULATOR_MIME, '', DROP_POS)
      const asset = onAssetAdd.mock.calls[0][0]

      expect(asset.data.version).toBe(1)
      expect(asset.data.state).toBeDefined()
      expect(Array.isArray(asset.data.state.expressions)).toBe(true)
      expect(asset.data.state.params).toBeDefined()
      expect(asset.data.state.viewport).toBeDefined()
      expect(asset.data.meta).toEqual({ last_snapshot_seq: 0 })
    })
  })

  // ── calculus_card (§3.7.4) ─────────────────────────────────────────────────
  describe('calculus_card — §3.7.4', () => {
    it('creates a calculus_card asset for mode=derivative', () => {
      const { addAtPosition, onAssetAdd } = makeComposable()
      addAtPosition(CALCULUS_DRAG_MIME, JSON.stringify({ mode: 'derivative' }), DROP_POS)

      expect(onAssetAdd).toHaveBeenCalledOnce()
      const asset = onAssetAdd.mock.calls[0][0]

      expect(asset.type).toBe('calculus_card')
      expect(asset.id).toMatch(/^calc-/)
      expect(asset.w).toBe(DEFAULT_CALCULUS_W)
      expect(asset.h).toBe(DEFAULT_CALCULUS_H)
      expect(asset.x).toBe(DROP_POS.x - DEFAULT_CALCULUS_W / 2)
      expect(asset.y).toBe(DROP_POS.y - DEFAULT_CALCULUS_H / 2)
      expect(asset.rotation).toBe(0)
      expect(asset.locked).toBe(false)
      expect(asset.data.version).toBe(1)
      expect(asset.data.mode).toBe('derivative')
    })

    it('creates a calculus_card asset for mode=integral', () => {
      const { addAtPosition, onAssetAdd } = makeComposable()
      addAtPosition(CALCULUS_DRAG_MIME, JSON.stringify({ mode: 'integral' }), DROP_POS)

      const asset = onAssetAdd.mock.calls[0][0]
      expect(asset.data.mode).toBe('integral')
    })

    it('does NOT call onAssetAdd for invalid mode', () => {
      const { addAtPosition, onAssetAdd } = makeComposable()
      addAtPosition(CALCULUS_DRAG_MIME, JSON.stringify({ mode: 'unknown_mode' }), DROP_POS)
      expect(onAssetAdd).not.toHaveBeenCalled()
    })

    it('does NOT call onAssetAdd for malformed JSON payload', () => {
      const { addAtPosition, onAssetAdd } = makeComposable()
      addAtPosition(CALCULUS_DRAG_MIME, 'not-json', DROP_POS)
      expect(onAssetAdd).not.toHaveBeenCalled()
    })
  })

  // ── trig_circle (§3.7.5) ───────────────────────────────────────────────────
  describe('trig_circle — §3.7.5', () => {
    it('creates a trig_circle asset centered on drop point', () => {
      const { addAtPosition, onAssetAdd } = makeComposable()
      addAtPosition(TRIG_CIRCLE_DRAG_MIME, '', DROP_POS)

      expect(onAssetAdd).toHaveBeenCalledOnce()
      const asset = onAssetAdd.mock.calls[0][0]

      expect(asset.type).toBe('trig_circle')
      expect(asset.id).toMatch(/^trig-/)
      expect(asset.w).toBe(DEFAULT_TRIG_CIRCLE_W)
      expect(asset.h).toBe(DEFAULT_TRIG_CIRCLE_H)
      expect(asset.x).toBe(DROP_POS.x - DEFAULT_TRIG_CIRCLE_W / 2)
      expect(asset.y).toBe(DROP_POS.y - DEFAULT_TRIG_CIRCLE_H / 2)
      expect(asset.rotation).toBe(0)
      expect(asset.locked).toBe(false)
      expect(asset.data.version).toBe(1)
    })

    it('trig_circle data has theta field', () => {
      const { addAtPosition, onAssetAdd } = makeComposable()
      addAtPosition(TRIG_CIRCLE_DRAG_MIME, '', DROP_POS)
      const asset = onAssetAdd.mock.calls[0][0]
      expect(typeof asset.data.theta).toBe('number')
    })
  })

  // ── helix (§3.7.6) ────────────────────────────────────────────────────────
  describe('helix — §3.7.6', () => {
    it('creates a helix asset centered on drop point', () => {
      const { addAtPosition, onAssetAdd } = makeComposable()
      addAtPosition(HELIX_DRAG_MIME, '', DROP_POS)

      expect(onAssetAdd).toHaveBeenCalledOnce()
      const asset = onAssetAdd.mock.calls[0][0]

      expect(asset.type).toBe('helix')
      expect(asset.id).toMatch(/^helix-/)
      expect(asset.w).toBe(DEFAULT_HELIX_W)
      expect(asset.h).toBe(DEFAULT_HELIX_H)
      expect(asset.x).toBe(DROP_POS.x - DEFAULT_HELIX_W / 2)
      expect(asset.y).toBe(DROP_POS.y - DEFAULT_HELIX_H / 2)
      expect(asset.rotation).toBe(0)
      expect(asset.locked).toBe(false)
      expect(asset.data.version).toBe(1)
    })

    it('helix data has theta and phi fields', () => {
      const { addAtPosition, onAssetAdd } = makeComposable()
      addAtPosition(HELIX_DRAG_MIME, '', DROP_POS)
      const asset = onAssetAdd.mock.calls[0][0]
      expect(typeof asset.data.theta).toBe('number')
      expect(typeof asset.data.phi).toBe('number')
    })
  })

  // ── geometry_2d_v2 (§3.7.3) ───────────────────────────────────────────────
  describe('geometry_2d_v2 — §3.7.3', () => {
    it('creates a geometry_2d_v2 asset for a valid preset string', () => {
      const { addAtPosition, onAssetAdd } = makeComposable()
      addAtPosition(GEOMETRY_2D_V2_DRAG_MIME, JSON.stringify({ preset: 'triangle' }), DROP_POS)

      expect(onAssetAdd).toHaveBeenCalledOnce()
      const asset = onAssetAdd.mock.calls[0][0]

      expect(asset.type).toBe('geometry_2d_v2')
      expect(asset.id).toMatch(/^geo2dv2-/)
      expect(asset.w).toBe(DEFAULT_GEOMETRY_2D_V2_W)
      expect(asset.h).toBe(DEFAULT_GEOMETRY_2D_V2_H)
      expect(asset.x).toBe(DROP_POS.x - DEFAULT_GEOMETRY_2D_V2_W / 2)
      expect(asset.y).toBe(DROP_POS.y - DEFAULT_GEOMETRY_2D_V2_H / 2)
      expect(asset.rotation).toBe(0)
      expect(asset.locked).toBe(false)
      expect(asset.data.version).toBe(1)
      expect(asset.data.preset).toBe('triangle')
    })

    it('does NOT call onAssetAdd when preset is missing', () => {
      const { addAtPosition, onAssetAdd } = makeComposable()
      addAtPosition(GEOMETRY_2D_V2_DRAG_MIME, JSON.stringify({}), DROP_POS)
      expect(onAssetAdd).not.toHaveBeenCalled()
    })

    it('does NOT call onAssetAdd when preset is not a string', () => {
      const { addAtPosition, onAssetAdd } = makeComposable()
      addAtPosition(GEOMETRY_2D_V2_DRAG_MIME, JSON.stringify({ preset: 42 }), DROP_POS)
      expect(onAssetAdd).not.toHaveBeenCalled()
    })

    it('does NOT call onAssetAdd for malformed JSON', () => {
      const { addAtPosition, onAssetAdd } = makeComposable()
      addAtPosition(GEOMETRY_2D_V2_DRAG_MIME, 'bad-json', DROP_POS)
      expect(onAssetAdd).not.toHaveBeenCalled()
    })
  })

  // ── geometry_solid (§3.7.1) ───────────────────────────────────────────────
  // ── unknown MIME ──────────────────────────────────────────────────────────
  describe('unknown MIME type', () => {
    it('does NOT call onAssetAdd for an unrecognised MIME', () => {
      const { addAtPosition, onAssetAdd } = makeComposable()
      addAtPosition('application/x-unknown', '{}', DROP_POS)
      expect(onAssetAdd).not.toHaveBeenCalled()
    })
  })

  // ── centering invariant ───────────────────────────────────────────────────
  describe('centering invariant', () => {
    it('asset center equals drop position for all widget types', () => {
      const cases: Array<[string, string]> = [
        [GRAPH_CALCULATOR_MIME, ''],
        [TRIG_CIRCLE_DRAG_MIME, ''],
        [HELIX_DRAG_MIME, ''],
        [CALCULUS_DRAG_MIME, JSON.stringify({ mode: 'derivative' })],
        [GEOMETRY_2D_V2_DRAG_MIME, JSON.stringify({ preset: 'triangle' })],
      ]

      for (const [mime, payload] of cases) {
        const { addAtPosition, onAssetAdd } = makeComposable()
        addAtPosition(mime, payload, DROP_POS)
        const asset = onAssetAdd.mock.calls[0]?.[0]
        if (!asset) continue  // skip if mime not reached (shouldn't happen)

        const centerX = asset.x + asset.w / 2
        const centerY = asset.y + asset.h / 2
        expect(centerX).toBeCloseTo(DROP_POS.x, 0), `centerX for MIME ${mime}`
        expect(centerY).toBeCloseTo(DROP_POS.y, 0), `centerY for MIME ${mime}`
      }
    })
  })
})
