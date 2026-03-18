import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock stores before importing the composable
vi.mock('@/modules/dashboard/store/dashboardStore', () => ({
  useDashboardStore: vi.fn(() => ({
    todaysLessons: [{ id: 1 }, { id: 2 }],
    upcomingLessons: [{ id: 1 }],
    activeTutors: [{ id: 1 }],
    isLoadingTutor: false,
  })),
}))

vi.mock('@/stores/relationsStore', () => ({
  useRelationsStore: vi.fn(() => ({
    tutorRelations: [
      { status: 'active', student: { id: 1 } },
      { status: 'active', student: { id: 2 } },
      { status: 'invited', student: { id: 3 } },
    ],
  })),
}))

vi.mock('@/stores/chatThreadsStore', () => ({
  useChatThreadsStore: vi.fn(() => ({
    totalUnread: 5,
  })),
}))

import { useDashboardStats } from '@/modules/dashboard/composables/useDashboardStats'

describe('useDashboardStats', () => {
  it('returns 4 stats for tutor', () => {
    const { stats } = useDashboardStats('tutor')
    expect(stats.value).toHaveLength(4)
  })

  it('tutor: lessonsToday shows correct count', () => {
    const { stats } = useDashboardStats('tutor')
    const lessons = stats.value.find(s => s.key === 'lessonsToday')
    expect(lessons?.value).toBe(2)
  })

  it('tutor: activeStudents counts active relations', () => {
    const { stats } = useDashboardStats('tutor')
    const students = stats.value.find(s => s.key === 'activeStudents')
    expect(students?.value).toBe(2)
  })

  it('tutor: pendingInquiries counts invited relations', () => {
    const { stats } = useDashboardStats('tutor')
    const inquiries = stats.value.find(s => s.key === 'pendingInquiries')
    expect(inquiries?.value).toBe(1)
  })

  it('tutor: balance stat exists with placeholder value', () => {
    const { stats } = useDashboardStats('tutor')
    const balance = stats.value.find(s => s.key === 'balance')
    expect(balance).toBeTruthy()
    expect(balance?.label).toBe('dashboard.stats.balance')
  })

  it('returns 3 stats for student', () => {
    const { stats } = useDashboardStats('student')
    expect(stats.value).toHaveLength(3)
  })

  it('student: upcomingLessons shows correct count', () => {
    const { stats } = useDashboardStats('student')
    const upcoming = stats.value.find(s => s.key === 'upcomingLessons')
    expect(upcoming?.value).toBe(1)
  })

  it('student: activeTutors shows correct count', () => {
    const { stats } = useDashboardStats('student')
    const tutors = stats.value.find(s => s.key === 'activeTutors')
    expect(tutors?.value).toBe(1)
  })

  it('student: unreadMessages shows correct count', () => {
    const { stats } = useDashboardStats('student')
    const unread = stats.value.find(s => s.key === 'unreadMessages')
    expect(unread?.value).toBe(5)
  })

  it('every stat has required fields', () => {
    for (const role of ['tutor', 'student'] as const) {
      const { stats } = useDashboardStats(role)
      for (const stat of stats.value) {
        expect(stat).toHaveProperty('key')
        expect(stat).toHaveProperty('icon')
        expect(stat).toHaveProperty('label')
        expect(stat).toHaveProperty('value')
        // label must be i18n key
        expect(stat.label).toMatch(/^dashboard\.stats\./)
        // icon must be kebab-case
        expect(stat.icon).toMatch(/^[a-z][a-z0-9-]*$/)
      }
    }
  })

  it('tutor stats have correct navigation links', () => {
    const { stats } = useDashboardStats('tutor')
    const lessons = stats.value.find(s => s.key === 'lessonsToday')
    expect(lessons?.to).toBe('/tutor/schedule')
    const inquiries = stats.value.find(s => s.key === 'pendingInquiries')
    expect(inquiries?.to).toBe('/tutor/inquiries')
  })

  it('student stats have correct navigation links', () => {
    const { stats } = useDashboardStats('student')
    const upcoming = stats.value.find(s => s.key === 'upcomingLessons')
    expect(upcoming?.to).toBe('/student/schedule')
    const tutors = stats.value.find(s => s.key === 'activeTutors')
    expect(tutors?.to).toBe('/marketplace')
    const unread = stats.value.find(s => s.key === 'unreadMessages')
    expect(unread?.to).toBe('/student/messages')
  })
})
