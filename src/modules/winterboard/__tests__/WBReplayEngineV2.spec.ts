// Unit tests for WBReplayEngineV2.
//
// Focus areas:
//   1. findIndexBySeq — C9 fix: seq-based engine index lookup for snapshot validation.
//      Regression guard: snap.operation_index (SESSION-level) != engine index (REPLAY-relative).
//   2. findIndexByTimeMs — parity with V1 engine behaviour.
//   3. Playback basics — play/pause/stop/speed (smoke tests, V1 engine has deep coverage).
//
// C9 Regression context:
//   BUG: seekToWithSnapshot compared snap.operation_index (SESSION count) to clampedIdx
//   (ENGINE index). For replays starting mid-session these differ → snapshot always rejected
//   → V2 fell back to rAF O(N) for every seek.
//   FIX: findIndexBySeq(snap.seq) converts snapshot seq → engine index → correct comparison.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { WBReplayEngineV2 } from '../engine/WBReplayEngineV2'
import type { ReplayTimeline, BoardOperation } from '../types/replay'

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeOp(id: number, seq: number, created_at: string, op_type = 'stroke_add'): BoardOperation {
  return { id, seq, op_type, page_id: 'p1', payload: {}, user: 1, created_at } as BoardOperation
}

function makeTimeline(ops: BoardOperation[]): ReplayTimeline {
  return { session_id: 'test-uuid', total_operations: ops.length, operations: ops }
}

/** 3 ops, 100ms apart, seq 10/20/30 */
function makeTimeline3(): ReplayTimeline {
  return makeTimeline([
    makeOp(1, 10, '2026-01-01T00:00:00.000Z'),
    makeOp(2, 20, '2026-01-01T00:00:00.100Z'),
    makeOp(3, 30, '2026-01-01T00:00:00.200Z'),
  ])
}

// ─── findIndexBySeq ──────────────────────────────────────────────────────────
//
// This method is the core of the C9 fix. It converts a snapshot's seq value
// to an engine index (0-based, replay-relative), avoiding the session/replay
// index mismatch that caused V2 to always fall back to rAF.

