// WBRemoteView v1.1 — універсальний пульт: сам знаходить активну дошку, абсолютні
// індекси, голос → граматика або фраза, і НІКОЛИ не мовчить про причину.
// Канал, мікрофон, API і authStore підмінені.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { derivePair } from '../remote/remotePair'

const SID = '4ba7fff3-9452-4c42-9ff9-04415ff25d90'
const PAIR = derivePair(SID)

const channelState = ref<'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'unavailable'>('idle')
const send = vi.fn((_data: Record<string, unknown>) => true)
const connect = vi.fn(async () => { channelState.value = 'connected' })
const disconnect = vi.fn(() => { channelState.value = 'disconnected' })
const retry = vi.fn()
let onStateCb: ((s: any) => void) | null = null
let onErrorCb: ((c: string) => void) | null = null

vi.mock('../composables/useRemoteChannel', () => ({
  useRemoteChannel: (opts: any) => {
    onStateCb = opts.onState
    onErrorCb = opts.onError
    return { state: channelState, lastError: ref(null), sessionId: ref(null), connect, disconnect, retry, send }
  },
}))

let onFinalCb: ((t: string) => void) | null = null
const pttListening = ref(false)
vi.mock('../composables/usePushToTalk', () => ({
  usePushToTalk: (opts: any) => {
    onFinalCb = opts.onFinal
    return { supported: true, listening: pttListening, press: vi.fn(), release: vi.fn() }
  },
}))

const forceLogout = vi.fn()
vi.mock('@/modules/auth/store/authStore', () => ({
  useAuthStore: () => ({ user: { email: 'teacher@m4sh.local' }, forceLogout }),
}))

const apiLogout = vi.fn()
vi.mock('@/modules/auth/api/authApi', () => ({ default: { logout: (...a: any[]) => apiLogout(...a) } }))

const trackEvent = vi.fn()
vi.mock('@/utils/telemetryAgent', () => ({ trackEvent: (...a: any[]) => trackEvent(...a) }))

const getActiveRemoteSession = vi.fn()
vi.mock('../api/winterboardApi', () => ({
  winterboardApi: { getActiveRemoteSession: (...a: any[]) => getActiveRemoteSession(...a) },
}))

import WBRemoteView from '../views/WBRemoteView.vue'

const MSG = {
  disconnect: 'Відключити', connect: 'Підключити', refresh: 'Оновити',
  connected: 'Зв\'язок є', connecting: '…', disconnected: 'нема', unavailable: 'недоступно',
  waitingBoard: 'Чекаю дошку…', board: 'Дошка', loggedInAs: 'Ти зайшов як', switchAccount: 'Змінити акаунт',
  noActiveBoard: 'На ноутбуці не відкрита жодна дошка.', noActiveBoardHint: 'Відкрий дошку',
  wrongAccount: 'Дошка належить іншому акаунту.', wrongAccountHint: 'На телефоні ти {email}',
  tooManyConnections: 'забагато з\'єднань', tooManyConnectionsHint: 'закрий вкладку',
  boardNotAnswering: 'Дошка відкрита, але не відповідає.', boardNotAnsweringHint: 'Ctrl+Shift+R',
  noToken: 'протухла', serverRejected: 'Сервер відхилив ({code})',
  prev: 'Назад', next: 'Далі', newPage: 'Нова сторінка', undo: 'Відмінити',
  boardFrozen: 'Запис на цій дошці завершено — нічого не зберігається.', boardFrozenHint: 'Натисни «Новий запис»',
  fitTask: 'Задача на екран', fontUp: 'Більше', fontDown: 'Менше', scrollUp: 'Вгору', scrollDown: 'Вниз',
  showAnswer: 'Відповідь', hideAnswer: 'Сховати відповідь', showSolution: 'Розбір', hideSolution: 'Сховати розбір',
  noCards: 'На цій сторінці нема карток задач',
  holdToTalk: 'Говорю', listening: 'Слухаю…', voiceUnsupported: 'x',
}

// Кожен view тримає інтервал hello і слухає спільний мок каналу — незняті
// інстанси з попередніх тестів множили б hello. Прибираємо всі.
const mounted: Array<{ unmount: () => void }> = []

