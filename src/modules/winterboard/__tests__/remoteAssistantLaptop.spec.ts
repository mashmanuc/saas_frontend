/**
 * LAW §9 v1.20 — ноутбук (useBoardRemote): Інтегралик текстом з пульта.
 *   • assistant.ask / assistant.answer → подія палітрі ЦІЄЇ дошки (модулі не імпортують один одного);
 *   • палітри немає — телефон одразу отримує error, а не «…» вічно;
 *   • відповідь палітри → `remote.state.assistant_reply` (лише остання); `done` несе ПОТОЧНИЙ
 *     номер підготовчої сторінки (після вставки/видалення сторінок — теж правильний); текст — у стелю.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, reactive, ref } from 'vue'
import { mount } from '@vue/test-utils'
import {
  ASSISTANT_ANSWER_EVENT,
  ASSISTANT_ASK_EVENT,
  ASSISTANT_REPLY_EVENT,
  ASSISTANT_REPLY_TEXT_MAX,
  useBoardRemote,
} from '../composables/useBoardRemote'
import { derivePair } from '../remote/remotePair'
import commandPaletteSource from '../../intent/CommandPalette.vue?raw'

const SID = '4ba7fff3-9452-4c42-9ff9-04415ff25d90'
const PAIR = derivePair(SID)
const REQ = '0c1f7c9e-5b7a-4d1e-9f3a-2b6c8d4e1a90'
const mounted: Array<{ unmount: () => void }> = []

function setup() {
  const pageIds = ref(['p-A', 'p-prep', 'p-B'])
  const store = reactive({
    currentPageIndex: 0,
    get pageCount() { return pageIds.value.length },
    goToPage: vi.fn((i: number) => { store.currentPageIndex = i }),
    addPage: vi.fn(),
    pageIndexOf: (id: string) => pageIds.value.indexOf(id),
  })
  const sendMessage = vi.fn()
  const wrapper = mount(defineComponent({
    setup() {
      useBoardRemote({ sessionId: ref(SID), store, undo: vi.fn(), sendMessage, enabled: ref(true) })
      return () => h('div')
    },
  }))
  mounted.push(wrapper)
  fire({ cmd: 'hello', args: {} })   // пульт підключився — ноутбук шле йому стан
  return { store, sendMessage, pageIds }
}

function fire(d: { cmd: string; args: Record<string, unknown> }) {
  window.dispatchEvent(new CustomEvent('wb:remote-command', { detail: { userId: 'u', pair: PAIR, clientId: 'phone', ...d } }))
}
function reply(r: Record<string, unknown>, boardId = SID) {
  window.dispatchEvent(new CustomEvent(ASSISTANT_REPLY_EVENT, { detail: { boardId, reply: r } }))
}
const lastState = (send: ReturnType<typeof vi.fn>) => {
  const states = send.mock.calls.map((c) => c[0] as Record<string, unknown>).filter((m) => m.type === 'remote.state')
  return states[states.length - 1]
}

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => {
  while (mounted.length) mounted.pop()!.unmount()
  vi.useRealTimers()
})

describe('пульт → палітра', () => {
  it('assistant.ask → подія з дошкою, запитом і текстом; палітра прийняла — телефон чекає відповіді', () => {
    const { sendMessage } = setup()
    const seen: any[] = []
    const onAsk = (e: Event) => { const d = (e as CustomEvent).detail; seen.push({ ...d }); d.accepted = true }
    window.addEventListener(ASSISTANT_ASK_EVENT, onAsk)
    try {
      fire({ cmd: 'assistant.ask', args: { request_id: REQ, text: '  підготуй задачу  ' } })
    } finally {
      window.removeEventListener(ASSISTANT_ASK_EVENT, onAsk)
    }
    expect(seen).toEqual([{ boardId: SID, requestId: REQ, text: 'підготуй задачу', accepted: false }])
    vi.advanceTimersByTime(500)
    expect(lastState(sendMessage).assistant_reply).toBeUndefined()
  })

  it('палітри на дошці немає — одразу error, телефон не чекає «…» вічно', () => {
    const { sendMessage } = setup()
    fire({ cmd: 'assistant.ask', args: { request_id: REQ, text: 'підготуй задачу' } })
    vi.advanceTimersByTime(500)
    const r = lastState(sendMessage).assistant_reply as Record<string, unknown>
    expect(r).toMatchObject({ request_id: REQ, status: 'error' })
    expect(String(r.text)).toBeTruthy()
  })

  it('assistant.answer → подія; «може» замість yes/no — нічого', () => {
    setup()
    const seen: any[] = []
    const onAnswer = (e: Event) => seen.push((e as CustomEvent).detail)
    window.addEventListener(ASSISTANT_ANSWER_EVENT, onAnswer)
    try {
      fire({ cmd: 'assistant.answer', args: { request_id: REQ, choice: 'yes' } })
      fire({ cmd: 'assistant.answer', args: { request_id: REQ, choice: 'maybe' } })
    } finally {
      window.removeEventListener(ASSISTANT_ANSWER_EVENT, onAnswer)
    }
    expect(seen).toEqual([{ boardId: SID, requestId: REQ, choice: 'yes' }])
  })
})

describe('палітра → пульт (remote.state.assistant_reply)', () => {
  it('остання відповідь іде в стан; done — з ПОТОЧНИМ номером підготовчої сторінки', async () => {
    const { sendMessage, pageIds } = setup()
    reply({ request_id: REQ, status: 'thinking' })
    vi.advanceTimersByTime(500)
    expect(lastState(sendMessage).assistant_reply).toEqual({ request_id: REQ, status: 'thinking' })
    reply({ request_id: REQ, status: 'done', text: 'Готово', page_id: 'p-prep' })
    vi.advanceTimersByTime(500)
    expect(lastState(sendMessage).assistant_reply).toEqual({ request_id: REQ, status: 'done', text: 'Готово', page_index: 1 })
    // учитель вставив сторінку перед підготовчою — «Показати» веде вже на №2
    pageIds.value = ['p-A', 'p-X', 'p-prep', 'p-B']
    await nextTick()                      // спостерігач сторінок — асинхронний
    vi.advanceTimersByTime(500)
    expect(lastState(sendMessage).assistant_reply).toMatchObject({ page_index: 2 })
  })

  it('підготовчої сторінки вже немає — без номера (кнопки «Показати» не буде)', () => {
    const { sendMessage } = setup()
    reply({ request_id: REQ, status: 'done', text: 'Готово', page_id: 'p-gone' })
    vi.advanceTimersByTime(500)
    expect(lastState(sendMessage).assistant_reply).toEqual({ request_id: REQ, status: 'done', text: 'Готово' })
  })

  it('довгий текст — у стелю сервера (інакше він відкине поле цілим)', () => {
    const { sendMessage } = setup()
    reply({ request_id: REQ, status: 'reply', text: 'я'.repeat(900) })
    vi.advanceTimersByTime(500)
    const text = String((lastState(sendMessage).assistant_reply as Record<string, unknown>).text)
    expect(text).toHaveLength(ASSISTANT_REPLY_TEXT_MAX)
  })

  it('відповідь для іншої дошки — ігнор', () => {
    const { sendMessage } = setup()
    reply({ request_id: REQ, status: 'reply', text: 'чуже' }, 'other-board')
    vi.advanceTimersByTime(500)
    expect(lastState(sendMessage).assistant_reply).toBeUndefined()
  })
})

describe('назви подій — ті самі, що слухає й шле палітра', () => {
  it('CommandPalette.vue використовує рівно ці рядки', () => {
    for (const name of [ASSISTANT_ASK_EVENT, ASSISTANT_ANSWER_EVENT, ASSISTANT_REPLY_EVENT]) {
      expect(commandPaletteSource).toContain(`'${name}'`)
    }
  })
})
