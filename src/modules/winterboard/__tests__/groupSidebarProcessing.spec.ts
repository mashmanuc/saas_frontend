// WB: useGroupSidebar — значок «Обробка…» має зникати сам.
//
// Панель «Матеріали» на ВСІХ дошках (Solo, Constructor, Classroom) живиться
// саме цим composable. Власник 2026-09-24: «при відкритій дошці додаю файл до
// матеріалів, а його крутить ніби грузить, а він давно завантажився».
//
// Два канали оновлення статусу мають працювати незалежно один від одного:
//   1) WS-подія `content:processing-complete` (бекенд шле її з media_tasks);
//   2) опитування `getItemDetail` — запасний шлях, коли WS не долетів.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, defineComponent, h, nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'

const mockGetItemDetail = vi.fn()
const mockUploadFile = vi.fn()
const mockListMaterials = vi.fn()
const mockAddMaterial = vi.fn()
const mockFetchAssets = vi.fn()

vi.mock('@/modules/learning-content/api/learningContentApi', () => ({
  learningContentApi: {
    getItemDetail: (...a: unknown[]) => mockGetItemDetail(...a),
    uploadFile: (...a: unknown[]) => mockUploadFile(...a),
  },
}))
vi.mock('@/modules/groups/api/groupApi', () => ({
  groupApi: {
    listMaterials: (...a: unknown[]) => mockListMaterials(...a),
    addMaterial: (...a: unknown[]) => mockAddMaterial(...a),
  },
}))
vi.mock('@/modules/winterboard/api/library', () => ({
  fetchAssets: (...a: unknown[]) => mockFetchAssets(...a),
  fetchRecentAssets: () => Promise.resolve([]),
}))

import { useGroupSidebar } from '../composables/useGroupSidebar'

type Api = ReturnType<typeof useGroupSidebar>

function mountSidebar(groupId: string | null): { wrapper: ReturnType<typeof mount>; api: Api } {
  let api!: Api
  const Comp = defineComponent({
    setup() {
      api = useGroupSidebar(ref(groupId))
      return () => h('div')
    },
  })
  const wrapper = mount(Comp)
  return { wrapper, api }
}

function docxFile(): File {
  return new File(['x'], 'lesson.docx', {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
}

describe('useGroupSidebar — «Обробка…» знімається без перезавантаження', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchAssets.mockResolvedValue({ results: [], count: 0 })
    mockListMaterials.mockResolvedValue([])
    mockAddMaterial.mockResolvedValue({})
    mockUploadFile.mockResolvedValue({
      id: 77, title: 'lesson.docx', type: 'document',
      asset_category: 'document', processing_status: 'pending',
    })
  })
  afterEach(() => vi.useRealTimers())

  it('бібліотека (без групи): опитування знімає значок після завантаження', async () => {
    vi.useFakeTimers()
    const { wrapper, api } = mountSidebar(null)
    await flushPromises()

    await api.uploadFile(docxFile())
    expect(api.items.value[0].processing_status).toBe('pending')

    mockGetItemDetail.mockResolvedValue({ id: 77, processing_status: 'ready', content_json: {} })
    await vi.advanceTimersByTimeAsync(5000)
    await flushPromises()

    expect(mockGetItemDetail).toHaveBeenCalledWith(77)
    expect(api.items.value[0].processing_status).toBe('ready')
    wrapper.unmount()
  })

  it('група: опитування знімає значок після завантаження', async () => {
    vi.useFakeTimers()
    const { wrapper, api } = mountSidebar('5')
    await flushPromises()

    await api.uploadFile(docxFile())
    expect(api.items.value[0].processing_status).toBe('pending')

    mockGetItemDetail.mockResolvedValue({ id: 77, processing_status: 'ready', content_json: {} })
    await vi.advanceTimersByTimeAsync(5000)
    await flushPromises()

    expect(api.items.value[0].processing_status).toBe('ready')
    wrapper.unmount()
  })

  it('файл, що завис у pending, не опитується вічно', async () => {
    vi.useFakeTimers()
    const { wrapper, api } = mountSidebar('5')
    await flushPromises()
    await api.uploadFile(docxFile())

    // Бекенд мовчить: статус так і лишається 'pending'.
    mockGetItemDetail.mockResolvedValue({ id: 77, processing_status: 'pending', content_json: {} })
    await vi.advanceTimersByTimeAsync(4000 * 80)
    await flushPromises()
    const afterBudget = mockGetItemDetail.mock.calls.length

    await vi.advanceTimersByTimeAsync(4000 * 20)
    await flushPromises()

    expect(afterBudget).toBeLessThanOrEqual(76)
    expect(mockGetItemDetail.mock.calls.length).toBe(afterBudget)
    wrapper.unmount()
  })

  it('старий актив бібліотеки без ContentItem не опитується (/items/null/ = 404)', async () => {
    vi.useFakeTimers()
    mockFetchAssets.mockResolvedValue({
      results: [{
        id: 5, content_item_id: null, name: 'old.pdf', content_type: 'application/pdf',
        status: 'processing', processing_status: 'pending', thumbnail_url: null,
        cdn_url: '', storage_key: 'k/5.pdf',
      }],
      count: 1,
    })
    const { wrapper, api } = mountSidebar(null)
    await flushPromises()
    expect(api.items.value[0].processing_status).toBe('pending')

    await vi.advanceTimersByTimeAsync(20000)
    await flushPromises()

    expect(mockGetItemDetail).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('WS-подія знімає значок одразу, без опитування', async () => {
    const { wrapper, api } = mountSidebar('5')
    await flushPromises()
    await api.uploadFile(docxFile())

    window.dispatchEvent(new CustomEvent('content:processing-complete', {
      detail: { content_item_id: 77, processing_status: 'ready', page_count: 4 },
    }))
    await nextTick()

    expect(api.items.value[0].processing_status).toBe('ready')
    expect(api.items.value[0].page_count).toBe(4)
    expect(mockGetItemDetail).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
