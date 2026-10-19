/**
 * «Матеріали»: видалення папки — вікно сайту, а не системне «Повідомлення з m4sh.org»
 * (власник 2026-10-19). Тексти — з реального uk.json.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '@/i18n/locales/uk.json'

const { deleteFolder } = vi.hoisted(() => ({ deleteFolder: vi.fn(async () => undefined) }))

vi.mock('../api/library', () => ({
  fetchFoldersTree: vi.fn(async () => [
    { id: 7, name: 'N_22', parent: null, assets_count: 2, children: [] },
    { id: 8, name: 'Алгебра', parent: null, assets_count: 0, children: [{ id: 9, name: '7 клас', parent: 8, assets_count: 1, children: [] }] },
  ]),
  fetchAssets: vi.fn(async () => ({ count: 0, results: [] })),
  fetchRecentAssets: vi.fn(async () => []),
  fetchStorageStats: vi.fn(async () => ({ upload_bytes: 0, paste_bytes: 0, total_bytes: 0, limit_bytes: 2 * 1024 ** 3 })),
  fetchPastedItems: vi.fn(async () => ({ count: 0, results: [] })),
  fetchArchivedItems: vi.fn(async () => ({ count: 0, results: [] })),
  toggleFavorite: vi.fn(), deleteAsset: vi.fn(), updateAsset: vi.fn(), createFolder: vi.fn(),
  updateFolder: vi.fn(), deleteFolder, addYouTubeAsset: vi.fn(), cleanupPasted: vi.fn(), restorePasted: vi.fn(),
}))
vi.mock('../api/materials', () => ({ default: { status: vi.fn(async () => ({ enabled: false, ocr: false })) } }))

import WBLibrary from '../views/WBLibrary.vue'
import LibraryFolderTree from '../components/library/LibraryFolderTree.vue'

const i18n = createI18n({ legacy: false, locale: 'uk', messages: { uk } as never })
const lib = (uk as any).winterboard.library

async function mountLibrary() {
  // Анімацію зникання вікна вимикаємо: у jsdom вона не завершується, і закрите вікно лишалось би в DOM.
  const w = mount(WBLibrary, { global: { plugins: [i18n], stubs: { transition: true } }, attachTo: document.body })
  await flushPromises()
  return w
}

// Кнопки саме вікна підтвердження (на сторінці є й інші «Скасувати»).
const modalButton = (text: string) =>
  [...document.body.querySelectorAll('.modal-content button')].find(b => b.textContent?.trim() === text) as HTMLButtonElement | undefined
const modalText = () => document.body.querySelector('.modal-content')?.textContent ?? ''

afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); deleteFolder.mockClear() })

describe('WBLibrary — видалення папки', () => {
  it('вікно сайту з назвою папки; «Видалити» видаляє; системного confirm немає', async () => {
    const native = vi.spyOn(window, 'confirm')
    const w = await mountLibrary()
    w.findComponent(LibraryFolderTree).vm.$emit('delete', 7, 'N_22')
    await flushPromises()

    expect(native).not.toHaveBeenCalled()
    expect(modalText()).toContain('Видалити папку «N_22»?')
    expect(modalText()).toContain(lib.deleteFolderConfirm)
    expect(deleteFolder).not.toHaveBeenCalled()

    modalButton(lib.deleteFolder)!.click()
    await flushPromises()
    expect(deleteFolder).toHaveBeenCalledWith(7)
  })

  it('папка з підпапками — попередження про них; «Скасувати» нічого не видаляє', async () => {
    const w = await mountLibrary()
    w.findComponent(LibraryFolderTree).vm.$emit('delete', 8, 'Алгебра')
    await flushPromises()
    expect(modalText()).toContain(lib.deleteFolderConfirmWithChildren)

    modalButton('Скасувати')!.click()
    await flushPromises()
    expect(deleteFolder).not.toHaveBeenCalled()
    expect(modalText()).not.toContain('Видалити папку «Алгебра»?')
  })
})
