/**
 * Повзунок часу не відстає від дошки на стиснутих паузах.
 * Ops записані в 0 / 1000 / 11000 / 12000 мс: пауза 10 с рушій стискає до 2 с.
 * Раніше повзунок ішов за годинником від старту гри й після паузи показував
 * ~3 с, коли дошка вже була на 11-й секунді (REPLAY_SEEK_INVESTIGATION §6.1).
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
import { useReplayPlayhead } from '../composables/useReplayPlayhead'

async function setup() {
  const r = useReplayV2('s')
  await r.loadTimeline(() => {})
  const ph = useReplayPlayhead()
  ph.attach({
    state: () => r.state.value,
    currentTimeMs: () => r.currentTimeMs.value,
    totalMs: () => r.totalDurationMs.value,
  })
  return { r, ph }
}

/** Прокрутити фальшивий час кроками кадру, щоб rAF-тікер жив. */
async function run(ms: number) {
  for (let t = 0; t < ms; t += 16) {
    await vi.advanceTimersByTimeAsync(16)
    await nextTick()
  }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame'] })
})
afterEach(() => { vi.useRealTimers() })

describe('useReplayPlayhead', () => {
  it('після стиснутої паузи повзунок стоїть на часі дошки, а не відстає', async () => {
    const { r, ph } = await setup()
    r.play()
    // op2 (11000) показується через ~1000 + 2000 мс гри
    await run(3100)
    expect(r.currentTimeMs.value).toBe(11000)
    expect(ph.playheadMs.value).toBeGreaterThanOrEqual(11000)
    expect(ph.playheadMs.value).toBeLessThan(11200)
  })

  it('між op повзунок іде плавно (за годинником), не стоїть', async () => {
    const { r, ph } = await setup()
    r.play()
    await run(500)
    expect(ph.playheadMs.value).toBeGreaterThan(400)
    expect(ph.playheadMs.value).toBeLessThan(600)
  })

  it('кінець запису: повзунок = тривалість, не більше', async () => {
    const { r, ph } = await setup()
    r.play()
    await run(6000)
    expect(r.state.value).toBe('ended')
    expect(ph.playheadMs.value).toBe(12000)
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
