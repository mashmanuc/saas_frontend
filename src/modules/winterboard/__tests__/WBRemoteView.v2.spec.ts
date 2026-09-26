// Пульт v2 (ТЗ TZ_REMOTE_LAYOUT_V2_2026-09-27, рішення власника «Р1 приймаю»):
// клавіатура лише після першого стану; правило трьох станів (caps — не показуємо,
// «не можна зараз» — вимкнена на місці й пояснює, вміст сторінки — у своїй зоні);
// аркуші знизу; «Наступна задача» при кількох картках. Канал, мікрофон, API і
// authStore підмінені так само, як у WBRemoteView.spec.ts.

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
let onStateCb: ((s: any) => void) | null = null

vi.mock('../composables/useRemoteChannel', async (importOriginal) => {
  const actual = await importOriginal<any>()
  return {
    ...actual,
    useRemoteChannel: (opts: any) => {
      onStateCb = opts.onState
      return { state: channelState, lastError: ref(null), sessionId: ref(null), connect, disconnect, retry: vi.fn(), send }
    },
  }
})

let onFinalCb: ((t: string) => void) | null = null
vi.mock('../composables/usePushToTalk', () => ({
  usePushToTalk: (opts: any) => {
    onFinalCb = opts.onFinal
    return { supported: true, listening: ref(false), press: vi.fn(), release: vi.fn() }
  },
}))
vi.mock('@/modules/auth/store/authStore', () => ({
  useAuthStore: () => ({ user: { email: 'teacher@m4sh.local' }, forceLogout: vi.fn() }),
}))
vi.mock('@/modules/auth/api/authApi', () => ({ default: { logout: vi.fn() } }))
vi.mock('@/utils/telemetryAgent', () => ({ trackEvent: vi.fn() }))
vi.mock('@/modules/intent/corridors/corridorApi', () => ({ fetchCorridorRegistry: vi.fn(async () => null) }))

const getActiveRemoteSession = vi.fn()
const searchVideos = vi.fn()
vi.mock('../api/winterboardApi', () => ({
  winterboardApi: {
    getActiveRemoteSession: (...a: any[]) => getActiveRemoteSession(...a),
    searchVideos: (...a: any[]) => searchVideos(...a),
    lookupVideo: vi.fn(),
  },
}))

import WBRemoteView from '../views/WBRemoteView.vue'

const MSG = {
  disconnect: 'Відключити', connect: 'Підключити', refresh: 'Оновити',
  connected: 'Зв\'язок є', connecting: '…', disconnected: 'нема', unavailable: 'недоступно',
  waitingBoard: 'Чекаю дошку…', board: 'Дошка', loggedInAs: 'Ти зайшов як', switchAccount: 'Змінити акаунт',
  noActiveBoard: 'На ноутбуці не відкрита жодна дошка.', noActiveBoardHint: 'Відкрий дошку',
  boardNotAnswering: 'не відповідає', boardNotAnsweringHint: 'лише в уроці',
  serverRejected: 'Сервер відхилив ({code})', noToken: 'x', wrongAccount: 'x', wrongAccountHint: 'x',
  tooManyConnections: 'x', tooManyConnectionsHint: 'x', boardFrozen: 'x', boardFrozenHint: 'x',
  prev: 'Назад', next: 'Далі', newPage: 'Нова сторінка', undo: 'Відмінити',
  fitTask: 'Задача на екран', nextTask: 'Наступна задача', fitPage: 'Уся сторінка',
  fontUp: 'Більше', fontDown: 'Менше', scrollUp: 'Вгору', scrollDown: 'Вниз',
  showAnswer: 'Відповідь', hideAnswer: 'Сховати відповідь', showSolution: 'Розбір', hideSolution: 'Сховати розбір',
  holdToTalk: 'Говорю', listening: 'Слухаю…', voiceUnsupported: 'x', exitToBoards: 'Студія',
  addPhoto: 'Фото', addVideo: 'Відео', sheetVideo: 'Відео на дошку', settings: 'Налаштування', close: 'Закрити',
  whyFirstPage: 'Це перша сторінка', whyLastPage: 'Це остання сторінка',
  remoteAddress: 'Адреса пульта', searchOff: 'Пошук вимкнено — вставте посилання.',
  photo: { title: 'Фото на дошку', take: 'Зробити фото', pick: 'З галереї' },
  video: {
    placeholder: 'Знайти відео про…', search: 'Знайти', linkPlaceholder: 'посилання', paste: 'Вставити з буфера',
    check: 'Перевірити', disabled: 'Пошук відео не налаштовано.', empty: 'Нічого', failed: 'Не вдалося',
    quota: 'вичерпано', userLimit: 'ліміт', pick: 'Яке відео', untitled: 'Без назви', play: 'Грати', pause: 'Пауза',
  },
}

