/**
 * Повзунок Replay на шкалі ЧАСУ ПЕРЕГЛЯДУ (REPLAY_MANIFEST v2.3, рішення власника 2026-09-27).
 * Ops записані в 0 / 1000 / 11000 / 12000 мс: пауза 10 с рушій стискає до 2 с, тож на шкалі
 * перегляду ops стоять на 0 / 1000 / 3000 / 4000, а вся шкала = 4000 + витримка 2500.
 *
 * Було (v2.2): шкала в реальному часі — повзунок 2 с повз, потім перескакував на 11 000, а
 * під кінець «скакав» до кінця; `ended` — у ту саму мить, що й остання op
 * (REPLAY_TIMELINE_AND_ENDING_INVESTIGATION_2026-09-27.md).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

const { TIMES } = vi.hoisted(() => ({ TIMES: [0, 1000, 11000, 12000] }))

vi.mock('../api/replay', () => {
  const t0 = Date.UTC(2026, 0, 1)
  const ops = TIMES.map((t, i) => ({
    id: i + 1, seq: i + 1, op_type: 'stroke_add', page_id: 'p', payload: { i }, user: 1,
    created_at: new Date(t0 + t).toISOString(),
  }))
  return {
    fetchReplayTimeline: async () => ({ session_id: 's', total_operations: ops.length, operations: ops, start_state: null }),
    fetchOwnerReplayPlayback: async () => { throw new Error('unused') },
    fetchPublicReplayByToken: async () => { throw new Error('unused') },
    fetchLessonMarkers: async () => ({ markers: [] }),
    reportReplayView: async () => true,
    fetchNearestSnapshot: async () => null,
    fetchPublicNearestSnapshot: async () => null,
  }
})

import { useReplayV2 } from '../composables/useReplayV2'
import { epilogueCurve, useReplayPlayhead } from '../composables/useReplayPlayhead'
import { REPLAY_EPILOGUE_MS } from '../engine/replayViewTime'

const LAST_OP_VIEW_MS = 4000
const TOTAL_VIEW_MS = LAST_OP_VIEW_MS + REPLAY_EPILOGUE_MS

/** Так само, як під'єднує WBPublicView (v2.3). */
async function setup() {
  const r = useReplayV2('s')
  await r.loadTimeline(() => {})
  const ph = useReplayPlayhead()
  ph.attach({
    state: () => r.state.value,
    currentTimeMs: () => r.currentViewMs.value,
    totalMs: () => r.totalViewMs.value,
    epilogueStartedAt: () => r.epilogueStartedAt.value,
    epilogueMs: REPLAY_EPILOGUE_MS,
  })
  return { r, ph }
}

/** Прокрутити фальшивий час кроками кадру, щоб rAF-тікер жив; повертає значення повзунка на кожному кадрі. */
async function run(ms: number, read?: () => number): Promise<number[]> {
  const samples: number[] = []
  for (let t = 0; t < ms; t += 16) {
    await vi.advanceTimersByTimeAsync(16)
    await nextTick()
    if (read) samples.push(read())
  }
  return samples
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame'] })
})
afterEach(() => { vi.useRealTimers() })

