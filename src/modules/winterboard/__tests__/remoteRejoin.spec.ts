/**
 * Б-120 · LAW §9 v1.16 — пульт після F5 ноутбука отримує свіжий стан сам.
 *
 * ЧОМУ ЦЕЙ ТЕСТ ІСНУЄ
 * Ноутбук шле `remote.state` лише тому, хто вже привітався (hello): «без hello нема кому»
 * (задум з v1, 2026-09-02). Після F5 ноутбук пульт забуває, а пульт вітався лише при
 * своєму підключенні — і показував стару сторінку: на стенді ноутбук відкрився на стор. 1,
 * телефон казав «2 / 5», а «Далі» з телефона привело клас на стор. 3.
 *
 * ІНВАРІАНТИ
 *   INV-REJOIN-1  канал передає пульту `presence.join` (хто приєднався) — більше нічого
 *   INV-REJOIN-2  пульт вітається рівно ОДИН раз на приєднання дошки СВОГО акаунта;
 *                 учень у класі — не привід; без дошки — нікому вітатись. Ні повторів,
 *                 ні опитувань (§12)
 *   INV-REJOIN-3  ноутбук не губить hello, що прийшов до готовності кімнати (власник ще
 *                 не відомий): одна відповідь, щойно готова; інші команди до готовності
 *                 не виконуються й потім не «доганяються»
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, nextTick, reactive, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '../../../i18n/locales/uk.json'
import { derivePair } from '../remote/remotePair'

// ── підміни для WBRemoteView (як у WBRemoteView.v2.spec.ts); канал — справжній або підмінений ──
const SID = '4ba7fff3-9452-4c42-9ff9-04415ff25d90'
const PAIR = derivePair(SID)
const MY_ID = 584
const channelState = ref<'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'unavailable'>('idle')
const send = vi.fn((_data: Record<string, unknown>) => true)
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
        connect: vi.fn(async () => { channelState.value = 'connected' }), disconnect: vi.fn(), retry: vi.fn(), send,
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
vi.mock('../api/winterboardApi', () => ({
  winterboardApi: {
    getActiveRemoteSession: vi.fn(async () => ({ session_id: SID, name: 'Урок', ts: 1 })),
    searchVideos: vi.fn(), lookupVideo: vi.fn(),
  },
}))

import { useRemoteChannel } from '../composables/useRemoteChannel'
import { useBoardRemote } from '../composables/useBoardRemote'
import WBRemoteView from '../views/WBRemoteView.vue'

const i18n = () => createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })
const hellos = () => send.mock.calls.map((c) => c[0] as any).filter((m) => m.type === 'remote.command' && m.cmd === 'hello')

// ═════════════════════════════════════════════════════════════════════════════
describe('INV-REJOIN-1 · канал передає пульту presence.join', () => {
  class FakeWS {
    static OPEN = 1
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

  it('presence.join → onBoardJoin(userId рядком); presence.leave і решта — ні', async () => {
    const joins: string[] = []
    const ch = useRemoteChannel({ onState: () => {}, onBoardJoin: (u) => joins.push(u) })
    await ch.connect(SID)
    const ws = FakeWS.last!
    ws.onopen!()
    const msg = (m: Record<string, unknown>) => ws.onmessage!({ data: JSON.stringify(m) })
    msg({ type: 'presence.leave', userId: '584' })
    msg({ type: 'ops.applied', seq: 3 })
    msg({ type: 'presence.join', userId: 584, displayName: 'Салют' })
    msg({ type: 'presence.join', userId: '586' })
    expect(joins).toEqual(['584', '586'])
  })
})

// ═════════════════════════════════════════════════════════════════════════════
describe('INV-REJOIN-2 · пульт вітається один раз на приєднання дошки свого акаунта', () => {
  const mounted: Array<{ unmount: () => void }> = []
  async function connected() {
    const w = mount(WBRemoteView, { global: { plugins: [i18n()], stubs: { RouterLink: true } } })
    mounted.push(w)
    await flushPromises()
    channelOpts.onState({ pair: PAIR, clientId: 'l', pageIndex: 1, pageCount: 5 })
    await nextTick()
    return w
  }
  beforeEach(() => {
    channelState.value = 'idle'
    send.mockClear()
    channelOpts = null
    try { localStorage.setItem('wb.remote.firstTipSeen', '1') } catch { /* noop */ }
  })
  afterEach(() => { while (mounted.length) mounted.pop()!.unmount() })

  it('ноутбук нашого акаунта знову в кімнаті (F5) → рівно один hello з pair', async () => {
    await connected()
    send.mockClear()
    channelOpts.onBoardJoin(String(MY_ID))
    expect(hellos()).toHaveLength(1)
    expect(hellos()[0]).toMatchObject({ type: 'remote.command', pair: PAIR, cmd: 'hello' })
    // ще одне приєднання — ще один hello, не більше (подія → одна відповідь)
    channelOpts.onBoardJoin(String(MY_ID))
    expect(hellos()).toHaveLength(2)
  })

  it('приєднався учень (інший акаунт) — не вітаємось', async () => {
    await connected()
    send.mockClear()
    channelOpts.onBoardJoin('586')
    expect(hellos()).toHaveLength(0)
  })

  it('без повторів: після hello пульт сам нічого не шле, скільки б часу не минуло', async () => {
    vi.useFakeTimers()
    try {
      await connected()
      send.mockClear()
      channelOpts.onBoardJoin(String(MY_ID))
      vi.advanceTimersByTime(60_000)
      expect(hellos()).toHaveLength(1)
    } finally {
      vi.useRealTimers()
    }
  })
})

