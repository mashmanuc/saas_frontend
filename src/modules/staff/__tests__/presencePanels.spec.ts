/**
 * Staff: «Зараз онлайн» і «Присутність і споживання» (2026-09-26).
 * Власник: «щоб я міг дивитися: якщо немає нікого — то пушити», графік присутності,
 * хто найбільше споживає, що цінне. Переклади — справжній uk.json.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '@/i18n/locales/uk.json'

vi.mock('@/modules/staff/api/staffPresenceApi', () => ({
  getPresenceNow: vi.fn(),
  getPresenceTimeline: vi.fn(),
  getUsageTop: vi.fn(),
  getFeatureUsage: vi.fn(),
}))
// happy-dom не малює canvas — графік підміняємо, перевіряємо дані, які йому дали.
const chartCalls: any[] = []
let chartDestroys = 0
vi.mock('chart.js', () => ({
  Chart: class {
    static register() {}
    constructor(_el: unknown, cfg: unknown) { chartCalls.push(cfg) }
    destroy() { chartDestroys++ }
  },
  registerables: [],
}))

import { getFeatureUsage, getPresenceNow, getPresenceTimeline, getUsageTop } from '@/modules/staff/api/staffPresenceApi'
import PresenceNowPanel from '../components/PresenceNowPanel.vue'
import PresenceUsageSection from '../components/PresenceUsageSection.vue'

const RouterLinkStub = { props: ['to'], template: '<a :href="to"><slot /></a>' }

function mountWith(component: any) {
  const i18n = createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk }, missingWarn: false })
  return mount(component, { global: { plugins: [i18n], stubs: { 'router-link': RouterLinkStub } } })
}

const NOW_EMPTY = {
  checked_at: '2026-09-26T10:00:00Z', nobody: true, people_count: 0, in_app: [], boards: [], recordings: [],
  guests: 0, staff_online: [{ user_id: 1, email: 'owner@x', role: 'admin', name: 'Власник', is_staff: true }],
}
const NOW_BUSY = {
  checked_at: '2026-09-26T10:00:00Z', nobody: false, people_count: 3,
  in_app: [{ user_id: 5, email: 'a@x', role: 'tutor', name: 'Анна' }],
  boards: [{ board_id: 'b1', name: 'Урок 9-А', members: [
    { user_id: 7, email: 'o@x', role: 'tutor', name: 'Олег', board_role: 'tutor', is_staff: false },
    { user_id: 8, email: 's@x', role: 'student', name: '', board_role: 'student', is_staff: false },
  ] }],
  recordings: [{ board_id: 'b1', name: 'Урок 9-А', owner_id: 7 }],
  guests: 2,
  staff_online: [],
}

beforeEach(() => {
  vi.mocked(getPresenceNow).mockReset()
  vi.mocked(getPresenceTimeline).mockReset()
  vi.mocked(getUsageTop).mockReset()
  vi.mocked(getFeatureUsage).mockReset()
  chartCalls.length = 0
  chartDestroys = 0
})
afterEach(() => vi.useRealTimers())

describe('PresenceNowPanel', () => {
  it('«можна пушити» — лише після двох порожніх перевірок поспіль; staff не рахується', async () => {
    vi.useFakeTimers()
    vi.mocked(getPresenceNow).mockResolvedValue(NOW_EMPTY)
    const w = mountWith(PresenceNowPanel)
    await flushPromises()
    expect(w.text()).toContain('Схоже, нікого — перевіряю ще раз…')
    expect(w.text()).not.toContain('можна пушити')

    await vi.advanceTimersByTimeAsync(10_000)
    await flushPromises()

    expect(getPresenceNow).toHaveBeenCalledTimes(2)
    expect(w.text()).toContain('Зараз нікого немає — можна пушити')
    expect(w.text()).toContain('Staff онлайн (не рахується): Власник')
    w.unmount()
  })

  it('хтось є — хто, де, запис і гості; пушити не радимо', async () => {
    vi.mocked(getPresenceNow).mockResolvedValue(NOW_BUSY)
    const w = mountWith(PresenceNowPanel)
    await flushPromises()
    const text = w.text()
    expect(text).toContain('Зараз онлайн: 3 · записів: 1 · гостей: 2 — краще почекати')
    expect(text).toContain('Урок 9-А')
    expect(text).toContain('Олег')
    expect(text).toContain('Анна')
    expect(text).toContain('Гостей без акаунта за 30 хв: 2')
    expect(w.find('a[href="/staff/users/8"]').text()).toBe('s@x')
    expect(text).not.toContain('можна пушити')
    w.unmount()
  })

  it('збій після «можна пушити» — одразу «не пуште наосліп», без спаму запитами', async () => {
    vi.useFakeTimers()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(getPresenceNow)
      .mockResolvedValueOnce(NOW_EMPTY).mockResolvedValueOnce(NOW_EMPTY).mockRejectedValue(new Error('500'))
    const w = mountWith(PresenceNowPanel)
    await flushPromises()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(w.text()).toContain('можна пушити')

    await vi.advanceTimersByTimeAsync(30_000)
    await flushPromises()

    expect(w.text()).toContain('Не вдалося перевірити, хто онлайн — не пуште наосліп')
    expect(w.text()).not.toContain('можна пушити')
    const calls = vi.mocked(getPresenceNow).mock.calls.length
    await vi.advanceTimersByTimeAsync(60_000)
    expect(vi.mocked(getPresenceNow).mock.calls.length).toBe(calls) // після збою — пауза 2 хв
    w.unmount()
  })

  it('зависла відповідь — «застаріло», а не старе «нікого»', async () => {
    vi.useFakeTimers()
    vi.mocked(getPresenceNow)
      .mockResolvedValueOnce(NOW_EMPTY).mockResolvedValueOnce(NOW_EMPTY)
      .mockImplementation(() => new Promise(() => {}))
    const w = mountWith(PresenceNowPanel)
    await flushPromises()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(w.text()).toContain('можна пушити')

    await vi.advanceTimersByTimeAsync(80_000)

    expect(w.text()).toContain('Відповідь застаріла')
    expect(w.text()).not.toContain('можна пушити')
    w.unmount()
  })

  it('повернення на вкладку — одразу нова перевірка; після закриття — тиша', async () => {
    vi.useFakeTimers()
    vi.mocked(getPresenceNow).mockResolvedValue(NOW_BUSY)
    const w = mountWith(PresenceNowPanel)
    await flushPromises()
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    await flushPromises()
    expect(getPresenceNow).toHaveBeenCalledTimes(2)

    w.unmount()
    await vi.advanceTimersByTimeAsync(120_000)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(getPresenceNow).toHaveBeenCalledTimes(2)
  })
})

function heatmap(value: number | null = null) {
  return Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => value))
}

const TIMELINE = {
  sampling_enabled: true, since: '2026-09-26T08:00:00Z', sample_minutes: 5, bucket: 'hour' as const, heatmap: heatmap(1),
  points: [{ t: '2026-09-26T08:00:00Z', total: 3, on_boards: 1, recordings: 0 }],
}
const TOP = {
  days: 7, sort: 'online_minutes' as const, sample_minutes: 5, sampling_enabled: true,
  results: [{ user_id: 5, name: 'Анна', email: 'a@x', role: 'tutor', is_staff: false, online_minutes: 125,
              board_minutes: 5, ai_requests: 12, ai_month: 30, storage_bytes: 5 * 1024 * 1024, boards: 3, replays: 1 }],
}
const FEATURES = {
  days: 7, aggregation_enabled: true, objects_until: '2026-09-25', ops_log_last_write: new Date().toISOString(),
  objects: [{ object_type: 'graph_calculator', total: 9, users: 2 }, { object_type: 'brand_new_type', total: 1, users: 1 }],
  integralyk_tools: [{ tool: 'board_add_graph', total: 4, users: 2 }],
}

describe('PresenceUsageSection', () => {
  function arrange() {
    vi.mocked(getPresenceTimeline).mockResolvedValue(TIMELINE)
    vi.mocked(getUsageTop).mockResolvedValue(TOP)
    vi.mocked(getFeatureUsage).mockResolvedValue(FEATURES)
  }

  it('графік, топ і що цінне — людськими словами', async () => {
    arrange()
    const w = mountWith(PresenceUsageSection)
    await flushPromises()
    await flushPromises()

    const text = w.text()
    expect(chartCalls).toHaveLength(1)
    expect(chartCalls[0].data.datasets[0].data).toEqual([3])
    expect(text).toContain('Анна')
    expect(text).toContain('2 год 5 хв')
    expect(text).toMatch(/5[.,]0 МБ/)
    expect(text).toContain('Графік 2D')
    expect(text).toContain('brand_new_type')
    expect(text).toContain('board_add_graph')
    expect(text).not.toContain('вимкнено')
    expect(text).not.toContain('staff.presence')
  })

  it('знімки й нічний підсумок вимкнено — так і кажемо, без обіцянки «через 5 хвилин»', async () => {
    arrange()
    vi.mocked(getPresenceTimeline).mockResolvedValue({ ...TIMELINE, sampling_enabled: false, since: null, points: [] })
    vi.mocked(getUsageTop).mockResolvedValue({ ...TOP, sampling_enabled: false })
    vi.mocked(getFeatureUsage).mockResolvedValue({ ...FEATURES, aggregation_enabled: false, objects: [] })
    const w = mountWith(PresenceUsageSection)
    await flushPromises()

    const text = w.text()
    expect(text).toContain('Запис історії присутності вимкнено')
    expect(text).not.toContain('через 5 хвилин')
    expect(text).toContain('Колонки «Онлайн» і «На дошках» порожні')
    expect(text).toContain('Нічний підсумок об’єктів вимкнено')
  })

  it('ops-лог не пишеться — попереджаємо, що нуль об\'єктів ще не означає «не користуються»', async () => {
    arrange()
    vi.mocked(getFeatureUsage).mockResolvedValue({ ...FEATURES, objects_until: null, ops_log_last_write: null, objects: [] })
    const w = mountWith(PresenceUsageSection)
    await flushPromises()
    expect(w.text()).toContain('Журнал операцій дошки давно не пишеться')
  })

  it('період і сортування йдуть у запит', async () => {
    arrange()
    const w = mountWith(PresenceUsageSection)
    await flushPromises()
    const month = w.findAll('.pu__period').find(b => b.text() === 'Місяць')!
    await month.trigger('click')
    await flushPromises()
    expect(month.attributes('aria-pressed')).toBe('true')
    expect(getUsageTop).toHaveBeenLastCalledWith(30, 'online_minutes')
    await w.find('select').setValue('ai_requests')
    await flushPromises()
    expect(getUsageTop).toHaveBeenLastCalledWith(30, 'ai_requests')
    expect(getPresenceTimeline).toHaveBeenLastCalledWith(30)
  })

  it('повільна стара відповідь не перезаписує нову', async () => {
    arrange()
    let resolveSlow!: (v: any) => void
    vi.mocked(getUsageTop)
      .mockImplementationOnce(() => new Promise(r => { resolveSlow = r }))
      .mockResolvedValueOnce({ ...TOP, results: [{ ...TOP.results[0], name: 'Нова відповідь' }] })
    const w = mountWith(PresenceUsageSection)
    await flushPromises()
    await w.findAll('.pu__period').find(b => b.text() === 'Місяць')!.trigger('click')
    await flushPromises()
    resolveSlow({ ...TOP, results: [{ ...TOP.results[0], name: 'Стара відповідь' }] })
    await flushPromises()

    expect(w.text()).toContain('Нова відповідь')
    expect(w.text()).not.toContain('Стара відповідь')
  })

  it('порожній новий період прибирає графік попереднього', async () => {
    arrange()
    const w = mountWith(PresenceUsageSection)
    await flushPromises()
    await flushPromises()
    expect(chartCalls).toHaveLength(1)
    vi.mocked(getPresenceTimeline).mockResolvedValue({ ...TIMELINE, points: [] })
    await w.findAll('.pu__period').find(b => b.text() === 'Доба')!.trigger('click')
    await flushPromises()
    await flushPromises()
    expect(chartDestroys).toBe(1)
    expect(chartCalls).toHaveLength(1)
  })

  it('збій одного блоку не гасить інші', async () => {
    arrange()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(getUsageTop).mockRejectedValue(new Error('500'))
    const w = mountWith(PresenceUsageSection)
    await flushPromises()
    expect(w.text()).toContain('Не вдалося завантажити дані')
    expect(w.text()).toContain('Графік 2D')
  })
})

describe('staffPresenceApi', () => {
  it('опитування «зараз» тихе: без лоадера, мережевий збій без тосту й breaker', async () => {
    vi.resetModules()
    const get = vi.fn().mockResolvedValue({})
    vi.doMock('@/utils/apiClient', () => ({ default: { get } }))
    const api = await vi.importActual<typeof import('@/modules/staff/api/staffPresenceApi')>('@/modules/staff/api/staffPresenceApi')
    await api.getPresenceNow()
    expect(get).toHaveBeenCalledWith('/v1/staff/presence/now/', { meta: { skipLoader: true, nonCriticalRequest: true } })
    vi.doUnmock('@/utils/apiClient')
  })
})