function mountView(props: Record<string, unknown> = {}) {
  const i18n = createI18n({
    legacy: false, locale: 'uk', fallbackLocale: 'uk',
    messages: { uk: { winterboard: { remote: MSG } } },
  })
  const w = mount(WBRemoteView, { props, global: { plugins: [i18n] } })
  mounted.push(w)
  return w
}

function lastCmd() {
  const calls = send.mock.calls
  return calls.length ? (calls[calls.length - 1][0] as any) : null
}

describe('WBRemoteView v1.1', () => {
  beforeEach(() => {
    channelState.value = 'idle'
    send.mockClear(); connect.mockClear(); disconnect.mockClear()
    getActiveRemoteSession.mockReset()
    getActiveRemoteSession.mockResolvedValue({ session_id: SID, name: 'Алгебра 8-А', ts: 1 })
    onStateCb = null; onErrorCb = null; onFinalCb = null
    vi.useFakeTimers()
  })
  afterEach(() => {
    while (mounted.length) { try { mounted.pop()!.unmount() } catch { /* already unmounted */ } }
    vi.useRealTimers()
  })

  it('без id: питає активну дошку, підключається до неї і вітається зі СТАБІЛЬНИМ pair', async () => {
    const w = mountView()
    await flushPromises()
    expect(getActiveRemoteSession).toHaveBeenCalledTimes(1)
    expect(connect).toHaveBeenCalledWith(SID)
    const hello = send.mock.calls.find(c => (c[0] as any).cmd === 'hello')?.[0] as any
    expect(hello).toMatchObject({ type: 'remote.command', pair: PAIR, cmd: 'hello' })
    expect(w.text()).toContain('Алгебра 8-А')
    expect(w.text()).toContain('teacher@m4sh.local')
  })

  it('з id: API не питає, підключається до заданої дошки', async () => {
    mountView({ id: SID })
    await flushPromises()
    expect(getActiveRemoteSession).not.toHaveBeenCalled()
    expect(connect).toHaveBeenCalledWith(SID)
  })

  it('дошка не відкрита (404) → словами «не відкрита жодна дошка», без connect, є «Оновити»', async () => {
    getActiveRemoteSession.mockRejectedValueOnce({ response: { status: 404 } })
    const w = mountView()
    await flushPromises()
    expect(connect).not.toHaveBeenCalled()
    expect(w.text()).toContain(MSG.noActiveBoard)
    expect(w.text()).not.toContain(MSG.waitingBoard)
    // «Оновити» → перепитує
    await w.find('.wb-remote__refresh').trigger('click')
    await flushPromises()
    expect(getActiveRemoteSession).toHaveBeenCalledTimes(2)
    expect(connect).toHaveBeenCalledWith(SID)
  })

  it('сервер відповів forbidden (інший акаунт) → причина словами з email', async () => {
    const w = mountView()
    await flushPromises()
    onErrorCb?.('forbidden')
    await nextTick()
    expect(w.text()).toContain(MSG.wrongAccount)
    expect(w.text()).toContain('teacher@m4sh.local')
  })

  it('ws_4008 / ws_rejected → «забагато з\'єднань»', async () => {
    const w = mountView()
    await flushPromises()
    onErrorCb?.('ws_rejected')
    await nextTick()
    expect(w.text()).toContain(MSG.tooManyConnections)
  })

  it('6 hello без remote.state і без error → «дошка не відповідає» (стара збірка)', async () => {
    const w = mountView()
    await flushPromises()
    send.mockClear()
    vi.advanceTimersByTime(800 * 7)
    await nextTick()
    expect(w.text()).toContain(MSG.boardNotAnswering)
    // hello більше не шлеться в петлі
    const hellos = send.mock.calls.filter(c => (c[0] as any).cmd === 'hello').length
    expect(hellos).toBeLessThanOrEqual(5)
  })

  it('remote.state з нашим pair → «3 / 7», причина знімається; чужий pair ігнорується', async () => {
    const w = mountView()
    await flushPromises()
    onStateCb?.({ pair: '000000', clientId: 'x', pageIndex: 0, pageCount: 1 })
    await nextTick()
    expect(w.text()).toContain(MSG.waitingBoard)
    onStateCb?.({ pair: PAIR, clientId: 'laptop', pageIndex: 2, pageCount: 7 })
    await nextTick()
    expect(w.find('.wb-remote__page-cur').text()).toBe('3')
    expect(w.find('.wb-remote__page-total').text()).toBe('7')
    expect(w.find('.wb-remote__block').exists()).toBe(false)
  })

  it('«Далі» шле АБСОЛЮТНИЙ page.goto(index+1); на останній — вимкнена', async () => {
    const w = mountView()
    await flushPromises()
    onStateCb?.({ pair: PAIR, clientId: 'l', pageIndex: 2, pageCount: 7 })
    await nextTick()
    send.mockClear()
    await w.findAll('.wb-remote__btn')[1].trigger('click')
    expect(lastCmd()).toMatchObject({ cmd: 'page.goto', args: { index: 3 }, pair: PAIR })

    onStateCb?.({ pair: PAIR, clientId: 'l', pageIndex: 6, pageCount: 7 })
    await nextTick()
    expect((w.findAll('.wb-remote__btn')[1].element as HTMLButtonElement).disabled).toBe(true)
  })

  it('голос: «далі» → page.goto; питання → phrase', async () => {
    mountView()
    await flushPromises()
    onStateCb?.({ pair: PAIR, clientId: 'l', pageIndex: 1, pageCount: 5 })
    await nextTick()
    send.mockClear()
    onFinalCb?.('далі')
    expect(lastCmd()).toMatchObject({ cmd: 'page.goto', args: { index: 2 } })
    onFinalCb?.('додай завдання по числовій нерівності')
    expect(lastCmd()).toMatchObject({ cmd: 'phrase', args: { text: 'додай завдання по числовій нерівності' } })
  })

  it('v1.2: кнопки вигляду/карток вимкнені без стану; зі станом шлють view.fit / view.zoom / view.scroll / card.reveal', async () => {
    const w = mountView()
    await flushPromises()
    const minis = () => w.findAll('.wb-remote__mini')
    expect(minis().every(b => (b.element as HTMLButtonElement).disabled)).toBe(true)

    onStateCb?.({ pair: PAIR, clientId: 'l', pageIndex: 0, pageCount: 3, zoom: 1, cards: { count: 1, answer: false, solution: true } })
    await nextTick()
    send.mockClear()
    await minis()[0].trigger('click')   // Задача на екран
    expect(lastCmd()).toMatchObject({ cmd: 'view.fit' })
    await minis()[1].trigger('click')   // A−
    expect(lastCmd()).toMatchObject({ cmd: 'view.zoom', args: { delta: -1 } })
    await minis()[2].trigger('click')   // A+
    expect(lastCmd()).toMatchObject({ cmd: 'view.zoom', args: { delta: 1 } })
    await minis()[3].trigger('click')   // ▲
    expect(lastCmd()).toMatchObject({ cmd: 'view.scroll', args: { dir: -1 } })
    await minis()[4].trigger('click')   // ▼
    expect(lastCmd()).toMatchObject({ cmd: 'view.scroll', args: { dir: 1 } })
    await minis()[5].trigger('click')   // Відповідь
    expect(lastCmd()).toMatchObject({ cmd: 'card.reveal', args: { what: 'answer' } })
    expect(minis()[5].text()).toBe(MSG.showAnswer)
    expect(minis()[6].text()).toBe(MSG.hideSolution)   // solution=true → «Сховати розбір»
  })

  it('v1.2: без карток на сторінці — «Задача на екран» і «Відповідь/Розбір» вимкнені, підказка показана', async () => {
    const w = mountView()
    await flushPromises()
    onStateCb?.({ pair: PAIR, clientId: 'l', pageIndex: 0, pageCount: 3, cards: { count: 0, answer: null, solution: null } })
    await nextTick()
    const minis = w.findAll('.wb-remote__mini')
    expect((minis[0].element as HTMLButtonElement).disabled).toBe(true)
    expect((minis[1].element as HTMLButtonElement).disabled).toBe(false)   // A− працює і без карток
    expect((minis[5].element as HTMLButtonElement).disabled).toBe(true)
    expect(w.text()).toContain(MSG.noCards)
  })

  it('v1.2: голос «покажи відповідь» → card.reveal; «вниз» → view.scroll', async () => {
    mountView()
    await flushPromises()
    onStateCb?.({ pair: PAIR, clientId: 'l', pageIndex: 0, pageCount: 3, cards: { count: 1, answer: false, solution: false } })
    await nextTick()
    send.mockClear()
    onFinalCb?.('покажи відповідь')
    expect(lastCmd()).toMatchObject({ cmd: 'card.reveal', args: { what: 'answer' } })
    onFinalCb?.('вниз')
    expect(lastCmd()).toMatchObject({ cmd: 'view.scroll', args: { dir: 1 } })
  })

  it('заморожена дошка (frozen у state) → причина словами, лічильник і кнопки лишаються', async () => {
    const w = mountView()
    await flushPromises()
    onStateCb?.({ pair: PAIR, clientId: 'l', pageIndex: 1, pageCount: 4, frozen: true, cards: { count: 0, answer: null, solution: null } })
    await nextTick()
    expect(w.text()).toContain(MSG.boardFrozen)
    expect(w.find('.wb-remote__page-cur').text()).toBe('2')
    expect((w.findAll('.wb-remote__btn')[1].element as HTMLButtonElement).disabled).toBe(false)
    // «Новий запис» на ноутбуці → стан без frozen → причина зникає
    onStateCb?.({ pair: PAIR, clientId: 'l', pageIndex: 1, pageCount: 4, frozen: false })
    await nextTick()
    expect(w.text()).not.toContain(MSG.boardFrozen)
  })

  it('«Відключити» лишає сторінку на місці й показує «Підключити»; «Підключити» знову шукає дошку', async () => {
    const w = mountView()
    await flushPromises()
    onStateCb?.({ pair: PAIR, clientId: 'l', pageIndex: 0, pageCount: 3 })
    await nextTick()
    await w.find('.wb-remote__exit').trigger('click')
    expect(disconnect).toHaveBeenCalledTimes(1)
    await nextTick()
    expect(w.find('.wb-remote__exit--primary').exists()).toBe(true)
    expect(w.find('.wb-remote__grid').exists()).toBe(true)   // нікуди не кинуло
    await w.find('.wb-remote__exit--primary').trigger('click')
    await flushPromises()
    expect(getActiveRemoteSession).toHaveBeenCalledTimes(2)
    expect(connect).toHaveBeenCalledTimes(2)
  })
})

