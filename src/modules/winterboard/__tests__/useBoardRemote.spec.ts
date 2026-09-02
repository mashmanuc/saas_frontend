// useBoardRemote — ноутбук виконує ЛОКАЛЬНІ дії з команд пульта; pair звіряється тут.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, reactive, nextTick, defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { useBoardRemote, REMOTE_STATE_THROTTLE_MS } from '../composables/useBoardRemote'

function setup(enabled = true) {
  const store = reactive({
    currentPageIndex: 2,
    pageCount: 5,
    goToPage: vi.fn((i: number) => { store.currentPageIndex = i }),
    addPage: vi.fn(() => { store.pageCount += 1; store.currentPageIndex = store.pageCount - 1 }),
  })
  const undo = vi.fn()
  const sendMessage = vi.fn()
  const enabledRef = ref(enabled)
  let api!: ReturnType<typeof useBoardRemote>
  const wrapper = mount(defineComponent({
    setup() {
      api = useBoardRemote({ sessionId: ref('sess-1'), store, undo, sendMessage, enabled: enabledRef })
      return () => h('div')
    },
  }))
  return { wrapper, api, store, undo, sendMessage, enabledRef }
}

function fire(detail: Record<string, unknown>) {
  window.dispatchEvent(new CustomEvent('wb:remote-command', { detail }))
}

describe('useBoardRemote', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('pairCode — 6 цифр; remoteUrl містить сесію і pair', () => {
    const { api } = setup()
    expect(api.pairCode.value).toMatch(/^\d{6}$/)
    expect(api.remoteUrl.value).toContain('/winterboard/sess-1/remote?pair=' + api.pairCode.value)
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

  it('чужий pair → ігнорується повністю (ні дії, ні стану)', () => {
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
    // перше — одразу (минув throttle від hello? ні: hello щойно) → усе в таймер
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

  it('unmount знімає слухача', () => {
    const { wrapper, api, store } = setup()
    const pair = api.pairCode.value
    wrapper.unmount()
    fire({ userId: 'u', pair, clientId: 'p', cmd: 'page.goto', args: { index: 0 } })
    expect(store.goToPage).not.toHaveBeenCalled()
  })
})
