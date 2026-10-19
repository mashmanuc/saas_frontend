/**
 * Пульт: «✍️ Розв'язок рукою» поряд із «✍️ Наступний рядок» (власник 2026-10-18: «бери ✍ з пульта… роби
 * разом з покроковим»). Ряд з'являється, коли ноутбук каже, що є що писати (`handwrite_step.target`), — тож
 * і на сторінці з самою вирізкою з PDF, без карток задач. Старий ноутбук (без стану) — кнопка, як і була,
 * у ряді карток; дубля немає.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '../../../i18n/locales/uk.json'
import { derivePair } from '../remote/remotePair'

const SID = '4ba7fff3-9452-4c42-9ff9-04415ff25d90'
const PAIR = derivePair(SID)

vi.mock('../composables/usePresence', () => ({ usePresence: () => ({}) }))

const channelState = ref<'idle' | 'connected'>('idle')
const send = vi.fn((_data: Record<string, unknown>) => true)
let onStateCb: ((s: any) => void) | null = null

vi.mock('../composables/useRemoteChannel', async (importOriginal) => {
  const actual = await importOriginal<any>()
  return {
    ...actual,
    useRemoteChannel: (opts: any) => {
      onStateCb = opts.onState
      return {
        state: channelState, lastError: ref(null), sessionId: ref(null),
        connect: vi.fn(async () => { channelState.value = 'connected' }), disconnect: vi.fn(), retry: vi.fn(), send,
      }
    },
  }
})
vi.mock('../composables/usePushToTalk', () => ({
  usePushToTalk: () => ({ supported: true, listening: ref(false), press: vi.fn(), release: vi.fn() }),
}))
vi.mock('@/modules/auth/store/authStore', () => ({
  useAuthStore: () => ({ user: { id: 7, email: 'teacher@m4sh.local' }, forceLogout: vi.fn() }),
}))
vi.mock('@/modules/auth/api/authApi', () => ({ default: { logout: vi.fn() } }))
vi.mock('@/utils/telemetryAgent', () => ({ trackEvent: vi.fn() }))
vi.mock('@/modules/intent/corridors/corridorApi', () => ({ fetchCorridorRegistry: vi.fn(async () => null) }))
vi.mock('../api/winterboardApi', () => ({
  winterboardApi: {
    getActiveRemoteSession: vi.fn(async () => ({ session_id: SID, name: 'Урок', ts: 1 })),
    searchVideos: vi.fn(), lookupVideo: vi.fn(),
  },
}))

import WBRemoteView from '../views/WBRemoteView.vue'

async function mountWith(state: Record<string, unknown>) {
  const i18n = createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })
  const w = mount(WBRemoteView, { global: { plugins: [i18n], stubs: { RouterLink: true, RemoteBoardMirror: true } } })
  await flushPromises()
  onStateCb!({ pair: PAIR, clientId: 'l', pageIndex: 0, pageCount: 1, ...state })
  await nextTick()
  return w
}

const CARDS = { count: 1, answer: false, solution: false }

describe("пульт: «✍️ Розв\'язок рукою» поряд із «Наступним рядком»", () => {
  beforeEach(() => {
    channelState.value = 'idle'
    send.mockClear()
    onStateCb = null
    try { localStorage.setItem('wb.remote.firstTipSeen', '1') } catch { /* noop */ }
  })

  it('сторінка з самою вирізкою (карток задач немає) — кнопка є і шле card.handwrite', async () => {
    const w = await mountWith({ handwriteStep: { status: 'idle', written: 0, total: 0, target: true } })
    const btns = w.findAll('[data-testid="remote-handwrite"]')
    expect(btns).toHaveLength(1)
    expect(w.find('[data-testid="remote-handwrite-next"]').exists()).toBe(true)
    send.mockClear()
    await btns[0].trigger('click')
    expect(send.mock.calls.map((c) => c[0])).toContainEqual(expect.objectContaining({ type: 'remote.command', cmd: 'card.handwrite' }))
  })

  it('з картками — одна кнопка, без дубля в ряді карток', async () => {
    const w = await mountWith({ cards: CARDS, handwriteStep: { status: 'idle', written: 0, total: 0, target: true } })
    expect(w.findAll('[data-testid="remote-handwrite"]')).toHaveLength(1)
  })

  it('старий ноутбук (без стану покрокового) — кнопка в ряді карток, як до 18.10', async () => {
    const w = await mountWith({ cards: CARDS })
    expect(w.findAll('[data-testid="remote-handwrite"]')).toHaveLength(1)
    expect(w.find('[data-testid="remote-handwrite-next"]').exists()).toBe(false)
  })

  it("увесь розв\'язок пишеться — «Пишу розв\'язок…», обидві кнопки зайняті; відмова — причина словами", async () => {
    const w = await mountWith({ handwriteStep: { status: 'writing', written: 0, total: 0, target: true } })
    expect(w.get('[data-testid="remote-handwrite-step"]').text()).toBe(uk.winterboard.remote.step.writingAll)
    expect(w.get('[data-testid="remote-handwrite"]').attributes('disabled')).toBeDefined()
    expect(w.get('[data-testid="remote-handwrite-next"]').attributes('disabled')).toBeDefined()
    onStateCb!({ pair: PAIR, clientId: 'l', pageIndex: 0, pageCount: 1,
      handwriteStep: { status: 'refused', written: 0, total: 0, reason: 'no_solution', target: false } })
    await nextTick()
    expect(w.get('[data-testid="remote-handwrite-step"]').text()).toBe(uk.winterboard.remote.step.reason.no_solution)
  })
})


