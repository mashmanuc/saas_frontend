// Phase 21: Tests for WBMyLessonsPage
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import WBMyLessonsPage from '../views/WBMyLessonsPage.vue'

const mockPush = vi.fn()

// Mock vue-router
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

// Mock vue-i18n
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

// Mock lessonSaveApi
vi.mock('../api/lessonSaveApi', () => ({
  lessonSaveApi: {
    getMyLessons: vi.fn(),
    createSessionFromLesson: vi.fn(),
  },
}))

import { lessonSaveApi } from '../api/lessonSaveApi'

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
    created_at: '2026-03-18T10:00:00Z',
    updated_at: '2026-03-18T10:00:00Z',
    has_presentation: false,
    chunk_count: 0,
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
    created_at: '2026-03-17T08:00:00Z',
    updated_at: '2026-03-17T08:00:00Z',
    has_presentation: false,
    chunk_count: 0,
  },
]

function createWrapper() {
  return mount(WBMyLessonsPage, {
    global: {
      mocks: {
        $t: (key: string) => key,
      },
    },
  })
}

describe('WBMyLessonsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPush.mockResolvedValue(undefined)
  })

  it('shows loading spinner initially', () => {
    vi.mocked(lessonSaveApi.getMyLessons).mockReturnValue(new Promise(() => {}))
    const wrapper = createWrapper()
    expect(wrapper.find('.animate-spin').exists()).toBe(true)
  })

  it('renders lesson cards after fetch', async () => {
    vi.mocked(lessonSaveApi.getMyLessons).mockResolvedValue(MOCK_LESSONS)
    const wrapper = createWrapper()
    await flushPromises()

    const cards = wrapper.findAll('.wb-lesson-card')
    expect(cards).toHaveLength(2)
    expect(wrapper.text()).toContain('Algebra Basics')
    expect(wrapper.text()).toContain('Physics Forces')
  })

  it('shows empty state when no lessons', async () => {
    vi.mocked(lessonSaveApi.getMyLessons).mockResolvedValue([])
    const wrapper = createWrapper()
    await flushPromises()

    expect(wrapper.text()).toContain('winterboard.lesson.emptyTitle')
  })

  it('calls createSessionFromLesson on Open click', async () => {
    vi.mocked(lessonSaveApi.getMyLessons).mockResolvedValue(MOCK_LESSONS)
    vi.mocked(lessonSaveApi.createSessionFromLesson).mockResolvedValue({
      session_id: 'new-session-abc',
      name: 'Algebra Basics',
    })

    const wrapper = createWrapper()
    await flushPromises()

    const openBtns = wrapper.findAll('button').filter(b =>
      b.text().includes('winterboard.lesson.openButton'),
    )
    expect(openBtns.length).toBeGreaterThan(0)
    await openBtns[0].trigger('click')
    await flushPromises()

    expect(lessonSaveApi.createSessionFromLesson).toHaveBeenCalledWith('lesson-1')
  })

  it('navigates to winterboard-solo after Open', async () => {
    vi.mocked(lessonSaveApi.getMyLessons).mockResolvedValue(MOCK_LESSONS)
    vi.mocked(lessonSaveApi.createSessionFromLesson).mockResolvedValue({
      session_id: 'session-xyz',
      name: 'Algebra Basics',
    })

    const wrapper = createWrapper()
    await flushPromises()

    const openBtns = wrapper.findAll('button').filter(b =>
      b.text().includes('winterboard.lesson.openButton'),
    )
    await openBtns[0].trigger('click')
    await flushPromises()

    expect(mockPush).toHaveBeenCalledWith({
      name: 'winterboard-solo',
      params: { id: 'session-xyz' },
    })
  })

  it('shows error on fetch failure', async () => {
    vi.mocked(lessonSaveApi.getMyLessons).mockRejectedValue(new Error('Network'))
    const wrapper = createWrapper()
    await flushPromises()

    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
  })
})
