// Phase 21→24→25→26: Tests for WBMyLessonsPage
// Updated: component now uses getMyLessonsFiltered + lessonViewApi.loadToSession
// Phase 26 (2026-05-19): fix stale i18n key + add conducted tab tests
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
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

// Mock lessonViewApi — всі методи що використовує компонент
vi.mock('../api/lessonViewApi', () => ({
  lessonViewApi: {
    loadToSession: vi.fn(),
    prepareLesson: vi.fn(),
    listConducted: vi.fn(),
    generateShareLink: vi.fn(),
    updateSnapshot: vi.fn(),
  },
}))

// Mock apiClient
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

// WBSession items, що повертає listConducted (is_lesson_play=True)
const MOCK_CONDUCTED_SESSIONS = [
  {
    id: 'session-conducted-1',
    name: 'Algebra Basics — урок 1',
    created_at: '2026-05-10T09:00:00Z',
    updated_at: '2026-05-10T10:00:00Z',
    is_lesson_play: true,
    origin_lesson_id: 'lesson-1',
  },
  {
    id: 'session-conducted-2',
    name: 'Physics Forces — урок 1',
    created_at: '2026-05-11T11:00:00Z',
    updated_at: '2026-05-11T12:00:00Z',
    is_lesson_play: true,
    origin_lesson_id: 'lesson-2',
  },
]

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
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockPush.mockResolvedValue(undefined)
    vi.mocked(lessonSaveApi.getFolders).mockResolvedValue([])
    // Default: conducted повертає порожній список щоб не блокувати інші тести
    vi.mocked(lessonViewApi.listConducted).mockResolvedValue([])
  })

  // ── Templates tab ────────────────────────────────────────────────────────

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
    vi.mocked(lessonSaveApi.getMyLessonsFiltered).mockResolvedValue({
      lessons: [], total: 0, has_more: false, offset: 0, limit: 20,
    })
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

    // Кнопка "Провести" рендерить i18n-ключ knowledge.lesson.prepare.button
    const openBtns = wrapper.findAll('button').filter(b =>
      b.text().includes('knowledge.lesson.prepare.button'),
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
      b.text().includes('knowledge.lesson.prepare.button'),
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

  // ── Tabs ─────────────────────────────────────────────────────────────────

  it('renders two tabs: templates and conducted', async () => {
    vi.mocked(lessonSaveApi.getMyLessonsFiltered).mockResolvedValue(MOCK_FILTERED_RESPONSE)
    const wrapper = createWrapper()
    await flushPromises()

    // Обидва таб-тригери мають відповідні i18n-ключі
    expect(wrapper.text()).toContain('winterboard.lesson.tabs.templates')
    expect(wrapper.text()).toContain('winterboard.lesson.tabs.conducted')
  })

  // ── Conducted tab ────────────────────────────────────────────────────────

  it('calls listConducted when conducted tab is clicked', async () => {
    vi.mocked(lessonSaveApi.getMyLessonsFiltered).mockResolvedValue(MOCK_FILTERED_RESPONSE)
    vi.mocked(lessonViewApi.listConducted).mockResolvedValue(MOCK_CONDUCTED_SESSIONS)

    const wrapper = createWrapper()
    await flushPromises()

    // Клікаємо на вкладку "Проведені уроки"
    const conductedTab = wrapper.findAll('button').find(b =>
      b.text().includes('winterboard.lesson.tabs.conducted'),
    )
    expect(conductedTab).toBeDefined()
    await conductedTab!.trigger('click')
    await flushPromises()

    expect(lessonViewApi.listConducted).toHaveBeenCalled()
  })

  it('renders conducted sessions after switching tab', async () => {
    vi.mocked(lessonSaveApi.getMyLessonsFiltered).mockResolvedValue(MOCK_FILTERED_RESPONSE)
    vi.mocked(lessonViewApi.listConducted).mockResolvedValue(MOCK_CONDUCTED_SESSIONS)

    const wrapper = createWrapper()
    await flushPromises()

    const conductedTab = wrapper.findAll('button').find(b =>
      b.text().includes('winterboard.lesson.tabs.conducted'),
    )
    await conductedTab!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Algebra Basics — урок 1')
    expect(wrapper.text()).toContain('Physics Forces — урок 1')
  })

  it('shows empty state when no conducted sessions', async () => {
    vi.mocked(lessonSaveApi.getMyLessonsFiltered).mockResolvedValue(MOCK_FILTERED_RESPONSE)
    vi.mocked(lessonViewApi.listConducted).mockResolvedValue([])

    const wrapper = createWrapper()
    await flushPromises()

    const conductedTab = wrapper.findAll('button').find(b =>
      b.text().includes('winterboard.lesson.tabs.conducted'),
    )
    await conductedTab!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('winterboard.lesson.conducted.emptyTitle')
  })

  it('navigates to winterboard-solo when clicking a conducted session', async () => {
    vi.mocked(lessonSaveApi.getMyLessonsFiltered).mockResolvedValue(MOCK_FILTERED_RESPONSE)
    vi.mocked(lessonViewApi.listConducted).mockResolvedValue(MOCK_CONDUCTED_SESSIONS)

    const wrapper = createWrapper()
    await flushPromises()

    const conductedTab = wrapper.findAll('button').find(b =>
      b.text().includes('winterboard.lesson.tabs.conducted'),
    )
    await conductedTab!.trigger('click')
    await flushPromises()

    // Клік на карточку сесії (wb-conducted-card)
    const card = wrapper.find('.wb-conducted-card')
    expect(card.exists()).toBe(true)
    await card.trigger('click')
    await flushPromises()

    expect(mockPush).toHaveBeenCalledWith({
      name: 'winterboard-solo',
      params: { id: 'session-conducted-1' },
    })
  })
})
