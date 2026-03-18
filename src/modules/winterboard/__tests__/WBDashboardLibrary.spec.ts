// WB Phase 7: Tests for B14 (WBDashboard) + B15 (WBLibrary, LibraryAssetCard, LibraryFolderTree)
// DoD: 8+ unit tests, green run, correct API usage

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

// ─── Mock vue-i18n ────────────────────────────────────────────────────────────

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
  }),
}))

// ─── Mock vue-router ──────────────────────────────────────────────────────────

const mockPush = vi.fn()
const mockResolve = vi.fn((route: any) => ({ href: `/winterboard/${route.params?.id ?? ''}` }))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush, resolve: mockResolve }),
  RouterLink: { template: '<a><slot /></a>' },
}))

// ─── Mock authStore ───────────────────────────────────────────────────────────

vi.mock('@/modules/auth/store/authStore', () => ({
  useAuthStore: () => ({ user: { first_name: 'Olena', email: 'olena@test.com' } }),
}))

// ─── Mock winterboardApi ──────────────────────────────────────────────────────

const mockListSessions = vi.fn()

vi.mock('../api/winterboardApi', () => ({
  winterboardApi: {
    listSessions: mockListSessions,
  },
}))

// ─── Mock library API ─────────────────────────────────────────────────────────

const mockFetchAssets = vi.fn()
const mockFetchFoldersTree = vi.fn()
const mockFetchRecentAssets = vi.fn()
const mockToggleFavorite = vi.fn()
const mockDeleteAsset = vi.fn()
const mockCreateFolder = vi.fn()

vi.mock('../api/library', () => ({
  fetchAssets: mockFetchAssets,
  fetchFoldersTree: mockFetchFoldersTree,
  fetchRecentAssets: mockFetchRecentAssets,
  toggleFavorite: mockToggleFavorite,
  deleteAsset: mockDeleteAsset,
  createFolder: mockCreateFolder,
}))

// ─── Mock useToast ────────────────────────────────────────────────────────────

const mockShowToast = vi.fn()

vi.mock('../composables/useToast', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}))

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const SESSION = {
  id: 'uuid-001',
  name: 'Math Lesson',
  page_count: 4,
  thumbnail_url: 'https://cdn.example.com/math.png',
  rev: 1,
  updated_at: new Date(Date.now() - 3600_000).toISOString(),
  created_at: new Date(Date.now() - 86400_000).toISOString(),
}

