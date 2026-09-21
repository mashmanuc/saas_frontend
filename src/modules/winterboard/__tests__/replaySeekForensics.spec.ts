/**
 * Перемотування Replay: дошка стає рівно в точку й далі грає без дьоргання.
 * Скарга власника 2026-09-22: «при перемотуванні уроку події ніби швидко
 * дьоргаються, а не переключається в потрібну точку і плавно не продовжується».
 *
 * Справжні useReplayV2 + WBReplayEngineV2; замоканий лише API. Дошка = список
 * застосованих engine-індексів. Правильний стан після seek(T) = [0..T-1], кожен
 * рівно раз, по зростанню, і далі гра T, T+1, …
 *
 * Урок — 4000 ops (10 ops/с), щоб seek далі за SEQUENTIAL_SEEK_MAX_OPS (3000)
 * ішов через знімок, а ближчі — з ops.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// seq = SEQ0 + index (сесія почалась раніше за запис); знімок кожні SNAP_EVERY seq.
const { STEP_MS, SEQ0, SNAP_EVERY, api } = vi.hoisted(() => ({
  STEP_MS: 100, SEQ0: 1001, SNAP_EVERY: 100,
  api: { n: 4000, snapshotLatencyMs: 0, snapshotsEnabled: true, brokenSnapshots: false, fetchCalls: 0 },
}))

vi.mock('../api/replay', () => {
  const t0 = Date.UTC(2026, 0, 1)
  const makeOps = (n: number) => Array.from({ length: n }, (_, i) => ({
    id: i + 1, seq: SEQ0 + i, op_type: 'stroke_add', page_id: 'p1',
    payload: { i }, user: 1, created_at: new Date(t0 + i * STEP_MS).toISOString(),
  }))
  return {
    fetchReplayTimeline: async () => ({ session_id: 's1', total_operations: api.n, operations: makeOps(api.n), start_state: null }),
    fetchOwnerReplayPlayback: async () => { throw new Error('unused') },
    fetchPublicReplayByToken: async () => { throw new Error('unused') },
    fetchLessonMarkers: async () => ({ markers: [] }),
    reportReplayView: async () => true,
    // Знімок стану ПІСЛЯ op з seq (включно) — як ops_worker._create_snapshot.
    // brokenSnapshots: знімок без половини ops — як биті знімки G1.
    fetchNearestSnapshot: (_sid: string, targetSeq: number) => new Promise((resolve) => {
      api.fetchCalls++
      setTimeout(() => {
        if (!api.snapshotsEnabled) return resolve(null)
        const snapSeq = Math.floor(targetSeq / SNAP_EVERY) * SNAP_EVERY
        if (snapSeq < SEQ0) return resolve(null)
        const upto = snapSeq - SEQ0
        const all = Array.from({ length: upto + 1 }, (_, k) => k)
        resolve({
          id: `snap-${snapSeq}`, operation_index: upto, seq: snapSeq,
          board_state: { applied: api.brokenSnapshots ? all.filter((k) => k % 2 === 0) : all },
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

/** Стартуємо гру з точки `from` (через seek), даємо пограти `ms`. */
async function playFrom(ctx: Awaited<ReturnType<typeof setup>>, from: number, ms: number) {
  const p = ctx.seek(from); await vi.advanceTimersByTimeAsync(api.snapshotLatencyMs + 50); await p
  ctx.r.play()
  await vi.advanceTimersByTimeAsync(ms)
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame'] })
  Object.assign(api, { n: 4000, snapshotLatencyMs: 0, snapshotsEnabled: true, brokenSnapshots: false, fetchCalls: 0 })
})
afterEach(() => { vi.useRealTimers() })