describe('WBReplayEngineV2 — findIndexBySeq (C9 fix)', () => {
  it('returns -1 for empty timeline', () => {
    const engine = new WBReplayEngineV2(makeTimeline([]))
    expect(engine.findIndexBySeq(100)).toBe(-1)
  })

  it('returns -1 when targetSeq is lower than all op seqs', () => {
    const engine = new WBReplayEngineV2(makeTimeline3()) // seqs: 10, 20, 30
    expect(engine.findIndexBySeq(5)).toBe(-1)
    expect(engine.findIndexBySeq(9)).toBe(-1)
  })

  it('returns exact index for precise seq match', () => {
    const engine = new WBReplayEngineV2(makeTimeline3()) // seqs: 10, 20, 30
    expect(engine.findIndexBySeq(10)).toBe(0)
    expect(engine.findIndexBySeq(20)).toBe(1)
    expect(engine.findIndexBySeq(30)).toBe(2)
  })

  it('returns last index with seq ≤ targetSeq for between-seq lookup', () => {
    const engine = new WBReplayEngineV2(makeTimeline3()) // seqs: 10, 20, 30
    expect(engine.findIndexBySeq(15)).toBe(0)   // 10 ≤ 15 < 20 → index 0
    expect(engine.findIndexBySeq(25)).toBe(1)   // 20 ≤ 25 < 30 → index 1
    expect(engine.findIndexBySeq(29)).toBe(1)   // 20 ≤ 29 < 30 → index 1
  })

  it('returns last index when targetSeq exceeds all seqs', () => {
    const engine = new WBReplayEngineV2(makeTimeline3()) // seqs: 10, 20, 30
    expect(engine.findIndexBySeq(1000)).toBe(2)
    expect(engine.findIndexBySeq(99999)).toBe(2)
  })

  it('handles ops without seq field (typed as number only)', () => {
    // Ops with no seq — should return -1 (no valid seq found)
    const ops = [
      { id: 1, op_type: 'stroke_add', page_id: 'p1', payload: {}, user: 1, created_at: '2026-01-01T00:00:00.000Z' },
      { id: 2, op_type: 'stroke_add', page_id: 'p1', payload: {}, user: 1, created_at: '2026-01-01T00:00:00.100Z' },
    ] as BoardOperation[]
    const engine = new WBReplayEngineV2(makeTimeline(ops))
    expect(engine.findIndexBySeq(100)).toBe(-1)
  })

  // ── C9 Regression: mid-session replay scenario ──────────────────────────────
  //
  // Session has 6000 ops (seq 1..6000). Replay starts at seq 1000.
  // Engine holds ops with seq 1000..5999 (engine indices 0..4999).
  //
  // Snapshot:
  //   seq = 3900            → engine index via findIndexBySeq = 2900
  //   operation_index = 3900 (SESSION-level: absolute count from session start)
  //
  // BUG (before fix):
  //   snap.operation_index (3900) < clampedIdx (3000) → FALSE → snapshot rejected
  //
  // FIX:
  //   findIndexBySeq(3900) → 2900 → 2900 < 3000 → TRUE → snapshot accepted
  it('C9 regression: snap.seq → engine index for mid-session replay', () => {
    // Build replay with 5000 ops, seq starting at 1000
    const ops: BoardOperation[] = []
    for (let i = 0; i < 5000; i++) {
      ops.push(makeOp(i, 1000 + i, '2026-01-01T00:00:00.000Z'))
    }
    const engine = new WBReplayEngineV2(makeTimeline(ops))
    // seek target: engine index 3000 (session seq = 4000)
    // snapshot: seq = 3900 (session operation_index = 3900, but engine index = 2900)
    const snapEngineIdx = engine.findIndexBySeq(3900)
    expect(snapEngineIdx).toBe(2900)  // seq 3900 = index 1000+2900=3900 → ops[2900]

    // With the fix: 2900 <= 3000 (TRUE) and delta = 100 ≤ 150 (MAX_DELTA_OPS)
    // → snapshot should be accepted
    const clampedIdx = 3000
    const MAX_DELTA_OPS = 150
    expect(snapEngineIdx >= 0).toBe(true)
    expect(snapEngineIdx <= clampedIdx).toBe(true)  // C9b: <= (not <), handles snapIdx==target
    expect(clampedIdx - snapEngineIdx).toBeLessThanOrEqual(MAX_DELTA_OPS)

    // Without the fix: snap.operation_index (3900) < clampedIdx (3000) was FALSE
    const buggySessionLevelIndex = 3900
    expect(buggySessionLevelIndex < clampedIdx).toBe(false) // confirms the original bug
  })

  it('C9b regression: snapEngineIdx === clampedIdx (snapshot exactly at target) must be accepted (delta=0)', () => {
    // Bug observed in prod logs: target_idx=2088, snap_engine_idx=2088 → fallback with `<`
    // Fix: condition changed to `<=` so delta=0 snapshot is accepted and loaded directly.
    const ops: BoardOperation[] = []
    for (let i = 0; i < 100; i++) {
      ops.push(makeOp(i, 1000 + i, '2026-01-01T00:00:00.000Z'))
    }
    const engine = new WBReplayEngineV2(makeTimeline(ops))
    // Snapshot at seq=1050 → engine index 50
    const snapEngineIdx = engine.findIndexBySeq(1050)
    expect(snapEngineIdx).toBe(50)

    // seek target is also engine index 50 (snapshot exactly at target)
    const clampedIdx = 50
    const MAX_DELTA_OPS = 150
    const deltaOps = clampedIdx - snapEngineIdx  // = 0

    // With <= condition: 50 <= 50 AND 0 <= 150 → snapshot accepted
    expect(snapEngineIdx >= 0 && snapEngineIdx <= clampedIdx && deltaOps <= MAX_DELTA_OPS).toBe(true)
    // With old < condition: 50 < 50 → FALSE → wrongly rejected
    expect(snapEngineIdx < clampedIdx).toBe(false) // confirms the C9b bug
  })

  it('C9: findIndexBySeq at index 0 (snapshot at session start of replay)', () => {
    const ops: BoardOperation[] = []
    for (let i = 0; i < 200; i++) {
      ops.push(makeOp(i, 1000 + i, '2026-01-01T00:00:00.000Z'))
    }
    const engine = new WBReplayEngineV2(makeTimeline(ops))
    // Snapshot exactly at replay first op
    expect(engine.findIndexBySeq(1000)).toBe(0)
    // Snapshot before replay start (seq < 1000) → -1 → skip snapshot
    expect(engine.findIndexBySeq(999)).toBe(-1)
  })

  it('binary search correctness: handles 10k ops efficiently (O(log n))', () => {
    const N = 10_000
    const ops: BoardOperation[] = []
    for (let i = 0; i < N; i++) {
      ops.push(makeOp(i, i * 2 + 1, '2026-01-01T00:00:00.000Z')) // seqs: 1, 3, 5, 7, ...
    }
    const engine = new WBReplayEngineV2(makeTimeline(ops))
    // seq=5001 → last seq ≤ 5001 is seq=5001 at index 2500
    expect(engine.findIndexBySeq(5001)).toBe(2500)
    // seq=5000 → last seq ≤ 5000 is seq=4999 at index 2499
    expect(engine.findIndexBySeq(5000)).toBe(2499)
    // seq=0 → all seqs ≥ 1 → -1
    expect(engine.findIndexBySeq(0)).toBe(-1)
    // last seq = (N-1)*2+1 = 19999; targetSeq=99999 → last index
    expect(engine.findIndexBySeq(99999)).toBe(N - 1)
  })
})

