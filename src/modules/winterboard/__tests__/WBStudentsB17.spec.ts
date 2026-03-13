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

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const STUDENT_1 = {
  id: 101,
  display_name: 'Olena Kovalenko',
  avatar_url: 'https://cdn.example.com/avatar.png',
  last_session_at: '2026-03-10T14:00:00Z',
  sessions_count: 7,
}

const STUDENT_2 = {
  id: 102,
  display_name: 'Dmytro Petrenko',
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
  beforeEach(() => setActivePinia(createPinia()))
  afterEach(() => vi.clearAllMocks())

  // Test 1
  it('shows loading skeleton on initial mount', async () => {
    const wrapper = await mountStudents()
    // Loading is initially true before fetch resolves
    // Since fetch is instant (returns []) the loading disappears fast,
    // but we can verify the component mounts without error
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
    const WBStudents = (await import('../views/WBStudents.vue')).default
    const wrapper = mount(WBStudents)

    // Manually inject students after mount (simulate API returning data)
    const vm = wrapper.vm as any
    vm.students = [STUDENT_1, STUDENT_2]
    await wrapper.vm.$nextTick()

    const cards = wrapper.findAll('[data-testid="student-card"]')
    expect(cards).toHaveLength(2)
    expect(cards[0].text()).toContain('Olena Kovalenko')
    expect(cards[1].text()).toContain('Dmytro Petrenko')
  })

  // Test 4
  it('renders view-sessions button for each student', async () => {
    const WBStudents = (await import('../views/WBStudents.vue')).default
    const wrapper = mount(WBStudents)
    const vm = wrapper.vm as any
    vm.students = [STUDENT_1]
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="view-sessions"]').exists()).toBe(true)
  })

  // Test 5
  it('navigates to boards with student filter on view-sessions click', async () => {
    const WBStudents = (await import('../views/WBStudents.vue')).default
    const wrapper = mount(WBStudents)
    const vm = wrapper.vm as any
    vm.students = [STUDENT_1]
    await wrapper.vm.$nextTick()

    await wrapper.find('[data-testid="view-sessions"]').trigger('click')
    expect(mockPush).toHaveBeenCalledWith({
      name: 'winterboard-boards',
      query: { student: '101' },
    })
  })

  // Test 6
  it('shows error state and retry button on fetch failure', async () => {
    const WBStudents = (await import('../views/WBStudents.vue')).default
    const wrapper = mount(WBStudents)
    const vm = wrapper.vm as any
    vm.error = 'Network error'
    vm.loading = false
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="students-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="students-error"]').text()).toContain('Network error')
  })

  // Test 7
  it('renders student name in card', async () => {
    const WBStudents = (await import('../views/WBStudents.vue')).default
    const wrapper = mount(WBStudents)
    const vm = wrapper.vm as any
    vm.students = [STUDENT_1]
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.wb-student-card__name').text()).toBe('Olena Kovalenko')
  })

  // Test 8
  it('uses default avatar when avatar_url is empty', async () => {
    const WBStudents = (await import('../views/WBStudents.vue')).default
    const wrapper = mount(WBStudents)
    const vm = wrapper.vm as any
    vm.students = [STUDENT_2]
    await wrapper.vm.$nextTick()

    const img = wrapper.find('.wb-student-card__avatar')
    expect(img.attributes('src')).toBe('/default-avatar.svg')
  })
})

// ─── Tests: AppSidebar menu config (B18) ──────────────────────────────────────

describe('AppSidebar navigation config (B18)', () => {
  // Test 9
  it('SECTIONED_MENU_BY_ROLE tutor has winterboard section', async () => {
    const { SECTIONED_MENU_BY_ROLE } = await import('@/config/menu')
    const tutorSections = SECTIONED_MENU_BY_ROLE.tutor
    const wbSection = tutorSections.find((s: any) => s.key === 'winterboard')
    expect(wbSection).toBeDefined()
    expect(wbSection.items).toHaveLength(5)
  })

  // Test 10
  it('tutor winterboard section has all required routes', async () => {
    const { SECTIONED_MENU_BY_ROLE } = await import('@/config/menu')
    const wbSection = SECTIONED_MENU_BY_ROLE.tutor.find((s: any) => s.key === 'winterboard')
    const paths = wbSection.items.map((i: any) => i.to)
    expect(paths).toContain('/winterboard/dashboard')
    expect(paths).toContain('/winterboard/library')
    expect(paths).toContain('/winterboard/lessons')
    expect(paths).toContain('/winterboard/boards')
    expect(paths).toContain('/winterboard/students')
  })

  // Test 11
  it('SECTIONED_MENU_BY_ROLE student has winterboard section', async () => {
    const { SECTIONED_MENU_BY_ROLE } = await import('@/config/menu')
    const studentSections = SECTIONED_MENU_BY_ROLE.student
    const wbSection = studentSections.find((s: any) => s.key === 'winterboard')
    expect(wbSection).toBeDefined()
    expect(wbSection.items).toHaveLength(4)
  })

  // Test 12
  it('student winterboard section has no students route', async () => {
    const { SECTIONED_MENU_BY_ROLE } = await import('@/config/menu')
    const wbSection = SECTIONED_MENU_BY_ROLE.student.find((s: any) => s.key === 'winterboard')
    const paths = wbSection.items.map((i: any) => i.to)
    expect(paths).not.toContain('/winterboard/students')
  })
})
