// WB: useContentSidebar — live "Обробка..." → ready badge updates.
// Regression: the materials list never cleared the processing badge until a hard
// reload because it didn't listen for content:processing-complete and had no poll
// fallback for a flaky/denied notifications WS channel.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, defineComponent, h, nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'

const mockGetItems = vi.fn()
vi.mock('@/modules/learning-content/api/learningContentApi', () => ({
  learningContentApi: {
    getLessonAllowedItems: (...a: unknown[]) => mockGetItems(...a),
  },
}))

import { useContentSidebar } from '../composables/useContentSidebar'

type Api = ReturnType<typeof useContentSidebar>

function mountSidebar(): { wrapper: ReturnType<typeof mount>; api: Api } {
  let api!: Api
  const Comp = defineComponent({
    setup() {
      api = useContentSidebar(ref('1'))
      return () => h('div')
    },
  })
  const wrapper = mount(Comp)
  return { wrapper, api }
}

function pdfItem(id: number, status: string) {
  return {
    id,
    content_item: { id, type: 'pdf', title: `f${id}.pdf` },
    asset_category: 'pdf',
    processing_status: status,
  }
}

describe('useContentSidebar — live processing status', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.useRealTimers())

  it('clears the badge in place on content:processing-complete (no reload needed)', async () => {
    mockGetItems.mockResolvedValue([pdfItem(10, 'pending')])
    const { wrapper, api } = mountSidebar()
    await flushPromises()
    expect(api.items.value[0].processing_status).toBe('pending')

    window.dispatchEvent(new CustomEvent('content:processing-complete', {
      detail: { content_item_id: 10, processing_status: 'ready', page_count: 3 },
    }))
    await nextTick()

    expect(api.items.value[0].processing_status).toBe('ready')
    expect(api.items.value[0].page_count).toBe(3)
    wrapper.unmount()
  })

  it('stops listening after unmount (no leak)', async () => {
    mockGetItems.mockResolvedValue([pdfItem(10, 'ready')])
    const { wrapper, api } = mountSidebar()
    await flushPromises()
    wrapper.unmount()

    window.dispatchEvent(new CustomEvent('content:processing-complete', {
      detail: { content_item_id: 10, processing_status: 'pending' },
    }))
    await nextTick()
    expect(api.items.value[0].processing_status).toBe('ready') // unchanged
  })

  it('polls while pending and stops once everything is ready', async () => {
    vi.useFakeTimers()
    mockGetItems.mockResolvedValue([pdfItem(10, 'pending')])
    const { wrapper } = mountSidebar()

    await vi.advanceTimersByTimeAsync(10) // initial load (pending) → starts poll
    const afterLoad = mockGetItems.mock.calls.length
    await vi.advanceTimersByTimeAsync(4100) // one poll cycle
    expect(mockGetItems.mock.calls.length).toBeGreaterThan(afterLoad)

    // Backend now reports ready → next poll fetches it and polling stops.
    mockGetItems.mockResolvedValue([pdfItem(10, 'ready')])
    await vi.advanceTimersByTimeAsync(4100)
    const afterReady = mockGetItems.mock.calls.length
    await vi.advanceTimersByTimeAsync(12000) // no further polling
    expect(mockGetItems.mock.calls.length).toBe(afterReady)

    wrapper.unmount()
  })
})
