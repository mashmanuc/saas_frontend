/**
 * Час перегляду Replay (REPLAY_MANIFEST v2.3): одна формула для рушія і шкали.
 * Якщо рушій і шкала рахують паузу по-різному — повзунок знову розійдеться з дошкою,
 * тож тест звіряє реальні моменти спрацювання op на фальшивому годиннику з тим, що обіцяє шкала.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WBReplayEngineV2 } from '../engine/WBReplayEngineV2'
import {
  REPLAY_EPILOGUE_MS,
  REPLAY_MAX_GAP_MS,
  buildViewTimeline,
  findIndexByViewMs,
  lessonMsAtView,
  viewGapMs,
} from '../engine/replayViewTime'

const T0 = Date.UTC(2026, 0, 1)
/** Бурст (5 мс), дрібні проміжки, довгі паузи (10 с, 45 с), зламаний час. */
const OFFSETS: Array<number | null> = [0, 5, 9, 400, 1400, 11400, 11420, 11500, 56500, null, 57000, 57010, 90000]
const iso = (o: number | null) => (o === null ? 'not-a-date' : new Date(T0 + o).toISOString())
const CREATED = OFFSETS.map(iso)

function timeline() {
  return {
    session_id: 's', total_operations: CREATED.length, start_state: null,
    operations: CREATED.map((c, i) => ({ id: i + 1, seq: i + 1, op_type: 'stroke_add', page_id: 'p', payload: {}, user: 1, created_at: c })),
  } as unknown as ConstructorParameters<typeof WBReplayEngineV2>[0]
}

describe('replayViewTime — формула', () => {
  it('пауза: пачка → 0, мінімум 4 мс, стеля 2 с, зламаний час → 16 мс', () => {
    expect(viewGapMs(0)).toBe(0)
    expect(viewGapMs(15)).toBe(0)
    expect(viewGapMs(16)).toBe(16)
    expect(viewGapMs(1500)).toBe(1500)
    expect(viewGapMs(45_000)).toBe(REPLAY_MAX_GAP_MS)
    expect(viewGapMs(Number.NaN)).toBe(16)
    expect(viewGapMs(-50)).toBe(0)
  })

  it('шкала = сума стиснутих пауз + витримка; урок = остання − перша op', () => {
    const tl = buildViewTimeline(['2026-01-01T00:00:00.000Z', '2026-01-01T00:00:01.000Z', '2026-01-01T00:00:31.000Z'])
    expect(Array.from(tl.viewAt)).toEqual([0, 1000, 3000])
    expect(tl.totalViewMs).toBe(3000 + REPLAY_EPILOGUE_MS)
    expect(tl.lessonMs).toBe(31_000)
  })

  it('lessonMsAtView повертає справжній час кожної op (сумісність ?t=) і не виходить за наступну op', () => {
    const tl = buildViewTimeline(CREATED)
    for (let i = 0; i < CREATED.length; i++) {
      if (OFFSETS[i] === null) continue
      const j = findIndexByViewMs(tl, tl.viewAt[i])
      expect(lessonMsAtView(tl, tl.viewAt[j])).toBe(tl.realAt[j])
    }
    // усередині стиснутої паузи 11 500 → 56 500: урок іде разом із переглядом, але ≤ наступної op
    const k = OFFSETS.indexOf(11500)
    const mid = lessonMsAtView(tl, tl.viewAt[k] + 1500)
    expect(mid).toBe(11500 + 1500)
    expect(lessonMsAtView(tl, tl.viewAt[k] + 1999)).toBeLessThanOrEqual(56_500)
  })

  it('findIndexByViewMs: перша op не раніше цілі; за кінцем — остання', () => {
    const tl = buildViewTimeline(CREATED)
    expect(findIndexByViewMs(tl, 0)).toBe(0)
    expect(findIndexByViewMs(tl, tl.viewAt[5] - 1)).toBe(5)
    expect(findIndexByViewMs(tl, tl.totalViewMs)).toBe(CREATED.length - 1)
  })
})

