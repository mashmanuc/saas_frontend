// 8a-3 — поле кроку: два гейти, відсутність вердикту, порожнє не шлеться.
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import WBStepInput from '../components/copilot/WBStepInput.vue'
import winterboardApi from '../api/winterboardApi'

vi.mock('../api/winterboardApi', () => ({
  default: {
    copilotStatus: vi.fn().mockResolvedValue({ live: true }),
    copilotSteps: vi.fn().mockResolvedValue({ steps: [] }),
    copilotSubmitStep: vi.fn().mockResolvedValue({ accepted: true, step_no: 1 }),
  },
}))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (k: string) => k }) }))

const roleState = { isStudent: { value: true }, fetchRole: vi.fn().mockResolvedValue(undefined) }
vi.mock('../composables/useClassroomRole', () => ({
  useClassroomRole: () => roleState,
}))
vi.mock('../stores/opsSyncStore', () => ({
  useOpsSyncStore: () => ({ sessionId: 'sess-1' }),
}))
// MathQuill у jsdom не піднімається — підміняємо простим полем.
vi.mock('../components/shared/MathQuillField.vue', () => ({
  default: {
    name: 'MathQuillField',
    props: ['modelValue'],
    emits: ['update:modelValue', 'enter', 'unavailable'],
    template: '<input data-testid="mq" :value="modelValue" ' +
      '@input="$emit(\'update:modelValue\', $event.target.value)" ' +
      '@keyup.enter="$emit(\'enter\')" />',
  },
}))

describe('WBStepInput', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    roleState.isStudent.value = true
    ;(winterboardApi.copilotStatus as any).mockResolvedValue({ live: true })
    ;(winterboardApi.copilotSteps as any).mockResolvedValue({ steps: [] })
    ;(winterboardApi.copilotSubmitStep as any).mockResolvedValue({ accepted: true, step_no: 1 })
  })

  const mountIt = () => mount(WBStepInput, { props: { taskId: 'nmt-sc-1' } })

  it('не монтується при вимкненому Copilot', async () => {
    ;(winterboardApi.copilotStatus as any).mockResolvedValueOnce({ live: false })
    const w = mountIt()
    await flushPromises()
    expect(w.find('[data-testid="step-input"]').exists()).toBe(false)
  })

  it('не показується тьютору — навіть коли фіча увімкнена', async () => {
    roleState.isStudent.value = false
    const w = mountIt()
    await flushPromises()
    expect(w.find('[data-testid="step-input"]').exists()).toBe(false)
  })

  it('показується учню при live=true', async () => {
    const w = mountIt()
    await flushPromises()
    expect(w.find('[data-testid="step-input"]').exists()).toBe(true)
  })

  it('порожній крок не шлеться', async () => {
    const w = mountIt()
    await flushPromises()
    await w.find('[data-testid="step-submit"]').trigger('click')
    expect(winterboardApi.copilotSubmitStep).not.toHaveBeenCalled()
  })

  it('Enter записує крок', async () => {
    const w = mountIt()
    await flushPromises()
    await w.find('[data-testid="step-field-mq"]').setValue('2*x=8')
    await w.find('[data-testid="step-field-mq"]').trigger('keyup.enter')
    await flushPromises()
    expect(winterboardApi.copilotSubmitStep).toHaveBeenCalledWith('sess-1', 'nmt-sc-1', '2*x=8')
  })

  it('після запису показує «записано», а не вердикт', async () => {
    const w = mountIt()
    await flushPromises()
    await w.find('[data-testid="step-field-mq"]').setValue('2*x=8')
    await w.find('[data-testid="step-submit"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="step-saved"]').exists()).toBe(true)
    const html = w.html()
    for (const leak of ['broken', 'unverified', 'помилк', 'правильн']) {
      expect(html.toLowerCase()).not.toContain(leak)
    }
  })

  it('записані кроки видно списком, без вердиктів', async () => {
    ;(winterboardApi.copilotSteps as any).mockResolvedValueOnce({
      steps: [
        { step_no: 1, src: '2*x+6=14', task_id: 'nmt-sc-1', ts: 1 },
        { step_no: 2, src: '2*x=8', task_id: 'nmt-sc-1', ts: 2 },
      ],
    })
    const w = mountIt()
    await flushPromises()
    const list = w.find('[data-testid="step-list"]')
    expect(list.exists()).toBe(true)
    expect(list.findAll('li')).toHaveLength(2)
    expect(list.text()).toContain('2*x=8')
    expect(list.text()).not.toContain('ok')
  })

  it('збій запису не ковтається мовчки', async () => {
    ;(winterboardApi.copilotSubmitStep as any).mockRejectedValueOnce(new Error('500'))
    const w = mountIt()
    await flushPromises()
    await w.find('[data-testid="step-field-mq"]').setValue('2*x=8')
    await w.find('[data-testid="step-submit"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="step-failed"]').exists()).toBe(true)
  })
})
