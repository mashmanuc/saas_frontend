// «Показати ще» у бічних панелях файлів (власник 2026-10-13: «з часом там набіжиться і більше як по 100…»).
//
// Один механізм на всі типи: панель вантажить порцію по 50, а «Показати ще» — наступну порцію САМЕ
// поточного переліку (тип, пошук, тека), бо фільтр типу й пошук рахує сервер. Кнопки типів і лічильники —
// з сервера, а не з завантаженого. Відповідь старого переліку (тип змінили, поки летів запит) відкидається.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, defineComponent, h } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'

const mockFetchAssets = vi.fn()
const mockFetchFoldersTree = vi.fn()
const mockFetchRecentAssets = vi.fn()

vi.mock('@/modules/learning-content/api/learningContentApi', () => ({
  learningContentApi: { getItemDetail: vi.fn(), uploadFile: vi.fn() },
}))
vi.mock('@/modules/groups/api/groupApi', () => ({
  groupApi: { listMaterials: vi.fn(), addMaterial: vi.fn() },
}))
vi.mock('@/modules/winterboard/api/library', () => ({
  fetchAssets: (...a: unknown[]) => mockFetchAssets(...a),
  fetchRecentAssets: (...a: unknown[]) => mockFetchRecentAssets(...a),
  fetchFoldersTree: (...a: unknown[]) => mockFetchFoldersTree(...a),
  fetchPastedItems: vi.fn(),
  updateAsset: vi.fn(),
}))
vi.mock('../components/library/LibraryFolderTree.vue', () => ({ FAVORITES_ID: -1, RECENT_ID: -2, PASTED_ID: -3, ARCHIVED_ID: -4 }))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (k: string) => k }) }))
vi.mock('../composables/useToast', () => ({ useToast: () => ({ showToast: vi.fn() }) }))

import { useGroupSidebar } from '../composables/useGroupSidebar'
import { useMaterialsBrowser } from '../composables/useMaterialsBrowser'

const asset = (id: number, mime = 'video/mp4') => ({
  id, name: `файл ${id}`, content_type: mime, cdn_url: `/m/${id}`, thumbnail_url: '', storage_key: `k/${id}`,
  status: 'active', content_item_id: 1000 + id, processing_status: 'ready',
})
const page = (from: number, n: number, count: number, counts?: Record<string, number>) => ({
  count, results: Array.from({ length: n }, (_, i) => asset(from + i)),
  category_counts: counts ?? { video: count, image: 0 },
})

type Api = ReturnType<typeof useGroupSidebar>
function mountSidebar() {
  const category = ref('all')
  const search = ref('')
  let api!: Api
  mount(defineComponent({
    setup() {
      api = useGroupSidebar(ref(null), ref(null), { category, search })
      return () => h('div')
    },
  }))
  return { api, category, search }
}

