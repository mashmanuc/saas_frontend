/**
 * dashboardStore tests — BUG-3 regression guard
 *
 * Перевіряє що fetchStudentDashboard і fetchTutorDashboard
 * не блокують одна одну через спільний isLoading.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useDashboardStore } from '../dashboardStore'

vi.mock('../../api/dashboard', () => ({
  dashboardApi: {
    getStudentDashboard: vi.fn(),
    getTutorDashboard: vi.fn(),
    getStudentActiveLessons: vi.fn(),
    getStudentTeacher: vi.fn(),
    getTutorStats: vi.fn(),
  },
}))

const { dashboardApi } = await import('../../api/dashboard')

describe('dashboardStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('fetchStudentDashboard — завантажує дані студента', async () => {
    vi.mocked(dashboardApi.getStudentDashboard).mockResolvedValue({
      upcoming_lessons: [{ id: 1 }] as any,
      assigned_tutor: null,
      stats: { total_lessons: 5, upcoming_lessons: 1, total_hours: 5, this_month_lessons: 0 },
    })

    const store = useDashboardStore()
    await store.fetchStudentDashboard()

    expect(store.upcomingLessons).toHaveLength(1)
    expect(store.isLoadingStudent).toBe(false)
    expect(store.isLoading).toBe(false)
  })

  it('fetchTutorDashboard — завантажує дані тьютора', async () => {
    vi.mocked(dashboardApi.getTutorDashboard).mockResolvedValue({
      todays_lessons: [{ id: 2 }],
      pending_bookings_count: 3,
      week_lessons_count: 0,
      profile_status: 'active',
    } as any)

    const store = useDashboardStore()
    await store.fetchTutorDashboard()

    expect(store.todaysLessons).toHaveLength(1)
    expect(store.pendingBookingsCount).toBe(3)
    expect(store.isLoadingTutor).toBe(false)
    expect(store.isLoading).toBe(false)
  })

  // BUG-3 REGRESSION: student і tutor не блокують одна одну
  it('BUG-3: fetchStudentDashboard і fetchTutorDashboard виконуються незалежно', async () => {
    let resolveStudent!: (v: unknown) => void
    let resolveTutor!: (v: unknown) => void

    vi.mocked(dashboardApi.getStudentDashboard).mockReturnValue(
      new Promise((r) => { resolveStudent = r })
    )
    vi.mocked(dashboardApi.getTutorDashboard).mockReturnValue(
      new Promise((r) => { resolveTutor = r as any })
    )

    const store = useDashboardStore()

    // Запускаємо обидві паралельно
    const studentPromise = store.fetchStudentDashboard()
    const tutorPromise = store.fetchTutorDashboard()

    // Обидві повинні бути в стані завантаження одночасно
    expect(store.isLoadingStudent).toBe(true)
    expect(store.isLoadingTutor).toBe(true)
    expect(store.isLoading).toBe(true)

    resolveStudent({
      upcoming_lessons: [{ id: 1 }] as any,
      assigned_tutor: null,
      stats: { total_lessons: 2, upcoming_lessons: 1, total_hours: 2, this_month_lessons: 0 },
    })
    await studentPromise

    // Student завершився, tutor ще вантажиться
    expect(store.isLoadingStudent).toBe(false)
    expect(store.isLoadingTutor).toBe(true)
    expect(store.isLoading).toBe(true) // legacy computed ще true

    resolveTutor({ todays_lessons: [], pending_bookings_count: 0 })
    await tutorPromise

    expect(store.isLoadingStudent).toBe(false)
    expect(store.isLoadingTutor).toBe(false)
    expect(store.isLoading).toBe(false)
  })

  it('isLoading = computed OR з обох прапорів', () => {
    const store = useDashboardStore()
    expect(store.isLoading).toBe(false)
  })

  it('reset скидає стан', async () => {
    vi.mocked(dashboardApi.getTutorDashboard).mockResolvedValue({
      todays_lessons: [{ id: 1 }],
      pending_bookings_count: 5,
      week_lessons_count: 0,
      profile_status: 'active',
    } as any)
    const store = useDashboardStore()
    await store.fetchTutorDashboard()
    store.reset()

    expect(store.todaysLessons).toHaveLength(0)
    expect(store.pendingBookingsCount).toBe(0)
  })
})
