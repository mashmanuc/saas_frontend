// WB Responsive Phase 6: Tests for B13 — Board List View
// Components: WBBoardCard, WBBoardListItem, WBBoardList
// DoD: grid/list toggle + localStorage, thumbnail/placeholder, CRUD events, empty state

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

// ─── Mock vue-i18n ────────────────────────────────────────────────────────────

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string, opts?: Record<string, unknown>) => {
    if (opts) return `${key}:${JSON.stringify(opts)}`
    return key
  }}),
}))

// ─── Mock vue-router ──────────────────────────────────────────────────────────

const mockPush = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush }),
  RouterLink: { template: '<a><slot /></a>' },
}))

// ─── Mock winterboardApi ──────────────────────────────────────────────────────

const mockListSessions = vi.fn()
const mockDeleteSession = vi.fn()
const mockDuplicateSession = vi.fn()

vi.mock('../api/winterboardApi', () => ({
  winterboardApi: {
    listSessions: mockListSessions,
    deleteSession: mockDeleteSession,
    duplicateSession: mockDuplicateSession,
  },
}))

// ─── Mock useToast ────────────────────────────────────────────────────────────

const mockShowToast = vi.fn()

vi.mock('../composables/useToast', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}))

// ─── Mock async dialog components ────────────────────────────────────────────

vi.mock('../components/sharing/WBShareDialog.vue', () => ({
  default: { template: '<div class="stub-share-dialog" />' },
}))

vi.mock('../components/export/WBExportDialog.vue', () => ({
  default: { template: '<div class="stub-export-dialog" />' },
}))

// ─── Test fixtures ────────────────────────────────────────────────────────────

const BOARD_WITH_THUMB = {
  id: 'board-001',
  name: 'Math Lesson',
  page_count: 3,
  thumbnail_url: 'https://cdn.example.com/thumb.png',
  rev: 1,
  updated_at: new Date(Date.now() - 60_000).toISOString(),
  created_at: new Date(Date.now() - 3_600_000).toISOString(),
  has_lesson: false,
  lesson_info: null,
  folder: null,
}

const BOARD_NO_THUMB = {
  id: 'board-002',
  name: 'Physics Class',
  page_count: 1,
  thumbnail_url: null,
  rev: 2,
  updated_at: new Date(Date.now() - 3_600_000).toISOString(),
  created_at: new Date(Date.now() - 86_400_000).toISOString(),
  has_lesson: true,
  lesson_info: { id: 1, student_name: 'John', start: null, status: 'completed' },
  folder: null,
}

const BOARDS = [BOARD_WITH_THUMB, BOARD_NO_THUMB]

// ─── Shared mount helpers ─────────────────────────────────────────────────────

async function mountCard(board = BOARD_WITH_THUMB) {
  const WBBoardCard = (await import('../components/boards/WBBoardCard.vue')).default
  return mount(WBBoardCard, { props: { board } })
}

async function mountListItem(board = BOARD_WITH_THUMB) {
  const WBBoardListItem = (await import('../components/boards/WBBoardListItem.vue')).default
  return mount(WBBoardListItem, { props: { board } })
}

async function mountBoardList() {
  const WBBoardList = (await import('../views/WBBoardList.vue')).default
  return mount(WBBoardList, {
    global: {
      stubs: {
        Teleport: true,
        WBShareDialog: { template: '<div class="stub-share" />' },
        WBExportDialog: { template: '<div class="stub-export" />' },
      },
    },
  })
}

// ─── Tests: WBBoardCard ───────────────────────────────────────────────────────