describe('useReplayPlayhead — шкала часу перегляду', () => {
  it('шкала: остання op на 4000, уся шкала = 4000 + витримка; реальний урок = 12 000', async () => {
    const { r } = await setup()
    expect(r.totalViewMs.value).toBe(TOTAL_VIEW_MS)
    expect(r.lessonDurationMs.value).toBe(12000)
    expect(r.viewMsAtIndex(2)).toBe(3000)
  })

  it('стиснута пауза 10 с — повзунок іде рівно, без стрибка вперед чи назад', async () => {
    const { r, ph } = await setup()
    r.play()
    const s = await run(3900, () => ph.playheadMs.value)
    for (let i = 1; i < s.length; i++) {
      const step = s[i] - s[i - 1]
      expect(step).toBeLessThanOrEqual(16 + 20)   // один кадр + дрібне вирівнювання на op
      expect(step).toBeGreaterThanOrEqual(-20)
    }
    // через ~3,1 с гри дошка на op2 (реальні 11 с), а повзунок — на 3,1 с перегляду, не на 11 с
    expect(r.currentTimeMs.value).toBe(11000)
    expect(ph.playheadMs.value).toBeGreaterThan(3800)
    expect(ph.playheadMs.value).toBeLessThan(4000)
  })

  it('між op повзунок іде за годинником, не стоїть', async () => {
    const { r, ph } = await setup()
    r.play()
    await run(500)
    expect(ph.playheadMs.value).toBeGreaterThan(400)
    expect(ph.playheadMs.value).toBeLessThan(600)
  })

  it('кінець: остання op — витримка з видимою дошкою; повзунок монотонно доходить до кінця; ended рівно на 100 %', async () => {
    const { r, ph } = await setup()
    r.play()
    await run(LAST_OP_VIEW_MS + 50)
    // остання op показана, але кінця ще немає: витримка, стан 'playing'
    expect(r.currentIndex.value).toBe(TIMES.length)
    expect(r.state.value).toBe('playing')
    expect(r.epilogueStartedAt.value).not.toBeNull()
    expect(ph.playheadMs.value).toBeLessThan(TOTAL_VIEW_MS)
    const s = await run(REPLAY_EPILOGUE_MS - 100, () => ph.playheadMs.value)
    for (let i = 1; i < s.length; i++) expect(s[i]).toBeGreaterThanOrEqual(s[i - 1])
    expect(r.state.value).toBe('playing')
    await run(200)
    expect(r.state.value).toBe('ended')
    expect(ph.playheadMs.value).toBe(TOTAL_VIEW_MS)
  })

  it('на 2× витримка така сама за тривалістю, і повзунок так само стає рівно на 100 %', async () => {
    const { r, ph } = await setup()
    ph.setSpeed(2); r.setSpeed(2)
    r.play()
    await run(LAST_OP_VIEW_MS / 2 + 50)
    expect(r.state.value).toBe('playing')
    await run(REPLAY_EPILOGUE_MS - 150)
    expect(r.state.value).toBe('playing')
    expect(ph.playheadMs.value).toBeLessThanOrEqual(TOTAL_VIEW_MS)
    await run(250)
    expect(r.state.value).toBe('ended')
    expect(ph.playheadMs.value).toBe(TOTAL_VIEW_MS)
  })

  it('пауза під час витримки — одразу кінець на 100 %', async () => {
    const { r, ph } = await setup()
    r.play()
    await run(LAST_OP_VIEW_MS + 500)
    r.pause()
    await nextTick()
    expect(r.state.value).toBe('ended')
    expect(ph.playheadMs.value).toBe(TOTAL_VIEW_MS)
  })

  it('крива доходу монотонна й закінчується на 1 для швидкостей 0…3 і вище', () => {
    for (const a of [0, 0.5, 1, 2, 3, 10]) {
      let prev = 0
      for (let u = 0; u <= 1.0001; u += 0.01) {
        const h = epilogueCurve(u, a)
        expect(h).toBeGreaterThanOrEqual(prev - 1e-9)
        expect(h).toBeLessThanOrEqual(1 + 1e-9)
        prev = h
      }
      expect(epilogueCurve(1, a)).toBeCloseTo(1, 9)
    }
  })

  it('setSpeed не відкидає повзунок назад', async () => {
    const { r, ph } = await setup()
    r.play()
    await run(700)
    const before = ph.playheadMs.value
    ph.setSpeed(2); r.setSpeed(2)
    await run(16)
    expect(ph.playheadMs.value).toBeGreaterThanOrEqual(before)
  })

  it('detach зупиняє тікер і стеження', async () => {
    const { r, ph } = await setup()
    r.play()
    await run(200)
    ph.detach()
    const frozen = ph.playheadMs.value
    await run(3000)
    expect(ph.playheadMs.value).toBe(frozen)
  })
})
