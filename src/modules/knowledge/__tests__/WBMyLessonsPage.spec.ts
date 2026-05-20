// Phase 21→24→25: Tests for WBMyLessonsPage
// Updated: component now uses getMyLessonsFiltered + lessonViewApi.loadToSession
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import WBMyLessonsPage from '../views/WBMyLessonsPage.vue'

const mockPush = vi.fn()

// Mock vue-router
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useRoute: () => ({
    query: {},
    params: {},
    path: '/my-lessons',
  }),
  RouterLink: { template: '<a><slot /></a>' },
}))

// Mock vue-i18n
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

// Mock lessonSaveApi (Phase 24: getMyLessonsFiltered)
vi.mock('../api/lessonSaveApi', () => ({
  lessonSaveApi: {
    getMyLessons: vi.fn(),
    getMyLessonsFiltered: vi.fn(),
    createSessionFromLesson: vi.fn(),
    getFolders: vi.fn().mockResolvedValue([]),
  },
}))

// Mock lessonViewApi (Phase 23: loadToSession)
vi.mock('../api/lessonViewApi', () => ({
  lessonViewApi: {
    loadToSession: vi.fn(),
  },
}))

// Mock apiClient (used by component for toggle visibility etc.)
vi.mock('@/utils/apiClient', () => ({
  default: {
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

import { lessonSaveApi } from '../api/lessonSaveApi'
import { lessonViewApi } from '../api/lessonViewApi'

const MOCK_LESSONS = [
  {
    id: 'lesson-1',
    title: 'Algebra Basics',
    description: '',
    subject_tag: 'math',
    slug: 'draft-lesson-1',
    status: 'draft',
    visibility: 'demo',
    fork_depth: 0,
    source_session_id: null,
    folder: null,
    created_at: '2026-03-18T10:00:00Z',
    updated_at: '2026-03-18T10:00:00Z',
    has_presentation: false,
    chunk_count: 0,
    page_count: 1,
  },
  {
    id: 'lesson-2',
    title: 'Physics Forces',
    description: '',
    subject_tag: 'physics',
    slug: 'draft-lesson-2',
    status: 'draft',
    visibility: 'demo',
    fork_depth: 0,
    source_session_id: null,
    folder: null,
    created_at: '2026-03-17T08:00:00Z',
    updated_at: '2026-03-17T08:00:00Z',
    has_presentation: false,
    chunk_count: 0,
    page_count: 1,
  },
]

const MOCK_FILTERED_RESPONSE = {
  lessons: MOCK_LESSONS,
  total: 2,
  has_more: false,
  offset: 0,
  limit: 20,
}

function createWrapper() {
  return mount(WBMyLessonsPage, {
    global: {
      mocks: {
        $t: (key: string) => key,
      },
      stubs: {
        WBLessonFolders: { template: '<div class="stub-folders" />' },
        LessonEditDialog: { template: '<div />' },
        MoveToFolderDropdown: { template: '<div />' },
        ErrorBoundary: { template: '<div><slot /></div>' },
        Teleport: { template: '<div><slot /></div>' },
      },
    },
  })
}

describe('WBMyLessonsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPush.mockResolvedValue(undefined)
    vi.mocked(lessonSaveApi.getFolders).mockResolvedValue([])
  })

  it('shows loading skeleton initially', () => {
    vi.mocked(lessonSaveApi.getMyLessonsFiltered).mockReturnValue(new Promise(() => {}))
    const wrapper = createWrapper()
    expect(wrapper.find('.animate-pulse').exists()).toBe(true)
  })

  it('renders lesson cards after fetch', async () => {
    vi.mocked(lessonSaveApi.getMyLessonsFiltered).mockResolvedValue(MOCK_FILTERED_RESPONSE)
    const wrapper = createWrapper()
    await flushPromises()

    const cards = wrapper.findAll('.wb-lesson-card')
    expect(cards).toHaveLength(2)
    expect(wrapper.text()).toContain('Algebra Basics')
    expect(wrapper.text()).toContain('Physics Forces')
  })

  it('shows empty state when no lessons', async () => {
    vi.mocked(lessonSaveApi.getMyLessonsFiltered).mockResolvedValue({ lessons: [], total: 0, has_more: false, offset: 0, limit: 20 })
    const wrapper = createWrapper()
    await flushPromises()

    expect(wrapper.text()).toContain('winterboard.lesson.emptyTitle')
  })

  it('calls loadToSession on Open click', async () => {
    vi.mocked(lessonSaveApi.getMyLessonsFiltered).mockResolvedValue(MOCK_FILTERED_RESPONSE)
    vi.mocked(lessonViewApi.loadToSession).mockResolvedValue({
      session_id: 'new-session-abc',
      board_id: 'board-1',
      name: 'Algebra Basics',
      lesson_id: 'lesson-1',
    })

    const wrapper = createWrapper()
    await flushPromises()

    const openBtns = wrapper.findAll('button').filter(b =>
      b.text().includes('knowledge.lesson.reuse.useLesson'),
    )
    expect(openBtns.length).toBeGreaterThan(0)
    await openBtns[0].trigger('click')
    await flushPromises()

    expect(lessonViewApi.loadToSession).toHaveBeenCalledWith('lesson-1')
  })

  it('navigates to winterboard-solo after Open', async () => {
    vi.mocked(lessonSaveApi.getMyLessonsFiltered).mockResolvedValue(MOCK_FILTERED_RESPONSE)
    vi.mocked(lessonViewApi.loadToSession).mockResolvedValue({
      session_id: 'session-xyz',
      board_id: 'board-1',
      name: 'Algebra Basics',
      lesson_id: 'lesson-1',
    })

    const wrapper = createWrapper()
    await flushPromises()

    const openBtns = wrapper.findAll('button').filter(b =>
      b.text().includes('knowledge.lesson.reuse.useLesson'),
    )
    await openBtns[0].trigger('click')
    await flushPromises()

    expect(mockPush).toHaveBeenCalledWith({
      name: 'winterboard-solo',
      params: { id: 'session-xyz' },
    })
  })

  it('shows error on fetch failure', async () => {
    vi.mocked(lessonSaveApi.getMyLessonsFiltered).mockRejectedValue(new Error('Network'))
    const wrapper = createWrapper()
    await flushPromises()

    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
  })
})
