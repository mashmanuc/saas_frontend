/**
 * Поступова обробка PDF (власник 2026-10-23: «Чого так довго вантажить? Алгебру 10 клас» — підручник на 448
 * сторінок висів в «Обробці» ~3,5 хв; «роби»): сервер віддає готові сторінки одразу після першої й далі
 * кожні 10. Тут — що з цим робить дошка:
 *   — картка файлу відкривається, щойно є перша сторінка, і пише «Готово N з M»;
 *   — «Мої файли» підтягують нові сторінки, не чекаючи кінця обробки;
 *   — вибір сторінок показує «N з M стор.» і сам дотягує нові;
 *   — документ на дошці перепитує сторінки, поки обробка йде, і пише «Сторінка ще готується…».
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, defineComponent, h } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createI18n } from 'vue-i18n'
import uk from '../../../i18n/locales/uk.json'
import en from '../../../i18n/locales/en.json'
import type { AllowedContentItem } from '../types/sidebar'

const mockGetItemDetail = vi.fn()
const mockUploadFile = vi.fn()
const mockFetchAssets = vi.fn()

vi.mock('@/modules/learning-content/api/learningContentApi', () => ({
  learningContentApi: {
    getItemDetail: (...a: unknown[]) => mockGetItemDetail(...a),
    uploadFile: (...a: unknown[]) => mockUploadFile(...a),
  },
}))
vi.mock('@/modules/groups/api/groupApi', () => ({
  groupApi: { listMaterials: () => Promise.resolve([]), addMaterial: () => Promise.resolve({}) },
}))
vi.mock('@/modules/winterboard/api/library', () => ({
  fetchAssets: (...a: unknown[]) => mockFetchAssets(...a),
  fetchRecentAssets: () => Promise.resolve([]),
}))

import ContentSidebarItem from '../components/sidebar/ContentSidebarItem.vue'
import PdfPageSelector from '../components/sidebar/PdfPageSelector.vue'
import { useGroupSidebar } from '../composables/useGroupSidebar'
import {
  getDocumentPageMap, isDocumentStillProcessing, refreshIncompleteDocument, retryDocumentPageCache,
} from '../composables/useDocumentPageCache'

const i18n = () => createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'en', messages: { uk, en } as any })

function pages(n: number): Record<string, { thumbnail_url: string }> {
  return Object.fromEntries(Array.from({ length: n }, (_, i) => [String(i + 1), { thumbnail_url: `p${i + 1}.png` }]))
}

function pdf(over: Partial<AllowedContentItem> = {}): AllowedContentItem {
  return {
    id: 5, content_item_id: 2272, content_type: 'pdf', title: 'algebra-10-klas-ister.pdf',
    asset_category: 'pdf', thumbnail_url: null, processing_status: 'processing',
    pages: pages(1), page_count: 448, ...over,
  } as AllowedContentItem
}

function detail(ready: number, status = 'processing', total = 448) {
  return { id: 2272, processing_status: status, content_json: { page_count: total, pages: pages(ready) } }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFetchAssets.mockResolvedValue({ results: [], count: 0 })
})
afterEach(() => vi.useRealTimers())

describe('картка файлу', () => {
  it('PDF з першою готовою сторінкою: «Готово 1 з 448», не приглушений, відкривається кліком', async () => {
    mockGetItemDetail.mockResolvedValue(detail(1))
    const w = mount(ContentSidebarItem, { props: { item: pdf(), isTutor: true }, global: { plugins: [i18n()], stubs: { teleport: true } } })
    expect(w.find('[data-testid="sidebar-processing-badge"]').text()).toBe('Готово 1 з 448')
    const card = w.find('.sidebar-item')
    expect(card.classes()).not.toContain('sidebar-item--processing')
    expect(card.attributes('draggable')).toBe('true')
    await card.trigger('click')
    expect(w.findComponent(PdfPageSelector).exists()).toBe(true)
    w.unmount()
  })

  it('ще жодної сторінки — як раніше: «Обробка...», приглушений, не відкривається', async () => {
    const w = mount(ContentSidebarItem, { props: { item: pdf({ pages: {} }), isTutor: true }, global: { plugins: [i18n()], stubs: { teleport: true } } })
    expect(w.find('[data-testid="sidebar-processing-badge"]').text()).toBe('Обробка...')
    expect(w.find('.sidebar-item').classes()).toContain('sidebar-item--processing')
    await w.find('.sidebar-item').trigger('click')
    expect(w.findComponent(PdfPageSelector).exists()).toBe(false)
    w.unmount()
  })
})

describe('вибір сторінок', () => {
  it('«1 з 448 стор.», нові сторінки доходять самі; коли готово — опитування стає', async () => {
    vi.useFakeTimers()
    mockGetItemDetail.mockResolvedValue(detail(11))
    const w = mount(PdfPageSelector, { props: { item: pdf() }, global: { plugins: [i18n()] } })
    await flushPromises()
    expect(w.find('[data-testid="pdf-selector-count"]').text()).toBe('1 з 448 стор.')

    await vi.advanceTimersByTimeAsync(4000)
    await flushPromises()
    expect(w.findAll('.pdf-selector__page')).toHaveLength(11)
    expect(w.find('[data-testid="pdf-selector-count"]').text()).toBe('11 з 448 стор.')

    mockGetItemDetail.mockResolvedValue(detail(448, 'ready'))
    await vi.advanceTimersByTimeAsync(4000)
    await flushPromises()
    expect(w.find('[data-testid="pdf-selector-count"]').text()).toBe('448 стор.')
    const calls = mockGetItemDetail.mock.calls.length
    await vi.advanceTimersByTimeAsync(20000)
    expect(mockGetItemDetail.mock.calls.length).toBe(calls)
    w.unmount()
  })
})

describe('«Мої файли»', () => {
  it('опитування підтягує нові сторінки, поки обробка йде, а не лише наприкінці', async () => {
    vi.useFakeTimers()
    mockUploadFile.mockResolvedValue({ id: 2272, title: 'algebra.pdf', type: 'pdf', asset_category: 'pdf', processing_status: 'pending' })
    let api!: ReturnType<typeof useGroupSidebar>
    const w = mount(defineComponent({ setup() { api = useGroupSidebar(ref(null)); return () => h('div') } }))
    await flushPromises()
    await api.uploadFile(new File(['x'], 'algebra.pdf', { type: 'application/pdf' }))

    mockGetItemDetail.mockResolvedValue(detail(1))
    await vi.advanceTimersByTimeAsync(4000)
    await flushPromises()
    expect([api.items.value[0].processing_status, Object.keys(api.items.value[0].pages ?? {}).length, api.items.value[0].page_count])
      .toEqual(['processing', 1, 448])

    mockGetItemDetail.mockResolvedValue(detail(21))
    await vi.advanceTimersByTimeAsync(4000)
    await flushPromises()
    expect(Object.keys(api.items.value[0].pages ?? {}).length).toBe(21)
    w.unmount()
  })
})

describe('документ на дошці', () => {
  it('поки обробка йде, сторінки можна перепитати — не частіше ніж раз на 3,5 с; готовий — ні', async () => {
    retryDocumentPageCache(2272)
    vi.useFakeTimers()
    mockGetItemDetail.mockResolvedValue(detail(10))
    expect((await getDocumentPageMap(2272, 'pdf')).size).toBe(10)
    expect(isDocumentStillProcessing(2272)).toBe(true)
    expect(refreshIncompleteDocument(2272)).toBe(false)
    vi.advanceTimersByTime(3600)
    expect(refreshIncompleteDocument(2272)).toBe(true)

    mockGetItemDetail.mockResolvedValue(detail(448, 'ready'))
    expect((await getDocumentPageMap(2272, 'pdf')).size).toBe(448)
    expect(isDocumentStillProcessing(2272)).toBe(false)
    vi.advanceTimersByTime(10_000)
    expect(refreshIncompleteDocument(2272)).toBe(false)
  })

  it('неготова сторінка: «Сторінка ще готується…» і перепит раз на 4 с, лише поки документ обробляється', () => {
    const src = readFileSync(resolve(__dirname, '../components/canvas/DocumentViewerAsset.vue'), 'utf-8')
    expect(src).toContain("text: pageWaiting.value ? t('winterboard.pdfSelector.pageNotReady') : '...'")
    const wait = src.slice(src.indexOf('function waitForPage'), src.indexOf('onBeforeUnmount(clearPageWait)'))
    expect(wait).toContain('isDocumentStillProcessing(contentId)')
    expect(wait).toContain('refreshIncompleteDocument(contentId)')
    expect(wait).toContain('pageWaitTries >= PAGE_WAIT_MAX')
    expect((uk as any).winterboard.pdfSelector.pageNotReady).toBe('Сторінка ще готується…')
  })
})
