// TZ_REMOTE_DESKTOP_CONNECT_2026-09-22 (Салют → Фея): «Пульт» на комп'ютері —
// сторінка «Підключити телефон», сам пульт — лише на пристрої з дотиком.
// Перемикач вигляду, запасний вихід, стан дошки 200/404, visibilitychange,
// одна адреса QR для сторінки й модалки.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, h, ref, effectScope } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'

const toDataURL = vi.fn(async (_url: string, _opts?: unknown) => 'data:image/png;base64,QR')
vi.mock('qrcode', () => ({ default: { toDataURL: (u: string, o: unknown) => toDataURL(u, o) } }))

vi.mock('@/modules/auth/store/authStore', () => ({
  useAuthStore: () => ({ user: { email: 'teacher@m4sh.local' } }),
}))
vi.mock('@/utils/telemetryAgent', () => ({ trackEvent: vi.fn() }))

const getActiveRemoteSession = vi.fn()
vi.mock('../api/winterboardApi', () => ({
  winterboardApi: { getActiveRemoteSession: (...a: any[]) => getActiveRemoteSession(...a) },
}))

// Сам пульт тут не перевіряємо (у нього свій спек) — лише ЩО показано.
vi.mock('../views/WBRemoteView.vue', () => ({
  default: defineComponent({ name: 'WBRemoteView', props: { id: String }, setup: () => () => h('div', { class: 'stub-remote' }) }),
}))

import WBRemoteEntry from '../views/WBRemoteEntry.vue'
import WBRemoteConnectPage from '../views/WBRemoteConnectPage.vue'
import WBRemoteQrModal from '../components/remote/WBRemoteQrModal.vue'
import { useBoardRemote } from '../composables/useBoardRemote'

// ── Пристрої: що кажуть matchMedia і maxTouchPoints ─────────────────────
type Device = { pointer: 'fine' | 'coarse'; anyFine: boolean; anyCoarse: boolean; hover: boolean; touchPoints: number }
const PHONE: Device = { pointer: 'coarse', anyFine: false, anyCoarse: true, hover: false, touchPoints: 5 }
const LAPTOP: Device = { pointer: 'fine', anyFine: true, anyCoarse: false, hover: true, touchPoints: 0 }
const TOUCH_LAPTOP: Device = { pointer: 'fine', anyFine: true, anyCoarse: true, hover: true, touchPoints: 10 }
// Графічний планшет власника: перо = вказівник, миша поруч, дотику нема.
const PEN_TABLET_PC: Device = { pointer: 'fine', anyFine: true, anyCoarse: false, hover: true, touchPoints: 0 }

