// A12: Unit tests for WBReplayEngine
// Ref: DAY17_AGENT-A.md — мінімум 12 тестів, fake timers
// Coverage: play/pause/stop cycle, seekTo bounds, speed, callbacks, onComplete, destroy

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { WBReplayEngine } from '../engine/WBReplayEngine'
import type { ReplayTimeline, BoardOperation } from '../types/replay'

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeOp(id: number, created_at: string, op_type = 'stroke_add'): BoardOperation {
  return { id, op_type, page_id: 'p1', payload: {}, user: 1, created_at }
}

function makeTimeline(ops: BoardOperation[]): ReplayTimeline {
  return { session_id: 'test-uuid', total_operations: ops.length, operations: ops }
}

/** Timeline with 3 ops spaced 100ms apart */
function makeTimeline3(): ReplayTimeline {
  return makeTimeline([
    makeOp(1, '2026-01-01T00:00:00.000Z'),
    makeOp(2, '2026-01-01T00:00:00.100Z'),
    makeOp(3, '2026-01-01T00:00:00.200Z'),
  ])
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('WBReplayEngine — initial state', () => {
  it('starts in idle state', () => {
    const engine = new WBReplayEngine(makeTimeline3())
    expect(engine.getState()).toBe('idle')
  })

  it('reports correct total operations', () => {
    const engine = new WBReplayEngine(makeTimeline3())
    expect(engine.getTotalOperations()).toBe(3)
  })

  it('starts with currentIndex 0', () => {
    const engine = new WBReplayEngine(makeTimeline3())
    expect(engine.getCurrentIndex()).toBe(0)
  })

  it('handles empty timeline without crash', () => {
    const engine = new WBReplayEngine(makeTimeline([]))
    expect(engine.getTotalOperations()).toBe(0)
    expect(engine.getState()).toBe('idle')
  })
})

describe('WBReplayEngine — play / pause / stop', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('transitions to playing on play()', () => {
    const engine = new WBReplayEngine(makeTimeline3())
    engine.play()
    expect(engine.getState()).toBe('playing')
  })

  it('fires onStateChange with playing', () => {
    const onStateChange = vi.fn()
    const engine = new WBReplayEngine(makeTimeline3()).on('onStateChange', onStateChange)
    engine.play()
    expect(onStateChange).toHaveBeenCalledWith('playing')
  })

  it('pause() transitions to paused', () => {
    const engine = new WBReplayEngine(makeTimeline3())
    engine.play()
    engine.pause()
    expect(engine.getState()).toBe('paused')
  })

  it('pause() is no-op when already paused', () => {
    const onStateChange = vi.fn()
    const engine = new WBReplayEngine(makeTimeline3()).on('onStateChange', onStateChange)
    engine.play()
    engine.pause()
    engine.pause()  // second pause — should not fire again
    const pauseCalls = onStateChange.mock.calls.filter(([s]) => s === 'paused')
    expect(pauseCalls).toHaveLength(1)
  })

  it('play() is no-op when already playing', () => {
    const onStateChange = vi.fn()
    const engine = new WBReplayEngine(makeTimeline3()).on('onStateChange', onStateChange)
    engine.play()
    engine.play()  // second play
    const playCalls = onStateChange.mock.calls.filter(([s]) => s === 'playing')
    expect(playCalls).toHaveLength(1)
  })

  it('stop() resets to idle and currentIndex to 0', () => {
    const engine = new WBReplayEngine(makeTimeline3())
    engine.play()
    vi.advanceTimersByTime(50)
    engine.stop()
    expect(engine.getState()).toBe('idle')
    expect(engine.getCurrentIndex()).toBe(0)
  })

  it('stop() fires onProgress(0, total)', () => {
    const onProgress = vi.fn()
    const engine = new WBReplayEngine(makeTimeline3()).on('onProgress', onProgress)
    engine.play()
    engine.stop()
    const lastCall = onProgress.mock.calls[onProgress.mock.calls.length - 1]
    expect(lastCall).toEqual([0, 3])
  })

  it('fires onOperation for each op as timer fires', () => {
    const onOperation = vi.fn()
    const engine = new WBReplayEngine(makeTimeline3()).on('onOperation', onOperation)
    engine.play()

    // Advance through all 3 ops (each gap 100ms, speed=1 → 100ms delay)
    vi.advanceTimersByTime(16)   // first op (last op has min 16ms delay)
    vi.advanceTimersByTime(100)  // second op
    vi.advanceTimersByTime(100)  // third op

    expect(onOperation).toHaveBeenCalledTimes(3)
    expect(onOperation.mock.calls[0][0].id).toBe(1)
    expect(onOperation.mock.calls[1][0].id).toBe(2)
    expect(onOperation.mock.calls[2][0].id).toBe(3)
  })
})

