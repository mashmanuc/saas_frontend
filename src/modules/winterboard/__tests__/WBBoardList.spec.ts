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

// DIR-хвости-2 §2 (2026-08-24): мок відстав від API — view давно кличе ще
// й теки (listBoardFolders і далі), а мок їх не мав → 5 × «is not a
// function» у catch, гілка тек мовчки деградувала в кожному тесті.
const mockListBoardFolders = vi.fn().mockResolvedValue([])

vi.mock('../api/winterboardApi', () => ({
  winterboardApi: {
    listSessions: mockListSessions,
    deleteSession: mockDeleteSession,
    duplicateSession: mockDuplicateSession,
    listBoardFolders: mockListBoardFolders,
    createBoardFolder: vi.fn().mockResolvedValue({ id: 1, name: 'f' }),
    updateBoardFolder: vi.fn().mockResolvedValue({}),
    deleteBoardFolder: vi.fn().mockResolvedValue({}),
    moveSessionToFolder: vi.fn().mockResolvedValue({}),
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
  folder_path: null,
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
  folder_path: null,
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
  it('renders cover (monogram from the name) when thumbnail_url is null', async () => {
    // 2026-10-22 (Студія за макетом): замість порожнього місця — обкладинка зі знаком або монограмою
    const wrapper = await mountCard(BOARD_NO_THUMB)
    expect(wrapper.find('.wb-board-card__thumb-img').exists()).toBe(false)
    expect(wrapper.find('.wb-board-card__cover').exists()).toBe(true)
    expect(wrapper.find('.wb-board-card__glyph').text()).toBe('Pc')
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
  it('renders cover when thumbnail_url is null', async () => {
    const wrapper = await mountListItem(BOARD_NO_THUMB)
    expect(wrapper.find('.wb-board-list-item__thumb-img').exists()).toBe(false)
    expect(wrapper.find('.wb-board-list-item__cover').text()).toBe('Pc')
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
    // Лог збою тут — КОНТРАКТ (навмисна відмова API), тож він асертиться,
    // а не смітить у stderr зеленого прогону (хвости-2 §2).
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockListSessions.mockRejectedValueOnce(new Error('Network error'))
    const wrapper = await mountBoardList()
    await vi.waitFor(() =>
      expect(wrapper.find('.wb-board-list__empty').exists()).toBe(true)
    )
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
    expect(errorSpy.mock.calls.some((c) =>
      String(c[0]).includes('Failed to load boards'))).toBe(true)
    errorSpy.mockRestore()
  })

  // Б-39 (2026-09-27): відкритий circuit breaker apiClient відхиляє запит як CanceledError.
  // Раніше список вважав будь-який CanceledError своїм abort і показував «порожньо» —
  // учитель бачив «дошок немає» замість «не вдалося завантажити».
  it('відмова відкритого circuit breaker — помилка завантаження, а не «порожньо»', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { default: axios } = await import('axios')
    mockListSessions.mockRejectedValueOnce(
      Object.assign(new axios.Cancel('[apiClient] Circuit breaker open — request blocked'),
        { blockedBy: 'circuit_breaker' }))
    const wrapper = await mountBoardList()
    await vi.waitFor(() => expect(wrapper.find('[role="alert"]').exists()).toBe(true))
    expect(wrapper.find('.wb-board-list__empty-title').text()).toBe('winterboard.boards.loadError')
    errorSpy.mockRestore()
  })
})

// 14.10 (власник): «папка учня видаляється в один клік, без підтвердження».
// Кошик у дереві папок тепер лише відкриває вікно; видаляє — тільки «Видалити папку».
describe('WBBoardList.vue — видалення папки лише з підтвердженням', () => {
  const TREE = [{
    id: 7, name: 'Олексій', parent: null, sessions_count: 3,
    children: [{ id: 8, name: 'Дроби', parent: 7, sessions_count: 1, children: [] }],
  }, { id: 9, name: 'Порожня', parent: null, sessions_count: 0, children: [] }]

  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    mockListSessions.mockResolvedValue({ count: 2, results: BOARDS })
    mockListBoardFolders.mockResolvedValue(TREE)
  })

  afterEach(() => {
    mockListBoardFolders.mockResolvedValue([])
    vi.clearAllMocks()
  })

  async function mountWithFolders() {
    const wrapper = await mountBoardList()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Олексій'))
    const { winterboardApi } = await import('../api/winterboardApi')
    return { wrapper, deleteFolder: winterboardApi.deleteBoardFolder as ReturnType<typeof vi.fn> }
  }

  /** Як учитель: навести на папку «Олексій» (кнопки з'являються при наведенні) і натиснути кошик. */
  async function clickTrash(wrapper: Awaited<ReturnType<typeof mountBoardList>>) {
    const item = wrapper.findAll('.wb-folder-tree__item').find((w) => w.text().includes('Олексій'))!
    await item.trigger('mouseenter')
    await item.find('.wb-folder-tree__action--danger').trigger('click')
  }

  it('кошик відкриває вікно і нічого не видаляє; «Скасувати» закриває без видалення', async () => {
    const { wrapper, deleteFolder } = await mountWithFolders()
    await clickTrash(wrapper)
    const dialog = wrapper.find('[data-testid="folder-delete-dialog"]')
    expect(dialog.exists()).toBe(true)
    expect(dialog.text()).toContain('winterboard.folders.confirmDelete.title:{"name":"Олексій"}')
    // Дошки не зникають: скільки їх і куди підуть (папка верхнього рівня → «Без папки»).
    expect(dialog.text()).toContain(
      'winterboard.folders.confirmDelete.boardsMove:{"count":3,"target":"winterboard.folders.noFolder"}')
    expect(dialog.text()).toContain('winterboard.folders.confirmDelete.childrenMove')
    expect(deleteFolder).not.toHaveBeenCalled()

    await dialog.find('.wb-dialog__btn--cancel').trigger('click')
    // <Transition> прибирає вікно на наступному кадрі.
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="folder-delete-dialog"]').exists()).toBe(false))
    expect(deleteFolder).not.toHaveBeenCalled()
  })

  it('«Видалити папку» видаляє саме цю папку й закриває вікно', async () => {
    const { wrapper, deleteFolder } = await mountWithFolders()
    await clickTrash(wrapper)
    await wrapper.find('[data-testid="folder-delete-confirm"]').trigger('click')
    await vi.waitFor(() => expect(deleteFolder).toHaveBeenCalledWith(7))
    expect(deleteFolder).toHaveBeenCalledTimes(1)
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="folder-delete-dialog"]').exists()).toBe(false))
  })

  it('підпапка — дошки йдуть у батьківську папку; порожня — так і сказано', async () => {
    const { wrapper } = await mountWithFolders()
    const BoardFolderTree = (await import('../components/boards/BoardFolderTree.vue')).default
    const tree = wrapper.findComponent(BoardFolderTree)

    tree.vm.$emit('delete', 8)
    await wrapper.vm.$nextTick()
    const sub = wrapper.find('[data-testid="folder-delete-dialog"]').text()
    expect(sub).toContain('winterboard.folders.confirmDelete.boardsMove:{"count":1,"target":"Олексій"}')
    expect(sub).not.toContain('childrenMove')

    await wrapper.find('.wb-dialog__btn--cancel').trigger('click')
    tree.vm.$emit('delete', 9)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="folder-delete-dialog"]').text())
      .toContain('winterboard.folders.confirmDelete.empty')
  })

  it('невідома папка (дерево застаріло) — без вікна й без видалення, дерево оновлюється', async () => {
    const { wrapper, deleteFolder } = await mountWithFolders()
    const calls = mockListBoardFolders.mock.calls.length
    const BoardFolderTree = (await import('../components/boards/BoardFolderTree.vue')).default
    wrapper.findComponent(BoardFolderTree).vm.$emit('delete', 999)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="folder-delete-dialog"]').exists()).toBe(false)
    expect(deleteFolder).not.toHaveBeenCalled()
    expect(mockListBoardFolders.mock.calls.length).toBe(calls + 1)
  })
})
