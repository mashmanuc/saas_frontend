/**
 * LAW §9 v1.23 (2026-10-06) — «❓ Показати відповідь» на пульті для питань до обговорення.
 * Власник: «так, показувати відповідь після обговорення»; на пульті — та сама дія,
 * що кнопка під питанням на дошці.
 *
 * Наскрізно, як remoteCardsPresenting.spec.ts (там дефект ховався між ланками):
 *   адаптер ноутбука → questionsSummary() → JSON (як на дроті) → parseRemoteQuestions()
 *   → WBRemoteView (кнопка) → card.reveal {what:'question'} → revealQuestions() → showAnswer.
 * Плюс межі: задачі й питання не чіпають одне одного; без питань поля немає.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '../../../i18n/locales/uk.json'
import en from '../../../i18n/locales/en.json'
import ru from '../../../i18n/locales/ru.json'
import { createRemoteViewAdapter, QUESTION_ASSET_TYPE, TASK_ASSET_TYPE } from '../composables/useRemoteViewAdapter'
import { parseRemoteQuestions } from '../composables/useRemoteChannel'
import { resetTutorGate } from '../composables/useStudentTutor'
import { derivePair } from '../remote/remotePair'

const channelState = ref<'idle' | 'connected' | 'disconnected'>('idle')
let onStateCb: ((s: any) => void) | null = null
const sent: any[] = []
vi.mock('../composables/useRemoteChannel', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../composables/useRemoteChannel')>()
  return {
    ...actual,
    useRemoteChannel: (opts: any) => {
      onStateCb = opts.onState
      return {
        state: channelState, lastError: ref(null), sessionId: ref(null),
        connect: vi.fn(async () => { channelState.value = 'connected' }),
        disconnect: vi.fn(), retry: vi.fn(), send: vi.fn((m: any) => { sent.push(m); return true }),
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

function question(id: string, showAnswer = false, answer = 'Відповідь') {
  return { id, type: QUESTION_ASSET_TYPE, x: 80, y: 860, w: 1760, h: 90, data: { version: 1, question: 'Питання?', answer, showAnswer } }
}
// Поле answer у задачі — навмисно: питання від задачі відрізняє ТИП, а не наявність тексту відповіді.
function taskCard(id: string, showAnswer = false) {
  return { id, type: TASK_ASSET_TYPE, x: 100, y: 300, w: 400, h: 200, data: { externalId: id, showAnswer, answer: 'Відповідь задачі' } }
}
function makeStore(assets: any[]) {
  const store: any = {
    containerWidth: 1000, containerHeight: 600, pageWidth: 1920, pageHeight: 1080,
    zoom: 1, scrollX: 0, scrollY: 0, expandedAssetId: null, currentPageIndex: 0,
    pages: [{ assets }],
    setZoom: vi.fn(), setScroll: vi.fn(),
    // як справжнє сховище: оновлення замінює об'єкт на сторінці
    updateAsset: vi.fn((asset: any) => {
      const list = store.pages[0].assets
      list.splice(list.findIndex((a: any) => a.id === asset.id), 1, asset)
    }),
  }
  return store
}
const wire = (x: unknown) => JSON.parse(JSON.stringify(x))

beforeEach(() => {
  resetTutorGate()
  channelState.value = 'idle'
  onStateCb = null
  sent.length = 0
})
afterEach(() => vi.clearAllMocks())

describe('ноутбук: питання сторінки', () => {
  it('без питань поля немає (старий стан пульта не міняється)', () => {
    expect(createRemoteViewAdapter(makeStore([taskCard('t')])).questionsSummary()).toBeNull()
  })

  it('питання без відповіді не рахуються — відкривати нічого', () => {
    expect(createRemoteViewAdapter(makeStore([question('q', false, '  ')])).questionsSummary()).toBeNull()
  })

  it('одна команда — один стан: є закрите → відкриває всі; усі відкриті → закриває всі', () => {
    const store = makeStore([question('a', true), question('b', false)])
    const v = createRemoteViewAdapter(store)
    expect(v.questionsSummary()).toEqual({ count: 2, answer: false })
    expect(v.revealQuestions()).toBe(1)
    expect(v.questionsSummary()).toEqual({ count: 2, answer: true })
    expect(v.revealQuestions()).toBe(2)
    expect(v.questionsSummary()).toEqual({ count: 2, answer: false })
  })

  it('задачі й питання не чіпають одне одного', () => {
    const store = makeStore([question('q'), taskCard('t')])
    const v = createRemoteViewAdapter(store)
    v.revealQuestions()
    expect(store.pages[0].assets.find((a: any) => a.id === 't').data.showAnswer).toBe(false)
    v.reveal('answer')
    expect(store.pages[0].assets.find((a: any) => a.id === 'q').data.showAnswer).toBe(true)
    expect(store.pages[0].assets.find((a: any) => a.id === 't').data.showAnswer).toBe(true)
    expect(v.summary().count).toBe(1) // «Задача на екран» рахує лише задачі
  })
})

describe('телефон: розбір поля', () => {
  it('доходить крізь JSON', () => {
    const v = createRemoteViewAdapter(makeStore([question('q', true)]))
    expect(parseRemoteQuestions(wire(v.questionsSummary()))).toEqual({ count: 1, answer: true })
  })

  it('зіпсоване чи порожнє не вмикає кнопку', () => {
    for (const bad of [null, undefined, 'x', [], {}, { count: 0, answer: true }, { count: -1 }, { count: 1.5 }, { count: '2' }]) {
      expect(parseRemoteQuestions(bad)).toBeUndefined()
    }
    expect(parseRemoteQuestions({ count: 2, answer: 'yes' })).toEqual({ count: 2, answer: null })
  })
})

describe('пульт: кнопка «❓ Показати відповідь»', () => {
  async function mountRemote() {
    const WBRemoteView = (await import('../views/WBRemoteView.vue')).default
    const i18n = createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })
    const w = mount(WBRemoteView, { global: { plugins: [i18n], stubs: { RouterLink: true } } })
    await flushPromises()
    channelState.value = 'connected'
    await nextTick()
    return w
  }

  it('увесь ланцюг: стан → кнопка → команда → відповідь відкрита', async () => {
    const w = await mountRemote()
    const store = makeStore([question('q')])
    const v = createRemoteViewAdapter(store)
    onStateCb!({ pair: PAIR, pageIndex: 0, pageCount: 1, questions: parseRemoteQuestions(wire(v.questionsSummary())) })
    await nextTick()
    const btn = w.find('[data-testid="questions-reveal"]')
    expect(btn.exists()).toBe(true)
    expect(btn.text()).toBe(uk.winterboard.remote.showQuestionAnswer)

    await btn.trigger('click')
    const cmd = sent.filter((m) => m.type === 'remote.command').pop()
    expect(cmd).toMatchObject({ cmd: 'card.reveal', args: { what: 'question' } })

    // ноутбук виконує команду тим самим шляхом, що useBoardRemote
    v.revealQuestions()
    onStateCb!({ pair: PAIR, pageIndex: 0, pageCount: 1, questions: parseRemoteQuestions(wire(v.questionsSummary())) })
    await nextTick()
    expect(store.pages[0].assets[0].data.showAnswer).toBe(true)
    expect(w.find('[data-testid="questions-reveal"]').text()).toBe(uk.winterboard.remote.hideQuestionAnswer)
    w.unmount()
  })

  it('на сторінці без питань рядка немає', async () => {
    const w = await mountRemote()
    onStateCb!({ pair: PAIR, pageIndex: 0, pageCount: 1 })
    await nextTick()
    expect(w.find('[data-testid="questions-row"]').exists()).toBe(false)
    w.unmount()
  })
})

describe('ноутбук (useBoardRemote): команда й стан', () => {
  async function setupLaptop(assets: any[]) {
    const { useBoardRemote } = await import('../composables/useBoardRemote')
    const { defineComponent, h } = await import('vue')
    const store = makeStore(assets)
    store.pageCount = 1
    store.goToPage = vi.fn()
    store.addPage = vi.fn()
    const view = createRemoteViewAdapter(store)
    const sendMessage = vi.fn()
    let api!: any
    const w = mount(defineComponent({
      setup() {
        api = useBoardRemote({ sessionId: ref<string | null>(SID), store, undo: vi.fn(), sendMessage, enabled: ref(true), view } as any)
        return () => h('div')
      },
    }))
    const command = (cmd: string, args: Record<string, unknown> = {}) =>
      window.dispatchEvent(new CustomEvent('wb:remote-command', { detail: { userId: 'u', pair: api.pairCode.value, clientId: 'phone', cmd, args } }))
    const lastState = () => sendMessage.mock.calls.map((c) => c[0]).filter((m: any) => m?.type === 'remote.state').pop()
    return { w, store, command, lastState }
  }

  it('card.reveal {what:"question"} відкриває питання сторінки й шле новий стан; задач не чіпає', async () => {
    const { w, store, command, lastState } = await setupLaptop([question('q'), taskCard('t')])
    command('hello')
    expect(lastState()).toMatchObject({ questions: { count: 1, answer: false } })
    command('card.reveal', { what: 'question' })
    expect(store.pages[0].assets.find((a: any) => a.id === 'q').data.showAnswer).toBe(true)
    expect(store.pages[0].assets.find((a: any) => a.id === 't').data.showAnswer).toBe(false)
    // стан пульта йде не частіше REMOTE_STATE_THROTTLE_MS (150 мс) — чекаємо, як телефон
    await new Promise((r) => setTimeout(r, 200))
    expect(lastState()).toMatchObject({ questions: { count: 1, answer: true } })
    w.unmount()
  })

  it('без питань на сторінці поля questions у стані немає', async () => {
    const { w, command, lastState } = await setupLaptop([taskCard('t')])
    command('hello')
    expect(lastState()).not.toHaveProperty('questions')
    w.unmount()
  })
})

describe('переклади пульта', () => {
  it.each([['uk', uk], ['en', en], ['ru', ru]] as const)('%s: обидва ключі є', (l, dict) => {
    const r = (dict as any).winterboard.remote
    expect(r.showQuestionAnswer).toMatch(/^❓ /)
    expect(r.hideQuestionAnswer).toMatch(/^❓ /)
    if (l === 'ru') expect(`${r.showQuestionAnswer}${r.hideQuestionAnswer}`).not.toMatch(/[іїєґІЇЄҐ]/)
  })
})