const ASSET_WITH_THUMB: any = {
  id: 1,
  name: 'diagram.png',
  storage_key: 'key1',
  cdn_url: 'https://cdn.example.com/diagram.png',
  thumbnail_url: 'https://cdn.example.com/diagram_thumb.png',
  content_type: 'image/png',
  size_bytes: 204800,
  status: 'active',
  folder: null,
  is_favorite: false,
  last_used_at: null,
  tags: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

const ASSET_NO_THUMB: any = {
  ...ASSET_WITH_THUMB,
  id: 2,
  name: 'report.pdf',
  thumbnail_url: '',
  content_type: 'application/pdf',
  is_favorite: true,
}

const ASSET_VIDEO: any = {
  ...ASSET_WITH_THUMB,
  id: 3,
  name: 'lecture.mp4',
  thumbnail_url: '',
  content_type: 'video/mp4',
  is_favorite: false,
}

const FOLDER: any = {
  id: 10,
  name: 'Images',
  parent: null,
  children: [
    { id: 11, name: 'Diagrams', parent: 10, children: [], assets_count: 3 },
  ],
  assets_count: 8,
}

// ─── Mount helpers ────────────────────────────────────────────────────────────

async function mountAssetCard(asset = ASSET_WITH_THUMB) {
  const LibraryAssetCard = (await import('../components/library/LibraryAssetCard.vue')).default
  return mount(LibraryAssetCard, { props: { asset } })
}

async function mountFolderTree(folders = [FOLDER], selectedId: number | null = null) {
  const LibraryFolderTree = (await import('../components/library/LibraryFolderTree.vue')).default
  return mount(LibraryFolderTree, { props: { folders, selectedId } })
}

async function mountDashboard() {
  const WBDashboard = (await import('../views/WBDashboard.vue')).default
  return mount(WBDashboard, {
    global: {
      stubs: { RouterLink: { template: '<a><slot /></a>' } },
    },
  })
}

async function mountLibrary() {
  const WBLibrary = (await import('../views/WBLibrary.vue')).default
  return mount(WBLibrary, {
    global: {
      stubs: { Teleport: true },
    },
  })
}

// ─── Tests: LibraryAssetCard ──────────────────────────────────────────────────

describe('LibraryAssetCard.vue (B15)', () => {
  beforeEach(() => setActivePinia(createPinia()))
  afterEach(() => vi.clearAllMocks())

  // Test 1
  it('renders thumbnail img when thumbnail_url is present', async () => {
    const wrapper = await mountAssetCard(ASSET_WITH_THUMB)
    const img = wrapper.find('.library-asset-card__img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe(ASSET_WITH_THUMB.thumbnail_url)
    expect(wrapper.find('.library-asset-card__icon').exists()).toBe(false)
  })

  // Test 2
  it('renders file icon when no thumbnail_url', async () => {
    const wrapper = await mountAssetCard(ASSET_NO_THUMB)
    expect(wrapper.find('.library-asset-card__img').exists()).toBe(false)
    expect(wrapper.find('.library-asset-card__icon').exists()).toBe(true)
    expect(wrapper.find('.library-asset-card__icon').text()).toBe('📄')
  })

  // Test 3
  it('renders video icon for video content_type', async () => {
    const wrapper = await mountAssetCard(ASSET_VIDEO)
    expect(wrapper.find('.library-asset-card__icon').text()).toBe('🎬')
  })

  // Test 4
  it('emits toggle-favorite when star button clicked', async () => {
    const wrapper = await mountAssetCard(ASSET_WITH_THUMB)
    const favoriteBtn = wrapper.find('.library-asset-card__action-btn')
    await favoriteBtn.trigger('click')
    const emitted = wrapper.emitted('toggle-favorite')
    expect(emitted).toHaveLength(1)
    expect(emitted![0][0]).toEqual(ASSET_WITH_THUMB)
  })

  // Test 5
  it('emits delete when delete button clicked', async () => {
    const wrapper = await mountAssetCard()
    const deleteBtn = wrapper.find('.library-asset-card__action-btn--danger')
    await deleteBtn.trigger('click')
    expect(wrapper.emitted('delete')).toHaveLength(1)
  })

  // Test 6
  it('shows is-favorite class when asset.is_favorite is true', async () => {
    const wrapper = await mountAssetCard(ASSET_NO_THUMB)
    expect(wrapper.find('.library-asset-card--favorite').exists()).toBe(true)
  })

  // Test 7
  it('displays formatted file size', async () => {
    const wrapper = await mountAssetCard(ASSET_WITH_THUMB) // 204800 bytes = 200.0 KB
    expect(wrapper.find('.library-asset-card__size').text()).toContain('KB')
  })
})

// ─── Tests: LibraryFolderTree ─────────────────────────────────────────────────

describe('LibraryFolderTree.vue (B15)', () => {
  beforeEach(() => setActivePinia(createPinia()))
  afterEach(() => vi.clearAllMocks())

  // Test 8
  it('renders All Files button always', async () => {
    const wrapper = await mountFolderTree([])
    const items = wrapper.findAll('.wb-folder-tree__item')
    // Should have at least All Files + Favorites + Recent = 3 fixed items
    expect(items.length).toBeGreaterThanOrEqual(3)
  })

  // Test 9
  it('emits select(null) when All Files clicked', async () => {
    const wrapper = await mountFolderTree([])
    const allFilesBtn = wrapper.findAll('.wb-folder-tree__item')[0]
    await allFilesBtn.trigger('click')
    expect(wrapper.emitted('select')).toHaveLength(1)
    expect(wrapper.emitted('select')![0]).toEqual([null])
  })

  // Test 10
  it('renders folder names from props', async () => {
    const wrapper = await mountFolderTree([FOLDER])
    const folderItems = wrapper.findAll('.wb-folder-tree__item--folder')
    expect(folderItems.length).toBe(2) // Images + Diagrams (nested)
    expect(folderItems[0].text()).toContain('Images')
    expect(folderItems[1].text()).toContain('Diagrams')
  })

  // Test 11
  it('emits select with folder id when folder clicked', async () => {
    const wrapper = await mountFolderTree([FOLDER])
    const folderBtn = wrapper.find('.wb-folder-tree__item--folder')
    await folderBtn.trigger('click')
    expect(wrapper.emitted('select')![0]).toEqual([FOLDER.id])
  })

  // Test 12
  it('marks selected folder with active class', async () => {
    const wrapper = await mountFolderTree([FOLDER], FOLDER.id)
    const activeFolderBtn = wrapper.findAll('.wb-folder-tree__item--folder')
      .find((b) => b.classes('wb-folder-tree__item--active'))
    expect(activeFolderBtn).toBeDefined()
  })
})

// ─── Tests: WBDashboard ───────────────────────────────────────────────────────

describe('WBDashboard.vue (B14)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockListSessions.mockResolvedValue({ count: 1, results: [SESSION] })
  })
  afterEach(() => vi.clearAllMocks())

  // Test 13
  it('calls listSessions on mount', async () => {
    await mountDashboard()
    await vi.waitFor(() => expect(mockListSessions).toHaveBeenCalledOnce())
  })

  // Test 14
  it('renders recent board name after loading', async () => {
    const wrapper = await mountDashboard()
    await vi.waitFor(() =>
      expect(wrapper.find('.wb-recent-card__name').exists()).toBe(true)
    )
    expect(wrapper.find('.wb-recent-card__name').text()).toBe(SESSION.name)
  })

  // Test 15
  it('shows empty state when no boards returned', async () => {
    mockListSessions.mockResolvedValueOnce({ count: 0, results: [] })
    const wrapper = await mountDashboard()
    await vi.waitFor(() =>
      expect(wrapper.find('.wb-dashboard__empty').exists()).toBe(true)
    )
  })

  // Test 16
  it('navigates to board on recent card click', async () => {
    const mockOpen = vi.fn()
    vi.stubGlobal('open', mockOpen)

    const wrapper = await mountDashboard()
    await vi.waitFor(() => expect(wrapper.find('.wb-recent-card').exists()).toBe(true))
    await wrapper.find('.wb-recent-card').trigger('click')
    expect(mockResolve).toHaveBeenCalledWith({
      name: 'winterboard-solo',
      params: { id: SESSION.id },
    })
    expect(mockOpen).toHaveBeenCalledWith(
      `/winterboard/${SESSION.id}`,
      '_blank',
      'noopener',
    )

    vi.unstubAllGlobals()
  })
})

// ─── Tests: WBLibrary ─────────────────────────────────────────────────────────

describe('WBLibrary.vue (B15)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockFetchFoldersTree.mockResolvedValue([FOLDER])
    mockFetchAssets.mockResolvedValue({ count: 2, results: [ASSET_WITH_THUMB, ASSET_NO_THUMB] })
  })
  afterEach(() => vi.clearAllMocks())

  // Test 17
  it('calls fetchAssets on mount', async () => {
    await mountLibrary()
    await vi.waitFor(() => expect(mockFetchAssets).toHaveBeenCalledOnce())
  })

  // Test 18
  it('shows empty state when no assets returned', async () => {
    mockFetchAssets.mockResolvedValueOnce({ count: 0, results: [] })
    mockFetchFoldersTree.mockResolvedValueOnce([])
    const wrapper = await mountLibrary()
    await vi.waitFor(() =>
      expect(wrapper.find('.wb-library__empty').exists()).toBe(true)
    )
  })
})
