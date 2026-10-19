/**
 * «Запрошення на урок» без учнів — не глухий кут (прохід «очима вчителя 60 років», 19.10, №32).
 *
 * Було: «У вас ще немає активних учнів», «Розпочати урок» не натискається — і все.
 * Стало: «Додати учня» — та сама дія, що «Створити запрошення» на сторінці «Учні»
 * (useInviteCreate → POST /tutor/invites/create/), посилання й «Скопіювати посилання» тут же.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

const listOrders = vi.fn()
const createInvite = vi.fn()

vi.mock('@/modules/booking/api/ordersApi', () => ({ ordersApi: { listOrders: () => listOrders() } }))
vi.mock('@/api/invites', () => ({ invitesApi: { createInvite: () => createInvite() } }))
vi.mock('@/composables/useToast', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

import WBInviteStudentModal from '../components/classroom/WBInviteStudentModal.vue'

async function open() {
  const w = mount(WBInviteStudentModal, {
    props: { visible: false, sessionId: 'board-1' },
    global: { stubs: { Teleport: true } },
  })
  await w.setProps({ visible: true })
  await flushPromises()
  return w
}

describe('«Запрошення на урок» без учнів', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    listOrders.mockReset()
    createInvite.mockReset()
  })

  it('замість мертвого «Розпочати урок» — «Додати учня»; назви уроку й «Оберіть учня» немає', async () => {
    listOrders.mockResolvedValue({ results: [] })
    const w = await open()
    expect(w.find('[data-testid="wb-invite-no-students"]').text()).toContain('winterboard.startClassroom.noStudents')
    expect(w.find('[data-testid="wb-invite-add-student"]').text()).toBe('winterboard.startClassroom.addStudent')
    expect(w.text()).not.toContain('winterboard.startClassroom.confirm')
    expect(w.text()).not.toContain('winterboard.startClassroom.lessonName')
    expect(w.find('.wb-invite-modal__label').exists()).toBe(false)
  })

  it('«Додати учня» створює запрошення й показує посилання тут же', async () => {
    listOrders.mockResolvedValue({ results: [] })
    createInvite.mockResolvedValue({ invite_url: 'https://m4sh.org/invite/abc', expires_at: '2026-10-26T00:00:00Z' })
    const w = await open()
    await w.find('[data-testid="wb-invite-add-student"]').trigger('click')
    await flushPromises()
    expect(createInvite).toHaveBeenCalledTimes(1)
    const input = w.find('[data-testid="wb-invite-link"] input')
    expect((input.element as HTMLInputElement).value).toBe('https://m4sh.org/invite/abc')
    expect(w.find('[data-testid="wb-invite-copy"]').text()).toBe('invites.shareCopy')
    expect(w.text()).toContain('winterboard.startClassroom.afterInvite')
    expect(w.find('[data-testid="wb-invite-add-student"]').exists()).toBe(false)
  })

  it('учні є — вікно як було: вибір учня й «Розпочати урок», без «Додати учня»', async () => {
    listOrders.mockResolvedValue({ results: [{ student: { id: 7, fullName: 'Оля', firstName: 'Оля', lastName: '', email: '' } }] })
    const w = await open()
    expect(w.find('select').exists()).toBe(true)
    expect(w.text()).toContain('winterboard.startClassroom.confirm')
    expect(w.find('[data-testid="wb-invite-add-student"]').exists()).toBe(false)
  })
})
