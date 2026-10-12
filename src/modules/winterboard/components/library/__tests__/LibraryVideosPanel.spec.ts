/**
 * Вкладка «Відео» в «Матеріалах» — ТЗ TZ_BOARD_VIDEO_PICKER_AND_LIBRARY_2026-10-11 §1 п.4, §6.
 * Архівувати ≠ видалити; архівоване повертається лише «Повернути до моїх відео».
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '@/i18n/locales/uk.json'

const api = vi.hoisted(() => ({
  fetchVideos: vi.fn(),
  addYouTubeAsset: vi.fn(),
  archiveVideo: vi.fn(),
  unarchiveVideo: vi.fn(),
  deleteAsset: vi.fn(),
}))
const toast = vi.hoisted(() => ({ showToast: vi.fn() }))

vi.mock('../../../api/library', () => api)
vi.mock('../../../composables/useToast', () => ({ useToast: () => toast }))

import LibraryVideosPanel from '../LibraryVideosPanel.vue'

const i18n = createI18n({ legacy: false, locale: 'uk', messages: { uk } })

const V1 = { id: 1, name: 'Дроби', cdn_url: 'https://youtu.be/aaaaaaaaaaa', thumbnail_url: 't1', status: 'active' }
const V2 = { id: 2, name: 'Відсотки', cdn_url: 'https://youtu.be/bbbbbbbbbbb', thumbnail_url: 't2', status: 'active' }
const A1 = { id: 3, name: 'Старе відео', cdn_url: 'https://youtu.be/ccccccccccc', thumbnail_url: 't3', status: 'archived' }

function mountPanel() {
  return mount(LibraryVideosPanel, {
    global: { plugins: [i18n], stubs: { teleport: true } },
  })
}

describe('LibraryVideosPanel — вкладка «Відео»', () => {
  beforeEach(() => {
    Object.values(api).forEach((f) => f.mockReset())
    toast.showToast.mockReset()
    api.fetchVideos.mockImplementation(async (opts: { archived?: boolean } = {}) => (
      opts.archived ? { count: 1, results: [A1] } : { count: 2, results: [V1, V2] }
    ))
  })

  it('показує «Мої відео» (без архіву) з прев\'ю й назвою', async () => {
    const w = mountPanel()
    await flushPromises()
    expect(api.fetchVideos).toHaveBeenCalledWith({ archived: false })
    expect(w.findAll('[data-testid="videos-list"] li')).toHaveLength(2)
    expect(w.text()).toContain('Дроби')
    expect(w.find('img[src="t1"]').exists()).toBe(true)
    expect(w.emitted('count')?.[0]).toEqual([2])
  })

  it('«Архівувати» → запит архіву, відео зникає зі списку; видалення не викликається', async () => {
    api.archiveVideo.mockResolvedValue({ ...V1, status: 'archived' })
    const w = mountPanel()
    await flushPromises()
    await w.find('[data-testid="video-1"] [data-testid="video-archive"]').trigger('click')
    await flushPromises()
    expect(api.archiveVideo).toHaveBeenCalledWith(1)
    expect(api.deleteAsset).not.toHaveBeenCalled()
    expect(w.find('[data-testid="video-1"]').exists()).toBe(false)
  })

  it('фільтр «Архів» → архівовані; «Повернути до моїх відео» — єдиний шлях назад', async () => {
    api.unarchiveVideo.mockResolvedValue({ ...A1, status: 'active' })
    const w = mountPanel()
    await flushPromises()
    // Фільтр зветься «Архів відео» — не плутати з головною вкладкою «Архів» (кошик) «Матеріалів»
    expect(w.find('[data-testid="videos-filter-archive"]').text()).toBe('Архів відео')
    await w.find('[data-testid="videos-filter-archive"]').trigger('click')
    await flushPromises()
    expect(api.fetchVideos).toHaveBeenLastCalledWith({ archived: true })
    expect(w.text()).toContain('Старе відео')
    expect(w.find('[data-testid="video-archive"]').exists()).toBe(false)
    await w.find('[data-testid="video-3"] [data-testid="video-unarchive"]').trigger('click')
    await flushPromises()
    expect(api.unarchiveVideo).toHaveBeenCalledWith(3)
    expect(w.find('[data-testid="video-3"]').exists()).toBe(false)
  })

  it('«Видалити» — лише після підтвердження, у той самий кошик, що файли', async () => {
    api.deleteAsset.mockResolvedValue(undefined)
    const w = mountPanel()
    await flushPromises()
    await w.find('[data-testid="video-2"] [data-testid="video-delete"]').trigger('click')
    expect(api.deleteAsset).not.toHaveBeenCalled()
    const confirmText = w.find('[data-testid="video-delete-confirm"]').text()
    expect(confirmText).toContain('піде в кошик «Матеріалів» на 90 днів, як файли')
    expect(confirmText).not.toContain('вкладка «Архів»')
    await w.find('[data-testid="video-delete-yes"]').trigger('click')
    await flushPromises()
    expect(api.deleteAsset).toHaveBeenCalledWith(2)
    expect(w.find('[data-testid="video-2"]').exists()).toBe(false)
  })

  it('додати посиланням → явне додавання (без added_from), новий запис угорі', async () => {
    const NEW = { id: 9, name: 'Нове', cdn_url: 'https://youtu.be/ddddddddddd', thumbnail_url: 't9', status: 'active' }
    api.addYouTubeAsset.mockResolvedValue(NEW)
    const w = mountPanel()
    await flushPromises()
    await w.find('[data-testid="videos-link-input"]').setValue('https://youtu.be/ddddddddddd')
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(api.addYouTubeAsset).toHaveBeenCalledWith('https://youtu.be/ddddddddddd')
    expect(w.findAll('[data-testid="videos-list"] li')[0].text()).toContain('Нове')
  })

  it('посилання на архівоване відео — НЕ повертає саме, показує архів і причину', async () => {
    api.addYouTubeAsset.mockResolvedValue({ ...A1 })
    const w = mountPanel()
    await flushPromises()
    await w.find('[data-testid="videos-link-input"]').setValue('https://youtu.be/ccccccccccc')
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(api.unarchiveVideo).not.toHaveBeenCalled()
    expect(toast.showToast).toHaveBeenCalledWith(expect.stringContaining('в архіві'), 'info')
    expect(api.fetchVideos).toHaveBeenLastCalledWith({ archived: true })
  })

  it('невалідне посилання — без запиту', async () => {
    const w = mountPanel()
    await flushPromises()
    await w.find('[data-testid="videos-link-input"]').setValue('https://example.com/x')
    await w.find('form').trigger('submit')
    expect(api.addYouTubeAsset).not.toHaveBeenCalled()
    expect(toast.showToast).toHaveBeenCalledWith(expect.any(String), 'error')
  })
})
