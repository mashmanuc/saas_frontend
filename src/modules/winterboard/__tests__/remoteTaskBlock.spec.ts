/**
 * Пульт і картки задач (власник, 2026-09-26, з живого уроку):
 *   1. «Задача на екран» розгортала задачу, а повернути звичайний вигляд з пульта
 *      було нічим — лише перегорнути сторінку. Тепер, поки задача на екрані, є
 *      «Уся сторінка» (`view.page`, LAW §9 v1.10).
 *   2. Без карток задач на сторінці кнопки задач зайві — блок не показується зовсім.
 *
 * Тест наскрізний, як `remoteCardsPresenting.spec.ts`: справжній адаптер ноутбука →
 * JSON «на дроті» → справжній парсер телефона → пульт.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '../../../i18n/locales/uk.json'
import { createRemoteViewAdapter, TASK_ASSET_TYPE } from '../composables/useRemoteViewAdapter'
import { parseRemoteCards } from '../composables/useRemoteChannel'
import { resetTutorGate } from '../composables/useStudentTutor'
import { resetNmtPresentationScales } from '../composables/useNmtPresentationScale'
import { derivePair } from '../remote/remotePair'

const channelState = ref<'idle' | 'connected' | 'disconnected'>('idle')
let onStateCb: ((s: any) => void) | null = null
const sendMock = vi.fn((_msg: any) => true)
vi.mock('../composables/useRemoteChannel', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../composables/useRemoteChannel')>()
  return {
    ...actual,
    useRemoteChannel: (opts: any) => {
      onStateCb = opts.onState
      return {
        state: channelState, lastError: ref(null), sessionId: ref(null),
        connect: vi.fn(async () => { channelState.value = 'connected' }),
        disconnect: vi.fn(), retry: vi.fn(), send: (msg: any) => sendMock(msg),
      }
    },
  }
})
vi.mock('../composables/usePushToTalk', () => ({
  usePushToTalk: () => ({ supported: false, listening: ref(false), press: vi.fn(), release: vi.fn() }),
}))
vi.mock('@/modules/auth/store/authStore', () => ({
  useAuthStore: () => ({ user: { email: 't@m4sh.local' }, forceLogout: vi.fn() }),
}))
vi.mock('@/modules/auth/api/authApi', () => ({ default: { logout: vi.fn() } }))
vi.mock('@/utils/telemetryAgent', () => ({ trackEvent: vi.fn() }))
const SID = '4ba7fff3-9452-4c42-9ff9-04415ff25d90'
const PAIR = derivePair(SID)
vi.mock('../api/winterboardApi', () => ({
  winterboardApi: { getActiveRemoteSession: vi.fn(async () => ({ session_id: SID, name: 'Дошка', ts: 1 })) },
}))

function taskCard(id: string, x: number, y: number) {
  return { id, type: TASK_ASSET_TYPE, x, y, w: 400, h: 200, data: { externalId: id } }
}
function makeStore(assets: any[]) {
  const store: any = {
    containerWidth: 1000, containerHeight: 600, pageWidth: 2000, pageHeight: 1500,
    zoom: 1, scrollX: 0, scrollY: 0, expandedAssetId: null, currentPageIndex: 0,
    pages: [{ assets }],
    setZoom: vi.fn((z: number) => { store.zoom = z }),
    setScroll: vi.fn((x: number, y: number) => { store.scrollX = x; store.scrollY = y }),
    updateAsset: vi.fn(),
  }
  return store
}
/** Те, що ноутбук кладе в `remote.state` (`useBoardRemote.ts`), крізь JSON і парсер телефона. */
function wire(v: ReturnType<typeof createRemoteViewAdapter>) {
  const s = v.summary()
  return parseRemoteCards(JSON.parse(JSON.stringify({ count: s.count, answer: s.answer, solution: s.solution, presenting: s.presenting })))
}

