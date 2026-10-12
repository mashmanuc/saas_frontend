/**
 * Вкладка «Відео» в «Матеріалах» — ТЗ TZ_BOARD_VIDEO_PICKER_AND_LIBRARY_2026-10-11 §1 п.4, §6, §7.
 * Етап 1: архівувати ≠ видалити; архівоване повертається лише «Повернути до моїх відео».
 * Етап 2 (§7): YouTube і власні відеофайли поруч — чипи, порядок, пам'ять вибору (і без
 * localStorage), позначки «YouTube» / «Файл», для файла лише «Видалити» (той самий кошик).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '@/i18n/locales/uk.json'

const api = vi.hoisted(() => ({
  fetchLibraryVideos: vi.fn(),
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

const FILTER_KEY = 'm4sh.wb.library.videos.filter'
const ORDERING_KEY = 'm4sh.wb.library.videos.ordering'

const yt = (id: number, name: string, extra: Record<string, unknown> = {}) => ({
  id, name, cdn_url: `https://youtu.be/${String(id).padStart(11, 'a')}`, thumbnail_url: `t${id}`,
  poster_url: `t${id}`, content_type: 'youtube_link', size_bytes: 0, status: 'active', video_kind: 'youtube',
  ...extra,
})
const file = (id: number, name: string, extra: Record<string, unknown> = {}) => ({
  id, name, cdn_url: `/media/${name}`, thumbnail_url: '', poster_url: '', content_type: 'video/mp4',
  size_bytes: 1572864, status: 'active', video_kind: 'file', ...extra,
})

const V1 = yt(1, 'Дроби')
const V2 = yt(2, 'Відсотки')
const A1 = yt(3, 'Старе відео', { status: 'archived' })
const F1 = file(10, 'Урок-1.mp4', { poster_url: 'https://cdn/poster-10.jpg' })
const F2 = file(11, 'Без-кадру.webm', { content_type: 'video/webm', size_bytes: 2048 })

type Query = { kind: string; ordering: string; archived?: 'only' }

function serverFor(q: Query) {
  if (q.archived === 'only') return { count: 1, results: [A1] }
  if (q.kind === 'youtube') return { count: 2, results: [V1, V2] }
  if (q.kind === 'file') return { count: 2, results: [F1, F2] }
  return { count: 4, results: [F1, V1, V2, F2] }
}

function mountPanel() {
  return mount(LibraryVideosPanel, {
    global: { plugins: [i18n], stubs: { teleport: true } },
  })
}

describe('LibraryVideosPanel — вкладка «Відео»', () => {
  beforeEach(() => {
    Object.values(api).forEach((f) => f.mockReset())
    toast.showToast.mockReset()
    localStorage.clear()
    api.fetchLibraryVideos.mockImplementation(async (q: Query) => serverFor(q))
  })

  // ── Етап 2: чипи, позначки, порядок ─────────────────────────────────────────────

  it('за замовчуванням «Усі» й «Спершу нові»: YouTube і файли поруч з позначками', async () => {
    const w = mountPanel()
    await flushPromises()
    expect(api.fetchLibraryVideos).toHaveBeenCalledTimes(1)
    expect(api.fetchLibraryVideos).toHaveBeenCalledWith({ kind: 'all', ordering: '-created_at' })
    expect(w.find('[data-testid="videos-filter-all"]').attributes('aria-selected')).toBe('true')
    expect((w.find('[data-testid="videos-ordering"]').element as HTMLSelectElement).value).toBe('-created_at')
    expect(w.findAll('[data-testid="videos-list"] li')).toHaveLength(4)
    expect(w.find('[data-testid="video-10"] [data-testid="video-badge"]').text()).toBe('Файл')
    expect(w.find('[data-testid="video-1"] [data-testid="video-badge"]').text()).toBe('YouTube')
    expect(w.emitted('count')?.[0]).toEqual([4])
    // Підписи чипів — як у ТЗ
    expect(w.findAll('[role="tab"]').map((b) => b.text())).toEqual(['Усі', 'YouTube', 'Мої файли', 'Архів відео'])
  })

  it('рядок файла: кадр-постер, якщо є; інакше значок відео; розмір; без «Архівувати»', async () => {
    const w = mountPanel()
    await flushPromises()
    const f1 = w.find('[data-testid="video-10"]')
    expect(f1.find('img').attributes('src')).toBe('https://cdn/poster-10.jpg')
    expect(f1.find('[data-testid="video-size"]').text()).toBe('1.5 MB')
    expect(f1.find('[data-testid="video-archive"]').exists()).toBe(false)
    expect(f1.find('[data-testid="video-delete"]').exists()).toBe(true)

    const f2 = w.find('[data-testid="video-11"]')
    expect(f2.find('img').exists()).toBe(false)
    expect(f2.find('.wb-video-row__thumb-empty').exists()).toBe(true)
    expect(f2.find('[data-testid="video-size"]').text()).toBe('2.0 KB')

    // YouTube-рядок: без розміру, з «Архівувати»
    const v1 = w.find('[data-testid="video-1"]')
    expect(v1.find('[data-testid="video-size"]').exists()).toBe(false)
    expect(v1.find('[data-testid="video-archive"]').exists()).toBe(true)
  })

  it('чипи: YouTube → kind=youtube; «Мої файли» → kind=file (без поля посилання); «Архів відео» → лише YouTube-архів', async () => {
    const w = mountPanel()
    await flushPromises()

    await w.find('[data-testid="videos-filter-youtube"]').trigger('click')
    await flushPromises()
    expect(api.fetchLibraryVideos).toHaveBeenLastCalledWith({ kind: 'youtube', ordering: '-created_at' })
    expect(w.findAll('[data-testid="video-badge"]').map((b) => b.text())).toEqual(['YouTube', 'YouTube'])
    expect(w.find('[data-testid="videos-link-input"]').exists()).toBe(true)

    await w.find('[data-testid="videos-filter-file"]').trigger('click')
    await flushPromises()
    expect(api.fetchLibraryVideos).toHaveBeenLastCalledWith({ kind: 'file', ordering: '-created_at' })
    expect(w.findAll('[data-testid="video-badge"]').map((b) => b.text())).toEqual(['Файл', 'Файл'])
    expect(w.find('[data-testid="videos-link-input"]').exists()).toBe(false)
    expect(w.find('[data-testid="video-archive"]').exists()).toBe(false)

    await w.find('[data-testid="videos-filter-archive"]').trigger('click')
    await flushPromises()
    expect(api.fetchLibraryVideos).toHaveBeenLastCalledWith({ kind: 'youtube', ordering: '-created_at', archived: 'only' })
    expect(w.find('[data-testid="videos-link-input"]').exists()).toBe(false)
  })

  it('порядок: «Спершу старі» і «За назвою» йдуть на сервер разом із чипом', async () => {
    const w = mountPanel()
    await flushPromises()
    const select = w.find('[data-testid="videos-ordering"]')
    expect(select.findAll('option').map((o) => o.text())).toEqual(['Спершу нові', 'Спершу старі', 'За назвою'])

    await select.setValue('created_at')
    await flushPromises()
    expect(api.fetchLibraryVideos).toHaveBeenLastCalledWith({ kind: 'all', ordering: 'created_at' })

    await w.find('[data-testid="videos-filter-file"]').trigger('click')
    await select.setValue('name')
    await flushPromises()
    expect(api.fetchLibraryVideos).toHaveBeenLastCalledWith({ kind: 'file', ordering: 'name' })
  })

  it('вибір чипа й порядку пам\'ятається в браузері і відновлюється після перезаходу', async () => {
    const w = mountPanel()
    await flushPromises()
    await w.find('[data-testid="videos-filter-file"]').trigger('click')
    await w.find('[data-testid="videos-ordering"]').setValue('name')
    await flushPromises()
    expect(localStorage.getItem(FILTER_KEY)).toBe('file')
    expect(localStorage.getItem(ORDERING_KEY)).toBe('name')
    w.unmount()

    api.fetchLibraryVideos.mockClear()
    const again = mountPanel()
    await flushPromises()
    expect(api.fetchLibraryVideos).toHaveBeenCalledTimes(1)
    expect(api.fetchLibraryVideos).toHaveBeenCalledWith({ kind: 'file', ordering: 'name' })
    expect(again.find('[data-testid="videos-filter-file"]').attributes('aria-selected')).toBe('true')
    expect((again.find('[data-testid="videos-ordering"]').element as HTMLSelectElement).value).toBe('name')
  })

  it('чуже чи зіпсоване значення в браузері → типові «Усі» й «Спершу нові»', async () => {
    localStorage.setItem(FILTER_KEY, 'mine')
    localStorage.setItem(ORDERING_KEY, 'size')
    mountPanel()
    await flushPromises()
    expect(api.fetchLibraryVideos).toHaveBeenCalledWith({ kind: 'all', ordering: '-created_at' })
  })

  describe('без localStorage (приватне вікно, заблоковані дані сайту)', () => {
    let original: PropertyDescriptor | undefined
    beforeEach(() => {
      original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        get() { throw new DOMException('blocked', 'SecurityError') },
      })
    })
    afterEach(() => {
      if (original) Object.defineProperty(globalThis, 'localStorage', original)
    })

    it('усе працює: типовий вибір, чипи й порядок перемикаються', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const w = mountPanel()
      await flushPromises()
      expect(api.fetchLibraryVideos).toHaveBeenCalledWith({ kind: 'all', ordering: '-created_at' })
      expect(w.findAll('[data-testid="videos-list"] li')).toHaveLength(4)

      await w.find('[data-testid="videos-filter-youtube"]').trigger('click')
      await w.find('[data-testid="videos-ordering"]').setValue('created_at')
      await flushPromises()
      expect(api.fetchLibraryVideos).toHaveBeenLastCalledWith({ kind: 'youtube', ordering: 'created_at' })
      expect(w.find('[data-testid="videos-filter-youtube"]').attributes('aria-selected')).toBe('true')
      // Збій пам'яті не мовчить — попередження в консолі, без падіння
      expect(warn).toHaveBeenCalled()
      warn.mockRestore()
    })
  })

  it('«Видалити» файл — підтвердження про кошик файлів і наявний шлях видалення; архів не викликається', async () => {
    api.deleteAsset.mockResolvedValue(undefined)
    const w = mountPanel()
    await flushPromises()
    await w.find('[data-testid="video-10"] [data-testid="video-delete"]').trigger('click')
    expect(api.deleteAsset).not.toHaveBeenCalled()
    const confirm = w.find('[data-testid="video-delete-confirm"]')
    expect(confirm.text()).toContain('Видалити файл?')
    expect(confirm.text()).toContain('«Урок-1.mp4» піде в кошик «Матеріалів» на 90 днів, потім видалиться остаточно')
    expect(confirm.text()).toContain('Зникне й з «Усі»')
    // Не текст для YouTube (про картки на дошках) — у файла свій
    expect(confirm.text()).not.toContain('як файли')
    await w.find('[data-testid="video-delete-yes"]').trigger('click')
    await flushPromises()
    expect(api.deleteAsset).toHaveBeenCalledWith(10)
    expect(api.archiveVideo).not.toHaveBeenCalled()
    expect(w.find('[data-testid="video-10"]').exists()).toBe(false)
    expect(toast.showToast).toHaveBeenCalledWith('Файл у кошику (вкладка «Архів», 90 днів)', 'success')
    const counts = w.emitted('count') ?? []
    expect(counts[counts.length - 1]).toEqual([3])
  })

  it('застаріла відповідь (чип уже змінено) не перезаписує перелік', async () => {
    let releaseAll: (v: unknown) => void = () => {}
    api.fetchLibraryVideos.mockImplementationOnce(() => new Promise((r) => { releaseAll = r }))
    const w = mountPanel()
    await w.find('[data-testid="videos-filter-file"]').trigger('click')
    await flushPromises()
    releaseAll(serverFor({ kind: 'all', ordering: '-created_at' }))
    await flushPromises()
    expect(w.findAll('[data-testid="video-badge"]').map((b) => b.text())).toEqual(['Файл', 'Файл'])
  })

  // ── Етап 1 (YouTube): архів ≠ кошик ──────────────────────────────────────────────

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

  it('фільтр «Архів відео» → архівовані; «Повернути до моїх відео» — єдиний шлях назад', async () => {
    api.unarchiveVideo.mockResolvedValue({ ...A1, status: 'active' })
    const w = mountPanel()
    await flushPromises()
    // Фільтр зветься «Архів відео» — не плутати з головною вкладкою «Архів» (кошик) «Матеріалів»
    expect(w.find('[data-testid="videos-filter-archive"]').text()).toBe('Архів відео')
    await w.find('[data-testid="videos-filter-archive"]').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('Старе відео')
    expect(w.find('[data-testid="video-archive"]').exists()).toBe(false)
    await w.find('[data-testid="video-3"] [data-testid="video-unarchive"]').trigger('click')
    await flushPromises()
    expect(api.unarchiveVideo).toHaveBeenCalledWith(3)
    expect(w.find('[data-testid="video-3"]').exists()).toBe(false)
  })

  it('«Видалити» YouTube — лише після підтвердження, у той самий кошик, що файли', async () => {
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

  it('додати посиланням → явне додавання (без added_from), перелік перечитується з тим самим вибором', async () => {
    const NEW = yt(9, 'Нове')
    api.addYouTubeAsset.mockResolvedValue(NEW)
    const w = mountPanel()
    await flushPromises()
    api.fetchLibraryVideos.mockResolvedValueOnce({ count: 5, results: [NEW, F1, V1, V2, F2] })
    await w.find('[data-testid="videos-link-input"]').setValue('https://youtu.be/ddddddddddd')
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(api.addYouTubeAsset).toHaveBeenCalledWith('https://youtu.be/ddddddddddd')
    expect(api.fetchLibraryVideos).toHaveBeenLastCalledWith({ kind: 'all', ordering: '-created_at' })
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
    expect(api.fetchLibraryVideos).toHaveBeenLastCalledWith({ kind: 'youtube', ordering: '-created_at', archived: 'only' })
    // Автоматичне перемикання — не вибір учителя: у пам'ять не пишеться
    expect(localStorage.getItem(FILTER_KEY)).toBeNull()
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