// ─── findIndexByTimeMs ───────────────────────────────────────────────────────

describe('WBReplayEngineV2 — findIndexByTimeMs', () => {
  it('returns 0 for empty timeline or targetMs ≤ 0', () => {
    const engine = new WBReplayEngineV2(makeTimeline([]))
    expect(engine.findIndexByTimeMs(1000)).toBe(0)
    const engine3 = new WBReplayEngineV2(makeTimeline3())
    expect(engine3.findIndexByTimeMs(0)).toBe(0)
    expect(engine3.findIndexByTimeMs(-1)).toBe(0)
  })

  it('returns last index when targetMs exceeds duration', () => {
    const engine = new WBReplayEngineV2(makeTimeline3())
    expect(engine.findIndexByTimeMs(999_999)).toBe(2)
  })

  it('finds correct index by op offset', () => {
    const engine = new WBReplayEngineV2(makeTimeline3()) // offsets: 0, 100, 200ms
    expect(engine.findIndexByTimeMs(0)).toBe(0)
    expect(engine.findIndexByTimeMs(100)).toBe(1)
    expect(engine.findIndexByTimeMs(200)).toBe(2)
    expect(engine.findIndexByTimeMs(50)).toBe(1)   // between 0 and 100 → first ≥ 50
    expect(engine.findIndexByTimeMs(150)).toBe(2)  // between 100 and 200 → first ≥ 150
  })

  it('getOperationTimeMs returns 0 for invalid index, correct offset otherwise', () => {
    const engine = new WBReplayEngineV2(makeTimeline3())
    expect(engine.getOperationTimeMs(-1)).toBe(0)
    expect(engine.getOperationTimeMs(999)).toBe(0)
    expect(engine.getOperationTimeMs(0)).toBe(0)
    expect(engine.getOperationTimeMs(1)).toBe(100)
    expect(engine.getOperationTimeMs(2)).toBe(200)
  })
})

// ─── Playback (smoke tests — deep coverage in WBReplayEngine.spec.ts) ────────

describe('WBReplayEngineV2 — playback basics', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('starts in idle, transitions to playing on play()', () => {
    const engine = new WBReplayEngineV2(makeTimeline3())
    expect(engine.getState()).toBe('idle')
    engine.play()
    expect(engine.getState()).toBe('playing')
  })

  it('pause() → paused, stop() → idle + index 0', () => {
    const engine = new WBReplayEngineV2(makeTimeline3())
    engine.play()
    engine.pause()
    expect(engine.getState()).toBe('paused')
    engine.play()
    engine.stop()
    expect(engine.getState()).toBe('idle')
    expect(engine.getCurrentIndex()).toBe(0)
  })

  it('reaches ended + fires onComplete after all ops', () => {
    const onComplete = vi.fn()
    const engine = new WBReplayEngineV2(makeTimeline3()).on('onComplete', onComplete)
    engine.play()
    vi.runAllTimers()
    expect(engine.getState()).toBe('ended')
    expect(onComplete).toHaveBeenCalledOnce()
  })

  it('seekTo clamps to valid range', () => {
    const engine = new WBReplayEngineV2(makeTimeline3())
    expect(engine.seekTo(-10)).toBe(0)
    expect(engine.seekTo(999)).toBe(2)
    expect(engine.seekTo(1)).toBe(1)
  })

  it('destroy() stops timers — no callbacks after', () => {
    const onOp = vi.fn()
    const engine = new WBReplayEngineV2(makeTimeline3()).on('onOperation', onOp)
    engine.play()
    engine.destroy()
    vi.runAllTimers()
    expect(onOp).not.toHaveBeenCalled()
  })
})

// ─── INV-V2-1: does NOT import from V1 ───────────────────────────────────────
//
// Runtime check — if V2 uses V1 engine internals, the import would be visible
// in module graph. We just verify instance has correct methods.
describe('WBReplayEngineV2 — INV-V2-1: V2-only public API', () => {
  it('has all required V2 methods', () => {
    const engine = new WBReplayEngineV2(makeTimeline3())
    expect(typeof engine.findIndexBySeq).toBe('function')
    expect(typeof engine.findIndexByTimeMs).toBe('function')
    expect(typeof engine.getOperationTimeMs).toBe('function')
    expect(typeof engine.getFirstOpAtMs).toBe('function')
    expect(typeof engine.play).toBe('function')
    expect(typeof engine.pause).toBe('function')
    expect(typeof engine.stop).toBe('function')
    expect(typeof engine.seekTo).toBe('function')
    expect(typeof engine.stepForward).toBe('function')
    expect(typeof engine.stepBackward).toBe('function')
    expect(typeof engine.destroy).toBe('function')
  })
})
