// Телеметрія воронки гостя — TTFS (Ф2 плану рекомендацій 2026-08-25).
//
// Стережемо не «подія відправилась», а те, від чого залежить достовірність
// числа: нуль відліку = початок завантаження сторінки (не монтування),
// метрика йде окремим каналом (metrics, не context), і другий штрих її не
// перезаписує — інакше p50 показував би час останньої дії, а не першої.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const trackEvent = vi.fn()
vi.mock('@/utils/telemetryAgent', () => ({
  trackEvent: (...args: unknown[]) => trackEvent(...args),
}))

import {
  _resetLocalTelemetryDedupe,
  elapsedSincePageLoad,
  trackEngagement,
  trackLocal,
} from '../localWorkspaceTelemetry'

beforeEach(() => {
  trackEvent.mockClear()
  _resetLocalTelemetryDedupe()
  localStorage.clear()
})

describe('TTFS', () => {
  it('перший штрих несе ttfs_ms = час від завантаження сторінки', () => {
    vi.spyOn(performance, 'now').mockReturnValue(4321.7)

    trackEngagement('stroke:pen')

    const [, , metrics] = trackEvent.mock.calls[0]
    expect(metrics).toEqual({ ttfs_ms: 4322 })
  })

  it('метрика йде у metrics, не в context — context не для чисел', () => {
    // BE рахує перцентилі через `metrics__ttfs_ms`; якщо число заїде у
    // context, воронка мовчки покаже «даних немає».
    vi.spyOn(performance, 'now').mockReturnValue(1000)

    trackEngagement('stroke:pen')

    const [, context] = trackEvent.mock.calls[0]
    expect(context).not.toHaveProperty('ttfs_ms')
    expect(context).toHaveProperty('anon_id')
  })

  it('другий штрих НЕ перезаписує ttfs — це час ПЕРШОГО', () => {
    const now = vi.spyOn(performance, 'now')
    now.mockReturnValue(2000)
    trackEngagement('stroke:pen')
    now.mockReturnValue(90_000)
    trackEngagement('stroke:pen')

    const engaged = trackEvent.mock.calls.filter(
      ([name]) => name === 'wb.local.engaged',
    )
    expect(engaged).toHaveLength(1)
    expect(engaged[0][2]).toEqual({ ttfs_ms: 2000 })
  })

  it('tool_used іде без метрики — інструмент не має свого ttfs', () => {
    vi.spyOn(performance, 'now').mockReturnValue(1500)

    trackEngagement('stroke:pen')

    const toolUsed = trackEvent.mock.calls.find(
      ([name]) => name === 'wb.local.tool_used',
    )
    expect(toolUsed?.[2]).toBeUndefined()
  })

  it('без performance.now подія все одно летить, просто без метрики', () => {
    // Телеметрія ніколи не має ламати малювання: відсутній API → подія без
    // числа, а не проковтнута подія.
    vi.spyOn(performance, 'now').mockImplementation(() => {
      throw new Error('unavailable')
    })

    trackEngagement('stroke:pen')

    expect(trackEvent).toHaveBeenCalled()
    expect(trackEvent.mock.calls[0][2]).toBeUndefined()
  })

  it('elapsedSincePageLoad віддає ціле число мс', () => {
    vi.spyOn(performance, 'now').mockReturnValue(812.4)
    expect(elapsedSincePageLoad()).toBe(812)
  })
})

describe('trackLocal', () => {
  it('пропускає metrics далі в агент', () => {
    trackLocal('workspace_opened', { returning: true }, { ready_ms: 700 })

    const [name, context, metrics] = trackEvent.mock.calls[0]
    expect(name).toBe('wb.local.workspace_opened')
    expect(context).toMatchObject({ returning: true })
    expect(metrics).toEqual({ ready_ms: 700 })
  })

  it('без metrics поводиться як раніше (undefined, не порожній обʼєкт)', () => {
    trackLocal('seed_shown')
    expect(trackEvent.mock.calls[0][2]).toBeUndefined()
  })
})
