/**
 * LAW §9 v1.63 (маніфест пульта П8) — ноутбук пішов з дошки → пульт повертається до списку запуску.
 *
 *   INV-LEFT-1  канал передає пульту `presence.leave` (хто пішов)
 *   INV-LEFT-2  пішов НАШ ноутбук → через 1,5 с один hello; за 10 с ні стану, ні join →
 *               пульт відключається і шукає дошку знову (немає — «не відкрита» + список)
 *   INV-LEFT-3  стан чи join за ці 10 с (інша вкладка, F5) — пульт лишається на дошці;
 *               пішов учень — нічого не робимо
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '../../../i18n/locales/uk.json'
import { derivePair } from '../remote/remotePair'

const SID = '4ba7fff3-9452-4c42-9ff9-04415ff25d90'
const PAIR = derivePair(SID)
const MY_ID = 584
const channelState = ref<'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'unavailable'>('idle')
const send = vi.fn((_data: Record<string, unknown>) => true)
const channelDisconnect = vi.fn(() => { channelState.value = 'disconnected' })
let channelOpts: any = null
let realChannel = false

vi.mock('../composables/usePresence', () => ({
  getWsBaseUrl: () => 'wss://api.example.test',
  isPresenceAvailable: () => true,
  _getFreshTokenAsync: async () => 'tok',
}))
vi.mock('../composables/useRemoteChannel', async (importOriginal) => {
  const actual = await importOriginal<any>()
  return {
    ...actual,
    useRemoteChannel: (opts: any) => {
      if (realChannel) return actual.useRemoteChannel(opts)
      channelOpts = opts
      return {
        state: channelState, lastError: ref(null), sessionId: ref(null),
        connect: vi.fn(async () => { channelState.value = 'connected' }), disconnect: channelDisconnect, retry: vi.fn(), send,
      }
    },
  }
})
vi.mock('../composables/usePushToTalk', () => ({
  usePushToTalk: () => ({ supported: true, listening: ref(false), press: vi.fn(), release: vi.fn() }),
}))
vi.mock('@/modules/auth/store/authStore', () => ({ useAuthStore: () => ({ user: { id: MY_ID, email: 't@m4sh.local' }, forceLogout: vi.fn() }) }))
vi.mock('@/modules/auth/api/authApi', () => ({ default: { logout: vi.fn() } }))
vi.mock('@/utils/telemetryAgent', () => ({ trackEvent: vi.fn() }))
vi.mock('@/modules/intent/corridors/corridorApi', () => ({ fetchCorridorRegistry: vi.fn(async () => null) }))
const getActiveRemoteSession = vi.fn()
const getRemoteLaunch = vi.fn(async () => ({ screen: { page: 'sidebar.item.schedule' }, boards: [] }))
vi.mock('../api/winterboardApi', () => ({
  winterboardApi: {
    getActiveRemoteSession: (...a: any[]) => getActiveRemoteSession(...a),
    getRemoteLaunch: (...a: any[]) => getRemoteLaunch(...a),
    remoteLaunch: vi.fn(), searchVideos: vi.fn(), lookupVideo: vi.fn(),
  },
}))

import { useRemoteChannel } from '../composables/useRemoteChannel'
import WBRemoteView from '../views/WBRemoteView.vue'

const i18n = () => createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })
const hellos = () => send.mock.calls.map((c) => c[0] as any).filter((m) => m.type === 'remote.command' && m.cmd === 'hello')
const notFound = () => Object.assign(new Error('404'), { response: { status: 404 } })

describe('INV-LEFT-1 · канал передає пульту presence.leave', () => {
  class FakeWS {
    static last: FakeWS | null = null
    readyState = 1
    onopen: (() => void) | null = null
    onclose: ((e: { code: number }) => void) | null = null
    onerror: (() => void) | null = null
    onmessage: ((e: { data: string }) => void) | null = null
    constructor() { FakeWS.last = this }
    close() { /* noop */ }
    send() { /* noop */ }
  }
  beforeEach(() => { realChannel = true; vi.stubGlobal('WebSocket', FakeWS as unknown as typeof WebSocket) })
  afterEach(() => { realChannel = false; vi.unstubAllGlobals() })

  it('presence.leave → onBoardLeave(userId рядком); join — окремо', async () => {
    const leaves: string[] = []
    const joins: string[] = []
    const ch = useRemoteChannel({ onState: () => {}, onBoardJoin: (u) => joins.push(u), onBoardLeave: (u) => leaves.push(u) })
    await ch.connect(SID)
    const ws = FakeWS.last!
    ws.onopen!()
    const msg = (m: Record<string, unknown>) => ws.onmessage!({ data: JSON.stringify(m) })
    msg({ type: 'presence.leave', userId: 584 })
    msg({ type: 'presence.join', userId: '584' })
    expect(leaves).toEqual(['584'])
    expect(joins).toEqual(['584'])
  })
})