// ── LAW §9 v1.34: поточний об'єкт (маніфест пульта П2; урок власника 19.10) ──
describe("пульт v1.34: поточний об'єкт — перемикач і адреса в кожній кнопці", () => {
  beforeEach(() => {
    channelState.value = 'idle'
    send.mockClear()
    onStateCb = null
    try { localStorage.setItem('wb.remote.firstTipSeen', '1') } catch { /* noop */ }
  })
  const TWO = [
    { id: 't1', kind: 'task', n: 1, hw: true, answer: false, solution: false, presenting: false },
    { id: 't2', kind: 'task', n: 2, hw: true, answer: false, solution: false, presenting: false },
  ]
  const cmds = () => send.mock.calls.map((c) => c[0]).filter((m: any) => m.type === 'remote.command')

  it('«Задача 2 з 2»: A+ і ✍ шлють адресу саме другої (урок 19.10)', async () => {
    const w = await mountWith({ cards: CARDS, objects: TWO, currentId: 't2' })
    expect(w.get('[data-testid="object-label"]').text()).toBe('Задача 2 з 2')
    send.mockClear()
    await w.get('[data-testid="object-zoom-up"]').trigger('click')
    await w.get('[data-testid="remote-handwrite"]').trigger('click')
    expect(cmds()).toEqual([
      expect.objectContaining({ cmd: 'view.zoom', args: { delta: 1, object_id: 't2' } }),
      expect.objectContaining({ cmd: 'card.handwrite', args: { object_id: 't2' } }),
    ])
    // старого блоку (без адрес) немає — дубля кнопок теж
    expect(w.findAll('[data-testid="remote-handwrite"]')).toHaveLength(1)
  })

  it('◀ перемикає й одразу шле object.select; наступний натиск — уже з новою адресою, хоч стан ще не прийшов', async () => {
    const w = await mountWith({ objects: TWO, currentId: 't2' })
    send.mockClear()
    await w.get('[data-testid="object-prev"]').trigger('click')
    expect(w.get('[data-testid="object-label"]').text()).toBe('Задача 1 з 2')
    await w.get('[data-testid="object-fit"]').trigger('click')
    expect(cmds()).toEqual([
      expect.objectContaining({ cmd: 'object.select', args: { object_id: 't1' } }),
      expect.objectContaining({ cmd: 'view.fit', args: { object_id: 't1' } }),
    ])
    // запізнілий стан зі старим поточним не повертає вибір назад
    onStateCb!({ pair: PAIR, clientId: 'l', pageIndex: 0, pageCount: 1, objects: TWO, currentId: 't2' })
    await nextTick()
    expect(w.get('[data-testid="object-label"]').text()).toBe('Задача 1 з 2')
  })

  it("різні види — «Вирізка 1 · 2 з 2»; у вирізки без права ✍ немає кнопок задачі; один об'єкт — без стрілок", async () => {
    const w = await mountWith({ objects: [TWO[0], { id: 'c1', kind: 'cut', n: 1, hw: false, presenting: false }], currentId: 'c1' })
    expect(w.get('[data-testid="object-label"]').text()).toBe('Вирізка 1 · 2 з 2')
    expect(w.find('[data-testid="object-zoom-up"]').exists()).toBe(false)
    expect(w.find('[data-testid="remote-handwrite"]').exists()).toBe(false)
    const one = await mountWith({ objects: [TWO[0]], currentId: 't1' })
    expect(one.find('[data-testid="object-prev"]').exists()).toBe(false)
    expect(one.get('[data-testid="object-label"]').text()).toBe('Задача 1')
  })

  it("причина від ноутбука — словами під перемикачем; об'єктів немає — немає й рядка", async () => {
    const w = await mountWith({ objects: TWO, currentId: 't1', objectNotice: 'gone' })
    expect(w.get('[data-testid="object-notice"]').text()).toBe(uk.winterboard.remote.object.notice.gone)
    const empty = await mountWith({ objects: [] })
    expect(empty.find('[data-testid="object-row"]').exists()).toBe(false)
  })
})

