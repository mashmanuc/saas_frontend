// 8a-2 — панель шепотів: видимість, порожній стан, 👎 зі scope.
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import WBCopilotPanel from '../components/copilot/WBCopilotPanel.vue'
import winterboardApi from '../api/winterboardApi'

vi.mock('../api/winterboardApi', () => ({
  default: {
    copilotStatus: vi.fn().mockResolvedValue({ live: true }),
    copilotEvaluate: vi.fn().mockResolvedValue({ decision: null }),
    copilotOverride: vi.fn().mockResolvedValue({}),
    copilotDecisions: vi.fn().mockResolvedValue({ decisions: [] }),
  },
}))

const t = (k: string) => k
const STUDENTS = [
  { user_id: '42', display_name: 'Оля' },
  { user_id: '43', display_name: 'Петро' },
]

function makePanel(students = [STUDENTS[0]]) {
  return mount(WBCopilotPanel, {
    props: { sessionId: 'sess-1', students },
    global: { mocks: { $t: t }, stubs: { transition: false } },
  })
}

// vue-i18n у компоненті — через useI18n; підміняємо на просту функцію.
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (k: string) => k }) }))

function whisper(over: Record<string, unknown> = {}) {
  return {
    decision_id: 'd1',
    student_id: '42',
    action: 'REMEDIATE',
    task_label: '«№3»',
    whisper: '3 помилки поспіль — варто розібрати разом',
    reason: 'wrong_streak',
    ts: Date.now(),
    ...over,
  }
}

describe('WBCopilotPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    ;(winterboardApi.copilotStatus as any).mockResolvedValue({ live: true })
  })

  it('не монтується, поки прапорець вимкнено — жодного «сірого» UI', async () => {
    ;(winterboardApi.copilotStatus as any).mockResolvedValueOnce({ live: false })
    const w = makePanel()
    await flushPromises()
    expect(w.find('[data-testid="copilot-panel"]').exists()).toBe(false)
  })

  it('показує вимикач, коли прапорець увімкнено', async () => {
    const w = makePanel()
    await flushPromises()
    expect(w.find('[data-testid="copilot-panel"]').exists()).toBe(true)
    expect(w.find('[data-testid="copilot-toggle"]').exists()).toBe(true)
  })

  it('вимкнений copilot не показує ні стрічки, ні індикатора', async () => {
    const w = makePanel()
    await flushPromises()
    expect(w.find('[data-testid="copilot-indicator"]').exists()).toBe(false)
    expect(w.find('[data-testid="copilot-empty"]').exists()).toBe(false)
  })

  it('увімкнений показує індикатор і порожній стан', async () => {
    const w = makePanel()
    await flushPromises()
    await w.find('[data-testid="copilot-toggle"]').setValue(true)
    await flushPromises()
    expect(w.find('[data-testid="copilot-indicator"]').exists()).toBe(true)
    expect(w.find('[data-testid="copilot-empty"]').exists()).toBe(true)
  })

  it('вибір учня зʼявляється лише коли їх більше одного', async () => {
    const one = makePanel()
    await flushPromises()
    await one.find('[data-testid="copilot-toggle"]').setValue(true)
    await flushPromises()
    expect(one.find('[data-testid="copilot-student"]').exists()).toBe(false)

    const many = makePanel(STUDENTS)
    await flushPromises()
    await many.find('[data-testid="copilot-toggle"]').setValue(true)
    await flushPromises()
    expect(many.find('[data-testid="copilot-student"]').exists()).toBe(true)
  })

  it('шепіт зі стрічки показує текст і дію', async () => {
    const w = makePanel()
    await flushPromises()
    await w.find('[data-testid="copilot-toggle"]').setValue(true)
    await flushPromises()
    window.dispatchEvent(new CustomEvent('wb:copilot-whisper', { detail: whisper() }))
    await flushPromises()
    const item = w.find('[data-testid="copilot-whisper"]')
    expect(item.exists()).toBe(true)
    expect(item.text()).toContain('3 помилки поспіль')
    expect(item.text()).toContain('«№3»')
  })

  it('👎 відкриває вибір scope і шле обраний', async () => {
    const w = makePanel()
    await flushPromises()
    await w.find('[data-testid="copilot-toggle"]').setValue(true)
    await flushPromises()
    window.dispatchEvent(new CustomEvent('wb:copilot-whisper', { detail: whisper() }))
    await flushPromises()

    expect(w.find('[data-testid="copilot-scope"]').exists()).toBe(false)
    await w.find('[data-testid="copilot-reject"]').trigger('click')
    const scope = w.find('[data-testid="copilot-scope"]')
    expect(scope.exists()).toBe(true)

    await scope.find('[data-scope="session"]').trigger('click')
    await flushPromises()
    expect(winterboardApi.copilotOverride).toHaveBeenCalledWith('d1', 'reject', 'session')
  })

  it('після відповіді кнопки зникають, лишається вердикт', async () => {
    const w = makePanel()
    await flushPromises()
    await w.find('[data-testid="copilot-toggle"]').setValue(true)
    await flushPromises()
    window.dispatchEvent(new CustomEvent('wb:copilot-whisper', { detail: whisper() }))
    await flushPromises()
    await w.find('[data-testid="copilot-accept"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="copilot-accept"]').exists()).toBe(false)
    expect(w.find('[data-testid="copilot-verdict"]').exists()).toBe(true)
  })

  it('панель не показує сирих лічильників стану учня', async () => {
    const w = makePanel()
    await flushPromises()
    await w.find('[data-testid="copilot-toggle"]').setValue(true)
    await flushPromises()
    window.dispatchEvent(
      new CustomEvent('wb:copilot-whisper', {
        detail: whisper({ inputs: { consecutive_wrong: 3 } } as any),
      }),
    )
    await flushPromises()
    expect(w.text()).not.toContain('consecutive_wrong')
  })
})
