/**
 * «Матеріали»: сітка АБО список (візуальний розбір 2026-09-22, п. 1).
 *
 * На проді обидва показувались одночасно: між сіткою (`v-else-if`) і списком
 * (`v-else`) стояла панель читання матеріалу з власним `v-if`, і `v-else`
 * списку прив'язувався до неї — тобто список рендерився завжди.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '@/i18n/locales/uk.json'

const png = (id: number, name: string) => ({
  id, name, storage_key: 'k', cdn_url: 'data:image/png;base64,', thumbnail_url: '', content_type: 'image/png',
  size_bytes: 1000, status: 'active', folder: null, is_favorite: false, last_used_at: null, tags: [],
  created_at: '2026-06-20T10:00:00Z', updated_at: '2026-06-20T10:00:00Z', content_item_id: id,
})

vi.mock('../api/library', () => ({
  fetchFoldersTree: vi.fn(async () => [{ id: 7, name: 'N_22', parent: null, assets_count: 2, children: [] }]),
  fetchAssets: vi.fn(async () => ({ count: 3, results: [png(1, 'N22__17_06_26.png'), png(2, 'N22__30_05_26.png'), { ...png(3, 'NMT_2026.pdf'), content_type: 'application/pdf' }] })),
  fetchRecentAssets: vi.fn(async () => []),
  fetchStorageStats: vi.fn(async () => ({ upload_bytes: 30_000_000, paste_bytes: 8000, total_bytes: 30_008_000, limit_bytes: 2 * 1024 ** 3 })),
  fetchPastedItems: vi.fn(async () => ({ count: 0, results: [] })),
  fetchArchivedItems: vi.fn(async () => ({ count: 0, results: [] })),
  toggleFavorite: vi.fn(), deleteAsset: vi.fn(), updateAsset: vi.fn(), createFolder: vi.fn(),
  updateFolder: vi.fn(), deleteFolder: vi.fn(), addYouTubeAsset: vi.fn(), cleanupPasted: vi.fn(), restorePasted: vi.fn(),
}))
vi.mock('../api/materials', () => ({ default: { status: vi.fn(async () => ({ enabled: false, ocr: false })) } }))

import WBLibrary from '../views/WBLibrary.vue'

const i18n = createI18n({ legacy: false, locale: 'uk', messages: { uk } as never })

async function mountLibrary() {
  const w = mount(WBLibrary, { global: { plugins: [i18n] }, attachTo: document.body })
  await flushPromises()
  return w
}

afterEach(() => { document.body.innerHTML = '' })

describe('WBLibrary — один режим перегляду за раз', () => {
  it('сітка: карток 3, списку немає', async () => {
    const w = await mountLibrary()
    expect(w.findAll('.library-asset-card')).toHaveLength(3)
    expect(w.find('.wb-library__list').exists()).toBe(false)
  })

  it('перемикач «список»: рядків 3, карток немає', async () => {
    const w = await mountLibrary()
    await w.find('[title="Список"]').trigger('click')
    expect(w.findAll('.wb-library__list-item')).toHaveLength(3)
    expect(w.find('.library-asset-card').exists()).toBe(false)
  })

  it('групи за датою: червень, травень, документи', async () => {
    const w = await mountLibrary()
    const titles = w.findAll('.wb-library__group-title').map((h) => h.text().replace(/\s*\d+$/, ''))
    expect(titles).toEqual(['Червень 2026', 'Травень 2026', 'Документи й збірники'])
  })

  it('квота — один рядок, без смуги, поки місця вистачає', async () => {
    const w = await mountLibrary()
    expect(w.find('.wb-library__quota').text()).toContain('з 2 GB')
    expect(w.find('.wb-library__storage-track').exists()).toBe(false)
  })

  it('як у «Записах»: папки — колонка ліворуч, вкладки зверху — лише фільтри', async () => {
    const w = await mountLibrary()
    const tabs = w.findAll('.wb-library__tab').map((b) => b.text())
    expect(tabs).toEqual(['Усі', 'Вибране', 'Нещодавні', 'Скопійовані', 'Архів'])
    const tree = w.find('.wb-library__sidebar .wb-folder-tree')
    expect(tree.exists()).toBe(true)
    expect(tree.text()).toContain('N_22')
    // віртуальні розділи не дублюються в дереві
    expect(tree.text()).not.toContain('Вибране')
  })
})
