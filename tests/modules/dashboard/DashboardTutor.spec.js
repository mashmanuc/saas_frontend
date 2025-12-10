import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import DashboardTutor from '../../../src/modules/dashboard/views/DashboardTutor.vue'
const dashboardStoreModule = vi.hoisted(() => ({
  useDashboardStore: vi.fn(),
}))

const relationsStoreModule = vi.hoisted(() => ({
  useRelationsStore: vi.fn(),
}))

const authStoreModule = vi.hoisted(() => ({
  useAuthStore: vi.fn(),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key, params) => (params ? `${key}:${JSON.stringify(params)}` : key),
  }),
}))

vi.mock('../../../src/modules/dashboard/store/dashboardStore', () => dashboardStoreModule)
vi.mock('../../../src/stores/relationsStore', () => relationsStoreModule)
vi.mock('../../../src/modules/auth/store/authStore', () => authStoreModule)

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

const createDashboardStore = () => ({
  nextLessonAt: '2024-01-01T10:00:00Z',
  fetchTutorStudents: vi.fn().mockResolvedValue(),
})

const createRelationsStore = (overrides = {}) => ({
  tutorFilter: 'all',
  tutorRelations: [
    {
      id: '1',
      status: 'invited',
      student: { id: 's1', first_name: 'Ada', last_name: 'Lovelace', email: 'ada@example.com', timezone: 'UTC' },
    },
  ],
  filteredTutorRelations: [
    {
      id: '1',
      status: 'invited',
      student: { id: 's1', first_name: 'Ada', last_name: 'Lovelace', email: 'ada@example.com', timezone: 'UTC' },
    },
  ],
  tutorSummary: { total: 1, invited: 1, active: 0, archived: 0 },
  tutorHasMore: false,
  tutorLoading: false,
  tutorError: null,
  tutorErrorCode: null,
  tutorBulkLoading: false,
  tutorLoadingMore: false,
  selectedTutorCount: 0,
  canBulkAccept: false,
  canBulkArchive: false,
  toggleTutorSelection: vi.fn(),
  selectAllCurrentTutorRelations: vi.fn(),
  clearTutorSelection: vi.fn(),
  isTutorSelected: vi.fn().mockReturnValue(false),
  setTutorFilter: vi.fn().mockResolvedValue(),
  bulkAcceptSelectedTutorRelations: vi.fn().mockResolvedValue(),
  bulkArchiveSelectedTutorRelations: vi.fn().mockResolvedValue(),
  loadMoreTutorRelations: vi.fn().mockResolvedValue(),
  fetchTutorRelations: vi.fn().mockResolvedValue(),
  ...overrides,
})

const createAuthStore = () => ({
  user: { timezone: 'Europe/Kyiv' },
})

const mountView = () =>
  mount(DashboardTutor, {
    global: {
      stubs: {
        teleport: true,
      },
    },
  })

describe('DashboardTutor.vue', () => {
  let dashboardStore
  let relationsStore

  beforeEach(() => {
    vi.clearAllMocks()
    dashboardStore = createDashboardStore()
    relationsStore = createRelationsStore()
    dashboardStoreModule.useDashboardStore.mockReturnValue(dashboardStore)
    relationsStoreModule.useRelationsStore.mockReturnValue(relationsStore)
    authStoreModule.useAuthStore.mockReturnValue(createAuthStore())
  })

  it('renders tabs with counts from summary', async () => {
    const wrapper = mountView()
    await flushPromises()

    const allTab = wrapper.find('[data-test="tutor-tab-all"]')
    const invitedTab = wrapper.find('[data-test="tutor-tab-invited"]')
    const activeTab = wrapper.find('[data-test="tutor-tab-active"]')
    const archivedTab = wrapper.find('[data-test="tutor-tab-archived"]')

    expect(allTab.exists()).toBe(true)
    expect(invitedTab.exists()).toBe(true)
    expect(activeTab.exists()).toBe(true)
    expect(archivedTab.exists()).toBe(true)
  })

  it('switches filter when clicking tab', async () => {
    const wrapper = mountView()
    await flushPromises()

    const invitedTab = wrapper.find('[data-test="tutor-tab-invited"]')
    await invitedTab.trigger('click')
    await flushPromises()

    expect(relationsStore.setTutorFilter).toHaveBeenCalledWith('invited')
  })

  it('enables bulk buttons when store allows actions', async () => {
    relationsStore = createRelationsStore({ canBulkAccept: true, canBulkArchive: true, tutorBulkLoading: false })
    relationsStoreModule.useRelationsStore.mockReturnValue(relationsStore)
    const wrapper = mountView()
    await flushPromises()

    const acceptButton = wrapper.find('[data-test="bulk-accept"]')
    const archiveButton = wrapper.find('[data-test="bulk-archive"]')

    expect(acceptButton.attributes('disabled')).toBeUndefined()
    expect(archiveButton.attributes('disabled')).toBeUndefined()
  })

  it('renders status badge for relation', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.find('[data-test="relation-status-1"]').text()).toContain('dashboard.tutor.status.invited')
  })

  it('shows error banner when store has error', async () => {
    relationsStore = createRelationsStore({
      tutorError: 'Failed to load',
      tutorErrorCode: 'offline',
      filteredTutorRelations: [],
    })
    relationsStoreModule.useRelationsStore.mockReturnValue(relationsStore)

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.find('[data-test="relations-error"]').exists()).toBe(true)
  })
})
