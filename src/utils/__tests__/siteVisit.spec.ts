/**
 * Позначка «гість без акаунта зайшов на сайт» (власник 2026-10-01: «відображати в staff скільки гостей
 * зайшло на сайт»). Одна на браузер на КИЇВСЬКУ добу; без PII: шаблон маршруту, лише домен, звідки прийшли.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/telemetryAgent', () => ({ trackEvent: vi.fn(), flush: vi.fn(() => Promise.resolve()) }))

import { flush, trackEvent } from '@/utils/telemetryAgent'
import { REGISTER_OPEN_EVENT, SITE_VISIT_EVENT, trackRegisterOpen, trackSiteVisit } from '../siteVisit'

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

/**
 * «Гість відкрив форму реєстрації» (власник 2026-10-05: «роби подію на відкриття форми реєстрації») —
 * середина воронки «на /start → відкрили форму → реєстрацій». Той самий анонімний id, що й у візиту,
 * інакше бекенд не зшив би одного гостя.
 */
describe('trackRegisterOpen', () => {
  it('одна подія з тим самим анонімним id, що й візит; шле одразу', () => {
    trackSiteVisit(START)
    trackRegisterOpen()

    expect(trackEvent).toHaveBeenCalledTimes(2)
    const [visitName, visitCtx] = vi.mocked(trackEvent).mock.calls[0]
    const [name, ctx] = vi.mocked(trackEvent).mock.calls[1]
    expect(visitName).toBe(SITE_VISIT_EVENT)
    expect(name).toBe(REGISTER_OPEN_EVENT)
    expect(name).toBe('site.register_open') // контракт із бекендом: presence.REGISTER_OPEN_EVENT
    expect(ctx).toEqual({ anon_id: visitCtx.anon_id, route: '/auth/register/tutor' })
    expect(flush).toHaveBeenCalledTimes(2)
  })

  it('раз на київську добу — повторне відкриття того ж дня не рахується вдруге', () => {
    trackRegisterOpen(new Date('2026-10-01T20:58:00Z')) // 23:58 Київ
    trackRegisterOpen(new Date('2026-10-01T20:59:30Z'))
    expect(trackEvent).toHaveBeenCalledTimes(1)
    trackRegisterOpen(new Date('2026-10-01T21:01:00Z')) // 00:01 Київ, 2 жовтня
    expect(trackEvent).toHaveBeenCalledTimes(2)
  })

  it('не залежить від позначки візиту: візит уже був — відкриття форми все одно шле', () => {
    trackSiteVisit(START)
    vi.mocked(trackEvent).mockClear()
    trackRegisterOpen()
    expect(trackEvent).toHaveBeenCalledTimes(1)
  })

  it('автоматизація — нічого; телеметрія впала — форма не падає', () => {
    Object.defineProperty(navigator, 'webdriver', { value: true, configurable: true })
    trackRegisterOpen()
    expect(trackEvent).not.toHaveBeenCalled()

    Object.defineProperty(navigator, 'webdriver', { value: false, configurable: true })
    vi.mocked(trackEvent).mockImplementationOnce(() => { throw new Error('boom') })
    expect(() => trackRegisterOpen()).not.toThrow()
  })
})