const mounted: Array<{ unmount: () => void }> = []
function mountView(props: Record<string, unknown> = {}) {
  const i18n = createI18n({
    legacy: false, locale: 'uk', fallbackLocale: 'uk',
    messages: { uk: { winterboard: { remote: MSG } } },
  })
  // attachTo: isVisible() через checkVisibility бачить display:none лише в документі
  const w = mount(WBRemoteView, { props, attachTo: document.body, global: { plugins: [i18n], stubs: { RouterLink: true } } })
  mounted.push(w)
  return w
}
function lastCmd() {
  const calls = send.mock.calls
  return calls.length ? (calls[calls.length - 1][0] as any) : null
}
async function connected(extra: Record<string, unknown> = {}) {
  const w = mountView()
  await flushPromises()
  onStateCb?.({ pair: PAIR, clientId: 'l', pageIndex: 1, pageCount: 3, ...extra })
  await nextTick()
  return w
}
const btnByText = (w: any, label: string) =>
  w.findAll('button').find((b: any) => b.text() === label || b.attributes('aria-label') === label)

describe('пульт v2 · клавіатура лише з дошкою', () => {
  beforeEach(() => {
    channelState.value = 'idle'
    send.mockClear(); connect.mockClear(); disconnect.mockClear()
    getActiveRemoteSession.mockReset()
    getActiveRemoteSession.mockResolvedValue({ session_id: SID, name: 'Алгебра 8-А', ts: 1 })
    searchVideos.mockReset()
    onStateCb = null; onFinalCb = null
    try { localStorage.setItem('wb.remote.firstTipSeen', '1') } catch { /* noop */ }
  })
  afterEach(() => { while (mounted.length) mounted.pop()!.unmount() })

  it('до першого remote.state — статус, назва уроку і «Чекаю дошку…», жодної кнопки дошки', async () => {
    const w = mountView()
    await flushPromises()
    expect(w.find('.wb-remote__page-wait').text()).toBe(MSG.waitingBoard)
    expect(w.find('[data-testid="board-name"]').text()).toContain('Алгебра 8-А')
    expect(w.find('.wb-remote__grid').exists()).toBe(false)
    expect(w.find('[data-testid="add-row"]').exists()).toBe(false)
    expect(w.find('.wb-remote__talk').exists()).toBe(false)
    onStateCb?.({ pair: PAIR, clientId: 'l', pageIndex: 0, pageCount: 3 })
    await nextTick()
    expect(w.find('.wb-remote__page-wait').exists()).toBe(false)
    expect(w.find('.wb-remote__grid').exists()).toBe(true)
    expect(w.find('.wb-remote__talk').exists()).toBe(true)
  })

  it('ядро: ◀ ▶ великі, «Нова сторінка» і «Відмінити» малі, порядок як був', async () => {
    const w = await connected()
    const btns = w.findAll('.wb-remote__btn')
    expect(btns.map((b) => b.text())).toEqual(['◀' + MSG.prev, '▶' + MSG.next, '＋' + MSG.newPage, '↶' + MSG.undo])
    expect(btns[0].classes()).toContain('wb-remote__btn--big')
    expect(btns[2].classes()).toContain('wb-remote__btn--small')
  })
})

