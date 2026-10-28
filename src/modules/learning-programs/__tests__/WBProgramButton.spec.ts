// Програма поверх дошки: перегляд не виконує прихованих дій уроку.
import { defineComponent, h, ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import uk from '@/i18n/locales/uk.json'
import { useKeyboard } from '@/modules/winterboard/composables/useKeyboard'

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('@/utils/apiClient', () => ({ default: { get, post } }))
vi.mock('@/modules/auth/store/authStore', () => ({ useAuthStore: () => ({ user: { id: 40, role: 'tutor' } }) }))
vi.mock('vue-router', () => ({ useRouter: () => ({ resolve: () => ({ href: '/test' }) }) }))
vi.mock('../composables/useProgramsAvailability', () => ({
  useProgramsAvailability: () => ({ ensure: async () => true }),
}))
import WBProgramButton from '../components/WBProgramButton.vue'

let wrapper: ReturnType<typeof mount> | null = null
const options = () => ({ attachTo: document.body,
  global: { plugins: [createI18n({ legacy: false, locale: 'uk', messages: { uk } })], stubs: { transition: true } } })
beforeEach(() => {
  get.mockReset(); post.mockReset()
  get.mockImplementation((url: string) => Promise.resolve(url.includes('/for-board/') ? {
    board_learner: { id: 1, display_name: 'Учень А' }, programs: [{ id: 'p', title: 'План А', status: 'active' }],
  } : { id: 'p', title: 'План А', current_topic: 'Логарифми', plan: [],
    progress: { done_lessons: 0, planned_lessons: 1 }, next_steps: [], materials: [] }))
})
afterEach(() => { wrapper?.unmount(); wrapper = null; document.body.innerHTML = '' })

it('Ctrl+Z у програмі не змінює дошку; Escape повертає керування дошці', async () => {
  const undo = vi.fn()
  const Host = defineComponent({ setup() {
    const open = ref(false)
    useKeyboard({ onUndo: undo }, { disabled: () => open.value })
    return () => h(WBProgramButton, { boardId: 'board-a', onOpenChange: (value: boolean) => { open.value = value } })
  } })
  wrapper = mount(Host, options())
  await flushPromises()
  await wrapper.get('[data-testid=wb-program-button]').trigger('click'); await flushPromises()
  const dialog = document.querySelector('[data-testid=wb-program-modal]')!
  expect(dialog).not.toBeNull()
  dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', code: 'KeyZ', ctrlKey: true, bubbles: true }))
  expect(undo).not.toHaveBeenCalled()
  expect(post).not.toHaveBeenCalled()
  dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  await flushPromises()
  expect(document.querySelector('[data-testid=wb-program-modal]')).toBeNull()
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', code: 'KeyZ', ctrlKey: true, bubbles: true }))
  expect(undo).toHaveBeenCalledTimes(1)
})

it('на дошці без учня кнопки немає', async () => {
  get.mockRejectedValue({ response: { status: 404 } })
  wrapper = mount(WBProgramButton, { ...options(), props: { boardId: 'plain' } })
  await flushPromises()
  expect(wrapper.find('[data-testid=wb-program-button]').exists()).toBe(false)
  expect(post).not.toHaveBeenCalled()
})

it('зміна дошки закриває попередню програму й знімає бар’єр клавіш', async () => {
  wrapper = mount(WBProgramButton, { ...options(), props: { boardId: 'board-a' } })
  await flushPromises()
  await wrapper.get('[data-testid=wb-program-button]').trigger('click'); await flushPromises()
  expect(document.querySelector('[data-testid=wb-program-modal]')).not.toBeNull()
  get.mockRejectedValue({ response: { status: 404 } })
  await wrapper.setProps({ boardId: 'board-b' }); await flushPromises()
  expect(document.querySelector('[data-testid=wb-program-modal]')).toBeNull()
  expect(wrapper.find('[data-testid=wb-program-button]').exists()).toBe(false)
  expect(wrapper.emitted('open-change')?.slice(-1)[0]).toEqual([false])
})