// Мультимедійна дошка в класі часто під ШКІЛЬНИМ акаунтом, а телефон — під
// особистим; активна дошка шукається по акаунту, тож пульт каже «дошок нема».
// Власник на уроці 2026-09-04: «треба мати можливість пультові швидко
// змінювати акаунт».
describe('WBRemoteView — швидка зміна акаунта', () => {
  it('кнопка чистить сесію і веде на ВХІД, а не на лендінг', async () => {
    const href = vi.fn()
    const original = window.location
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { get href() { return '' }, set href(v: string) { href(v) } },
    })
    try {
      getActiveRemoteSession.mockResolvedValue({ session_id: 'b1', name: 'Урок' })
      const w = mount(WBRemoteView, { global: { mocks: { $t: (k: string) => k } } })
      await flushPromises()

      const btn = w.findAll('button').find((b) => b.text() === 'Змінити акаунт')
      expect(btn, 'кнопки «Змінити акаунт» немає').toBeTruthy()
      await btn!.trigger('click')
      await flushPromises()

      expect(apiLogout).toHaveBeenCalled()          // сесія на сервері закрита
      expect(forceLogout).toHaveBeenCalled()        // токен не лишився в пам'яті
      // саме /auth/login, бо authStore.logout() веде на /start — зайвий екран
      // з телефона (та сама причина, що meta.loginDirect у маршруті пульта)
      expect(href).toHaveBeenCalledWith('/auth/login?redirect=%2Fremote')
      w.unmount()
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: original })
    }
  })
})
