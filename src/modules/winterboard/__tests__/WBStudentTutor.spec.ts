// 8b-2 — панель учня: два гейти (прапорець tutor + роль), поведінка чату.
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import WBStudentTutor from '../components/copilot/WBStudentTutor.vue'
import winterboardApi from '../api/winterboardApi'
import { resetTutorGate } from '../composables/useStudentTutor'

vi.mock('../api/winterboardApi', () => ({
  default: {
    copilotStatus: vi.fn().mockResolvedValue({ live: false, tutor: true }),
    copilotReply: vi.fn().mockResolvedValue({ reply: 'Крок далі?', stage: 1, action: 'HINT' }),
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

const mic = {
  supported: true,
  listening: { value: false },
  toggle: vi.fn(),
  reset: vi.fn(),
}
vi.mock('../../../composables/useVoiceDictation', () => ({
  useVoiceDictation: () => mic,
}))

describe('WBStudentTutor', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    resetTutorGate()
    roleState.isStudent.value = true
    ;(winterboardApi.copilotStatus as any).mockResolvedValue({ live: false, tutor: true })
    ;(winterboardApi.copilotReply as any)
      .mockResolvedValue({ reply: 'Крок далі?', stage: 1, action: 'HINT' })
  })

  const mountIt = () => mount(WBStudentTutor)

  it('не монтується при tutor=false — навіть якщо live=true', async () => {
    ;(winterboardApi.copilotStatus as any)
      .mockResolvedValueOnce({ live: true, tutor: false })
    const w = mountIt()
    await flushPromises()
    expect(w.find('[data-testid="student-tutor"]').exists()).toBe(false)
  })

  it('не показується тьютору', async () => {
    roleState.isStudent.value = false
    const w = mountIt()
    await flushPromises()
    expect(w.find('[data-testid="student-tutor"]').exists()).toBe(false)
  })

  it('показується учню при tutor=true', async () => {
    const w = mountIt()
    await flushPromises()
    expect(w.find('[data-testid="student-tutor"]').exists()).toBe(true)
  })

  it('надсилання: обидві репліки в лозі, поле очищено', async () => {
    const w = mountIt()
    await flushPromises()
    await w.find('[data-testid="tutor-field"]').setValue('не виходить 2x')
    await w.find('[data-testid="tutor-send"]').trigger('click')
    await flushPromises()
    const log = w.find('[data-testid="tutor-log"]').text()
    expect(log).toContain('не виходить 2x')
    expect(log).toContain('Крок далі?')
    expect((w.find('[data-testid="tutor-field"]').element as HTMLInputElement).value).toBe('')
  })

  it('порожнє: кнопка disabled, нічого не шлеться', async () => {
    const w = mountIt()
    await flushPromises()
    expect(w.find('[data-testid="tutor-send"]').attributes('disabled')).toBeDefined()
    await w.find('[data-testid="tutor-send"]').trigger('click')
    expect(winterboardApi.copilotReply).not.toHaveBeenCalled()
  })

  it('«не зрозумів» шле фіксовану фразу (i18n-ключ)', async () => {
    const w = mountIt()
    await flushPromises()
    await w.find('[data-testid="tutor-unclear"]').trigger('click')
    await flushPromises()
    expect(winterboardApi.copilotReply)
      .toHaveBeenCalledWith('sess-1', 'winterboard.copilot.tutor.unclearPhrase')
  })

  it('429 → показує throttled-нотатку, панель живе далі', async () => {
    ;(winterboardApi.copilotReply as any)
      .mockRejectedValueOnce({ response: { status: 429 } })
    const w = mountIt()
    await flushPromises()
    await w.find('[data-testid="tutor-field"]').setValue('а')
    await w.find('[data-testid="tutor-send"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="tutor-throttled"]').exists()).toBe(true)
    expect(w.find('[data-testid="student-tutor"]').exists()).toBe(true)
  })

  it('403 посеред уроку → панель зникає, не «сіріє»', async () => {
    ;(winterboardApi.copilotReply as any)
      .mockRejectedValueOnce({ response: { status: 403 } })
    const w = mountIt()
    await flushPromises()
    await w.find('[data-testid="tutor-field"]').setValue('а')
    await w.find('[data-testid="tutor-send"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="student-tutor"]').exists()).toBe(false)
  })

  it('мікрофон: видно при supported, клік делегує в композабл', async () => {
    const w = mountIt()
    await flushPromises()
    const btn = w.find('[data-testid="tutor-mic"]')
    expect(btn.exists()).toBe(true)
    await btn.trigger('click')
    expect(mic.toggle).toHaveBeenCalledTimes(1)
  })

  it('успішний send скидає базу диктовки (reset)', async () => {
    const w = mountIt()
    await flushPromises()
    await w.find('[data-testid="tutor-field"]').setValue('2x+6=20')
    await w.find('[data-testid="tutor-send"]').trigger('click')
    await flushPromises()
    expect(mic.reset).toHaveBeenCalledTimes(1)
  })

  it('«видалити мою історію» чистить лог', async () => {
    const w = mountIt()
    await flushPromises()
    await w.find('[data-testid="tutor-field"]').setValue('x=1')
    await w.find('[data-testid="tutor-send"]').trigger('click')
    await flushPromises()
    await w.find('[data-testid="tutor-clear"]').trigger('click')
    const log = w.find('[data-testid="tutor-log"]').text()
    expect(log).not.toContain('x=1')
    expect(log).toContain('winterboard.copilot.tutor.empty')
  })
})
