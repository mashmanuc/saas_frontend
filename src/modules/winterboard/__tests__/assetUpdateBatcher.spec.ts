/**
 * Phase 1B (Plan v1.1): Tests для assetUpdateBatcher (per-asset_id RAF coalesce).
 *
 * Plan ref: saas_docs/plans/classroom/CORE_UPDATEASSET_STABILIZATION_PLAN_2026-05-04.md §3.2 Layer B
 * Module: board/state/assetUpdateBatcher.ts
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  scheduleBufferedUpdate,
  flushPendingUpdates,
  cancelPendingUpdates,
  _pendingCountForTests,
  _hasPendingForTests,
} from '../board/state/assetUpdateBatcher'
import type { WBAsset } from '../types/winterboard'

function makeAsset(id: string, overrides: Partial<WBAsset> = {}): WBAsset {
  return {
    id,
    type: 'image',
    src: 'test.png',
    x: 0, y: 0, w: 100, h: 100,
    rotation: 0,
    ...overrides,
  }
}

describe('assetUpdateBatcher — per-asset_id RAF coalesce', () => {
  beforeEach(() => {
    cancelPendingUpdates()
    vi.useFakeTimers()
    // Mock requestAnimationFrame у window/globalThis (vitest jsdom default)
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      return setTimeout(() => cb(performance.now()), 16) as unknown as number
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      clearTimeout(id as unknown as ReturnType<typeof setTimeout>)
    })
  })

  afterEach(() => {
    cancelPendingUpdates()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  // ─── 1. Basic batching ──────────────────────────────────────────────

  it('1. single update → 1 apply call after RAF', () => {
    const apply = vi.fn()
    scheduleBufferedUpdate(makeAsset('a', { x: 10 }), undefined, apply)

    expect(apply).not.toHaveBeenCalled()  // не immediate
    expect(_pendingCountForTests()).toBe(1)

    vi.advanceTimersByTime(16)  // RAF fires

    expect(apply).toHaveBeenCalledTimes(1)
    expect(apply).toHaveBeenCalledWith(expect.objectContaining({ id: 'a', x: 10 }), undefined)
    expect(_pendingCountForTests()).toBe(0)
  })

  it('2. 8 consecutive updates same asset_id → 1 apply call (last-wins)', () => {
    const apply = vi.fn()
    for (let i = 0; i < 8; i++) {
      scheduleBufferedUpdate(makeAsset('a', { x: i * 10 }), undefined, apply)
    }
    expect(apply).not.toHaveBeenCalled()
    expect(_pendingCountForTests()).toBe(1)  // 1 entry per asset_id

    vi.advanceTimersByTime(16)

    expect(apply).toHaveBeenCalledTimes(1)
    expect(apply).toHaveBeenCalledWith(expect.objectContaining({ x: 70 }), undefined)  // last value (i=7)
  })

  it('3. updates на 2 різні asset_id → 2 apply calls (separate lanes)', () => {
    const applyA = vi.fn()
    const applyB = vi.fn()
    scheduleBufferedUpdate(makeAsset('a', { x: 10 }), undefined, applyA)
    scheduleBufferedUpdate(makeAsset('b', { x: 20 }), undefined, applyB)

    expect(_pendingCountForTests()).toBe(2)  // 2 окремі lanes

    vi.advanceTimersByTime(16)

    expect(applyA).toHaveBeenCalledTimes(1)
    expect(applyB).toHaveBeenCalledTimes(1)
    expect(applyA).toHaveBeenCalledWith(expect.objectContaining({ id: 'a', x: 10 }), undefined)
    expect(applyB).toHaveBeenCalledWith(expect.objectContaining({ id: 'b', x: 20 }), undefined)
  })

  // ─── 4. Drag-end natural via last-wins ─────────────────────────────

  it('4. drag pattern (pointermoves + drag-end) → 1 apply з final values', () => {
    const apply = vi.fn()
    // Симуляція 5 pointermoves + drag-end у тому самому frame
    scheduleBufferedUpdate(makeAsset('a', { x: 10 }), undefined, apply)
    scheduleBufferedUpdate(makeAsset('a', { x: 20 }), undefined, apply)
    scheduleBufferedUpdate(makeAsset('a', { x: 30 }), undefined, apply)
    scheduleBufferedUpdate(makeAsset('a', { x: 40 }), undefined, apply)
    scheduleBufferedUpdate(makeAsset('a', { x: 99 }), undefined, apply)  // drag-end (final)

    vi.advanceTimersByTime(16)

    expect(apply).toHaveBeenCalledTimes(1)
    expect(apply).toHaveBeenCalledWith(expect.objectContaining({ x: 99 }), undefined)
  })

  // ─── 5. opts last-wins ─────────────────────────────────────────────

  it('5. different opts across calls → final opts wins (skipHistory last value)', () => {
    const apply = vi.fn()
    scheduleBufferedUpdate(makeAsset('a', { x: 10 }), { skipHistory: false }, apply)
    scheduleBufferedUpdate(makeAsset('a', { x: 20 }), { skipHistory: true }, apply)

    vi.advanceTimersByTime(16)

    expect(apply).toHaveBeenCalledTimes(1)
    expect(apply).toHaveBeenCalledWith(
      expect.objectContaining({ x: 20 }),
      { skipHistory: true },  // last opts wins
    )
  })

  // ─── 6. flushPendingUpdates ────────────────────────────────────────

  it('6. flushPendingUpdates → synchronous flush (для unmount/route-leave)', () => {
    const apply = vi.fn()
    scheduleBufferedUpdate(makeAsset('a', { x: 10 }), undefined, apply)
    scheduleBufferedUpdate(makeAsset('b', { x: 20 }), undefined, apply)

    expect(apply).not.toHaveBeenCalled()
    flushPendingUpdates()  // no RAF wait

    expect(apply).toHaveBeenCalledTimes(2)
    expect(_pendingCountForTests()).toBe(0)
  })

  // ─── 7. cancelPendingUpdates ───────────────────────────────────────

  it('7. cancelPendingUpdates → drop без apply (DESYNC entry)', () => {
    const apply = vi.fn()
    scheduleBufferedUpdate(makeAsset('a', { x: 10 }), undefined, apply)
    scheduleBufferedUpdate(makeAsset('b', { x: 20 }), undefined, apply)

    cancelPendingUpdates()

    expect(_pendingCountForTests()).toBe(0)

    vi.advanceTimersByTime(100)
    expect(apply).not.toHaveBeenCalled()  // RAF cancelled, нічого не applied
  })

  // ─── 8. Sequential frames (post-flush new updates) ─────────────────

  it('8. update → flush → update → flush → 2 apply calls', () => {
    const apply = vi.fn()
    scheduleBufferedUpdate(makeAsset('a', { x: 10 }), undefined, apply)
    vi.advanceTimersByTime(16)  // flush #1

    expect(apply).toHaveBeenCalledTimes(1)

    scheduleBufferedUpdate(makeAsset('a', { x: 20 }), undefined, apply)
    vi.advanceTimersByTime(16)  // flush #2

    expect(apply).toHaveBeenCalledTimes(2)
    expect(apply).toHaveBeenLastCalledWith(expect.objectContaining({ x: 20 }), undefined)
  })

  // ─── 9. apply throws → не leak buffer ──────────────────────────────

  it('9. apply throws → buffer cleaned, error logged (NOT silently swallowed at top)', () => {
    const consoleErrSpy = vi.spyOn(console, 'error').mockImplementation(() => { /* silent */ })
    const apply = vi.fn(() => { throw new Error('test boom') })

    scheduleBufferedUpdate(makeAsset('a'), undefined, apply)
    vi.advanceTimersByTime(16)

    expect(apply).toHaveBeenCalledTimes(1)
    expect(_pendingCountForTests()).toBe(0)  // buffer cleaned навіть на error
    expect(consoleErrSpy).toHaveBeenCalled()  // error logged

    consoleErrSpy.mockRestore()
  })

  // ─── 10. _hasPendingForTests introspection ─────────────────────────

  it('10. _hasPendingForTests reports correct state', () => {
    expect(_hasPendingForTests('a')).toBe(false)

    scheduleBufferedUpdate(makeAsset('a'), undefined, vi.fn())
    expect(_hasPendingForTests('a')).toBe(true)
    expect(_hasPendingForTests('b')).toBe(false)

    vi.advanceTimersByTime(16)
    expect(_hasPendingForTests('a')).toBe(false)
  })
})
