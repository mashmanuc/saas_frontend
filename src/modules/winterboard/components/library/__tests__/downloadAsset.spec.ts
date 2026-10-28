/**
 * «⬇ Завантажити» у «Матеріалах» (власник 2026-10-29: «чого користувач назад не може скачати собі PDF-файл?»).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '../../../../../i18n/locales/uk.json'
import { assetFileName, downloadAsset } from '../downloadAsset'
import LibraryAssetMenu from '../LibraryAssetMenu.vue'

const PDF = { name: 'algebra-10-klas-ister.pdf', cdn_url: 'https://cdn.example/a/b/1234.pdf', content_type: 'application/pdf' }

describe('назва файлу для збереження', () => {
  it('як у «Матеріалах»; без розширення — з адреси файлу або з типу', () => {
    expect(assetFileName(PDF)).toBe('algebra-10-klas-ister.pdf')
    expect(assetFileName({ ...PDF, name: 'Алгебра 10 клас' })).toBe('Алгебра 10 клас.pdf')
    expect(assetFileName({ name: 'Фото дошки', cdn_url: '/media/x/abc', content_type: 'image/png' })).toBe('Фото дошки.png')
    expect(assetFileName({ name: '', cdn_url: '/media/x/abc', content_type: '' })).toBe('file')
  })
})

describe('завантаження', () => {
  const click = vi.fn()
  beforeEach(() => {
    click.mockReset()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { click(this.download, this.href) })
    ;(URL as any).createObjectURL = vi.fn(() => 'blob:local/1')
    ;(URL as any).revokeObjectURL = vi.fn()
  })
  afterEach(() => vi.restoreAllMocks())

  it('файл зберігається на компʼютер під своєю назвою', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['%PDF']) }))
    expect(await downloadAsset({ ...PDF, name: 'Алгебра 10 клас' })).toBe('saved')
    expect(click).toHaveBeenCalledWith('Алгебра 10 клас.pdf', 'blob:local/1')
    vi.unstubAllGlobals()
  })

  it('сховище не віддало файл — відкриваємо його в новій вкладці', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('CORS')))
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    expect(await downloadAsset(PDF)).toBe('opened')
    expect(open).toHaveBeenCalledWith(PDF.cdn_url, '_blank', 'noopener')
    expect(click).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})

describe('меню файлу', () => {
  const i18n = () => createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })
  const asset = { id: 1, status: 'active', folder: null, is_favorite: false, tags: [], storage_key: 'k', thumbnail_url: '',
    size_bytes: 1, last_used_at: null, created_at: '', updated_at: '', ...PDF }

  it('є «Завантажити», і він сам зберігає файл (без картки чи списку)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['%PDF']) }))
    ;(URL as any).createObjectURL = vi.fn(() => 'blob:local/2')
    const anchor = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const w = mount(LibraryAssetMenu, { props: { asset: asset as never }, global: { plugins: [i18n()] }, attachTo: document.body })
    await w.find('[data-testid="asset-menu-trigger"]').trigger('click')
    const btn = document.body.querySelector('[data-testid="download-asset-btn"]') as HTMLButtonElement
    expect(btn?.textContent).toContain('Завантажити')
    btn.click()
    await flushPromises()
    expect(anchor).toHaveBeenCalled()
    expect(w.emitted('action')).toBeUndefined()
    w.unmount()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })
})
