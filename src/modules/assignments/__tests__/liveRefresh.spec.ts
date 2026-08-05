/**
 * Жива доставка ДЗ (product intent 2026-07-22): списки ДЗ мовчки перезавантажуються
 * на WS-подію ASSIGNMENT_ASSIGNED/SUBMITTED/GRADED — той самий канал, що дзвіночок
 * (notifications_user_{id}, fan-out subscribe). Доказ, не припущення: мокаємо
 * websocketService.subscribeNotifications і симулюємо реальний BE-кадр.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'

vi.mock('@/services/websocket', () => ({
  websocketService: {
    subscribeNotifications: vi.fn(),
  },
}))

vi.mock('../api/assignmentsApi', () => ({
  assignmentsApi: {
    list: vi.fn(),
  },
}))

import { websocketService } from '@/services/websocket'
import { assignmentsApi } from '../api/assignmentsApi'
import MyAssignmentsView from '../views/MyAssignmentsView.vue'
import StudentAssignmentsView from '../views/StudentAssignmentsView.vue'
import { useAuthStore } from '@/modules/auth/store/authStore'
import { useRelationsStore } from '@/stores/relationsStore'

function makeRouter() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div/>' } },
      { path: '/assignments/student/:studentId', name: 'student-assignments', component: StudentAssignmentsView },
      { path: '/assignments/new', name: 'assignment-compose', component: { template: '<div/>' } },
      { path: '/assignments/:id', name: 'assignment-detail', component: { template: '<div/>' } },
    ],
  })
  return router
}

describe('MyAssignmentsView — жива доставка', () => {
  let capturedHandler: ((event: unknown) => void) | null = null
  const unsubSpy = vi.fn()

  beforeEach(() => {
    setActivePinia(createPinia())
    capturedHandler = null
    unsubSpy.mockClear()
    vi.mocked(assignmentsApi.list).mockReset()
    vi.mocked(websocketService.subscribeNotifications).mockImplementation((_id: number, handler: (e: unknown) => void) => {
      capturedHandler = handler
      return unsubSpy
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('підписується на канал користувача і перезавантажує список на ASSIGNMENT_ASSIGNED', async () => {
    vi.mocked(assignmentsApi.list)
      .mockResolvedValueOnce([{ id: 'a1', title: 'HW1', status: 'assigned' }])
      .mockResolvedValueOnce([
        { id: 'a1', title: 'HW1', status: 'assigned' },
        { id: 'a2', title: 'HW2', status: 'assigned' },
      ])

    const auth = useAuthStore()
    auth.user = { id: 77, role: 'student' }

    const router = makeRouter()
    router.push('/')
    await router.isReady()
    const w = mount(MyAssignmentsView, { global: { plugins: [router] } })
    await flushPromises()

    expect(w.text()).toContain('HW1')
    expect(w.text()).not.toContain('HW2')
    expect(websocketService.subscribeNotifications).toHaveBeenCalledWith(77, expect.any(Function))
    expect(capturedHandler).toBeTypeOf('function')

    // Реальний BE-кадр (той самий формат, що dispatcher_v2/gateway.py надсилає)
    capturedHandler!({
      type: 'ASSIGNMENT_ASSIGNED',
      payload: { id: 'notif-1', type: 'ASSIGNMENT_ASSIGNED', title: 'Нове ДЗ', data: { url: '/assignments/a2' } },
    })
    await flushPromises()

    expect(w.text()).toContain('HW2')
    w.unmount()
  })

  it('відписується на unmount (немає витоку підписки)', async () => {
    vi.mocked(assignmentsApi.list).mockResolvedValue([])
    const auth = useAuthStore()
    auth.user = { id: 77, role: 'student' }
    const router = makeRouter()
    router.push('/')
    await router.isReady()
    const w = mount(MyAssignmentsView, { global: { plugins: [router] } })
    await flushPromises()
    w.unmount()
    expect(unsubSpy).toHaveBeenCalledTimes(1)
  })

  it('НЕ перезавантажує на нерелевантну подію (напр. CHAT_MESSAGE)', async () => {
    vi.mocked(assignmentsApi.list).mockResolvedValue([{ id: 'a1', title: 'HW1', status: 'assigned' }])
    const auth = useAuthStore()
    auth.user = { id: 77, role: 'student' }
    const router = makeRouter()
    router.push('/')
    await router.isReady()
    const w = mount(MyAssignmentsView, { global: { plugins: [router] } })
    await flushPromises()
    const callsBefore = vi.mocked(assignmentsApi.list).mock.calls.length

    capturedHandler!({ type: 'CHAT_MESSAGE', payload: { id: 'x', type: 'CHAT_MESSAGE' } })
    await flushPromises()

    expect(vi.mocked(assignmentsApi.list).mock.calls.length).toBe(callsBefore)
    w.unmount()
  })
})

describe('StudentAssignmentsView — жива доставка + фільтр по учню', () => {
  let capturedHandler: ((event: unknown) => void) | null = null

  beforeEach(() => {
    setActivePinia(createPinia())
    capturedHandler = null
    vi.mocked(assignmentsApi.list).mockReset()
    vi.mocked(websocketService.subscribeNotifications).mockImplementation((_id: number, handler: (e: unknown) => void) => {
      capturedHandler = handler
      return vi.fn()
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('на ASSIGNMENT_SUBMITTED перезавантажує і лишає лише ДЗ цього учня', async () => {
    vi.mocked(assignmentsApi.list)
      .mockResolvedValueOnce([{ id: 'a1', title: 'HW-42', status: 'assigned', assignee_id: 42 }])
      .mockResolvedValueOnce([
        { id: 'a1', title: 'HW-42', status: 'submitted', assignee_id: 42 },
        { id: 'a2', title: 'HW-99-other-student', status: 'assigned', assignee_id: 99 },
      ])

    const auth = useAuthStore()
    auth.user = { id: 1, role: 'tutor' }
    const relations = useRelationsStore()
    relations.tutorRelations = [{ status: 'active', student: { id: 42, full_name: 'Test Student' } }]

    const router = makeRouter()
    router.push('/assignments/student/42')
    await router.isReady()
    const w = mount(StudentAssignmentsView, { global: { plugins: [router] } })
    await flushPromises()

    expect(w.text()).toContain('HW-42')

    capturedHandler!({ type: 'ASSIGNMENT_SUBMITTED', payload: { id: 'n1', type: 'ASSIGNMENT_SUBMITTED' } })
    await flushPromises()

    // FE-фільтр по assignee_id — інший учень (99) НЕ показується навіть після refetch.
    expect(w.text()).toContain('HW-42')
    expect(w.text()).not.toContain('HW-99-other-student')
    w.unmount()
  })
})
