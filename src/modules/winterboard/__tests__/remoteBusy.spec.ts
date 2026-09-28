// LAW §9 v1.18 — `remote.state.busy: 'saving_template'` («Зберегти як новий шаблон», власник 2026-09-28).
// Ноутбук: поки зберігає шаблон, шле busy, а команди пульта (крім hello) чекають і виконуються
// одразу після — не губляться, але в шаблон не потрапляють. Телефон: закритий набір поля.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { reactive, ref, nextTick, defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { useBoardRemote } from '../composables/useBoardRemote'
import { parseRemoteBusy } from '../composables/useRemoteChannel'

const SID = '4ba7fff3-9452-4c42-9ff9-04415ff25d90'
const mounted: Array<{ unmount: () => void }> = []
afterEach(() => { while (mounted.length) { try { mounted.pop()!.unmount() } catch { /* noop */ } } })

function setup() {
  const store = reactive({ currentPageIndex: 0, pageCount: 3, goToPage: vi.fn(), addPage: vi.fn() })
  const calls: string[] = []
  store.addPage.mockImplementation(() => { calls.push('page.new') })
  const undo = vi.fn(() => { calls.push('undo') })
  const sendMessage = vi.fn()
  const busy = ref<'saving_template' | null>(null)
  const enabled = ref(true)
  let api!: ReturnType<typeof useBoardRemote>
  const wrapper = mount(defineComponent({
    setup() {
      api = useBoardRemote({ sessionId: ref<string | null>(SID), store, undo, sendMessage, enabled, busy: () => busy.value })
      return () => h('div')
    },
  }))
  mounted.push(wrapper)
  const command = (cmd: string, args: Record<string, unknown> = {}) =>
    window.dispatchEvent(new CustomEvent('wb:remote-command', { detail: { userId: 'u', pair: api.pairCode.value, clientId: 'phone', cmd, args } }))
  const lastState = () => {
    const states = sendMessage.mock.calls.map((c) => c[0]).filter((m: any) => m?.type === 'remote.state')
    return states[states.length - 1]
  }
  return { api, store, undo, sendMessage, busy, enabled, command, lastState, calls }
}

describe('useBoardRemote v1.18 · ноутбук зберігає шаблон', () => {
  it('без збереження команди виконуються одразу, поля busy немає', async () => {
    const { store, command, lastState } = setup()
    command('hello')
    command('page.new')
    expect(store.addPage).toHaveBeenCalledTimes(1)
    expect(lastState()).not.toHaveProperty('busy')
  })

  it('під час збереження: стан із busy, команди чекають, hello — одразу', async () => {
    const { store, undo, busy, command, lastState, sendMessage } = setup()
    const statesSent = () => sendMessage.mock.calls.filter((c) => c[0]?.type === 'remote.state').length
    command('hello')
    busy.value = 'saving_template'
    await nextTick()
    expect(lastState()).toMatchObject({ type: 'remote.state', busy: 'saving_template' })
    command('page.new')
    command('undo')
    expect(store.addPage).not.toHaveBeenCalled()
    expect(undo).not.toHaveBeenCalled()
    const before = statesSent()
    command('hello')   // привітання не чекає — пульт (новий чи перепідключений) має побачити, що дошка зайнята
    expect(statesSent()).toBe(before + 1)
    expect(lastState()).toMatchObject({ busy: 'saving_template' })
  })

  it('збереження закінчилось: відкладені команди виконуються в тому самому порядку, стан — без busy', async () => {
    const { busy, command, lastState, calls } = setup()
    command('hello')
    busy.value = 'saving_template'
    await nextTick()
    command('page.new')
    command('page.new')
    command('undo')
    busy.value = null
    await nextTick()
    expect(calls).toEqual(['page.new', 'page.new', 'undo'])   // не загубились, порядок той самий
    expect(lastState()).not.toHaveProperty('busy')
  })

  it('понад 50 відкладених (не людина) — зайві не виконуються, і не мовчки: попередження в консолі', async () => {
    const { store, busy, command } = setup()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      command('hello')
      busy.value = 'saving_template'
      await nextTick()
      for (let i = 0; i < 52; i++) command('page.new')
      expect(warn).toHaveBeenCalledTimes(2)
      busy.value = null
      await nextTick()
      expect(store.addPage).toHaveBeenCalledTimes(50)
    } finally {
      warn.mockRestore()
    }
  })

  it('кімнати вже немає (enabled=false) — відкладене дошку не чіпає', async () => {
    const { store, busy, enabled, command } = setup()
    command('hello')
    busy.value = 'saving_template'
    await nextTick()
    command('page.new')
    enabled.value = false
    busy.value = null
    await nextTick()
    expect(store.addPage).not.toHaveBeenCalled()
  })
})

describe('parseRemoteBusy (телефон) — закритий набір, як на сервері', () => {
  it('saving_template → поле є', () => {
    expect(parseRemoteBusy('saving_template')).toBe('saving_template')
  })
  it.each([['saving'], [''], [1], [true], [['saving_template']], [{}], [null], [undefined]])('%j → поля немає', (raw) => {
    expect(parseRemoteBusy(raw)).toBeUndefined()
  })
})
