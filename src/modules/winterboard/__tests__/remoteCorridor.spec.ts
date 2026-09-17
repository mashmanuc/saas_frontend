// LAW §9 v1.6 — предмет і мова з пульта (ТЗ 2026-09-17 §2.4, §4.2, §11.3).
// Ноутбук: команда пульта → лише подія палітрі; стан палітри → remote.state.assistant.
// Телефон: закритий парсер поля `assistant`.

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { reactive, ref, defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import {
  useBoardRemote, ASSISTANT_COMMAND_EVENT, ASSISTANT_STATE_EVENT, ASSISTANT_STATE_REQUEST_EVENT,
  REMOTE_STATE_THROTTLE_MS,
} from '../composables/useBoardRemote'
import { parseRemoteAssistant } from '../composables/useRemoteChannel'

const SID = '4ba7fff3-9452-4c42-9ff9-04415ff25d90'
const mounted: Array<{ unmount: () => void }> = []

function setup() {
  const store = reactive({ currentPageIndex: 0, pageCount: 3, goToPage: vi.fn(), addPage: vi.fn() })
  const undo = vi.fn()
  const sendMessage = vi.fn()
  const sessionId = ref<string | null>(SID)
  let api!: ReturnType<typeof useBoardRemote>
  const wrapper = mount(defineComponent({
    setup() {
      api = useBoardRemote({ sessionId, store, undo, sendMessage, enabled: ref(true) })
      return () => h('div')
    },
  }))
  mounted.push(wrapper)
  return { api, store, undo, sendMessage }
}

const SNAPSHOT = {
  subject_mode: 'locked', subject: 'history', subject_source: 'explicit_remote',
  language_mode: 'auto', content_language: 'en',
}

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => {
  vi.useRealTimers()
  while (mounted.length) { try { mounted.pop()!.unmount() } catch { /* noop */ } }
})

describe('useBoardRemote v1.6 · предмет і мова', () => {
  it('subject.set з пульта → ЛИШЕ подія палітрі; дошка й запис не чіпаються (kill-проба 5)', () => {
    const { api, store, undo, sendMessage } = setup()
    const seen: any[] = []
    const listener = (e: Event) => seen.push((e as CustomEvent).detail)
    window.addEventListener(ASSISTANT_COMMAND_EVENT, listener)
    window.dispatchEvent(new CustomEvent('wb:remote-command', {
      detail: { userId: 'u', pair: api.pairCode.value, clientId: 'phone', cmd: 'subject.set', args: { subject: 'history' } },
    }))
    window.removeEventListener(ASSISTANT_COMMAND_EVENT, listener)
    expect(seen).toEqual([{ boardId: SID, cmd: 'subject.set', args: { subject: 'history' } }])
    expect(store.goToPage).not.toHaveBeenCalled()
    expect(store.addPage).not.toHaveBeenCalled()
    expect(undo).not.toHaveBeenCalled()
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('стан палітри для ЦІЄЇ дошки йде на пульт полем assistant; чужа дошка — ні', () => {
    const { api, sendMessage } = setup()
    window.dispatchEvent(new CustomEvent('wb:remote-command', {
      detail: { userId: 'u', pair: api.pairCode.value, clientId: 'phone', cmd: 'hello', args: {} },
    }))
    sendMessage.mockClear()
    window.dispatchEvent(new CustomEvent(ASSISTANT_STATE_EVENT, { detail: { boardId: 'other-board', state: SNAPSHOT } }))
    expect(api.assistantState.value).toBeNull()
    window.dispatchEvent(new CustomEvent(ASSISTANT_STATE_EVENT, { detail: { boardId: SID, state: SNAPSHOT } }))
    expect(api.assistantState.value).toEqual(SNAPSHOT)
    vi.advanceTimersByTime(REMOTE_STATE_THROTTLE_MS)
    const calls = sendMessage.mock.calls
    expect(calls[calls.length - 1]?.[0]).toMatchObject({ type: 'remote.state', assistant: SNAPSHOT })
  })

  it('на монтуванні й на hello просить палітру повторити стан (без гонки порядку монтування)', () => {
    const requests: any[] = []
    const listener = (e: Event) => requests.push((e as CustomEvent).detail)
    window.addEventListener(ASSISTANT_STATE_REQUEST_EVENT, listener)
    const { api } = setup()
    window.dispatchEvent(new CustomEvent('wb:remote-command', {
      detail: { userId: 'u', pair: api.pairCode.value, clientId: 'phone', cmd: 'hello', args: {} },
    }))
    window.removeEventListener(ASSISTANT_STATE_REQUEST_EVENT, listener)
    expect(requests).toEqual([{ boardId: SID }, { boardId: SID }])
  })

  it('без палітри (коридори вимкнені) у remote.state немає поля assistant', () => {
    const { api, sendMessage } = setup()
    window.dispatchEvent(new CustomEvent('wb:remote-command', {
      detail: { userId: 'u', pair: api.pairCode.value, clientId: 'phone', cmd: 'hello', args: {} },
    }))
    expect(sendMessage.mock.calls[0][0]).not.toHaveProperty('assistant')
  })
})

describe('parseRemoteAssistant (телефон)', () => {
  it('валідне поле → camelCase', () => {
    expect(parseRemoteAssistant(SNAPSHOT)).toEqual({
      subjectMode: 'locked', subject: 'history', subjectSource: 'explicit_remote',
      languageMode: 'auto', contentLanguage: 'en',
    })
  })

  it.each([
    [{ ...SNAPSHOT, subject_mode: 'maybe' }],
    [{ ...SNAPSHOT, content_language: 'de' }],
    [{ ...SNAPSHOT, subject: '' }],
    [{ ...SNAPSHOT, subject_source: 'x'.repeat(40) }],
    ['history'],
    [null],
  ])('зіпсоване поле відкидається: %j', (raw) => {
    expect(parseRemoteAssistant(raw)).toBeUndefined()
  })
})
