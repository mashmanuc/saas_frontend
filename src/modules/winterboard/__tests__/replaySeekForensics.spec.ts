/**
 * Перемотування Replay: дошка стає рівно в точку й далі грає без дьоргання.
 * Скарга власника 2026-09-21: «при перемотуванні уроку події ніби швидко
 * дьоргаються, а не переключається в потрібну точку і плавно не продовжується».
 *
 * Справжні useReplayV2 + WBReplayEngineV2; замоканий лише API. Дошка = список
 * застосованих engine-індексів. Правильний стан після seek(T) = [0..T-1], кожен
 * рівно раз, по зростанню, і далі гра T, T+1, …
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// N ops; 10 ops/с (STEP_MS); seq = SEQ0 + index; знімок кожні SNAP_EVERY seq (ops_worker).
const { N, STEP_MS, SEQ0, SNAP_EVERY, api } = vi.hoisted(() => ({
  N: 600, STEP_MS: 100, SEQ0: 1001, SNAP_EVERY: 100,
  api: { snapshotLatencyMs: 0, snapshotsEnabled: true },
}))

vi.mock('../api/replay', () => {
  const t0 = Date.UTC(2026, 0, 1)
  const ops = Array.from({ length: N }, (_, i) => ({
    id: i + 1, seq: SEQ0 + i, op_type: 'stroke_add', page_id: 'p1',
    payload: { i }, user: 1, created_at: new Date(t0 + i * STEP_MS).toISOString(),
  }))
  return {
    fetchReplayTimeline: async () => ({ session_id: 's1', total_operations: N, operations: ops, start_state: null }),
    fetchOwnerReplayPlayback: async () => { throw new Error('unused') },
    fetchPublicReplayByToken: async () => { throw new Error('unused') },
    fetchLessonMarkers: async () => ({ markers: [] }),
    reportReplayView: async () => true,
    // Знімок стану ПІСЛЯ op з seq (включно) — як ops_worker._create_snapshot.
    fetchNearestSnapshot: (_sid: string, targetSeq: number) => new Promise((resolve) => {
      setTimeout(() => {
        if (!api.snapshotsEnabled) return resolve(null)
        const snapSeq = Math.floor(targetSeq / SNAP_EVERY) * SNAP_EVERY
        if (snapSeq < SEQ0) return resolve(null)
        const upto = snapSeq - SEQ0                      // engine index of snapshot op
        resolve({
          id: `snap-${snapSeq}`, operation_index: upto, seq: snapSeq,
          board_state: { applied: Array.from({ length: upto + 1 }, (_, k) => k) },
          created_at: '',
        })
      }, api.snapshotLatencyMs)
    }),
    fetchPublicNearestSnapshot: async () => null,
  }
})

import { useReplayV2 } from '../composables/useReplayV2'

type Ev = { t: number; kind: 'op' | 'clear' | 'load'; idx?: number }

async function setup() {
  let board: number[] = []
  const events: Ev[] = []
  const r = useReplayV2('s1')
  await r.loadTimeline((op) => {
    const idx = (op.payload as { i: number }).i
    board.push(idx)
    events.push({ t: Date.now(), kind: 'op', idx })
  })
  const clearState = () => { board = []; events.push({ t: Date.now(), kind: 'clear' }) }
  const loadState = (bs: Record<string, unknown>) => {
    board = [...(bs.applied as number[])]
    events.push({ t: Date.now(), kind: 'load', idx: board.length })
  }
  const seek = (idx: number) => r.seekToWithSnapshot(idx, loadState, clearState)
  return { r, events, seek, board: () => board }
}

function dupes(a: number[]): number[] {
  const seen = new Set<number>(); const d: number[] = []
  for (const x of a) { if (seen.has(x)) d.push(x); seen.add(x) }
  return d
}
function isPrefix(a: number[]): boolean { return a.every((v, i) => v === i) }

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame'] })
  api.snapshotLatencyMs = 0
  api.snapshotsEnabled = true
})
afterEach(() => { vi.useRealTimers() })

describe('Replay seek — криміналістика', () => {
  it('A. пауза + знімок: чи стан після seek(400) = [0..399] рівно раз', async () => {
    const { seek, board } = await setup()
    const p = seek(400); await vi.advanceTimersByTimeAsync(50); await p
    const b = board()
    console.log('[A] len', b.length, 'dupes', dupes(b), 'prefix', isPrefix(b))
    // op знімка не застосовується вдруге (знімок включає свою op)
    expect(dupes(b)).toEqual([])
    expect(b.length).toBe(400)
    expect(isPrefix(b)).toBe(true)
  })

  it('B. гра + знімок з затримкою 300 мс: чи грає старе після кліку', async () => {
    api.snapshotLatencyMs = 300
    const { r, events, seek, board } = await setup()
    r.play()
    await vi.advanceTimersByTimeAsync(1000)
    const tClick = Date.now(); const idxAtClick = r.currentIndex.value
    const p = seek(400)
    await vi.advanceTimersByTimeAsync(400); await p
    // op зі старої позиції, застосована ПІСЛЯ кліку й ДО того, як дошку
    // перебудовано знімком: людина бачить, що урок «грає далі» не там.
    const tLoad = events.find((e) => e.kind === 'load' && e.t > tClick)?.t ?? Infinity
    const stale = events.filter((e) => e.kind === 'op' && e.t > tClick && e.t < tLoad)
    await vi.advanceTimersByTimeAsync(1000)
    const b = board()
    console.log('[B] idxAtClick', idxAtClick, 'stale ops after click', stale.map((e) => `${e.idx}@+${e.t - tClick}`).join(' '),
      '| final len', b.length, 'dupes', dupes(b).slice(0, 5), 'prefix', isPrefix(b))
    // після кліку старе місце більше не грає; далі гра з 400, 401…
    expect(stale).toEqual([])
    expect(dupes(b)).toEqual([])
    expect(isPrefix(b)).toBe(true)
    expect(b.length).toBeGreaterThan(400)
    expect(r.state.value).toBe('playing')
  })

  it('C. гра + БЕЗ знімка (запасний шлях): кадри прокручування, відкати індексу, цілісність', async () => {
    api.snapshotsEnabled = false
    const { r, events, seek, board } = await setup()
    r.play()
    await vi.advanceTimersByTimeAsync(1000)
    const tClick = Date.now()
    const idxTrace: number[] = []
    const stop = setInterval(() => idxTrace.push(r.currentIndex.value), 16)
    const p = seek(400)
    await vi.advanceTimersByTimeAsync(1500); await p
    clearInterval(stop)
    await vi.advanceTimersByTimeAsync(500)
    const after = events.filter((e) => e.t >= tClick && e.kind === 'op')
    const frames = new Set(after.filter((e) => (e.idx as number) < 400).map((e) => e.t)).size
    let regress = 0; for (let i = 1; i < idxTrace.length; i++) if (idxTrace[i] < idxTrace[i - 1]) regress++
    const b = board()
    const outOfOrder = b.filter((v, i) => i > 0 && v <= b[i - 1]).length
    console.log('[C] frames with intermediate board', frames, 'ms span', after.length ? after[after.length - 1].t - tClick : 0,
      '| currentIndex regressions', regress, '| final len', b.length, 'dupes', dupes(b).slice(0, 8), 'outOfOrder', outOfOrder, 'prefix', isPrefix(b))
    expect(frames).toBe(1)            // один прохід — жодних видимих проміжних станів
    expect(regress).toBe(0)
    expect(dupes(b)).toEqual([])
    expect(outOfOrder).toBe(0)
    expect(isPrefix(b)).toBe(true)
    expect(b.length).toBeGreaterThan(400)  // гра продовжилась з нової точки
  })

  it('D. пауза, БЕЗ знімка: скільки кадрів видно прокручування до 400', async () => {
    api.snapshotsEnabled = false
    const { events, seek } = await setup()
    const t0 = Date.now()
    const p = seek(400); await vi.advanceTimersByTimeAsync(2000); await p
    const ops = events.filter((e) => e.kind === 'op')
    console.log('[D] frames', new Set(ops.map((e) => e.t)).size, 'span ms', ops[ops.length - 1].t - t0)
    expect(new Set(ops.map((e) => e.t)).size).toBe(1)
    expect(ops.length).toBe(400)
  })

  it('E. знімок рівно на цільовій op не використовується (він уже містить op[T])', async () => {
    // T=400 → op[399] має seq 1400 → знімок seq 1400 = стан після op[399] = seek(400). OK.
    // T=399 → шукаємо знімок ≤ seq(op[398])=1399 → 1300 (idx 299), дельта 300..398.
    const { seek, board } = await setup()
    const p = seek(399); await vi.advanceTimersByTimeAsync(50); await p
    const b = board()
    expect(b.length).toBe(399)
    expect(isPrefix(b)).toBe(true)
  })

  it('F. два seek поспіль під час гри: виграє останній, гра одна', async () => {
    api.snapshotLatencyMs = 300
    const { r, seek, board } = await setup()
    r.play(); await vi.advanceTimersByTimeAsync(500)
    const p1 = seek(450)
    await vi.advanceTimersByTimeAsync(100)
    const p2 = seek(250)
    await vi.advanceTimersByTimeAsync(400); await Promise.all([p1, p2])
    await vi.advanceTimersByTimeAsync(1000)
    const b = board()
    expect(isPrefix(b)).toBe(true)
    expect(b[b.length - 1]).toBeGreaterThanOrEqual(250)
    expect(b.length).toBeLessThan(450)    // перший seek (450) не «переміг» пізніше
    expect(r.state.value).toBe('playing')
  })
})
