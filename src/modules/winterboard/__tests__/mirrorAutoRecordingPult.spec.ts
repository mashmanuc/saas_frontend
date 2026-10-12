// LAW §9 v1.28 (2026-10-12; ТЗ TZ_MIRROR_AUTO_RECORDING) — обв'язка пульта навколо Дзеркала:
//   • канал телефона розбирає `recording`, `recording_by_mirror_run`, `recording_result` зі справжнього
//     повідомлення сокета (зіпсоване — поля немає; старий ноутбук — поля немає);
//   • WBRemoteView передає їх Дзеркалу, а намір Дзеркала йде в сокет рівно як
//     remote.command { cmd: 'recording.start' | 'recording.stop', args: { source: 'mirror', mirror_run } }.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick, defineComponent, h } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '../../../i18n/locales/uk.json'
import { derivePair } from '../remote/remotePair'

const SID = '4ba7fff3-9452-4c42-9ff9-04415ff25d90'
const PAIR = derivePair(SID)
const RUN = '0c1f7c9e-5b7a-4d1e-9f3a-2b6c8d4e1a90'

// ── канал телефона зі справжнім розбором ────────────────────────────────────────────────

vi.mock('../composables/usePresence', () => ({
  getWsBaseUrl: () => 'wss://api.example.test',
  isPresenceAvailable: () => true,
  _getFreshTokenAsync: async () => 'tok',
}))

const sockets: FakeWS[] = []
class FakeWS {
  static OPEN = 1
  readyState = 1
  onopen: (() => void) | null = null
  onclose: ((e: { code: number }) => void) | null = null
  onerror: (() => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  constructor(_url: string) { sockets.push(this) }
  close() { /* noop */ }
  send() { /* noop */ }
}

describe('канал телефона: поля запису з remote.state', () => {
  beforeEach(() => { sockets.length = 0; vi.stubGlobal('WebSocket', FakeWS as unknown as typeof WebSocket) })
  afterEach(() => { vi.unstubAllGlobals() })

  it('новий ноутбук — стан запису і відповідь; зіпсоване й відсутнє — поля немає', async () => {
    const { useRemoteChannel } = await vi.importActual<typeof import('../composables/useRemoteChannel')>('../composables/useRemoteChannel')
    const got: any[] = []
    const ch = useRemoteChannel({ onState: (s) => got.push(s) })
    await ch.connect(SID)
    const ws = sockets[0]
    const state = (extra: Record<string, unknown>) =>
      ws.onmessage!({ data: JSON.stringify({ type: 'remote.state', pair: PAIR, client_id: 'l', page_index: 0, page_count: 2, ...extra }) })

    state({ recording: 'recording', recording_by_mirror_run: RUN, recording_result: { mirror_run: RUN, cmd: 'start', status: 'started' } })
    expect(got[0].recording).toEqual({ state: 'recording', byMirrorRun: RUN })
    expect(got[0].recordingResult).toEqual({ mirror_run: RUN, cmd: 'start', status: 'started' })

    state({})                                                           // старий ноутбук
    expect(got[1].recording).toBeUndefined()
    expect(got[1].recordingResult).toBeUndefined()

    state({ recording: 'finalized', recording_result: { mirror_run: RUN, cmd: 'start', status: 'rejected' } })
    expect(got[2].recording).toBeUndefined()
    expect(got[2].recordingResult).toBeUndefined()
    expect(got[2].pageCount).toBe(2)                                    // сам стан лишається
  })
})

// ── WBRemoteView → Дзеркало → сокет ────────────────────────────────────────────────────

const channelState = ref<'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'unavailable'>('idle')
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

/** Дзеркало без камери: лише пропси, які дав пульт */
let mirrorProps: any = null
const MirrorStub = defineComponent({
  name: 'RemoteBoardMirror',
  props: ['ready', 'pageIndex', 'result', 'sendBackground', 'boardId', 'tel', 'recording', 'recordingResult', 'sendRecording'],
  setup(props) { mirrorProps = props; return () => h('div', { 'data-testid': 'mirror-stub' }) },
})

describe('пульт: Дзеркало бачить запис і просить його тим самим сокетом', () => {
  beforeEach(() => {
    channelState.value = 'idle'
    send.mockClear()
    onStateCb = null
    mirrorProps = null
    try { localStorage.setItem('wb.remote.firstTipSeen', '1') } catch { /* noop */ }
  })

  it('стан → пропси Дзеркала; «Почати» / «Зупинити» Дзеркала → remote.command з запуском', async () => {
    const i18n = createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })
    const w = mount(WBRemoteView, {
      attachTo: document.body,
      global: { plugins: [i18n], stubs: { RouterLink: true, RemoteBoardMirror: MirrorStub } },
    })
    try {
      await flushPromises()
      onStateCb!({ pair: PAIR, clientId: 'l', pageIndex: 0, pageCount: 2, caps: ['photo'], recording: { state: 'idle', byMirrorRun: null } })
      await nextTick()
      await w.find('[data-testid="open-photo"]').trigger('click')
      await w.find('[data-testid="photo-mirror"]').trigger('click')
      await flushPromises()
      expect(w.find('[data-testid="mirror-stub"]').exists()).toBe(true)
      expect(mirrorProps.recording).toEqual({ state: 'idle', byMirrorRun: null })
      expect(mirrorProps.recordingResult).toBeNull()

      send.mockClear()
      expect(mirrorProps.sendRecording('recording.start', RUN)).toBe(true)
      expect(send).toHaveBeenCalledTimes(1)
      expect(send.mock.calls[0][0]).toMatchObject({
        type: 'remote.command', pair: PAIR, cmd: 'recording.start', args: { source: 'mirror', mirror_run: RUN },
      })

      onStateCb!({
        pair: PAIR, clientId: 'l', pageIndex: 0, pageCount: 2, caps: ['photo'],
        recording: { state: 'recording', byMirrorRun: RUN }, recordingResult: { mirror_run: RUN, cmd: 'start', status: 'started' },
      })
      await nextTick()
      expect(mirrorProps.recording).toEqual({ state: 'recording', byMirrorRun: RUN })
      expect(mirrorProps.recordingResult).toEqual({ mirror_run: RUN, cmd: 'start', status: 'started' })

      mirrorProps.sendRecording('recording.stop', RUN)
      expect(send.mock.calls[1][0]).toMatchObject({ cmd: 'recording.stop', args: { source: 'mirror', mirror_run: RUN } })

      // старий ноутбук (поля немає) — Дзеркало знає це: null, а не застаріле «recording»
      onStateCb!({ pair: PAIR, clientId: 'l', pageIndex: 0, pageCount: 2, caps: ['photo'] })
      await nextTick()
      expect(mirrorProps.recording).toBeNull()
      expect(mirrorProps.recordingResult).toBeNull()
    } finally {
      w.unmount()
    }
  })
})