describe('INV-LEFT-2/3 · пульт після виходу ноутбука з дошки', () => {
  const mounted: Array<{ unmount: () => void }> = []
  async function connected() {
    const w = mount(WBRemoteView, { global: { plugins: [i18n()], stubs: { RouterLink: true } } })
    mounted.push(w)
    await flushPromises()
    channelOpts.onState({ pair: PAIR, clientId: 'l', pageIndex: 1, pageCount: 5 })
    await nextTick()
    send.mockClear()
    getActiveRemoteSession.mockClear()
    return w
  }
  beforeEach(() => {
    vi.useFakeTimers()
    channelState.value = 'idle'
    send.mockClear(); channelDisconnect.mockClear()
    channelOpts = null
    getActiveRemoteSession.mockReset()
    getActiveRemoteSession.mockResolvedValueOnce({ session_id: SID, name: 'Урок', ts: 1 }).mockRejectedValue(notFound())
    try { localStorage.setItem('wb.remote.firstTipSeen', '1') } catch { /* noop */ }
  })
  afterEach(() => { while (mounted.length) mounted.pop()!.unmount(); vi.useRealTimers() })

  it('наш ноутбук пішов і не повернувся → hello, за 10 с — «не відкрита» і список уроків', async () => {
    const w = await connected()
    channelOpts.onBoardLeave(String(MY_ID))
    await vi.advanceTimersByTimeAsync(1_500)
    expect(hellos()).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(8_400)
    expect(channelDisconnect).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(100)
    await flushPromises()
    expect(channelDisconnect).toHaveBeenCalledTimes(1)
    expect(getActiveRemoteSession).toHaveBeenCalledTimes(1)
    expect(w.text()).toContain('На ноутбуці не відкрита жодна дошка')
    expect(w.find('[data-testid=remote-launch]').exists()).toBe(true)
  })

  it('інша вкладка відповіла станом або ноутбук повернувся (F5) — лишаємось на дошці', async () => {
    await connected()
    channelOpts.onBoardLeave(String(MY_ID))
    await vi.advanceTimersByTimeAsync(2_000)
    channelOpts.onState({ pair: PAIR, clientId: 'l2', pageIndex: 1, pageCount: 5 })
    await vi.advanceTimersByTimeAsync(10_000)
    expect(channelDisconnect).not.toHaveBeenCalled()

    channelOpts.onBoardLeave(String(MY_ID))
    await vi.advanceTimersByTimeAsync(4_000)
    channelOpts.onBoardJoin(String(MY_ID))
    await vi.advanceTimersByTimeAsync(10_000)
    expect(channelDisconnect).not.toHaveBeenCalled()
    expect(getActiveRemoteSession).not.toHaveBeenCalled()
  })

  it('пішов учень — пульт нічого не робить', async () => {
    await connected()
    channelOpts.onBoardLeave('586')
    await vi.advanceTimersByTimeAsync(12_000)
    expect(hellos()).toHaveLength(0)
    expect(channelDisconnect).not.toHaveBeenCalled()
  })
})