describe('пульт v2 · правило трьох станів', () => {
  beforeEach(() => {
    channelState.value = 'idle'
    send.mockClear()
    getActiveRemoteSession.mockReset()
    getActiveRemoteSession.mockResolvedValue({ session_id: SID, name: 'Алгебра 8-А', ts: 1 })
    try { localStorage.setItem('wb.remote.firstTipSeen', '1') } catch { /* noop */ }
  })
  afterEach(() => { while (mounted.length) mounted.pop()!.unmount() })

  it('вид А: ряд «+ Фото / + Відео» — лише те, що дошка оголосила в caps', async () => {
    const w = await connected({ caps: ['photo'] })
    expect(w.find('[data-testid="open-photo"]').exists()).toBe(true)
    expect(w.find('[data-testid="open-video"]').exists()).toBe(false)

    onStateCb?.({ pair: PAIR, clientId: 'l', pageIndex: 1, pageCount: 3, caps: [] })   // класна кімната
    await nextTick()
    expect(w.find('[data-testid="add-row"]').exists()).toBe(false)

    onStateCb?.({ pair: PAIR, clientId: 'l', pageIndex: 1, pageCount: 3, caps: ['photo', 'video'] })
    await nextTick()
    expect(w.find('[data-testid="open-photo"]').exists()).toBe(true)
    expect(w.find('[data-testid="open-video"]').exists()).toBe(true)
  })

  it('вид А, сумісність: старий ноутбук без caps → показуємо все, як до v2', async () => {
    const w = await connected()
    expect(w.find('[data-testid="open-photo"]').exists()).toBe(true)
    expect(w.find('[data-testid="open-video"]').exists()).toBe(true)
  })

  it('вид Б: вимкнена кнопка лишається на місці, тап по ній пояснює чому', async () => {
    const w = await connected({ pageIndex: 0, pageCount: 3 })
    const [prev, next] = w.findAll('.wb-remote__btn')
    expect((prev.element as HTMLButtonElement).disabled).toBe(true)
    expect((next.element as HTMLButtonElement).disabled).toBe(false)
    await w.find('[data-testid="slot-prev"]').trigger('click')
    expect(w.find('[data-testid="why"]').text()).toBe(MSG.whyFirstPage)
    expect(send).not.toHaveBeenCalledWith(expect.objectContaining({ cmd: 'page.goto' }))

    onStateCb?.({ pair: PAIR, clientId: 'l', pageIndex: 2, pageCount: 3 })
    await nextTick()
    await w.find('[data-testid="slot-next"]').trigger('click')
    expect(w.find('[data-testid="why"]').text()).toBe(MSG.whyLastPage)
    // позиції ті самі: ті ж чотири кнопки в тому ж порядку
    expect(w.findAll('.wb-remote__btn')).toHaveLength(4)
  })

  it('вид В: кілька карток у показі → «Наступна задача» шле view.fit; одна картка — її немає', async () => {
    const w = await connected({ cards: { count: 2, answer: false, solution: false, presenting: true } })
    expect(btnByText(w, MSG.fitTask)).toBeUndefined()
    expect(btnByText(w, MSG.fitPage)).toBeTruthy()
    send.mockClear()
    await btnByText(w, MSG.nextTask).trigger('click')
    expect(lastCmd()).toMatchObject({ cmd: 'view.fit', pair: PAIR })

    onStateCb?.({ pair: PAIR, clientId: 'l', pageIndex: 1, pageCount: 3, cards: { count: 1, answer: false, solution: false, presenting: true } })
    await nextTick()
    expect(btnByText(w, MSG.nextTask)).toBeUndefined()
    expect(btnByText(w, MSG.fitPage)).toBeTruthy()
  })

  it('вид В: без карток і відео зони контексту немає; відео на сторінці → ▶/⏸ у контексті, а не в аркуші', async () => {
    const w = await connected()
    expect(w.find('[data-testid="context"]').exists()).toBe(false)
    onStateCb?.({ pair: PAIR, clientId: 'l', pageIndex: 1, pageCount: 3, videos: [{ objectId: 'yt-1', title: 'Теорема', state: 'paused' }] })
    await nextTick()
    expect(w.find('[data-testid="context"] .wb-remote__video-ctl').exists()).toBe(true)
  })
})

