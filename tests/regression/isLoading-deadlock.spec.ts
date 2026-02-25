/**
 * isLoading Deadlock Detection — regression test suite
 *
 * Виявляє патерн де store-функція встановлює isLoading=true,
 * потім викликає іншу функцію того ж store, яка заблокована
 * тим самим isLoading прапором (deadlock).
 *
 * Покриває: inquiriesStore, negotiationChatStore, dashboardStore
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { flushPromises } from '@vue/test-utils'

// ─── inquiriesStore ─────────────────────────────────────────────────────────

vi.mock('@/api/inquiries', () => ({
  createInquiry: vi.fn(),
  fetchInquiries: vi.fn(),
  cancelInquiry: vi.fn(),
  acceptInquiry: vi.fn(),
  rejectInquiry: vi.fn(),
}))

describe('isLoading deadlock — inquiriesStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('REGRESSION BUG-1: cancelInquiry → refetch → fetchInquiries виконується (не заблокований isLoading)', async () => {
    const { fetchInquiries: apiFetch, cancelInquiry: apiCancel } = await import('@/api/inquiries')
    const { useInquiriesStore } = await import('@/stores/inquiriesStore')

    const mockInquiry = { id: 'inq-1', status: 'CANCELLED', tutor_id: 1, student_id: 2 } as any
    vi.mocked(apiCancel).mockResolvedValue({ inquiry: mockInquiry } as any)
    vi.mocked(apiFetch).mockResolvedValue([mockInquiry])

    const store = useInquiriesStore()
    await store.cancelInquiry('inq-1')
    await flushPromises()

    // fetchInquiries МАЄ бути викликана через refetch після cancelInquiry
    expect(vi.mocked(apiFetch)).toHaveBeenCalled()
    // Store items мають оновитись
    expect(store.items).toEqual([mockInquiry])
  })

  it('REGRESSION BUG-1: acceptInquiry → refetch → fetchInquiries виконується', async () => {
    const { fetchInquiries: apiFetch, acceptInquiry: apiAccept } = await import('@/api/inquiries')
    const { useInquiriesStore } = await import('@/stores/inquiriesStore')

    const mockResponse = {
      inquiry: { id: 'inq-2', status: 'ACCEPTED', tutor_id: 1, student_id: 2 },
      contacts: null,
      relation: null,
      thread_id: null,
      was_already_unlocked: false,
      message: '',
    } as any
    vi.mocked(apiAccept).mockResolvedValue(mockResponse)
    vi.mocked(apiFetch).mockResolvedValue([mockResponse.inquiry])

    const store = useInquiriesStore()
    await store.acceptInquiry('inq-2')
    await flushPromises()

    expect(vi.mocked(apiFetch)).toHaveBeenCalled()
  })

  it('паралельні fetchInquiries — другий виклик не зупиняє перший', async () => {
    const { fetchInquiries: apiFetch } = await import('@/api/inquiries')
    const { useInquiriesStore } = await import('@/stores/inquiriesStore')

    let resolve1!: (v: any) => void
    let resolve2!: (v: any) => void
    vi.mocked(apiFetch)
      .mockReturnValueOnce(new Promise((r) => { resolve1 = r }))
      .mockReturnValueOnce(new Promise((r) => { resolve2 = r }))

    const store = useInquiriesStore()

    const p1 = store.fetchInquiries()
    const p2 = store.fetchInquiries()

    resolve1([{ id: 'a' }])
    resolve2([{ id: 'b' }])

    await p1
    await p2

    // Обидва виклики мають завершитись — isLoading має бути false
    expect(store.isLoading).toBe(false)
  })
})

// ─── negotiationChatStore ────────────────────────────────────────────────────

vi.mock('@/api/negotiationChat', () => ({
  ensureNegotiationThread: vi.fn(),
  fetchThreads: vi.fn(),
  fetchMessagesLegacy: vi.fn(),
  sendMessage: vi.fn(),
}))

describe('isLoading deadlock — negotiationChatStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('REGRESSION BUG-2: ensureThread не блокує паралельний fetchThreads', async () => {
    const {
      ensureNegotiationThread,
      fetchThreads: apiFetchThreads,
    } = await import('@/api/negotiationChat')
    const { useNegotiationChatStore } = await import('@/stores/negotiationChatStore')

    let resolveEnsure!: (v: any) => void
    vi.mocked(ensureNegotiationThread).mockReturnValue(
      new Promise((r) => { resolveEnsure = r })
    )
    vi.mocked(apiFetchThreads).mockResolvedValue([{ id: 'thread-1' } as any])

    const store = useNegotiationChatStore()

    // Запускаємо ensureThread (він ставить isLoadingEnsure=true, НЕ isLoadingThreads)
    const ensurePromise = store.ensureThread('inq-1')

    // isLoadingEnsure=true, але isLoadingThreads=false
    expect(store.isLoadingEnsure).toBe(true)
    expect(store.isLoadingThreads).toBe(false)

    // fetchThreads ПОВИНЕН виконатись — isLoadingThreads ще false
    const fetchPromise = store.fetchThreads()
    await fetchPromise

    // fetchThreads завершився успішно
    expect(vi.mocked(apiFetchThreads)).toHaveBeenCalled()
    expect(store.threads).toHaveLength(1)
    expect(store.isLoadingThreads).toBe(false)

    // ensureThread ще висить
    expect(store.isLoadingEnsure).toBe(true)

    // Завершуємо ensureThread
    resolveEnsure({ id: 'thread-2', inquiry_id: 'inq-1' } as any)
    await ensurePromise

    expect(store.isLoadingEnsure).toBe(false)
    expect(store.isLoading).toBe(false)
  })

  it('REGRESSION BUG-2: fetchMessages і fetchThreads мають незалежні isLoading прапори', async () => {
    const {
      fetchThreads: apiFetchThreads,
      fetchMessagesLegacy: apiFetchMessages,
    } = await import('@/api/negotiationChat')
    const { useNegotiationChatStore } = await import('@/stores/negotiationChatStore')

    let resolveMessages!: (v: any) => void
    vi.mocked(apiFetchThreads).mockResolvedValue([{ id: 't1' } as any])
    vi.mocked(apiFetchMessages).mockReturnValue(
      new Promise((r) => { resolveMessages = r })
    )

    const store = useNegotiationChatStore()

    // fetchMessages висить
    const msgPromise = store.fetchMessages('t1')

    // threads мають бути isLoadingMessages=true, але fetchThreads незалежний
    expect(store.isLoadingMessages).toBe(true)
    expect(store.isLoadingThreads).toBe(false)

    // fetchThreads виконується незалежно
    await store.fetchThreads()
    expect(store.threads).toHaveLength(1)

    // Завершуємо messages
    resolveMessages({ messages: [{ id: 'm1' }], cursor: null, hasMore: false })
    await msgPromise

    expect(store.isLoadingMessages).toBe(false)
  })
})

// ─── dashboardStore ──────────────────────────────────────────────────────────

vi.mock('@/modules/dashboard/api/dashboard', () => ({
  dashboardApi: {
    getStudentDashboard: vi.fn(),
    getTutorDashboard: vi.fn(),
    getStudentActiveLessons: vi.fn(),
    getStudentTeacher: vi.fn(),
    getTutorStats: vi.fn(),
  },
}))

describe('isLoading deadlock — dashboardStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('REGRESSION BUG-3: fetchStudentDashboard не блокує fetchTutorDashboard', async () => {
    const { dashboardApi } = await import('@/modules/dashboard/api/dashboard')
    const { useDashboardStore } = await import('@/modules/dashboard/store/dashboardStore')

    let resolveStudent!: (v: any) => void
    vi.mocked(dashboardApi.getStudentDashboard).mockReturnValue(
      new Promise((r) => { resolveStudent = r })
    )
    vi.mocked(dashboardApi.getTutorDashboard).mockResolvedValue({
      todays_lessons: [{ id: 99 }],
      pending_bookings_count: 2,
      week_lessons_count: 0,
      profile_status: 'active',
    } as any)

    const store = useDashboardStore()

    // Student висить
    const studentPromise = store.fetchStudentDashboard()
    expect(store.isLoadingStudent).toBe(true)

    // Tutor повинен виконатись незалежно
    await store.fetchTutorDashboard()
    expect(store.todaysLessons).toHaveLength(1)
    expect(store.isLoadingTutor).toBe(false)

    // Student ще вантажиться
    expect(store.isLoadingStudent).toBe(true)
    expect(store.isLoading).toBe(true) // computed — ще true

    resolveStudent({
      upcoming_lessons: [],
      assigned_tutor: null,
      stats: { total_lessons: 0, upcoming_lessons: 0, total_hours: 0, this_month_lessons: 0 },
    })
    await studentPromise

    expect(store.isLoadingStudent).toBe(false)
    expect(store.isLoading).toBe(false)
  })
})
