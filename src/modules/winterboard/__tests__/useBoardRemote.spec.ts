// useBoardRemote — ноутбук виконує ЛОКАЛЬНІ дії з команд пульта; pair звіряється тут.
// v1.1: pair стабільний (derivePair з id дошки), remoteUrl універсальний (/remote).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, reactive, nextTick, defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { useBoardRemote, REMOTE_STATE_THROTTLE_MS } from '../composables/useBoardRemote'
import { derivePair } from '../remote/remotePair'

const SID = '4ba7fff3-9452-4c42-9ff9-04415ff25d90'

// pair тепер детермінований (той самий для SID у кожному тесті), тож НЕзнятий
// інстанс із попереднього тесту теж відповість на подію. Прибираємо всі.
const mounted: Array<{ unmount: () => void }> = []

function setup(enabled = true, sid: string | null = SID) {
  const store = reactive({
    currentPageIndex: 2,
    pageCount: 5,
    goToPage: vi.fn((i: number) => { store.currentPageIndex = i }),
    addPage: vi.fn(() => { store.pageCount += 1; store.currentPageIndex = store.pageCount - 1 }),
  })
  const undo = vi.fn()
  const sendMessage = vi.fn()
  const enabledRef = ref(enabled)
  const sessionId = ref<string | null>(sid)
  let api!: ReturnType<typeof useBoardRemote>
  const wrapper = mount(defineComponent({
    setup() {
      api = useBoardRemote({ sessionId, store, undo, sendMessage, enabled: enabledRef })
      return () => h('div')
    },
  }))
  mounted.push(wrapper)
  return { wrapper, api, store, undo, sendMessage, enabledRef, sessionId }
}

function fire(detail: Record<string, unknown>) {
  window.dispatchEvent(new CustomEvent('wb:remote-command', { detail }))
}