describe('replayViewTime ↔ WBReplayEngineV2', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  async function fireTimes(speed: 1 | 2): Promise<number[]> {
    const engine = new WBReplayEngineV2(timeline())
    const fired: number[] = []
    const start = Date.now()
    engine.on('onOperation', () => { fired.push(Date.now() - start) })
    engine.setSpeed(speed)
    engine.play()
    await vi.advanceTimersByTimeAsync(200_000)
    return fired
  }

  it('на 1× кожна op спрацьовує рівно в свій момент шкали (+4 мс першої op)', async () => {
    const tl = buildViewTimeline(CREATED)
    const fired = await fireTimes(1)
    expect(fired.length).toBe(CREATED.length)
    fired.forEach((t, i) => expect(t).toBe(4 + tl.viewAt[i]))
  })

  it('на 2× — у свій момент шкали, поділений на швидкість', async () => {
    const tl = buildViewTimeline(CREATED)
    const fired = await fireTimes(2)
    fired.forEach((t, i) => expect(Math.abs(t - (4 + tl.viewAt[i] / 2))).toBeLessThanOrEqual(2))
  })

  it('після останньої op — витримка REPLAY_EPILOGUE_MS зі станом playing, потім ended (один раз)', async () => {
    const engine = new WBReplayEngineV2(timeline())
    const tl = buildViewTimeline(CREATED)
    const states: string[] = []
    let epilogues = 0
    let completes = 0
    engine.on('onStateChange', s => states.push(s)).on('onEpilogue', () => { epilogues++ }).on('onComplete', () => { completes++ })
    engine.play()
    await vi.advanceTimersByTimeAsync(4 + tl.viewAt[CREATED.length - 1] + 1)
    expect(engine.getCurrentIndex()).toBe(CREATED.length)
    expect(engine.getState()).toBe('playing')
    expect(engine.isInEpilogue()).toBe(true)
    expect(epilogues).toBe(1)
    await vi.advanceTimersByTimeAsync(REPLAY_EPILOGUE_MS - 2)
    expect(engine.getState()).toBe('playing')
    await vi.advanceTimersByTimeAsync(5)
    expect(engine.getState()).toBe('ended')
    expect(engine.isInEpilogue()).toBe(false)
    expect(completes).toBe(1)
    expect(states.filter(s => s === 'ended').length).toBe(1)
  })

  it('пауза під час витримки — одразу ended; seek під час витримки — виходить із неї без ended', async () => {
    const tl = buildViewTimeline(CREATED)
    const lastAt = 4 + tl.viewAt[CREATED.length - 1] + 1

    const a = new WBReplayEngineV2(timeline())
    a.play()
    await vi.advanceTimersByTimeAsync(lastAt)
    a.pause()
    expect(a.getState()).toBe('ended')

    const b = new WBReplayEngineV2(timeline())
    b.play()
    await vi.advanceTimersByTimeAsync(lastAt)
    b.holdForSeek()
    b.seekTo(2)
    expect(b.isInEpilogue()).toBe(false)
    expect(b.getState()).toBe('playing')
    await vi.advanceTimersByTimeAsync(REPLAY_EPILOGUE_MS)
    expect(b.getCurrentIndex()).toBeGreaterThan(2)
  })

  it('швидкість під час витримки її не перезапускає', async () => {
    const tl = buildViewTimeline(CREATED)
    const engine = new WBReplayEngineV2(timeline())
    let epilogues = 0
    engine.on('onEpilogue', () => { epilogues++ })
    engine.play()
    await vi.advanceTimersByTimeAsync(4 + tl.viewAt[CREATED.length - 1] + 1000)
    engine.setSpeed(4)
    await vi.advanceTimersByTimeAsync(REPLAY_EPILOGUE_MS - 1000 + 5)
    expect(engine.getState()).toBe('ended')
    expect(epilogues).toBe(1)
  })
})