// ═════════════════════════════════════════════════════════════════════════════
describe('INV-REJOIN-3 · ноутбук не губить hello, що прийшов до готовності кімнати', () => {
  const mounted: Array<{ unmount: () => void }> = []
  function setup(enabled: boolean) {
    const store = reactive({
      currentPageIndex: 0, pageCount: 5,
      goToPage: vi.fn((i: number) => { store.currentPageIndex = i }),
      addPage: vi.fn(),
    })
    const sendMessage = vi.fn()
    const enabledRef = ref(enabled)
    let api!: ReturnType<typeof useBoardRemote>
    const w = mount(defineComponent({
      setup() {
        api = useBoardRemote({ sessionId: ref(SID), store, undo: vi.fn(), sendMessage, enabled: enabledRef })
        return () => h('div')
      },
    }))
    mounted.push(w)
    return { api, store, sendMessage, enabledRef }
  }
  const fire = (detail: Record<string, unknown>) => window.dispatchEvent(new CustomEvent('wb:remote-command', { detail }))
  const states = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls.map((c) => c[0] as any).filter((m) => m.type === 'remote.state')
  afterEach(() => { while (mounted.length) mounted.pop()!.unmount() })

  it('hello до готовності → поки нічого; щойно кімната готова → рівно один стан, пульт підключений', async () => {
    const { api, sendMessage, enabledRef } = setup(false)
    fire({ userId: 'u', pair: PAIR, clientId: 'phone', cmd: 'hello', args: {} })
    expect(states(sendMessage)).toHaveLength(0)
    expect(api.remoteConnected.value).toBe(false)
    enabledRef.value = true
    await nextTick()
    expect(states(sendMessage)).toHaveLength(1)
    expect(states(sendMessage)[0]).toMatchObject({ type: 'remote.state', pair: PAIR, page_index: 0, page_count: 5 })
    expect(api.remoteConnected.value).toBe(true)
  })

  it('до готовності інші команди не виконуються і після неї не «доганяються»', async () => {
    const { store, sendMessage, enabledRef } = setup(false)
    fire({ userId: 'u', pair: PAIR, clientId: 'phone', cmd: 'page.goto', args: { index: 3 } })
    enabledRef.value = true
    await nextTick()
    expect(store.goToPage).not.toHaveBeenCalled()
    expect(states(sendMessage)).toHaveLength(0)
  })

  it('hello чужої дошки до готовності — не позначка', async () => {
    const { sendMessage, enabledRef } = setup(false)
    fire({ userId: 'u', pair: derivePair('e16e5e94-8a17-4867-a016-34d321604245'), clientId: 'phone', cmd: 'hello', args: {} })
    enabledRef.value = true
    await nextTick()
    expect(states(sendMessage)).toHaveLength(0)
  })

  it('відповідь на відкладений hello — одна, навіть якщо готовність мигнула', async () => {
    const { sendMessage, enabledRef } = setup(false)
    fire({ userId: 'u', pair: PAIR, clientId: 'phone', cmd: 'hello', args: {} })
    enabledRef.value = true
    await nextTick()
    enabledRef.value = false
    await nextTick()
    enabledRef.value = true
    await nextTick()
    expect(states(sendMessage)).toHaveLength(1)
  })

  it('кімната, чий `enabled` читає значення, оголошене НИЖЧЕ виклику (як WBSoloRoom), монтується', async () => {
    // Живий збій 2026-09-28: watch(enabled) у setup читав `isSessionOwner` до його оголошення —
    // ReferenceError, кімната уроку не відкривалась. Юніт-тести з готовим ref цього не бачили.
    const sendMessage = vi.fn()
    const store = reactive({ currentPageIndex: 1, pageCount: 3, goToPage: vi.fn(), addPage: vi.fn() })
    const Room = defineComponent({
      setup() {
        const enabled = computed(() => isOwner.value)
        useBoardRemote({ sessionId: ref(SID), store, undo: vi.fn(), sendMessage, enabled })
        const isOwner = ref(false)   // оголошено нижче — як isSessionOwner у WBSoloRoom
        return { isOwner }
      },
      render: () => h('div'),
    })
    const w = mount(Room)
    mounted.push(w)
    fire({ userId: 'u', pair: PAIR, clientId: 'phone', cmd: 'hello', args: {} })
    ;(w.vm as any).isOwner = true
    await nextTick()
    expect(states(sendMessage)).toHaveLength(1)
    expect(states(sendMessage)[0]).toMatchObject({ page_index: 1, page_count: 3 })
  })

  it('hello прийшов і кімната стала готовою ще до монтування — відповідь при монтуванні', () => {
    const sendMessage = vi.fn()
    const store = reactive({ currentPageIndex: 0, pageCount: 2, goToPage: vi.fn(), addPage: vi.fn() })
    const Room = defineComponent({
      setup() {
        const isOwner = ref(false)
        useBoardRemote({ sessionId: ref(SID), store, undo: vi.fn(), sendMessage, enabled: computed(() => isOwner.value) })
        fire({ userId: 'u', pair: PAIR, clientId: 'phone', cmd: 'hello', args: {} })
        isOwner.value = true   // власник відомий ще до монтування — зміни після нього вже не буде
        return () => h('div')
      },
    })
    mounted.push(mount(Room))
    expect(states(sendMessage)).toHaveLength(1)
  })

  it('готова кімната відповідає на hello одразу, як і раніше', () => {
    const { sendMessage } = setup(true)
    fire({ userId: 'u', pair: PAIR, clientId: 'phone', cmd: 'hello', args: {} })
    expect(states(sendMessage)).toHaveLength(1)
  })
})