describe('WBReplayEngine — onComplete', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('fires onComplete after last operation', () => {
    const onComplete = vi.fn()
    const engine = new WBReplayEngine(makeTimeline3()).on('onComplete', onComplete)
    engine.play()
    vi.runAllTimers()
    expect(onComplete).toHaveBeenCalledOnce()
  })

  it('state is ended after completion', () => {
    const engine = new WBReplayEngine(makeTimeline3())
    engine.play()
    vi.runAllTimers()
    expect(engine.getState()).toBe('ended')
  })

  it('play() after ended restarts from index 0', () => {
    const onOperation = vi.fn()
    const engine = new WBReplayEngine(makeTimeline3()).on('onOperation', onOperation)
    engine.play()
    vi.runAllTimers()
    expect(engine.getState()).toBe('ended')

    // Play again — should restart
    engine.play()
    expect(engine.getState()).toBe('playing')
    vi.runAllTimers()
    expect(onOperation).toHaveBeenCalledTimes(6)  // 3 original + 3 restart
  })

  it('fires onComplete immediately for empty timeline', () => {
    const onComplete = vi.fn()
    const engine = new WBReplayEngine(makeTimeline([])).on('onComplete', onComplete)
    engine.play()
    vi.runAllTimers()
    expect(onComplete).toHaveBeenCalledOnce()
  })
})

describe('WBReplayEngine — seekTo', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('seekTo clamps below 0 to 0', () => {
    const onProgress = vi.fn()
    const engine = new WBReplayEngine(makeTimeline3()).on('onProgress', onProgress)
    engine.seekTo(-10)
    expect(onProgress).toHaveBeenCalledWith(0, 3)
  })

  it('seekTo clamps above max to last index', () => {
    const onProgress = vi.fn()
    const engine = new WBReplayEngine(makeTimeline3()).on('onProgress', onProgress)
    engine.seekTo(999)
    expect(onProgress).toHaveBeenCalledWith(2, 3)
  })

  it('seekTo mid-play resumes from new position', () => {
    const onOperation = vi.fn()
    const engine = new WBReplayEngine(makeTimeline3()).on('onOperation', onOperation)
    engine.play()
    engine.seekTo(2)  // skip to index 2 (last op)
    vi.runAllTimers()
    // Only the op at index 2 (id=3) should fire
    const fired = onOperation.mock.calls.map(([op]) => op.id)
    expect(fired).toContain(3)
    // After running all timers engine has incremented past last op (3 = ops.length)
    expect(engine.getCurrentIndex()).toBe(3)
  })
})

describe('WBReplayEngine — setSpeed', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('speed=2 halves the delay between operations', () => {
    const onOperation = vi.fn()
    // Ops spaced 200ms apart
    const ops = [
      makeOp(1, '2026-01-01T00:00:00.000Z'),
      makeOp(2, '2026-01-01T00:00:00.200Z'),
    ]
    const engine = new WBReplayEngine(makeTimeline(ops)).on('onOperation', onOperation)
    engine.setSpeed(2)
    engine.play()

    // At speed=2, 200ms delay → 100ms effective
    vi.advanceTimersByTime(90)
    expect(onOperation).not.toHaveBeenCalled()

    vi.advanceTimersByTime(20)  // total 110ms — should have fired
    expect(onOperation).toHaveBeenCalledTimes(1)
  })

  it('setSpeed while playing reschedules without restarting', () => {
    const onStateChange = vi.fn()
    const engine = new WBReplayEngine(makeTimeline3()).on('onStateChange', onStateChange)
    engine.play()
    engine.setSpeed(4)
    // Should still be playing (no idle/stop transition)
    expect(engine.getState()).toBe('playing')
    const idleCalls = onStateChange.mock.calls.filter(([s]) => s === 'idle')
    expect(idleCalls).toHaveLength(0)
  })
})

describe('WBReplayEngine — destroy', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('destroy() stops all timers — no callbacks fire after', () => {
    const onOperation = vi.fn()
    const engine = new WBReplayEngine(makeTimeline3()).on('onOperation', onOperation)
    engine.play()
    engine.destroy()
    vi.runAllTimers()
    expect(onOperation).not.toHaveBeenCalled()
  })

  it('destroy() resets state to idle', () => {
    const engine = new WBReplayEngine(makeTimeline3())
    engine.play()
    engine.destroy()
    expect(engine.getState()).toBe('idle')
  })

  it('calling play() after destroy is safe (no crash)', () => {
    const engine = new WBReplayEngine(makeTimeline3())
    engine.destroy()
    expect(() => engine.play()).not.toThrow()
  })
})

