/**
 * Unit tests — replayFadeIn helper.
 *
 * Covers the ID-collection contract for both single and batch appearance
 * ops, plus the Konva fade-in application.
 */

import { describe, it, expect } from 'vitest'
import {
  collectNewIdsFromOp,
  applyAppearanceFadeIn,
} from '../engine/animation/replayFadeIn'
import type { BoardOperation } from '../types/replay'

function makeOp(op_type: string, payload: Record<string, unknown> = {}): BoardOperation {
  return {
    id: 1,
    op_type,
    page_id: 'page-1',
    payload,
    user: 1,
    created_at: '2026-04-18T00:00:00Z',
  }
}

describe('collectNewIdsFromOp', () => {
  it('extracts single ID from stroke_add', () => {
    expect(collectNewIdsFromOp(makeOp('stroke_add', { stroke: { id: 's1' } }))).toEqual(['s1'])
  })

  it('extracts single ID from asset_add', () => {
    expect(collectNewIdsFromOp(makeOp('asset_add', { asset: { id: 'a1' } }))).toEqual(['a1'])
  })

  it('extracts all IDs from strokes_add_batch (critical: paste use case)', () => {
    const strokes = Array.from({ length: 48 }, (_, i) => ({ id: `cube-s-${i}` }))
    const ids = collectNewIdsFromOp(makeOp('strokes_add_batch', { strokes }))
    expect(ids).toHaveLength(48)
    expect(ids[0]).toBe('cube-s-0')
    expect(ids[47]).toBe('cube-s-47')
  })

  it('extracts all IDs from assets_add_batch', () => {
    const assets = [{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }]
    expect(collectNewIdsFromOp(makeOp('assets_add_batch', { assets }))).toEqual([
      'a1',
      'a2',
      'a3',
    ])
  })

  it('returns [] for non-appearance ops (stroke_update, objects_move, etc.)', () => {
    expect(collectNewIdsFromOp(makeOp('stroke_update', { stroke: { id: 's1' } }))).toEqual([])
    expect(collectNewIdsFromOp(makeOp('objects_move', { items: [{ id: 'a1' }] }))).toEqual([])
    expect(collectNewIdsFromOp(makeOp('page_add', { page: { id: 'p1' } }))).toEqual([])
  })

  it('returns [] for appearance ops with missing payload', () => {
    expect(collectNewIdsFromOp(makeOp('stroke_add', {}))).toEqual([])
    expect(collectNewIdsFromOp(makeOp('strokes_add_batch', {}))).toEqual([])
    expect(collectNewIdsFromOp(makeOp('strokes_add_batch', { strokes: 'not-array' }))).toEqual([])
  })

  it('filters out items without id (including empty strings) in batch', () => {
    // Malformed shapes at the boundary — make sure the helper does not
    // feed an empty/missing id into a later `#${id}` selector.
    const strokes = [{ id: 's1' }, {}, { id: 's2' }, null, { id: '' }] as unknown as Array<{ id?: string }>
    expect(collectNewIdsFromOp(makeOp('strokes_add_batch', { strokes }))).toEqual(['s1', 's2'])
  })
})

describe('applyAppearanceFadeIn', () => {
  function makeStage() {
    const tweenCalls: Array<{ id: string; duration: number }> = []
    const opacityCalls: Array<{ id: string; value: number }> = []
    let drawCount = 0
    const nodes = new Map<string, { id: string; opacity: (v: number) => void; to: (o: { opacity: number; duration: number }) => void }>()
    function addNode(id: string): void {
      nodes.set(id, {
        id,
        opacity(v) { opacityCalls.push({ id, value: v }) },
        to(o) { tweenCalls.push({ id, duration: o.duration }) },
      })
    }
    return {
      _nodes: nodes,
      _tweenCalls: tweenCalls,
      _opacityCalls: opacityCalls,
      get drawCount() { return drawCount },
      addNode,
      findOne(selector: string) {
        const id = selector.replace(/^#/, '')
        return nodes.get(id) ?? null
      },
      batchDraw() { drawCount += 1 },
    }
  }

  it('fades in a single node', () => {
    const stage = makeStage()
    stage.addNode('s1')
    applyAppearanceFadeIn(stage, ['s1'])
    expect(stage._opacityCalls).toEqual([{ id: 's1', value: 0 }])
    expect(stage._tweenCalls).toEqual([{ id: 's1', duration: 0.25 }])
    expect(stage.drawCount).toBe(1)
  })

  it('fades in ALL nodes in a batch simultaneously (48 cubes case)', () => {
    const stage = makeStage()
    const ids = Array.from({ length: 48 }, (_, i) => `cube-${i}`)
    for (const id of ids) stage.addNode(id)
    applyAppearanceFadeIn(stage, ids)
    expect(stage._opacityCalls).toHaveLength(48)
    expect(stage._tweenCalls).toHaveLength(48)
    expect(stage._tweenCalls.every((c) => c.duration === 0.25)).toBe(true)
    expect(stage.drawCount).toBe(1) // ONE batchDraw for the whole set
  })

  it('silently skips missing nodes (seek race with batch op)', () => {
    const stage = makeStage()
    stage.addNode('exists')
    // 'missing' was already removed by a seek/reset — must not throw
    expect(() => applyAppearanceFadeIn(stage, ['exists', 'missing'])).not.toThrow()
    expect(stage._opacityCalls).toEqual([{ id: 'exists', value: 0 }])
  })

  it('no-op when stage is null (canvas not yet mounted)', () => {
    expect(() => applyAppearanceFadeIn(null, ['s1'])).not.toThrow()
  })

  it('no-op when ids array is empty', () => {
    const stage = makeStage()
    applyAppearanceFadeIn(stage, [])
    expect(stage.drawCount).toBe(0)
  })
})