describe('пульт v2 · аркуші', () => {
  beforeEach(() => {
    channelState.value = 'idle'
    send.mockClear()
    getActiveRemoteSession.mockReset()
    getActiveRemoteSession.mockResolvedValue({ session_id: SID, name: 'Алгебра 8-А', ts: 1 })
    searchVideos.mockReset()
    try { localStorage.setItem('wb.remote.firstTipSeen', '1') } catch { /* noop */ }
  })
  afterEach(() => { vi.restoreAllMocks(); while (mounted.length) mounted.pop()!.unmount() })

  it('«+ Фото» відкриває аркуш із панеллю фото; «×» закриває; клавіша «Назад» теж закриває', async () => {
    const push = vi.spyOn(window.history, 'pushState')
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {})
    const w = await connected({ caps: ['photo', 'video'] })
    const sheet = w.find('[data-testid="remote-sheet"]')
    expect(sheet.isVisible()).toBe(false)

    await w.find('[data-testid="open-photo"]').trigger('click')
    expect(sheet.isVisible()).toBe(true)
    expect(sheet.attributes('data-sheet')).toBe('photo')
    expect(w.find('[data-testid="remote-photo"]').isVisible()).toBe(true)
    expect(push).toHaveBeenCalledTimes(1)   // запис в історію заради «Назад»

    await w.find('[data-testid="sheet-close"]').trigger('click')
    expect(sheet.isVisible()).toBe(false)
    expect(back).toHaveBeenCalledTimes(1)   // свій запис знімаємо самі

    await w.find('[data-testid="open-video"]').trigger('click')
    expect(sheet.attributes('data-sheet')).toBe('video')
    window.dispatchEvent(new PopStateEvent('popstate'))
    await nextTick()
    expect(sheet.isVisible()).toBe(false)
    expect(back).toHaveBeenCalledTimes(1)   // «Назад» уже зняв запис — вдруге не йдемо
  })

  it('«Відео»: поля пошуку живуть лише в аркуші; «пошук не налаштовано» ховає поле на цю сесію, посилання лишається', async () => {
    searchVideos.mockRejectedValue({ response: { data: { error: 'video_search_disabled' } } })
    const w = await connected({ caps: ['video'] })
    expect(w.find('[data-testid="context"]').exists()).toBe(false)   // без відео на сторінці ▶/⏸ немає
    await w.find('[data-testid="open-video"]').trigger('click')
    await w.find('.wb-remote__video-search input').setValue('дроби')
    await w.find('.wb-remote__video-search').trigger('submit')
    await flushPromises()
    expect(w.find('.wb-remote__video-search').exists()).toBe(false)
    expect(w.find('[data-testid="video-search-off"]').text()).toBe(MSG.searchOff)
    expect(w.find('.wb-remote__video-link').exists()).toBe(true)
  })

  it('голос «знайди відео про …» відкриває аркуш відео й шукає', async () => {
    searchVideos.mockResolvedValue({ items: [] })
    const w = await connected({ caps: ['video'] })
    onFinalCb?.('знайди відео про теорему Піфагора')
    await flushPromises()
    expect(w.find('[data-testid="remote-sheet"]').attributes('data-sheet')).toBe('video')
    expect(searchVideos).toHaveBeenCalledTimes(1)
  })

  it('налаштування: акаунт, «Змінити акаунт», «Оновити», адреса пульта, «Відключити» останнім', async () => {
    const w = await connected()
    await w.find('[data-testid="open-settings"]').trigger('click')
    const s = w.find('[data-testid="settings-sheet"]')
    expect(s.isVisible()).toBe(true)
    expect(s.text()).toContain('teacher@m4sh.local')
    expect(s.find('.wb-remote__switch').exists()).toBe(true)
    expect(s.find('.wb-remote__address').text()).toContain('/remote')
    const buttons = s.findAll('button').map((b) => b.text())
    expect(buttons[buttons.length - 1]).toBe(MSG.disconnect)
    await s.find('[data-testid="settings-refresh"]').trigger('click')
    await flushPromises()
    expect(getActiveRemoteSession).toHaveBeenCalledTimes(2)
    expect(s.isVisible()).toBe(false)   // «Оновити» закриває аркуш
  })
})