describe('WBBoardCard.vue (B13)', () => {
  beforeEach(() => setActivePinia(createPinia()))
  afterEach(() => vi.clearAllMocks())

  // Test 1
  it('renders thumbnail img when thumbnail_url is present', async () => {
    const wrapper = await mountCard(BOARD_WITH_THUMB)
    const img = wrapper.find('.wb-board-card__thumb-img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe(BOARD_WITH_THUMB.thumbnail_url)
    expect(wrapper.find('.wb-board-card__thumb-placeholder').exists()).toBe(false)
  })

  // Test 2
  it('renders placeholder SVG when thumbnail_url is null', async () => {
    const wrapper = await mountCard(BOARD_NO_THUMB)
    expect(wrapper.find('.wb-board-card__thumb-img').exists()).toBe(false)
    expect(wrapper.find('.wb-board-card__thumb-placeholder').exists()).toBe(true)
  })

  // Test 3
  it('emits open when card is clicked', async () => {
    const wrapper = await mountCard()
    await wrapper.find('.wb-board-card').trigger('click')
    expect(wrapper.emitted('open')).toHaveLength(1)
  })

  // Test 4
  it('emits delete when delete menu item is clicked', async () => {
    const wrapper = await mountCard()
    // open menu
    await wrapper.find('.wb-board-card__menu-trigger').trigger('click')
    const dangerBtn = wrapper.find('.wb-board-card__menu-item--danger')
    expect(dangerBtn.exists()).toBe(true)
    await dangerBtn.trigger('click')
    expect(wrapper.emitted('delete')).toHaveLength(1)
  })

  // Test 5
  it('emits duplicate when duplicate menu item is clicked', async () => {
    const wrapper = await mountCard()
    await wrapper.find('.wb-board-card__menu-trigger').trigger('click')
    const menuItems = wrapper.findAll('.wb-board-card__menu-item')
    // duplicate is the 2nd item (open, duplicate, share, delete)
    const duplicateBtn = menuItems.find((b) => b.text().includes('winterboard.boards.actions.duplicate'))
    expect(duplicateBtn).toBeDefined()
    await duplicateBtn!.trigger('click')
    expect(wrapper.emitted('duplicate')).toHaveLength(1)
  })

  // Test 6
  it('renders board name in card title', async () => {
    const wrapper = await mountCard(BOARD_WITH_THUMB)
    expect(wrapper.find('.wb-board-card__title').text()).toBe(BOARD_WITH_THUMB.name)
  })
})

// ─── Tests: WBBoardListItem ───────────────────────────────────────────────────

describe('WBBoardListItem.vue (B13)', () => {
  beforeEach(() => setActivePinia(createPinia()))
  afterEach(() => vi.clearAllMocks())

  // Test 7
  it('renders board name', async () => {
    const wrapper = await mountListItem(BOARD_WITH_THUMB)
    expect(wrapper.find('.wb-board-list-item__name').text()).toBe(BOARD_WITH_THUMB.name)
  })

  // Test 8
  it('emits open when row is clicked', async () => {
    const wrapper = await mountListItem()
    await wrapper.find('.wb-board-list-item').trigger('click')
    expect(wrapper.emitted('open')).toHaveLength(1)
  })

  // Test 9
  it('emits delete when delete button clicked (does not emit open)', async () => {
    const wrapper = await mountListItem()
    const deleteBtn = wrapper.find('.wb-board-list-item__action-btn--danger')
    await deleteBtn.trigger('click')
    expect(wrapper.emitted('delete')).toHaveLength(1)
    expect(wrapper.emitted('open')).toBeFalsy()
  })

  // Test 10
  it('renders placeholder when thumbnail_url is null', async () => {
    const wrapper = await mountListItem(BOARD_NO_THUMB)
    expect(wrapper.find('.wb-board-list-item__thumb-img').exists()).toBe(false)
    expect(wrapper.find('.wb-board-list-item__thumb-placeholder').exists()).toBe(true)
  })
})

// ─── Tests: WBBoardList ───────────────────────────────────────────────────────

describe('WBBoardList.vue (B13)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    mockListSessions.mockResolvedValue({ count: 2, results: BOARDS })
  })

  afterEach(() => vi.clearAllMocks())

  // Test 11
  it('renders grid of boards after loading', async () => {
    const wrapper = await mountBoardList()
    await vi.waitFor(() => expect(wrapper.find('.wb-board-list__grid').exists()).toBe(true))
    const cards = wrapper.findAll('[class*="wb-board-card"]')
    expect(cards.length).toBeGreaterThanOrEqual(2)
  })

  // Test 12
  it('shows empty state when no boards returned', async () => {
    mockListSessions.mockResolvedValueOnce({ count: 0, results: [] })
    const wrapper = await mountBoardList()
    await vi.waitFor(() =>
      expect(wrapper.find('.wb-board-list__empty').exists()).toBe(true)
    )
    expect(wrapper.find('.wb-board-list__empty-title').text()).toBe(
      'winterboard.boards.empty'
    )
  })

  // Test 13: grid/list toggle
  it('switches to list view and persists to localStorage', async () => {
    const wrapper = await mountBoardList()
    await vi.waitFor(() => expect(wrapper.find('.wb-board-list__grid').exists()).toBe(true))

    const listToggle = wrapper.findAll('.wb-view-toggle__btn')[1]
    await listToggle.trigger('click')

    expect(wrapper.find('.wb-board-list__list').exists()).toBe(true)
    expect(wrapper.find('.wb-board-list__grid').exists()).toBe(false)
    expect(localStorage.getItem('wb_board_view_mode')).toBe('list')
  })

  // Test 14: localStorage restore
  it('restores viewMode from localStorage on mount', async () => {
    localStorage.setItem('wb_board_view_mode', 'list')
    const wrapper = await mountBoardList()
    await vi.waitFor(() => expect(wrapper.find('.wb-board-list__list').exists()).toBe(true))
    expect(wrapper.find('.wb-board-list__grid').exists()).toBe(false)
  })

  // Test 15: error state
  it('shows error state when API fails', async () => {
    mockListSessions.mockRejectedValueOnce(new Error('Network error'))
    const wrapper = await mountBoardList()
    await vi.waitFor(() =>
      expect(wrapper.find('.wb-board-list__empty').exists()).toBe(true)
    )
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
  })
})
