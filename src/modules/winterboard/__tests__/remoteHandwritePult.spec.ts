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

describe('пульт: «✍️ Розв\'язок рукою» поряд із «Наступним рядком»', () => {
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

  it('увесь розв\'язок пишеться — «Пишу розв\'язок…», обидві кнопки зайняті; відмова — причина словами', async () => {
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
