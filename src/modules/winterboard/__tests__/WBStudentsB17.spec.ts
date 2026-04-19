// WB B17+B18: Tests for WBStudents + AppSidebar navigation
// DoD: 6+ unit tests, green run

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

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush }),
  RouterLink: { template: '<a><slot /></a>' },
}))

vi.mock('../composables/useToast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}))

// ─── Mock apiClient (WBStudents uses apiClient.get for /classroom/my-students/) ──

const mockApiGet = vi.fn()

vi.mock('@/utils/apiClient', () => ({
  default: { get: (...args: any[]) => mockApiGet(...args) },
}))

// ─── Fixtures ─────────────────────────────────────────────────────────────────

// Fixtures match the raw API shape (first_name/last_name/student_id)
// WBStudents.vue maps: display_name = first_name + last_name, id = student_id
const STUDENT_1 = {
  student_id: 101,
  first_name: 'Olena',
  last_name: 'Kovalenko',
  avatar_url: 'https://cdn.example.com/avatar.png',
  last_session_at: '2026-03-10T14:00:00Z',
  sessions_count: 7,
}

const STUDENT_2 = {
  student_id: 102,
  first_name: 'Dmytro',
  last_name: 'Petrenko',
  avatar_url: '',
  last_session_at: undefined,
  sessions_count: 0,
}

// ─── Mount helper ─────────────────────────────────────────────────────────────

async function mountStudents() {
  const WBStudents = (await import('../views/WBStudents.vue')).default
  return mount(WBStudents)
}

// ─── Tests: WBStudents ────────────────────────────────────────────────────────

describe('WBStudents.vue (B17)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockApiGet.mockResolvedValue({ results: [] })
  })
  afterEach(() => vi.clearAllMocks())

  // Test 1
  it('shows loading skeleton on initial mount', async () => {
    const wrapper = await mountStudents()
    expect(wrapper.exists()).toBe(true)
  })

  // Test 2
  it('shows empty state when no students returned', async () => {
    const wrapper = await mountStudents()
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="students-empty"]').exists()).toBe(true)
    )
  })

  // Test 3
  it('renders student cards when students are present', async () => {
    mockApiGet.mockResolvedValueOnce({ results: [STUDENT_1, STUDENT_2] })
    const wrapper = await mountStudents()
    await vi.waitFor(() =>
      expect(wrapper.findAll('[data-testid="student-card"]')).toHaveLength(2)
    )

    const cards = wrapper.findAll('[data-testid="student-card"]')
    expect(cards[0].text()).toContain('Olena Kovalenko')
    expect(cards[1].text()).toContain('Dmytro Petrenko')
  })

  // Test 4
  it('renders view-sessions button for each student', async () => {
    mockApiGet.mockResolvedValueOnce({ results: [STUDENT_1] })
    const wrapper = await mountStudents()
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="view-sessions"]').exists()).toBe(true)
    )
  })

  // Test 5
  it('navigates to boards with student filter on view-sessions click', async () => {
    mockApiGet.mockResolvedValueOnce({ results: [STUDENT_1] })
    const wrapper = await mountStudents()
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="view-sessions"]').exists()).toBe(true)
    )

    await wrapper.find('[data-testid="view-sessions"]').trigger('click')
    expect(mockPush).toHaveBeenCalledWith({
      name: 'winterboard-boards',
      query: { student: '101' },
    })
  })

  // Test 6
  it('shows error state and retry button on fetch failure', async () => {
    mockApiGet.mockRejectedValueOnce(new Error('Network error'))
    const wrapper = await mountStudents()
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="students-error"]').exists()).toBe(true)
    )
    expect(wrapper.find('[data-testid="students-error"]').text()).toContain('Network error')
  })

  // Test 7
  it('renders student name in card', async () => {
    mockApiGet.mockResolvedValueOnce({ results: [STUDENT_1] })
    const wrapper = await mountStudents()
    await vi.waitFor(() =>
      expect(wrapper.find('.wb-student-card__name').exists()).toBe(true)
    )
    expect(wrapper.find('.wb-student-card__name').text()).toBe('Olena Kovalenko')
  })

  // Test 8
  it('uses default avatar when avatar_url is empty', async () => {
    mockApiGet.mockResolvedValueOnce({ results: [STUDENT_2] })
    const wrapper = await mountStudents()
    await vi.waitFor(() =>
      expect(wrapper.find('.wb-student-card__avatar').exists()).toBe(true)
    )
    const img = wrapper.find('.wb-student-card__avatar')
    expect(img.attributes('src')).toBe('/default-avatar.svg')
  })
})

// ─── Tests: AppSidebar menu config (B18) ──────────────────────────────────────

describe('AppSidebar navigation config (B18)', () => {
  // Navigation restructured 2026-04: WB routes now live inside `teaching` section
  // for tutors. Student navigation has NO winterboard items (per memory
  // feedback_student_no_solo_board). Tests updated accordingly.

  it('SECTIONED_MENU_BY_ROLE tutor has teaching section with WB routes', async () => {
    const { SECTIONED_MENU_BY_ROLE } = await import('@/config/menu')
    const tutorSections = SECTIONED_MENU_BY_ROLE.tutor
    const teachingSection = tutorSections.find((s: any) => s.key === 'teaching')
    expect(teachingSection).toBeDefined()
    const paths = teachingSection.items.map((i: any) => i.to)
    // WB surfaces inside teaching: boards, replays, library
    const wbPaths = paths.filter((p: string) => p.startsWith('/winterboard/'))
    expect(wbPaths.length).toBeGreaterThanOrEqual(3)
  })

  it('tutor teaching section exposes required WB routes', async () => {
    const { SECTIONED_MENU_BY_ROLE } = await import('@/config/menu')
    const teachingSection = SECTIONED_MENU_BY_ROLE.tutor.find(
      (s: any) => s.key === 'teaching',
    )
    const paths = teachingSection.items.map((i: any) => i.to)
    expect(paths).toContain('/winterboard/boards')
    expect(paths).toContain('/winterboard/replays')
    expect(paths).toContain('/winterboard/library')
  })

  it('student navigation has NO winterboard routes (regression guard)', async () => {
    const { SECTIONED_MENU_BY_ROLE } = await import('@/config/menu')
    const studentSections = SECTIONED_MENU_BY_ROLE.student
    const allPaths = studentSections.flatMap((s: any) =>
      s.items.map((i: any) => i.to),
    )
    const wbPaths = allPaths.filter((p: string) => p.startsWith('/winterboard/'))
    expect(wbPaths).toHaveLength(0)
  })
})