describe('Replay seek — через знімок (далі за 3000 ops)', () => {
  it('A. пауза: op знімка не застосовується вдруге (знімок включає свою op)', async () => {
    // T=3500 → op[3499].seq = 4500 → знімок seq 4500 = стан після op[3499] = seek(3500)
    const { seek, board } = await setup()
    const p = seek(3500); await vi.advanceTimersByTimeAsync(50); await p
    const b = board()
    expect(api.fetchCalls).toBe(1)
    expect(dupes(b)).toEqual([])
    expect(b.length).toBe(3500)
    expect(isPrefix(b)).toBe(true)
  })

  it('B. гра + знімок їде 300 мс: після кліку старе місце не грає; далі гра з точки', async () => {
    api.snapshotLatencyMs = 300
    const ctx = await setup()
    await playFrom(ctx, 100, 1000)
    const tClick = Date.now()
    const p = ctx.seek(3500)
    await vi.advanceTimersByTimeAsync(400); await p
    const tLoad = ctx.events.find((e) => e.kind === 'load' && e.t > tClick)?.t ?? Infinity
    // op зі старої позиції після кліку й до перебудови — те, що людина бачить як «грає не там»
    const stale = ctx.events.filter((e) => e.kind === 'op' && e.t > tClick && e.t < tLoad)
    await vi.advanceTimersByTimeAsync(1000)
    const b = ctx.board()
    expect(stale).toEqual([])
    expect(dupes(b)).toEqual([])
    expect(isPrefix(b)).toBe(true)
    expect(b.length).toBeGreaterThan(3500)
    expect(ctx.r.state.value).toBe('playing')
  })

  it('E. знімок рівно на цільовій op не використовується (він уже містить op[T])', async () => {
    // T=3499 → шукаємо ≤ seq(op[3498])=4499 → 4400 (idx 3399), дельта 3400..3498
    const { seek, board } = await setup()
    const p = seek(3499); await vi.advanceTimersByTimeAsync(50); await p
    const b = board()
    expect(b.length).toBe(3499)
    expect(isPrefix(b)).toBe(true)
  })

  it('F. два seek поспіль під час гри: виграє останній, гра одна', async () => {
    api.snapshotLatencyMs = 300
    const ctx = await setup()
    await playFrom(ctx, 100, 500)
    const p1 = ctx.seek(3600)
    await vi.advanceTimersByTimeAsync(100)
    const p2 = ctx.seek(3200)
    await vi.advanceTimersByTimeAsync(400); await Promise.all([p1, p2])
    await vi.advanceTimersByTimeAsync(1000)
    const b = ctx.board()
    expect(isPrefix(b)).toBe(true)
    expect(b[b.length - 1]).toBeGreaterThanOrEqual(3200)
    expect(b.length).toBeLessThan(3600)
    expect(ctx.r.state.value).toBe('playing')
  })

  it('H. далі за 3000 знімок справді використовується (швидкий шлях живий)', async () => {
    const { seek, events } = await setup()
    const p = seek(3800); await vi.advanceTimersByTimeAsync(50); await p
    expect(api.fetchCalls).toBe(1)
    expect(events.some((e) => e.kind === 'load')).toBe(true)
    // з ops застосовано лише дельту, не 3800
    expect(events.filter((e) => e.kind === 'op').length).toBeLessThanOrEqual(150)
  })
})

describe('Replay seek — з ops (до 3000) і без знімка', () => {
  it('C. гра, знімка немає: один прохід, без проміжних кадрів, порядок цілий', async () => {
    api.snapshotsEnabled = false
    const ctx = await setup()
    await playFrom(ctx, 100, 1000)
    const tClick = Date.now()
    const idxTrace: number[] = []
    const stop = setInterval(() => idxTrace.push(ctx.r.currentIndex.value), 16)
    const p = ctx.seek(3500)
    await vi.advanceTimersByTimeAsync(1500); await p
    clearInterval(stop)
    await vi.advanceTimersByTimeAsync(500)
    const rebuild = ctx.events.filter((e) => e.t >= tClick && e.kind === 'op' && (e.idx as number) < 3500)
    const frames = new Set(rebuild.map((e) => e.t)).size
    let regress = 0; for (let i = 1; i < idxTrace.length; i++) if (idxTrace[i] < idxTrace[i - 1]) regress++
    const b = ctx.board()
    const outOfOrder = b.filter((v, i) => i > 0 && v <= b[i - 1]).length
    expect(frames).toBe(1)
    expect(regress).toBe(0)
    expect(dupes(b)).toEqual([])
    expect(outOfOrder).toBe(0)
    expect(isPrefix(b)).toBe(true)
    expect(b.length).toBeGreaterThan(3500)
  })

  it('D. пауза, до 3000: знімок не запитується, стан — одним кадром', async () => {
    const { events, seek } = await setup()
    const p = seek(400); await vi.advanceTimersByTimeAsync(50); await p
    const ops = events.filter((e) => e.kind === 'op')
    expect(api.fetchCalls).toBe(0)
    expect(new Set(ops.map((e) => e.t)).size).toBe(1)
    expect(ops.length).toBe(400)
  })

  it('G. битий знімок (G1) у межах 3000 не потрапляє на дошку', async () => {
    api.brokenSnapshots = true
    const { seek, board } = await setup()
    for (const T of [150, 999, 2500, 3000]) {
      const p = seek(T); await vi.advanceTimersByTimeAsync(50); await p
      expect(isPrefix(board())).toBe(true)
      expect(board().length).toBe(T)
    }
    expect(api.fetchCalls).toBe(0)
  })
})
