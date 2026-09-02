// WBRemoteView — пульт на телефоні: hello при підключенні, абсолютні індекси,
// голос → граматика або фраза. Канал і мікрофон підмінені.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'

const channelState = ref<'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'unavailable'>('idle')
const send = vi.fn(() => true)
const connect = vi.fn(async () => { channelState.value = 'connected' })
const disconnect = vi.fn()
const retry = vi.fn()
let onStateCb: ((s: any) => void) | null = null

vi.mock('../composables/useRemoteChannel', () => ({
  useRemoteChannel: (opts: any) => {
    onStateCb = opts.onState
    return { state: channelState, lastError: ref(null), connect, disconnect, retry, send }
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

const push = vi.fn()
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: { pair: '123456' }, params: { id: 'sess-1' } }),
  useRouter: () => ({ push }),
}))

import WBRemoteView from '../views/WBRemoteView.vue'

function mountView() {
  const i18n = createI18n({
    legacy: false, locale: 'uk', fallbackLocale: 'uk',
    messages: { uk: { winterboard: { remote: {
      exit: 'Вийти', pairMissing: 'нема коду', waitingBoard: 'Чекаю дошку…', prev: 'Назад', next: 'Далі',
      newPage: 'Нова сторінка', undo: 'Відмінити', holdToTalk: 'Говорю', listening: 'Слухаю…',
      voiceUnsupported: 'x', reconnect: 'Підключити ще раз', connected: 'Зв\'язок є', connecting: '…',
      unavailable: 'недоступно', disconnected: 'нема',
    } } } },
  })
  return mount(WBRemoteView, { props: { id: 'sess-1' }, global: { plugins: [i18n] } })
}

function lastCmd() {
  const calls = send.mock.calls
  return calls.length ? (calls[calls.length - 1][0] as any) : null
}

describe('WBRemoteView', () => {
  beforeEach(() => {
    channelState.value = 'idle'
    send.mockClear(); connect.mockClear(); push.mockClear()
    onStateCb = null; onFinalCb = null
    vi.useFakeTimers()
  })

  it('підключається до сесії з маршруту і одразу вітається (hello з pair)', async () => {
    mountView()
    await flushPromises()
    expect(connect).toHaveBeenCalledWith('sess-1')
    const hello = send.mock.calls.find(c => (c[0] as any).cmd === 'hello')?.[0] as any
    expect(hello).toBeTruthy()
    expect(hello.type).toBe('remote.command')
    expect(hello.pair).toBe('123456')
    expect(typeof hello.client_id).toBe('string')
  })

  it('до першого стану показує «Чекаю дошку…», кнопки сторінок вимкнені', async () => {
    const w = mountView()
    await flushPromises()
    expect(w.text()).toContain('Чекаю дошку…')
    const btns = w.findAll('.wb-remote__btn')
    expect((btns[0].element as HTMLButtonElement).disabled).toBe(true)
    expect((btns[1].element as HTMLButtonElement).disabled).toBe(true)
  })

  it('remote.state з нашим pair → лічильник «3 / 7»; чужий pair ігнорується', async () => {
    const w = mountView()
    await flushPromises()
    onStateCb?.({ pair: '000000', clientId: 'x', pageIndex: 0, pageCount: 1 })
    await nextTick()
    expect(w.text()).toContain('Чекаю дошку…')
    onStateCb?.({ pair: '123456', clientId: 'laptop', pageIndex: 2, pageCount: 7 })
    await nextTick()
    expect(w.find('.wb-remote__page-cur').text()).toBe('3')
    expect(w.find('.wb-remote__page-total').text()).toBe('7')
  })

  it('«Далі» шле АБСОЛЮТНИЙ page.goto(index+1); на останній сторінці — не шле', async () => {
    const w = mountView()
    await flushPromises()
    onStateCb?.({ pair: '123456', clientId: 'l', pageIndex: 2, pageCount: 7 })
    await nextTick()
    send.mockClear()
    await w.findAll('.wb-remote__btn')[1].trigger('click')
    expect(lastCmd()).toMatchObject({ cmd: 'page.goto', args: { index: 3 } })

    onStateCb?.({ pair: '123456', clientId: 'l', pageIndex: 6, pageCount: 7 })
    await nextTick()
    send.mockClear()
    expect((w.findAll('.wb-remote__btn')[1].element as HTMLButtonElement).disabled).toBe(true)
    await w.findAll('.wb-remote__btn')[1].trigger('click')
    expect(send).not.toHaveBeenCalled()
  })

  it('«Назад» на першій сторінці вимкнена; «Нова» і «Відмінити» шлють команди', async () => {
    const w = mountView()
    await flushPromises()
    onStateCb?.({ pair: '123456', clientId: 'l', pageIndex: 0, pageCount: 3 })
    await nextTick()
    const btns = w.findAll('.wb-remote__btn')
    expect((btns[0].element as HTMLButtonElement).disabled).toBe(true)
    send.mockClear()
    await btns[2].trigger('click')
    expect(lastCmd()).toMatchObject({ cmd: 'page.new' })
    await btns[3].trigger('click')
    expect(lastCmd()).toMatchObject({ cmd: 'undo' })
  })

  it('голос: «далі» → page.goto; питання → phrase з текстом', async () => {
    mountView()
    await flushPromises()
    onStateCb?.({ pair: '123456', clientId: 'l', pageIndex: 1, pageCount: 5 })
    await nextTick()
    send.mockClear()
    onFinalCb?.('далі')
    expect(lastCmd()).toMatchObject({ cmd: 'page.goto', args: { index: 2 } })
    onFinalCb?.('побудуй графік y дорівнює x квадрат')
    expect(lastCmd()).toMatchObject({ cmd: 'phrase', args: { text: 'побудуй графік y дорівнює x квадрат' } })
  })

  it('«Вийти» закриває канал і веде в Студію', async () => {
    const w = mountView()
    await flushPromises()
    await w.find('.wb-remote__exit').trigger('click')
    expect(disconnect).toHaveBeenCalled()
    expect(push).toHaveBeenCalledWith({ name: 'winterboard-boards' })
  })
})
