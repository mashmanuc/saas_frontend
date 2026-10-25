// LAW §9 v1.55 · диктант на пульті не висить (власник 2026-10-25: «25 жовтня ⏎ класна робота» посередині —
// «Сервер відхилив команду», а вікно диктанту «тупо стоїть "Пишу на дошці"»). Enter у полі — новий рядок; відмова
// сервера чи мовчання ноутбука 8 с — «Дошка не прийняла речення», кнопка знову доступна; відповідь ноутбука вчасно —
// жодного «не прийняла». Канал, мікрофон, API і authStore підмінені так само, як у WBRemoteView.v2.spec.ts.

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
let onErrorCb: ((code: string) => void) | null = null

vi.mock('../composables/useRemoteChannel', async (importOriginal) => {
  const actual = await importOriginal<any>()
  return {
    ...actual,
    useRemoteChannel: (opts: any) => {
      onStateCb = opts.onState
      onErrorCb = opts.onError
      return { state: channelState, lastError: ref(null), sessionId: ref(null), connect, disconnect, retry: vi.fn(), send }
    },
  }
})
vi.mock('../composables/usePushToTalk', () => ({
  usePushToTalk: () => ({ supported: true, listening: ref(false), press: vi.fn(), release: vi.fn() }),
}))
vi.mock('@/modules/auth/store/authStore', () => ({
  useAuthStore: () => ({ user: { email: 'teacher@m4sh.local' }, forceLogout: vi.fn() }),
}))
vi.mock('@/modules/auth/api/authApi', () => ({ default: { logout: vi.fn() } }))
vi.mock('@/utils/telemetryAgent', () => ({ trackEvent: vi.fn() }))
vi.mock('@/modules/intent/corridors/corridorApi', () => ({ fetchCorridorRegistry: vi.fn(async () => null) }))
const getActiveRemoteSession = vi.fn()
vi.mock('../api/winterboardApi', () => ({
  winterboardApi: { getActiveRemoteSession: (...a: any[]) => getActiveRemoteSession(...a), searchVideos: vi.fn(), lookupVideo: vi.fn() },
}))

import WBRemoteView from '../views/WBRemoteView.vue'

const MSG = {
  connected: 'Зв\'язок є', serverRejected: 'Сервер відхилив ({code})',
  dictation: { button: 'Диктант', write: 'Написати на дошці', writing: 'Пишу на дошці…', done: 'Готово', noAnswer: 'Дошка не прийняла речення' },
}
const CAPS = ['dictation', 'dictation_center', 'dictation_line_v1']

const mounted: Array<{ unmount: () => void }> = []
async function connected() {
  const i18n = createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', missingWarn: false, fallbackWarn: false,
    messages: { uk: { winterboard: { remote: MSG } } } })
  const w = mount(WBRemoteView, { attachTo: document.body, global: { plugins: [i18n], stubs: { RouterLink: true } } })
  mounted.push(w)
  await flushPromises()
  onStateCb?.({ pair: PAIR, clientId: 'l', pageIndex: 0, pageCount: 1, caps: CAPS })
  await nextTick()
  await w.find('[data-testid="open-dictation"]').trigger('click')
  return w
}
function dictateCmd() {
  const c = send.mock.calls.map((x) => x[0] as any).filter((d) => d.cmd === 'board.dictate')
  return c[c.length - 1]
}
async function write(w: any, text: string) {
  await w.find('[data-testid="dictation-text"]').setValue(text)
  await w.find('[data-testid="dictation-send"]').trigger('click')
  await nextTick()
}
const status = (w: any) => w.find('[data-testid="dictation-status"]').text()
const sendDisabled = (w: any) => w.find('[data-testid="dictation-send"]').attributes('disabled') !== undefined

describe('LAW §9 v1.55 · диктант на пульті не висить', () => {
  beforeEach(() => {
    channelState.value = 'idle'
    send.mockClear()
    getActiveRemoteSession.mockReset()
    getActiveRemoteSession.mockResolvedValue({ session_id: SID, name: 'Українська 5-А', ts: 1 })
    onStateCb = null; onErrorCb = null
    try { localStorage.setItem('wb.remote.firstTipSeen', '1') } catch { /* noop */ }
  })
  afterEach(() => { vi.useRealTimers(); while (mounted.length) mounted.pop()!.unmount() })

  it('Enter у полі — новий рядок; порожні рядки й пробіли по краях ноутбуку не йдуть', async () => {
    const w = await connected()
    await write(w, '  25 жовтня \n\n  класна робота \n')
    expect(dictateCmd().args.text).toBe('25 жовтня\nкласна робота')
    expect(status(w)).toBe('Пишу на дошці…')
  })

  it('сервер відхилив команду — одразу «не прийняла», кнопка доступна, текст лишився', async () => {
    const w = await connected()
    await write(w, '25 жовтня\nкласна робота')
    expect(sendDisabled(w)).toBe(true)
    onErrorCb?.('invalid_message')
    await nextTick()
    expect(status(w)).toBe('Дошка не прийняла речення')
    expect(sendDisabled(w)).toBe(false)
    expect((w.find('[data-testid="dictation-text"]').element as HTMLTextAreaElement).value).toBe('25 жовтня\nкласна робота')
  })

  it('ноутбук мовчить 8 с — «не прийняла»; новий натиск — знову «Пишу…»', async () => {
    const w = await connected()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    await write(w, 'Речення.')
    vi.advanceTimersByTime(7900)
    await nextTick()
    expect(status(w)).toBe('Пишу на дошці…')
    vi.advanceTimersByTime(200)
    await nextTick()
    expect(status(w)).toBe('Дошка не прийняла речення')
    await write(w, 'Речення.')
    expect(status(w)).toBe('Пишу на дошці…')
  })

  it('ноутбук відповів вчасно — жодного «не прийняла», навіть якщо пише довше 8 с', async () => {
    const w = await connected()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    await write(w, 'Речення.')
    const rid = dictateCmd().args.request_id
    onStateCb?.({ pair: PAIR, clientId: 'l', pageIndex: 0, pageCount: 1, caps: CAPS, dictation: { request_id: rid, status: 'writing' } })
    vi.advanceTimersByTime(20000)
    onErrorCb?.('rate_limit')
    await nextTick()
    expect(status(w)).toBe('Пишу на дошці…')
    onStateCb?.({ pair: PAIR, clientId: 'l', pageIndex: 0, pageCount: 1, caps: CAPS, dictation: { request_id: rid, status: 'done' } })
    await nextTick()
    expect(status(w)).toBe('Готово')
  })
})
