// 8a-2 — composable стрічки шепотів.
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import winterboardApi from '../api/winterboardApi'
import { IDLE_POLL_SEC, useCopilotWhispers } from '../composables/useCopilotWhispers'

vi.mock('../api/winterboardApi', () => ({
  default: {
    copilotStatus: vi.fn().mockResolvedValue({ live: true }),
    copilotEvaluate: vi.fn().mockResolvedValue({ decision: null }),
    copilotOverride: vi.fn().mockResolvedValue({}),
    copilotDecisions: vi.fn().mockResolvedValue({ decisions: [] }),
  },
}))

const SID = 'sess-1'

function whisper(over: Record<string, unknown> = {}) {
  return {
    decision_id: 'd1',
    student_id: '42',
    action: 'REMEDIATE',
    task_id: 'inline-a',
    task_label: '«№3»',
    whisper: '3 помилки поспіль',
    reason: 'wrong_streak',
    ts: 1_755_500_000_000,
    ...over,
  }
}

/** Composable потребує живого компонента: він вішає слухачі в onMounted. */
function useIn(fn: () => unknown) {
  let api: any
  const Host = defineComponent({
    setup() {
      api = fn()
      return () => h('div')
    },
  })
  const wrapper = mount(Host)
  return { api, wrapper }
}

describe('useCopilotWhispers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('додає шепіт із WS-події, нові згори', async () => {
    const { api } = useIn(() => useCopilotWhispers(SID))
    api.setStudent('42')
    window.dispatchEvent(new CustomEvent('wb:copilot-whisper', { detail: whisper() }))
    window.dispatchEvent(
      new CustomEvent('wb:copilot-whisper', { detail: whisper({ decision_id: 'd2' }) }),
    )
    await flushPromises()
    expect(api.whispers.value.map((w: any) => w.decision_id)).toEqual(['d2', 'd1'])
  })

  it('не дублює той самий decision_id (WS + REST)', async () => {
    const { api } = useIn(() => useCopilotWhispers(SID))
    api.setStudent('42')
    window.dispatchEvent(new CustomEvent('wb:copilot-whisper', { detail: whisper() }))
    ;(winterboardApi.copilotEvaluate as any).mockResolvedValueOnce({ decision: whisper() })
    api.setEnabled(true)
    await api.evaluate('manual')
    await flushPromises()
    expect(api.whispers.value).toHaveLength(1)
  })

  it('ігнорує шепіт про іншого учня', async () => {
    const { api } = useIn(() => useCopilotWhispers(SID))
    api.setStudent('42')
    window.dispatchEvent(
      new CustomEvent('wb:copilot-whisper', { detail: whisper({ student_id: '99' }) }),
    )
    await flushPromises()
    expect(api.whispers.value).toHaveLength(0)
  })

  it('👎 шле REST зі scope і позначає рішення відповіденим', async () => {
    const { api } = useIn(() => useCopilotWhispers(SID))
    api.setStudent('42')
    window.dispatchEvent(new CustomEvent('wb:copilot-whisper', { detail: whisper() }))
    await flushPromises()
    await api.reject('d1', 'session')
    expect(winterboardApi.copilotOverride).toHaveBeenCalledWith('d1', 'reject', 'session')
    expect(api.whispers.value[0].verdict).toBe('reject')
  })

  it('👍 має scope=decision — згода не глушить майбутні поради', async () => {
    const { api } = useIn(() => useCopilotWhispers(SID))
    api.setStudent('42')
    window.dispatchEvent(new CustomEvent('wb:copilot-whisper', { detail: whisper() }))
    await flushPromises()
    await api.accept('d1')
    expect(winterboardApi.copilotOverride).toHaveBeenCalledWith('d1', 'accept', 'decision')
  })

  it('idle-таймер мовчить, поки учень активний', async () => {
    const { api } = useIn(() => useCopilotWhispers(SID))
    api.setStudent('42')
    api.setEnabled(true)
    api.__tick()
    await flushPromises()
    expect(winterboardApi.copilotEvaluate).not.toHaveBeenCalled()
  })

  it('idle-таймер питає раз, а не на кожен тік', async () => {
    const { api } = useIn(() => useCopilotWhispers(SID))
    api.setStudent('42')
    api.setEnabled(true)
    api.lastStudentActivityTs.value = Date.now() - (IDLE_POLL_SEC + 5) * 1000
    api.__tick()
    api.__tick()
    api.__tick()
    await flushPromises()
    expect(winterboardApi.copilotEvaluate).toHaveBeenCalledTimes(1)
    expect(winterboardApi.copilotEvaluate).toHaveBeenCalledWith(SID, '42', 'idle')
  })

  it('вимкнений copilot не питає сервер', async () => {
    const { api } = useIn(() => useCopilotWhispers(SID))
    api.setStudent('42')
    api.lastStudentActivityTs.value = Date.now() - (IDLE_POLL_SEC + 5) * 1000
    api.__tick()
    await flushPromises()
    expect(winterboardApi.copilotEvaluate).not.toHaveBeenCalled()
  })

  it('активність учня скидає лічильник простою', async () => {
    const { api } = useIn(() => useCopilotWhispers(SID))
    api.setStudent('42')
    api.setEnabled(true)
    api.lastStudentActivityTs.value = Date.now() - (IDLE_POLL_SEC + 5) * 1000
    window.dispatchEvent(new CustomEvent('wb:test-answer', { detail: {} }))
    api.__tick()
    await flushPromises()
    expect(winterboardApi.copilotEvaluate).not.toHaveBeenCalled()
  })

  it('зміна учня очищає стрічку', async () => {
    const { api } = useIn(() => useCopilotWhispers(SID))
    api.setStudent('42')
    window.dispatchEvent(new CustomEvent('wb:copilot-whisper', { detail: whisper() }))
    await flushPromises()
    api.setStudent('43')
    expect(api.whispers.value).toHaveLength(0)
  })

  it('вмикання підтягує історію (переживає F5)', async () => {
    ;(winterboardApi.copilotDecisions as any).mockResolvedValueOnce({
      decisions: [whisper({ decision_id: 'old', verdict: 'accept' })],
    })
    const { api } = useIn(() => useCopilotWhispers(SID))
    api.setStudent('42')
    api.setEnabled(true)
    await flushPromises()
    expect(api.whispers.value[0].decision_id).toBe('old')
    expect(api.pending.value).toHaveLength(0)
  })
})