describe("пульт v1.35: етап 2 — відео, аудіо, документ, картка, картинка в тому самому перемикачі", () => {
  beforeEach(() => {
    channelState.value = 'idle'
    send.mockClear()
    onStateCb = null
    try { localStorage.setItem('wb.remote.firstTipSeen', '1') } catch { /* noop */ }
  })
  const cmds = () => send.mock.calls.map((c) => c[0]).filter((m: any) => m.type === 'remote.command')
  const OBJS = [
    { id: 'yt', kind: 'video', n: 1, hw: false, presenting: false },
    { id: 'pdf', kind: 'pdf', n: 1, hw: false, presenting: false },
    { id: 'mp4', kind: 'video', n: 2, hw: false, presenting: false, minimized: true },
  ]
  const SCN = {
    focusId: null,
    items: [
      { objectId: 'yt', kind: 'video', title: 'Досліди з маятником', pageIndex: 0, minimized: false, state: 'playing', volume: 60 },
      { objectId: 'pdf', kind: 'pdf', title: 'Умова', pageIndex: 0, minimized: false, docPage: 2, docPages: 12 },
      { objectId: 'mp4', kind: 'video', title: '', pageIndex: 0, minimized: true, state: 'paused' },
      { objectId: 'snd', kind: 'audio', title: 'Пісня', pageIndex: 1, minimized: false },
    ],
  }
  const VIDEOS = [{ objectId: 'yt', title: 'Досліди з маятником', state: 'playing' }]
  const NEW = { caps: ['scenario', 'objects'], scenario: SCN, objects: OBJS, videos: VIDEOS }

  it("відео — поточний об'єкт: назва, стан і кнопки «Сценарію» на головному екрані, з адресою; «випадайки» немає", async () => {
    const w = await mountWith({ ...NEW, currentId: 'yt' })
    expect(w.get('[data-testid="object-label"]').text()).toBe('Відео 1 · 1 з 3')
    expect(w.get('[data-testid="object-title"]').text()).toBe('Досліди з маятником')
    expect(w.get('[data-testid="object-status"]').text()).toContain('60')
    expect(w.find('.wb-remote__video-ctl').exists()).toBe(false)
    send.mockClear()
    await w.get('[data-testid="object-pause"]').trigger('click')
    await w.get('[data-testid="object-louder"]').trigger('click')
    await w.get('[data-testid="object-focus"]').trigger('click')
    expect(cmds()).toEqual([
      expect.objectContaining({ cmd: 'video.pause', args: { object_id: 'yt' } }),
      expect.objectContaining({ cmd: 'video.volume', args: { object_id: 'yt', delta: 1 } }),
      expect.objectContaining({ cmd: 'view.focus', args: { object_id: 'yt' } }),
    ])
  })

  it('▶ перемикача → PDF: «Стор. 3 / 12», ◀ ▶ документа з його адресою', async () => {
    const w = await mountWith({ ...NEW, currentId: 'yt' })
    await w.get('[data-testid="object-next"]').trigger('click')
    expect(w.get('[data-testid="object-label"]').text()).toBe('PDF 1 · 2 з 3')
    expect(w.get('[data-testid="object-doc-label"]').text()).toBe('Стор. 3 / 12')
    send.mockClear()
    await w.get('[data-testid="object-doc-next"]').trigger('click')
    expect(cmds()).toEqual([expect.objectContaining({ cmd: 'doc.page', args: { object_id: 'pdf', dir: 1 } })])
  })

  it('згорнуте — «Згорнуто» і «↩ Повернути» тим самим пальцем (Р3)', async () => {
    const w = await mountWith({ ...NEW, currentId: 'mp4' })
    expect(w.get('[data-testid="object-status"]').text()).toBe(uk.winterboard.remote.scenario.minimized)
    expect(w.find('[data-testid="object-play"]').exists()).toBe(false)
    send.mockClear()
    await w.get('[data-testid="object-restore"]').trigger('click')
    expect(cmds()).toEqual([expect.objectContaining({ cmd: 'card.restore', args: { object_id: 'mp4' } })])
  })

  it('«Сценарій»: тап по назві з іншої сторінки — сторінка, потім вибір; поточний позначено (Р2)', async () => {
    const w = await mountWith({ ...NEW, currentId: 'yt' })
    expect(w.get('[data-testid="scenario-item-yt"]').classes()).toContain('wb-scn__item--current')
    send.mockClear()
    await w.get('[data-testid="scenario-name-snd"]').trigger('click')
    expect(cmds()).toEqual([
      expect.objectContaining({ cmd: 'page.goto', args: { index: 1 } }),
      expect.objectContaining({ cmd: 'object.select', args: { object_id: 'snd' } }),
    ])
    send.mockClear()
    await w.get('[data-testid="scenario-name-pdf"]').trigger('click')       // та сама сторінка — лише вибір
    expect(cmds()).toEqual([expect.objectContaining({ cmd: 'object.select', args: { object_id: 'pdf' } })])
    expect(w.get('[data-testid="object-label"]').text()).toBe('PDF 1 · 2 з 3')
  })

  it('ноутбук v1.34 (без caps objects) — як було: «випадайка» відео на місці, тап у «Сценарії» лише відкриває сторінку', async () => {
    const w = await mountWith({ caps: ['scenario'], scenario: SCN, videos: VIDEOS, objects: [], currentId: undefined })
    expect(w.find('.wb-remote__video-ctl').exists()).toBe(true)
    expect(w.find('[data-testid="scenario-name-pdf"]').exists()).toBe(false)   // на сторінці, що на екрані, — не кнопка
    send.mockClear()
    await w.get('[data-testid="scenario-name-snd"]').trigger('click')
    expect(cmds()).toEqual([expect.objectContaining({ cmd: 'page.goto', args: { index: 1 } })])
  })
})