describe('бічна панель «Мої файли» — «Показати ще»', () => {
  beforeEach(() => { vi.clearAllMocks() })
  afterEach(() => { vi.useRealTimers() })

  it('перша порція — 50; «Показати ще» — наступні 50 з offset; лічильники — з сервера', async () => {
    mockFetchAssets.mockResolvedValueOnce(page(1, 50, 120, { video: 120, pdf: 7 }))
    const { api } = mountSidebar()
    await flushPromises()
    expect(mockFetchAssets).toHaveBeenLastCalledWith({ limit: 50 })
    expect(api.items.value).toHaveLength(50)
    expect(api.listCount.value).toBe(120)
    expect(api.totalCount.value).toBe(127)       // усі файли теки, а не завантажені
    expect(api.hasMore.value).toBe(true)

    mockFetchAssets.mockResolvedValueOnce(page(51, 50, 120, { video: 120, pdf: 7 }))
    await api.loadMore()
    expect(mockFetchAssets).toHaveBeenLastCalledWith({ limit: 50, offset: 50 })
    expect(api.items.value).toHaveLength(100)

    mockFetchAssets.mockResolvedValueOnce(page(101, 20, 120, { video: 120, pdf: 7 }))
    await api.loadMore()
    expect(api.items.value).toHaveLength(120)
    expect(api.hasMore.value).toBe(false)
  })

  it('тип файлів і пошук — у запиті до сервера, тож «Показати ще» йде по всіх відео, а не по завантаженому', async () => {
    vi.useFakeTimers()
    mockFetchAssets.mockResolvedValue(page(1, 50, 300))
    const { api, category, search } = mountSidebar()
    await flushPromises()
    category.value = 'video'
    await flushPromises()
    expect(mockFetchAssets).toHaveBeenLastCalledWith({ limit: 50, category: 'video' })
    search.value = 'квадрат'
    await vi.advanceTimersByTimeAsync(299)
    expect(mockFetchAssets).not.toHaveBeenLastCalledWith({ limit: 50, category: 'video', search: 'квадрат' })
    await vi.advanceTimersByTimeAsync(1)
    await flushPromises()
    expect(mockFetchAssets).toHaveBeenLastCalledWith({ limit: 50, category: 'video', search: 'квадрат' })
    await api.loadMore()
    expect(mockFetchAssets).toHaveBeenLastCalledWith({ limit: 50, offset: 50, category: 'video', search: 'квадрат' })
  })

  it('тип змінили, поки летіла стара відповідь, — стару відкидаємо', async () => {
    let releaseOld!: (v: unknown) => void
    mockFetchAssets.mockImplementationOnce(() => new Promise((r) => { releaseOld = r }))
    const { api, category } = mountSidebar()
    mockFetchAssets.mockResolvedValueOnce(page(900, 3, 3, { pdf: 3 }))
    category.value = 'pdf'
    await flushPromises()
    releaseOld(page(1, 50, 120))
    await flushPromises()
    expect(api.items.value.map((i) => i.id)).toEqual([1900, 1901, 1902])
    expect(api.listCount.value).toBe(3)
  })

  it('номер змісту одного файла збігся з номером іншого файла бібліотеки — обидва лишаються, зсув — за рядками сервера', async () => {
    // перша порція: файл бібліотеки 7 зі змістом 5; друга — файл бібліотеки 5 БЕЗ змісту (тоді id = 5)
    mockFetchAssets.mockResolvedValueOnce({ count: 2, category_counts: { video: 2 },
      results: [{ ...asset(7), content_item_id: 5 }] })
    const { api } = mountSidebar()
    await flushPromises()
    mockFetchAssets.mockResolvedValueOnce({ count: 2, category_counts: { video: 2 },
      results: [{ ...asset(5), content_item_id: null }] })
    await api.loadMore()
    expect(mockFetchAssets).toHaveBeenLastCalledWith({ limit: 50, offset: 1 })
    expect(api.items.value.map((i) => i.library_asset_id)).toEqual([7, 5])
    expect(api.hasMore.value).toBe(false)
  })

  it('наступна порція не прийшла — список лишається, кнопка й повідомлення; повтор лише рукою', async () => {
    mockFetchAssets.mockResolvedValueOnce(page(1, 50, 80))
    const { api } = mountSidebar()
    await flushPromises()
    mockFetchAssets.mockRejectedValueOnce(new Error('offline'))
    await api.loadMore()
    expect(api.items.value).toHaveLength(50)
    expect(api.moreError.value).toBe(true)
    expect(api.hasMore.value).toBe(true)
    expect(mockFetchAssets).toHaveBeenCalledTimes(2)
  })
})

describe('тип файла — та сама таблиця, що на сервері (apps/winterboard/tests/test_library_categories.py)', () => {
  const MIME_TABLE: [string, string][] = [
    ['youtube_link', 'youtube'], ['image/png', 'image'], ['image/jpeg', 'image'], ['video/mp4', 'video'],
    ['audio/mpeg', 'audio'], ['application/pdf', 'pdf'],
    ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'presentation'],
    ['application/vnd.ms-powerpoint', 'presentation'],
    ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'document'],
    ['application/msword', 'document'], ['application/octet-stream', 'image'],
  ]

  it('кожен MIME — у той самий тип, що й фільтр сервера', async () => {
    vi.clearAllMocks()
    mockFetchAssets.mockResolvedValueOnce({
      count: MIME_TABLE.length, category_counts: {},
      results: MIME_TABLE.map(([mime], i) => asset(i + 1, mime)),
    })
    const { api } = mountSidebar()
    await flushPromises()
    expect(api.items.value.map((i) => i.asset_category)).toEqual(MIME_TABLE.map(([, cat]) => cat))
  })
})

describe('панель «Матеріали» з теками — «Показати ще»', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchFoldersTree.mockResolvedValue([])
    mockFetchRecentAssets.mockResolvedValue([])
  })

  it('порції тієї самої теки; інша тека — з першої порції', async () => {
    mockFetchAssets.mockResolvedValueOnce(page(1, 50, 70))
    const b = useMaterialsBrowser()
    b.selectFolder(42)
    await flushPromises()
    expect(mockFetchAssets).toHaveBeenLastCalledWith({ limit: 50, folder: 42 })
    expect(b.hasMore.value).toBe(true)
    expect(b.remainingAssets.value).toBe(20)

    mockFetchAssets.mockResolvedValueOnce(page(51, 20, 70))
    await b.loadMoreAssets()
    expect(mockFetchAssets).toHaveBeenLastCalledWith({ limit: 50, folder: 42, offset: 50 })
    expect(b.rawAssets.value).toHaveLength(70)
    expect(b.hasMore.value).toBe(false)

    mockFetchAssets.mockResolvedValueOnce(page(500, 5, 5))
    b.selectFolder(7)
    await flushPromises()
    expect(mockFetchAssets).toHaveBeenLastCalledWith({ limit: 50, folder: 7 })
    expect(b.rawAssets.value).toHaveLength(5)
  })
})