function useDevice(d: Device) {
  const answers: Record<string, boolean> = {
    '(pointer: fine)': d.pointer === 'fine',
    '(pointer: coarse)': d.pointer === 'coarse',
    '(any-pointer: fine)': d.anyFine,
    '(any-pointer: coarse)': d.anyCoarse,
    '(hover: hover)': d.hover,
    '(display-mode: standalone)': false,
  }
  window.matchMedia = ((q: string) => ({
    matches: answers[q] ?? false, media: q, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as any
  Object.defineProperty(navigator, 'maxTouchPoints', { value: d.touchPoints, configurable: true })
}

const MSG = {
  openOnPhone: 'Або набери на телефоні:',
  qrTitle: 'Пульт на телефон', qrHint: 'hint', phoneWaiting: 'Чекаю телефон…', phoneConnected: 'Телефон підключено',
  sameAccountNote: 'Той самий акаунт',
  connectPage: {
    title: 'Пульт для телефону', lead: 'lead', howTitle: 'Як підключити',
    step1: 'Наведи камеру', step2: 'Увійди тим самим акаунтом:', step2NoEmail: 'Увійди тим самим акаунтом',
    step3: 'Відкрий урок', boardTitle: 'Дошка',
    boardActive: 'Пульт керуватиме дошкою «{name}».', boardActiveNoName: 'Пульт керуватиме дошкою.',
    boardNone: "Спершу відкрий урок на цьому комп'ютері.", boardError: 'Не вдалося дізнатися',
    boardChecking: 'Перевіряю…', duringLesson: 'Під час уроку…', openHere: 'Все одно відкрити пульт тут',
  },
}

function i18n() {
  return createI18n({
    legacy: false, locale: 'uk', fallbackLocale: 'uk',
    messages: { uk: { winterboard: { remote: MSG }, sidebar: { item: { myLessons: 'Мої уроки' } } } },
  })
}

const mounted: Array<{ unmount: () => void }> = []
function mountIt(component: any, props: Record<string, unknown> = {}) {
  const w = mount(component, { props, global: { plugins: [i18n()], stubs: { Teleport: true } } })
  mounted.push(w)
  return w
}

beforeEach(() => {
  window.sessionStorage.clear()
  getActiveRemoteSession.mockReset()
  getActiveRemoteSession.mockResolvedValue({ session_id: 's-1', name: 'Алгебра 8-А', ts: 1 })
  toDataURL.mockClear()
})
afterEach(() => {
  while (mounted.length) { try { mounted.pop()!.unmount() } catch { /* already unmounted */ } }
})

describe('один маршрут — два вигляди', () => {
  it('телефон (лише дотик) → пульт', () => {
    useDevice(PHONE)
    const w = mountIt(WBRemoteEntry)
    expect(w.find('.stub-remote').exists()).toBe(true)
    expect(w.find('.wb-remote-connect').exists()).toBe(false)
  })

  it.each([
    ['ноутбук з мишею', LAPTOP],
    ['ноутбук із тачскріном', TOUCH_LAPTOP],
    ["комп'ютер із графічним планшетом", PEN_TABLET_PC],
  ])('%s → сторінка підключення, кнопок пульта нема', (_name, device) => {
    useDevice(device as Device)
    const w = mountIt(WBRemoteEntry)
    expect(w.find('.wb-remote-connect').exists()).toBe(true)
    expect(w.find('.stub-remote').exists()).toBe(false)
  })

  it('id дошки доходить до пульта', () => {
    useDevice(PHONE)
    const w = mountIt(WBRemoteEntry, { id: 'board-7' })
    expect(w.findComponent({ name: 'WBRemoteView' }).props('id')).toBe('board-7')
  })

  it('«Все одно відкрити пульт тут» → пульт у цьому перегляді', async () => {
    useDevice(LAPTOP)
    const w = mountIt(WBRemoteEntry)
    await w.find('.wb-remote-connect__here').trigger('click')
    expect(w.find('.stub-remote').exists()).toBe(true)
  })

  // Власник 2026-09-22: «інші спроби зразу перекидають на пульт без попередньої
  // сторінки, і це не добре». Вибір НЕ зберігається.
  it("наступний вхід — знову сторінка підключення, вибір не запам'ятався", async () => {
    useDevice(LAPTOP)
    const w = mountIt(WBRemoteEntry)
    await w.find('.wb-remote-connect__here').trigger('click')
    w.unmount()
    const again = mountIt(WBRemoteEntry)
    expect(again.find('.wb-remote-connect').exists()).toBe(true)
    expect(again.find('.stub-remote').exists()).toBe(false)
  })

  it("з відкритого пульта на комп'ютері є дорога назад", async () => {
    useDevice(LAPTOP)
    const w = mountIt(WBRemoteEntry)
    await w.find('.wb-remote-connect__here').trigger('click')
    await w.find('.wb-remote-entry__back').trigger('click')
    expect(w.find('.wb-remote-connect').exists()).toBe(true)
  })

  it('на телефоні дороги «назад до пояснення» нема — пульт і є екран', () => {
    useDevice(PHONE)
    const w = mountIt(WBRemoteEntry)
    expect(w.find('.wb-remote-entry__back').exists()).toBe(false)
  })
})

describe('сторінка «Підключити телефон»', () => {
  it('акаунт і кроки на місці', async () => {
    const w = mountIt(WBRemoteConnectPage)
    await flushPromises()
    expect(w.text()).toContain('teacher@m4sh.local')
    expect(w.findAll('.wb-remote-connect__steps li')).toHaveLength(3)
  })

  it('200 → назва дошки', async () => {
    const w = mountIt(WBRemoteConnectPage)
    await flushPromises()
    expect(w.find('.wb-remote-connect__board').text()).toBe('Пульт керуватиме дошкою «Алгебра 8-А».')
    expect(w.find('.wb-remote-connect__lessons').exists()).toBe(false)
  })

  it('404 → «спершу відкрий урок» + «Мої уроки»', async () => {
    getActiveRemoteSession.mockRejectedValue({ response: { status: 404 } })
    const w = mountIt(WBRemoteConnectPage)
    await flushPromises()
    expect(w.find('.wb-remote-connect__board').text()).toBe("Спершу відкрий урок на цьому комп'ютері.")
    expect(w.find('.wb-remote-connect__lessons').attributes('to')).toBe('/knowledge/my-lessons')
  })

  it('інша помилка — не «відкрий урок», а чесне «не вдалося»', async () => {
    getActiveRemoteSession.mockRejectedValue({ response: { status: 500 } })
    const w = mountIt(WBRemoteConnectPage)
    await flushPromises()
    expect(w.find('.wb-remote-connect__board').text()).toBe('Не вдалося дізнатися')
  })

  it('відкрив урок в іншій вкладці й повернувся → назва дошки без перезавантаження', async () => {
    getActiveRemoteSession.mockRejectedValueOnce({ response: { status: 404 } })
    const w = mountIt(WBRemoteConnectPage)
    await flushPromises()
    expect(w.find('.wb-remote-connect__lessons').exists()).toBe(true)

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    await flushPromises()
    expect(getActiveRemoteSession).toHaveBeenCalledTimes(2)
    expect(w.find('.wb-remote-connect__board').text()).toContain('Алгебра 8-А')
  })

  it('без таймерів: сам по собі запит не повторюється (LAW §12)', async () => {
    vi.useFakeTimers()
    try {
      mountIt(WBRemoteConnectPage)
      await flushPromises()
      await vi.advanceTimersByTimeAsync(5 * 60_000)
      expect(getActiveRemoteSession).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('QR — одна адреса для сторінки й модалки', () => {
  const EXPECTED = `${window.location.origin}/remote`

  it('сторінка кодує універсальну адресу пульта', async () => {
    const w = mountIt(WBRemoteConnectPage)
    await flushPromises()
    expect(toDataURL.mock.calls[0][0]).toBe(EXPECTED)
    expect(w.find('.wb-remote-qrblock__url').text()).toBe(EXPECTED.replace(/^https?:\/\//, ''))
  })

  it('модалка в дошці — та сама адреса і той самий блок', async () => {
    const remote = effectScope().run(() => useBoardRemote({
      sessionId: ref('s-1'), store: {}, undo: vi.fn(), sendMessage: vi.fn(), enabled: ref(false),
    } as any))!
    expect(remote.remoteUrl.value).toBe(EXPECTED)
    const w = mountIt(WBRemoteQrModal, { visible: true, url: remote.remoteUrl.value, remoteConnected: false })
    await flushPromises()
    expect(w.find('.wb-remote-qrblock').exists()).toBe(true)
    expect(toDataURL.mock.calls[0][0]).toBe(EXPECTED)
  })
})