describe('WBReplayEngine — timestamp delay capping', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('caps delay at 2000ms even for large gaps', () => {
    const ops = [
      makeOp(1, '2026-01-01T00:00:00.000Z'),
      makeOp(2, '2026-01-01T00:01:00.000Z'),  // 60s gap → capped at 2s
    ]
    const onOperation = vi.fn()
    const engine = new WBReplayEngine(makeTimeline(ops)).on('onOperation', onOperation)
    engine.play()

    vi.advanceTimersByTime(2001)
    expect(onOperation).toHaveBeenCalledTimes(1)
    expect(onOperation.mock.calls[0][0].id).toBe(1)
  })

  it('uses minimum 4ms delay for same-timestamp ops (no 16ms floor)', () => {
    // Engine intentionally removed the 16ms artificial floor so atomic/batch
    // ops with diff≈0 replay together. Only a 4ms floor remains to prevent
    // timer storm at 10x speed. See memory project_replay_move_animation_shipped.
    const sameTime = '2026-01-01T00:00:00.000Z'
    const ops = [makeOp(1, sameTime), makeOp(2, sameTime)]
    const onOperation = vi.fn()
    const engine = new WBReplayEngine(makeTimeline(ops)).on('onOperation', onOperation)
    engine.play()

    vi.advanceTimersByTime(3)
    expect(onOperation).not.toHaveBeenCalled()

    vi.advanceTimersByTime(2)  // 5ms total — past the 4ms floor
    expect(onOperation).toHaveBeenCalled()
  })
})

// findIndexByTimeMs — REPLAY_MANIFEST §1: ops як часова координата.
// Лінійне ratio*totalOps було причиною стрибків повзунка при нерівномірному розподілі ops.
describe('WBReplayEngine — findIndexByTimeMs / getOperationTimeMs', () => {
  it('returns 0 for empty timeline', () => {
    const engine = new WBReplayEngine(makeTimeline([]))
    expect(engine.findIndexByTimeMs(1000)).toBe(0)
  })

  it('returns 0 for targetMs <= 0', () => {
    const engine = new WBReplayEngine(makeTimeline3())
    expect(engine.findIndexByTimeMs(0)).toBe(0)
    expect(engine.findIndexByTimeMs(-100)).toBe(0)
  })

  it('returns last index when targetMs exceeds duration', () => {
    const engine = new WBReplayEngine(makeTimeline3())
    expect(engine.findIndexByTimeMs(999_999)).toBe(2)
  })

  it('finds exact-match index (op offsets 0/100/200ms)', () => {
    const engine = new WBReplayEngine(makeTimeline3())
    expect(engine.findIndexByTimeMs(0)).toBe(0)
    expect(engine.findIndexByTimeMs(100)).toBe(1)
    expect(engine.findIndexByTimeMs(200)).toBe(2)
  })

  it('finds first op ≥ targetMs for between-op time', () => {
    const engine = new WBReplayEngine(makeTimeline3())
    // 50ms — між op[0]@0 та op[1]@100 → перша op з offset ≥ 50 це op[1]
    expect(engine.findIndexByTimeMs(50)).toBe(1)
    expect(engine.findIndexByTimeMs(150)).toBe(2)
  })

  // Ключовий regression test: нерівномірний розподіл (90% ops у останні 10% часу).
  // Лінійний ratio*totalOps дав би idx=50 для t=duration/2 — реально це майже кінець timeline.
  it('handles non-uniform op distribution correctly (regression: linear ratio bug)', () => {
    // 100 ops: 10 розподілені 0..1000ms, потім 90 у 9000..10000ms (бурст наприкінці).
    const ops: BoardOperation[] = []
    for (let i = 0; i < 10; i++) {
      ops.push(makeOp(i, new Date(i * 100).toISOString()))
    }
    for (let i = 0; i < 90; i++) {
      ops.push(makeOp(10 + i, new Date(9000 + i * 10).toISOString()))
    }
    const engine = new WBReplayEngine(makeTimeline(ops))
    // Клік на 50% timeline (t=5000ms) — лежить у мертвій зоні між op[9]@900ms та op[10]@9000ms.
    // findIndexByTimeMs має знайти першу op з offset ≥ 5000 — це op[10] @ 9000ms.
    // Лінійна мапа дала б idx = 50 (op[50] @ 9400ms) — далеко не там, де клікнув user.
    expect(engine.findIndexByTimeMs(5000)).toBe(10)
    // Клік на 95% (t=9500ms) → перша op з offset ≥ 9500 це op[10 + 50] = op[60] @ 9500ms.
    expect(engine.findIndexByTimeMs(9500)).toBe(60)
  })

  it('getOperationTimeMs returns 0 for invalid index', () => {
    const engine = new WBReplayEngine(makeTimeline3())
    expect(engine.getOperationTimeMs(-1)).toBe(0)
    expect(engine.getOperationTimeMs(999)).toBe(0)
  })

  it('getOperationTimeMs returns offset from first op', () => {
    const engine = new WBReplayEngine(makeTimeline3())
    expect(engine.getOperationTimeMs(0)).toBe(0)
    expect(engine.getOperationTimeMs(1)).toBe(100)
    expect(engine.getOperationTimeMs(2)).toBe(200)
  })

  it('getFirstOpAtMs returns first op timestamp; 0 for empty', () => {
    const engine = new WBReplayEngine(makeTimeline3())
    expect(engine.getFirstOpAtMs()).toBe(new Date('2026-01-01T00:00:00.000Z').getTime())
    expect(new WBReplayEngine(makeTimeline([])).getFirstOpAtMs()).toBe(0)
  })
})
