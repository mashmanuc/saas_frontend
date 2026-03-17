// A13: Tests — API integration for WBLessonDetail, WBDashboard
// Ref: DAY19_AGENT-A.md — мінімум 8 тестів

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHashHistory } from 'vue-router'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/api/lessons', () => ({
  default: {
    listMyLessons: vi.fn(),
    getLessonRoom: vi.fn(),
  },
}))

vi.mock('@/utils/apiClient', () => ({
  default: {
    get: vi.fn(),
  },
}))

vi.mock('@/modules/auth/store/authStore', () => ({
  useAuthStore: () => ({ user: { first_name: 'Test', email: 'test@example.com' } }),
}))

vi.mock('../api/winterboardApi', () => ({
  winterboardApi: {
    listSessions: vi.fn(),
  },
}))

vi.mock('../composables/useToast', () => ({
  useToast: () => ({
    showToast: vi.fn(),
    toasts: { value: [] },
    dismissToast: vi.fn(),
    clearAllToasts: vi.fn(),
  }),
}))

import lessonsApi from '@/api/lessons'
import apiClient from '@/utils/apiClient'
import { winterboardApi } from '../api/winterboardApi'

// ── i18n + router stubs ──────────────────────────────────────────────────────

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      winterboard: {
        lessons: {
          title: 'Lessons',
          noLessons: 'No lessons yet',
          loadError: 'Failed to load lessons',
          untitled: 'Untitled',
          openBoard: 'Open Board',
          openClassroom: 'Open Classroom',
          boardSessions: 'Boards for this lesson',
          noSessions: 'No associated boards',
        },
        sessions: { loadError: 'Failed to load sessions', loadListError: 'Failed to load lesson sessions' },
        board: { loadError: 'Failed to load board' },
        dashboard: {
          recentBoards: 'Recent Boards',
          noRecentBoards: 'No boards yet',
          goodMorning: 'Good morning, {name}',
          goodAfternoon: 'Good afternoon, {name}',
          goodEvening: 'Good evening, {name}',
          subtitle: 'Welcome',
          quickActions: 'Quick Actions',
          library: 'Library',
          viewAll: 'View all',
        },
        boards: {
          untitled: 'Untitled',
          newBoard: 'New Board',
          createFirst: 'Create Board',
          pageCount: '{n} pages',
        },
        time: { justNow: 'just now', minutesAgo: '{n}m ago', hoursAgo: '{n}h ago', daysAgo: '{n}d ago' },
      },
      common: { retry: 'Retry', back: 'Back' },
    },
  },
})

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: { template: '<div/>' } },
    { path: '/winterboard/lessons', name: 'winterboard-lessons', component: { template: '<div/>' } },
    { path: '/winterboard/lessons/:lessonId', name: 'winterboard-lesson', component: { template: '<div/>' }, props: true },
    { path: '/winterboard/classroom/:lessonId', name: 'winterboard-classroom', component: { template: '<div/>' }, props: true },
    { path: '/winterboard/:id', name: 'winterboard-solo', component: { template: '<div/>' }, props: true },
  ],
})

function mountView(component: any, props = {}) {
  return mount(component, {
    props,
    global: { plugins: [i18n, router] },
  })
}

// ── WBLessonDetail tests ──────────────────────────────────────────────────────

import WBLessonDetail from '../views/WBLessonDetail.vue'

describe('WBLessonDetail — API calls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls getLessonRoom with correct lessonId', async () => {
    ;(lessonsApi.getLessonRoom as any).mockResolvedValue({ id: 42, title: 'Test Lesson', status: 'scheduled' })
    ;(apiClient.get as any).mockResolvedValue({ results: [] })
    mountView(WBLessonDetail, { lessonId: '42' })
    await flushPromises()
    expect(lessonsApi.getLessonRoom).toHaveBeenCalledWith('42')
  })

  it('renders lesson title when loaded', async () => {
    ;(lessonsApi.getLessonRoom as any).mockResolvedValue({ id: 5, title: 'Chemistry', status: 'in_progress' })
    ;(apiClient.get as any).mockResolvedValue({ results: [] })
    const wrapper = mountView(WBLessonDetail, { lessonId: '5' })
    await flushPromises()
    expect(wrapper.html()).toContain('Chemistry')
  })

  it('shows error state when lesson fails to load', async () => {
    ;(lessonsApi.getLessonRoom as any).mockRejectedValue(new Error('Not found'))
    const wrapper = mountView(WBLessonDetail, { lessonId: '99' })
    await flushPromises()
    expect(wrapper.find('[data-testid="lesson-detail-error"]').exists()).toBe(true)
  })

  it('calls sessions API with lesson param', async () => {
    ;(lessonsApi.getLessonRoom as any).mockResolvedValue({ id: 7, title: 'Biology', status: 'scheduled' })
    ;(apiClient.get as any).mockResolvedValue({ results: [{ id: 'sess-1', name: 'Session 1', updated_at: new Date().toISOString() }] })
    mountView(WBLessonDetail, { lessonId: '7' })
    await flushPromises()
    expect(apiClient.get).toHaveBeenCalledWith(
      '/v1/winterboard/sessions/',
      expect.objectContaining({ params: { lesson: '7' } }),
    )
  })

  it('shows sessions list when sessions loaded', async () => {
    ;(lessonsApi.getLessonRoom as any).mockResolvedValue({ id: 3, title: 'English', status: 'completed' })
    ;(apiClient.get as any).mockResolvedValue({
      results: [
        { id: 'sess-a', name: 'Board 1', updated_at: new Date().toISOString() },
        { id: 'sess-b', name: 'Board 2', updated_at: new Date().toISOString() },
      ],
    })
    const wrapper = mountView(WBLessonDetail, { lessonId: '3' })
    await flushPromises()
    // B16: sessions live in 'boards' tab — switch to it first
    const boardsTab = wrapper.find('[data-testid="tab-boards"]')
    if (boardsTab.exists()) await boardsTab.trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="sessions-grid"]').exists()).toBe(true)
  })

  it('shows sessions empty when no sessions', async () => {
    ;(lessonsApi.getLessonRoom as any).mockResolvedValue({ id: 4, title: 'Art', status: 'scheduled' })
    ;(apiClient.get as any).mockResolvedValue({ results: [] })
    const wrapper = mountView(WBLessonDetail, { lessonId: '4' })
    await flushPromises()
    // B16: sessions live in 'boards' tab — switch to it first
    const boardsTab = wrapper.find('[data-testid="tab-boards"]')
    if (boardsTab.exists()) await boardsTab.trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="sessions-empty"]').exists()).toBe(true)
  })
})

// ── WBDashboard error state ───────────────────────────────────────────────────

import WBDashboard from '../views/WBDashboard.vue'

describe('WBDashboard — error state', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows error state when listSessions fails', async () => {
    ;(winterboardApi.listSessions as any).mockRejectedValue(new Error('Server error'))
    const wrapper = mountView(WBDashboard)
    await flushPromises()
    expect(wrapper.find('[data-testid="dashboard-error"]').exists()).toBe(true)
  })

  it('calls listSessions on mount', async () => {
    ;(winterboardApi.listSessions as any).mockResolvedValue({ results: [] })
    mountView(WBDashboard)
    await flushPromises()
    expect(winterboardApi.listSessions).toHaveBeenCalledOnce()
  })
})
