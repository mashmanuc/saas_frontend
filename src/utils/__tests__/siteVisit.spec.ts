/**
 * Позначка «гість без акаунта зайшов на сайт» (власник 2026-10-01: «відображати в staff скільки гостей
 * зайшло на сайт»). Одна на браузер на КИЇВСЬКУ добу; без PII: шаблон маршруту, лише домен, звідки прийшли.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/telemetryAgent', () => ({ trackEvent: vi.fn(), flush: vi.fn(() => Promise.resolve()) }))

import { flush, trackEvent } from '@/utils/telemetryAgent'
import { SITE_VISIT_EVENT, trackSiteVisit } from '../siteVisit'

const START = { matched: [{ path: '/start' }], query: {} }

function setReferrer(value: string) {
  Object.defineProperty(document, 'referrer', { value, configurable: true })
}

beforeEach(() => {
  // happy-dom за замовчуванням каже navigator.webdriver = true — як автоматизація; людина — false.
  Object.defineProperty(navigator, 'webdriver', { value: false, configurable: true })
  localStorage.clear()
  vi.mocked(trackEvent).mockClear()
  vi.mocked(flush).mockClear()
  setReferrer('')
})

describe('trackSiteVisit', () => {
  it('перший захід — одна подія з шаблоном маршруту, доменом і utm; шле одразу, не за 10 с', () => {
    setReferrer('https://t.me/tutor365/1234?x=1')
    trackSiteVisit({ matched: [{ path: '/' }, { path: '/start' }], query: { utm_source: 'tutor365', utm_campaign: 'oct1', other: 'x' } })

    expect(trackEvent).toHaveBeenCalledTimes(1)
    const [name, ctx] = vi.mocked(trackEvent).mock.calls[0]
    expect(name).toBe(SITE_VISIT_EVENT)
    expect(name).toBe('site.visit') // контракт із бекендом: presence.VISIT_EVENT
    expect(ctx).toEqual({
      anon_id: localStorage.getItem('m4sh:anon-id'), route: '/start', ref: 't.me',
      utm_source: 'tutor365', utm_campaign: 'oct1',
    })
    expect(ctx.anon_id).toBeTruthy()
    expect(flush).toHaveBeenCalledTimes(1)
  })

  it('токен з адреси не їде — лише шаблон маршруту', () => {
    trackSiteVisit({ matched: [{ path: '/invite/:token' }], query: {} })
    expect(vi.mocked(trackEvent).mock.calls[0][1].route).toBe('/invite/:token')
  })

  it('свій сайт як джерело — порожньо (перехід усередині, не звідки прийшли)', () => {
    setReferrer(`${window.location.origin}/start`)
    trackSiteVisit(START)
    expect(vi.mocked(trackEvent).mock.calls[0][1].ref).toBe('')
  })

  it('раз на київську добу: 23:59 і 00:01 за Києвом — дві позначки, хоча за UTC це той самий день', () => {
    const before = new Date('2026-10-01T20:59:00Z') // 23:59 Київ
    const after = new Date('2026-10-01T21:01:00Z')  // 00:01 Київ, 2 жовтня
    trackSiteVisit(START, before)
    trackSiteVisit(START, new Date('2026-10-01T20:59:30Z'))
    expect(trackEvent).toHaveBeenCalledTimes(1)
    trackSiteVisit(START, after)
    expect(trackEvent).toHaveBeenCalledTimes(2)
  })

  it('автоматизація (navigator.webdriver) — не людина, нічого не шле', () => {
    Object.defineProperty(navigator, 'webdriver', { value: true, configurable: true })
    trackSiteVisit(START)
    expect(trackEvent).not.toHaveBeenCalled()
  })

  it('телеметрія впала — застосунок не падає', () => {
    vi.mocked(trackEvent).mockImplementationOnce(() => { throw new Error('boom') })
    expect(() => trackSiteVisit(START)).not.toThrow()
  })
})