async function mountRemote() {
  const WBRemoteView = (await import('../views/WBRemoteView.vue')).default
  const i18n = createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })
  const w = mount(WBRemoteView, { global: { plugins: [i18n], stubs: { RouterLink: true } } })
  await flushPromises()
  channelState.value = 'connected'
  await nextTick()
  return w
}
async function pushState(v: ReturnType<typeof createRemoteViewAdapter>) {
  onStateCb!({ pair: PAIR, pageIndex: 0, pageCount: 1, cards: wire(v) })
  await nextTick()
}
const TASK_LABELS = ['Задача на екран', 'Наступна задача', 'Уся сторінка', 'A−', 'A+', '▲', '▼', 'Відповідь', 'Розбір']
const buttonTexts = (w: any): string[] => w.findAll('button').map((b: any) => b.text())
const byText = (w: any, text: string) => w.findAll('button').find((b: any) => b.text() === text)

beforeEach(() => {
  resetTutorGate()
  resetNmtPresentationScales()
  channelState.value = 'idle'
  onStateCb = null
  sendMock.mockClear()
})
afterEach(() => vi.clearAllMocks())

describe('пульт: блок задач лише коли на сторінці є картки задач', () => {
  it('карток задач немає — жодної кнопки задач і жодного напису про них', async () => {
    const w = await mountRemote()
    await pushState(createRemoteViewAdapter(makeStore([])))
    const texts = buttonTexts(w)
    for (const label of TASK_LABELS) expect(texts).not.toContain(label)
    expect(w.text()).not.toContain('нема карток задач')
    w.unmount()
  })

  it('картка є, задача не розгорнута — «Задача на екран» є, «Усієї сторінки» немає', async () => {
    // пульт v2 (ТЗ §2, зона D): поза показом — лише «Задача на екран»; у показі кнопка
    // МІНЯЄТЬСЯ на «Уся сторінка», а «Відповідь», «Розбір», A± і ▲▼ з'являються поруч
    const w = await mountRemote()
    const v = createRemoteViewAdapter(makeStore([taskCard('a', 100, 300)]))
    await pushState(v)
    let texts = buttonTexts(w)
    expect(texts).toContain('Задача на екран')
    for (const label of ['Уся сторінка', 'Наступна задача', 'A−', 'A+', '▲', '▼', 'Відповідь', 'Розбір']) expect(texts).not.toContain(label)
    v.fitTask()
    await pushState(v)
    texts = buttonTexts(w)
    expect(texts).not.toContain('Задача на екран')
    for (const label of ['Уся сторінка', 'A−', 'A+', '▲', '▼', 'Відповідь', 'Розбір']) expect(texts).toContain(label)
    expect(texts).not.toContain('Наступна задача')   // одна картка — гортати нема чого
    w.unmount()
  })
})

describe('пульт: з «Задача на екран» є вороття (v1.10)', () => {
  it('задача на екрані → «Уся сторінка» шле view.page; ноутбук повертає звичайний вигляд, кнопка зникає', async () => {
    const w = await mountRemote()
    const store = makeStore([taskCard('a', 100, 300)])
    const v = createRemoteViewAdapter(store)
    v.fitTask()
    await pushState(v)
    const pageBtn = byText(w, 'Уся сторінка')
    expect(pageBtn).toBeTruthy()
    expect(pageBtn.attributes('disabled')).toBeUndefined()

    await pageBtn.trigger('click')
    const sent = sendMock.mock.calls.map((c) => c[0]).filter((m) => m.type === 'remote.command')
    expect(sent[sent.length - 1]).toMatchObject({ cmd: 'view.page', args: {}, pair: PAIR })

    // ноутбук виконав view.page (useBoardRemote → resetFocus) і прислав новий стан
    v.resetFocus()
    expect(store.expandedAssetId).toBeNull()
    await pushState(v)
    expect(byText(w, 'Уся сторінка')).toBeUndefined()
    expect(byText(w, 'Задача на екран')).toBeTruthy()
    w.unmount()
  })

  it('кілька карток і задача на екрані — перша кнопка каже, що далі буде наступна задача', async () => {
    const w = await mountRemote()
    const v = createRemoteViewAdapter(makeStore([taskCard('a', 100, 300), taskCard('b', 100, 900)]))
    v.fitTask()
    await pushState(v)
    expect(byText(w, 'Наступна задача')).toBeTruthy()
    expect(byText(w, 'Уся сторінка')).toBeTruthy()
    w.unmount()
  })
})
