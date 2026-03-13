// WB B16: Tests for WBLessons, WBLessonDetail, LessonCard
// DoD: 8+ unit tests, green run

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
  }),
}))

const mockPush = vi.fn()
const mockBack = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
  useRoute: () => ({ params: { id: '42' } }),
  RouterLink: { template: '<a><slot /></a>' },
}))

vi.mock('@/modules/auth/store/authStore', () => ({
  useAuthStore: () => ({ user: { first_name: 'Test' } }),
}))

const mockListMyLessons = vi.fn()
const mockGetLessonRoom = vi.fn()

vi.mock('@/api/lessons', () => ({
  default: {
    listMyLessons: mockListMyLessons,
    getLessonRoom: mockGetLessonRoom,
  },
}))

const mockApiGet = vi.fn()

vi.mock('@/utils/apiClient', () => ({
  default: { get: mockApiGet },
}))

vi.mock('../composables/useToast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}))

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const LESSON = {
  id: 1,
  title: 'Algebra',
  description: 'Linear equations',
  materials_count: 3,
  created_at: '2026-03-01T10:00:00Z',
  status: 'scheduled',
}

const LESSON_NORMALIZED = {
  id: 1,
  name: 'Algebra',
  description: 'Linear equations',
  materials_count: 3,
  created_at: '2026-03-01T10:00:00Z',
}

// ─── LessonCard ───────────────────────────────────────────────────────────────

describe('LessonCard.vue (B16)', () => {
  beforeEach(() => setActivePinia(createPinia()))
  afterEach(() => vi.clearAllMocks())

  async function mountCard(lesson = LESSON_NORMALIZED) {
    const LessonCard = (await import('../components/lessons/LessonCard.vue')).default
    return mount(LessonCard, { props: { lesson } })
  }

  // Test 1
  it('renders lesson name', async () => {
    const wrapper = await mountCard()
    expect(wrapper.find('.lesson-card__name').text()).toBe('Algebra')
  })

  // Test 2
  it('renders description when provided', async () => {
    const wrapper = await mountCard()
    expect(wrapper.find('.lesson-card__description').text()).toBe('Linear equations')
  })

  // Test 3
  it('emits click when card clicked', async () => {
    const wrapper = await mountCard()
    await wrapper.find('[data-testid="lesson-card"]').trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  // Test 4
  it('emits clone when clone button clicked', async () => {
    const wrapper = await mountCard()
    await wrapper.find('[data-testid="clone-button"]').trigger('click')
    expect(wrapper.emitted('clone')).toHaveLength(1)
  })

  // Test 5
  it('emits delete when delete button clicked', async () => {
    const wrapper = await mountCard()
    await wrapper.find('[data-testid="delete-button"]').trigger('click')
    expect(wrapper.emitted('delete')).toHaveLength(1)
  })

  // Test 6
  it('clone/delete clicks do NOT propagate to card click', async () => {
    const wrapper = await mountCard()
    await wrapper.find('[data-testid="clone-button"]').trigger('click')
    // card click should NOT be emitted since clone btn uses @click.stop
    expect(wrapper.emitted('click')).toBeFalsy()
  })
})

// ─── WBLessons ────────────────────────────────────────────────────────────────

describe('WBLessons.vue (B16)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockListMyLessons.mockResolvedValue({ results: [LESSON] })
  })
  afterEach(() => vi.clearAllMocks())

  async function mountLessons() {
    const WBLessons = (await import('../views/WBLessons.vue')).default
    return mount(WBLessons, {
      global: { stubs: { Teleport: true, LessonCard: true } },
    })
  }

  // Test 7
  it('calls listMyLessons on mount', async () => {
    await mountLessons()
    await vi.waitFor(() => expect(mockListMyLessons).toHaveBeenCalledOnce())
  })

  // Test 8
  it('renders create-lesson button', async () => {
    const wrapper = await mountLessons()
    expect(wrapper.find('[data-testid="create-lesson"]').exists()).toBe(true)
  })

  // Test 9
  it('opens create modal when create button clicked', async () => {
    const wrapper = await mountLessons()
    await wrapper.find('[data-testid="create-lesson"]').trigger('click')
    expect(wrapper.find('[data-testid="create-modal"]').exists()).toBe(true)
  })

  // Test 10
  it('shows empty state when no lessons returned', async () => {
    mockListMyLessons.mockResolvedValueOnce({ results: [] })
    const wrapper = await mountLessons()
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="lessons-empty"]').exists()).toBe(true)
    )
  })

  // Test 11
  it('submit button disabled when lesson name is empty', async () => {
    const wrapper = await mountLessons()
    await wrapper.find('[data-testid="create-lesson"]').trigger('click')
    const submitBtn = wrapper.find('[data-testid="create-lesson-submit"]')
    expect(submitBtn.attributes('disabled')).toBeDefined()
  })
})

// ─── WBLessonDetail ───────────────────────────────────────────────────────────

describe('WBLessonDetail.vue (B16)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockGetLessonRoom.mockResolvedValue({ id: 42, title: 'Algebra', status: 'scheduled' })
    mockApiGet.mockResolvedValue({ results: [] })
  })
  afterEach(() => vi.clearAllMocks())

  async function mountDetail() {
    const WBLessonDetail = (await import('../views/WBLessonDetail.vue')).default
    return mount(WBLessonDetail, {
      props: { lessonId: '42' },
      global: { stubs: { Teleport: true, RouterLink: { template: '<a><slot /></a>' } } },
    })
  }

  // Test 12
  it('renders 3 tabs: materials / boards / notes', async () => {
    const wrapper = await mountDetail()
    await vi.waitFor(() => expect(wrapper.find('[data-testid="tab-materials"]').exists()).toBe(true))
    expect(wrapper.find('[data-testid="tab-boards"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="tab-notes"]').exists()).toBe(true)
  })

  // Test 13
  it('shows materials tab by default', async () => {
    const wrapper = await mountDetail()
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="tab-panel-materials"]').exists()).toBe(true)
    )
    expect(wrapper.find('[data-testid="tab-panel-boards"]').exists()).toBe(false)
  })

  // Test 14
  it('switches to boards tab on click', async () => {
    const wrapper = await mountDetail()
    await vi.waitFor(() => expect(wrapper.find('[data-testid="tab-boards"]').exists()).toBe(true))
    await wrapper.find('[data-testid="tab-boards"]').trigger('click')
    expect(wrapper.find('[data-testid="tab-panel-boards"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="tab-panel-materials"]').exists()).toBe(false)
  })

  // Test 15
  it('switches to notes tab on click', async () => {
    const wrapper = await mountDetail()
    await vi.waitFor(() => expect(wrapper.find('[data-testid="tab-notes"]').exists()).toBe(true))
    await wrapper.find('[data-testid="tab-notes"]').trigger('click')
    expect(wrapper.find('[data-testid="tab-panel-notes"]').exists()).toBe(true)
  })

  // Test 16
  it('back button calls router.back', async () => {
    const wrapper = await mountDetail()
    await vi.waitFor(() => expect(wrapper.find('[data-testid="back-btn"]').exists()).toBe(true))
    await wrapper.find('[data-testid="back-btn"]').trigger('click')
    expect(mockBack).toHaveBeenCalledOnce()
  })
})