describe('useBoardRemote', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => {
    while (mounted.length) { try { mounted.pop()!.unmount() } catch { /* already unmounted */ } }
    vi.useRealTimers()
  })

  it('pairCode СТАБІЛЬНИЙ: виводиться з id дошки, однаковий після повторного mount', () => {
    const a = setup()
    const b = setup()
    expect(a.api.pairCode.value).toBe(derivePair(SID))
    expect(b.api.pairCode.value).toBe(a.api.pairCode.value)
    a.wrapper.unmount(); b.wrapper.unmount()
  })

  it('pairCode міняється разом із дошкою', async () => {
    const { api, sessionId } = setup()
    const before = api.pairCode.value
    sessionId.value = 'e16e5e94-8a17-4867-a016-34d321604245'
    await nextTick()
    expect(api.pairCode.value).not.toBe(before)
    expect(api.pairCode.value).toBe(derivePair(sessionId.value))
  })

  it('remoteUrl — універсальний /remote без id і без коду', () => {
    const { api } = setup()
    expect(api.remoteUrl.value).toBe(`${window.location.origin}/remote`)
    expect(api.remoteUrl.value).not.toContain(SID)
    expect(api.remoteUrl.value).not.toContain('pair=')
  })

  it('hello з правильним pair → remote.state з поточною сторінкою; пульт вважається підключеним', () => {
    const { api, sendMessage } = setup()
    expect(api.remoteConnected.value).toBe(false)
    fire({ userId: 'u', pair: api.pairCode.value, clientId: 'phone', cmd: 'hello', args: {} })
    expect(api.remoteConnected.value).toBe(true)
    expect(sendMessage).toHaveBeenCalledTimes(1)
    expect(sendMessage.mock.calls[0][0]).toMatchObject({
      type: 'remote.state', pair: api.pairCode.value, page_index: 2, page_count: 5,
    })
  })

  it('чужий pair (інша дошка / стара вкладка) → ігнорується повністю', () => {
    const { api, store, sendMessage } = setup()
    fire({ userId: 'u', pair: '000000', clientId: 'phone', cmd: 'page.goto', args: { index: 4 } })
    expect(store.goToPage).not.toHaveBeenCalled()
    expect(sendMessage).not.toHaveBeenCalled()
    expect(api.ignoredCount.value).toBe(1)
    expect(api.remoteConnected.value).toBe(false)
  })

  it('page.goto → store.goToPage з абсолютним індексом; поза межами — нічого', () => {
    const { api, store } = setup()
    const pair = api.pairCode.value
    fire({ userId: 'u', pair, clientId: 'p', cmd: 'page.goto', args: { index: 4 } })
    expect(store.goToPage).toHaveBeenCalledWith(4)
    fire({ userId: 'u', pair, clientId: 'p', cmd: 'page.goto', args: { index: 5 } })
    fire({ userId: 'u', pair, clientId: 'p', cmd: 'page.goto', args: { index: -1 } })
    fire({ userId: 'u', pair, clientId: 'p', cmd: 'page.goto', args: { index: 1.5 } })
    expect(store.goToPage).toHaveBeenCalledTimes(1)
  })

  it('page.new → addPage; undo → undo(); phrase → m4sh:integralyk-ask з текстом', () => {
    const { api, store, undo } = setup()
    const pair = api.pairCode.value
    const asked: string[] = []
    const onAsk = (e: Event) => asked.push((e as CustomEvent).detail.text)
    window.addEventListener('m4sh:integralyk-ask', onAsk)

    fire({ userId: 'u', pair, clientId: 'p', cmd: 'page.new', args: {} })
    expect(store.addPage).toHaveBeenCalledTimes(1)
    fire({ userId: 'u', pair, clientId: 'p', cmd: 'undo', args: {} })
    expect(undo).toHaveBeenCalledTimes(1)
    fire({ userId: 'u', pair, clientId: 'p', cmd: 'phrase', args: { text: '  побудуй графік y=x^2 ' } })
    expect(asked).toEqual(['побудуй графік y=x^2'])
    fire({ userId: 'u', pair, clientId: 'p', cmd: 'phrase', args: { text: '   ' } })
    expect(asked).toHaveLength(1)

    window.removeEventListener('m4sh:integralyk-ask', onAsk)
  })

  it('після hello зміна сторінки на ноутбуці → remote.state пульту (з тротлінгом)', async () => {
    const { api, store, sendMessage } = setup()
    fire({ userId: 'u', pair: api.pairCode.value, clientId: 'p', cmd: 'hello', args: {} })
    sendMessage.mockClear()

    store.currentPageIndex = 3
    await nextTick()
    store.currentPageIndex = 4
    await nextTick()
    vi.advanceTimersByTime(REMOTE_STATE_THROTTLE_MS + 5)
    const states = sendMessage.mock.calls.map(c => c[0]).filter(m => m.type === 'remote.state')
    expect(states.length).toBeGreaterThanOrEqual(1)
    expect(states[states.length - 1]).toMatchObject({ page_index: 4, page_count: 5 })
  })

  it('без hello зміна сторінки НЕ шле remote.state (нема кому)', async () => {
    const { store, sendMessage } = setup()
    store.currentPageIndex = 0
    await nextTick()
    vi.advanceTimersByTime(REMOTE_STATE_THROTTLE_MS * 2)
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('enabled=false (не власник) → команди ігноруються', () => {
    const { api, store } = setup(false)
    fire({ userId: 'u', pair: api.pairCode.value, clientId: 'p', cmd: 'page.goto', args: { index: 0 } })
    expect(store.goToPage).not.toHaveBeenCalled()
  })

  // v1.2 — вигляд і картки через адаптер
  function setupWithView() {
    const view = {
      fitTask: vi.fn(() => 0), zoomBy: vi.fn(() => 1.5), scrollBy: vi.fn(() => -240),
      reveal: vi.fn(() => 1), resetFocus: vi.fn(), taskCards: vi.fn(() => []),
      summary: vi.fn(() => ({ count: 2, answer: false, solution: true, zoom: 1.5 })),
    }
    const store = reactive({
      currentPageIndex: 0, pageCount: 3,
      goToPage: vi.fn((i: number) => { store.currentPageIndex = i }),
      addPage: vi.fn(),
    })
    const sendMessage = vi.fn()
    let api!: ReturnType<typeof useBoardRemote>
    const wrapper = mount(defineComponent({
      setup() {
        api = useBoardRemote({ sessionId: ref(SID), store, undo: vi.fn(), sendMessage, enabled: ref(true), view: view as any })
        return () => h('div')
      },
    }))
    mounted.push(wrapper)
    return { api, view, store, sendMessage }
  }

  it('v1.2: hello → remote.state містить cards і zoom з адаптера', () => {
    const { api, sendMessage } = setupWithView()
    fire({ userId: 'u', pair: api.pairCode.value, clientId: 'p', cmd: 'hello', args: {} })
    expect(sendMessage.mock.calls[0][0]).toMatchObject({
      type: 'remote.state', zoom: 1.5, cards: { count: 2, answer: false, solution: true },
    })
  })

  it('v1.2: view.fit / view.zoom / view.scroll / card.reveal → адаптер; стан підтверджується', () => {
    const { api, view, sendMessage } = setupWithView()
    const pair = api.pairCode.value
    fire({ userId: 'u', pair, clientId: 'p', cmd: 'view.fit', args: {} })
    expect(view.fitTask).toHaveBeenCalledTimes(1)
    fire({ userId: 'u', pair, clientId: 'p', cmd: 'view.zoom', args: { delta: 1 } })
    expect(view.zoomBy).toHaveBeenCalledWith(1)
    fire({ userId: 'u', pair, clientId: 'p', cmd: 'view.zoom', args: { delta: 0 } })
    expect(view.zoomBy).toHaveBeenCalledTimes(1)          // 0 — не команда
    fire({ userId: 'u', pair, clientId: 'p', cmd: 'view.scroll', args: { dir: 1 } })
    expect(view.scrollBy).toHaveBeenCalledWith(1)
    fire({ userId: 'u', pair, clientId: 'p', cmd: 'card.reveal', args: { what: 'solution' } })
    expect(view.reveal).toHaveBeenCalledWith('solution')
    fire({ userId: 'u', pair, clientId: 'p', cmd: 'card.reveal', args: { what: 'both' } })
    expect(view.reveal).toHaveBeenCalledTimes(1)
    // fit/zoom/reveal шлють стан (3), scroll — ні
    vi.advanceTimersByTime(REMOTE_STATE_THROTTLE_MS * 4)
    const states = sendMessage.mock.calls.filter(c => c[0].type === 'remote.state').length
    expect(states).toBeGreaterThanOrEqual(1)
  })

  it('v1.2: зміна сторінки скидає фокус картки в адаптері', async () => {
    const { view, store } = setupWithView()
    store.currentPageIndex = 2
    await nextTick()
    expect(view.resetFocus).toHaveBeenCalled()
  })

  it('v1.2: без адаптера v1.2-команди ігноруються, старі працюють', () => {
    const { api, store } = setup()
    const pair = api.pairCode.value
    fire({ userId: 'u', pair, clientId: 'p', cmd: 'view.fit', args: {} })
    fire({ userId: 'u', pair, clientId: 'p', cmd: 'page.goto', args: { index: 1 } })
    expect(store.goToPage).toHaveBeenCalledWith(1)
  })

  it('unmount знімає слухача', () => {
    const { wrapper, api, store } = setup()
    const pair = api.pairCode.value
    wrapper.unmount()
    fire({ userId: 'u', pair, clientId: 'p', cmd: 'page.goto', args: { index: 0 } })
    expect(store.goToPage).not.toHaveBeenCalled()
  })
})
