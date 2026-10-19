// Папки «Моїх уроків» (2026-10-13): відкрита папка мусить бути ВИДНО — раніше стояли класи, яких у темі немає.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import WBLessonFolders from '../components/WBLessonFolders.vue'
import { lessonSaveApi } from '../api/lessonSaveApi'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (k: string, p?: Record<string, string>) => (p?.name ? `${k}:${p.name}` : k) }) }))
vi.mock('../api/lessonSaveApi', () => ({
  lessonSaveApi: {
    getFolders: vi.fn().mockResolvedValue([
      { id: 'f-start', name: 'Стартові', parent: null, order: 0, lesson_count: 1, children_count: 0 },
      { id: 'f-dan', name: 'Данилко', parent: null, order: 1, lesson_count: 0, children_count: 2 },
    ]),
    createFolder: vi.fn(),
    deleteFolder: vi.fn(),
    updateFolder: vi.fn(),
  },
}))

function mountFolders(activeFolder: string | null) {
  return mount(WBLessonFolders, {
    props: { activeFolder, totalCount: 12 },
    // ConfirmModal виноситься в body через Teleport — у тесті лишаємо його на місці.
    global: { mocks: { $t: (k: string) => k }, stubs: { teleport: true } },
  })
}

const deleteButtons = (w: any) => w.findAll('button').filter((b: any) => b.attributes('title') === 'knowledge.folder.delete')

describe('WBLessonFolders', () => {
  beforeEach(() => vi.clearAllMocks())

  it('відкрита папка позначена (клас теми + aria-current), інші — ні', async () => {
    const w = mountFolders('f-start')
    await flushPromises()
    const current = w.findAll('button[aria-current="true"]')
    expect(current).toHaveLength(1)
    expect(current[0].text()).toContain('Стартові')
    expect(current[0].classes()).toContain('wb-folder--active')
    // класів, яких у темі немає, більше не лишилось
    expect(w.html()).not.toContain('bg-primary-50')
  })

  it('«Всі уроки» позначені, коли папку не обрано, і показують загальну кількість', async () => {
    const w = mountFolders(null)
    await flushPromises()
    const current = w.find('button[aria-current="true"]')
    expect(current.text()).toContain('knowledge.folder.allLessons')
    expect(current.text()).toContain('(12)')
  })

  it('папки доступні сторінці (назва відкритої папки над уроками)', async () => {
    const w = mountFolders('f-start')
    await flushPromises()
    const exposed = (w.vm as unknown as { folders: Array<{ id: string; name: string }> }).folders
    expect(exposed.map(f => f.name)).toEqual(['Стартові', 'Данилко'])
  })

  // Власник 2026-10-19: видалення папки — вікно сайту, а не системне «Повідомлення з m4sh.org».
  it('видалення питає вікном сайту, без системного confirm; «Видалити папку» видаляє', async () => {
    const native = vi.spyOn(window, 'confirm')
    const w = mountFolders(null)
    await flushPromises()
    await deleteButtons(w)[0].trigger('click')
    await flushPromises()

    expect(native).not.toHaveBeenCalled()
    expect(w.text()).toContain('knowledge.folder.deleteTitle:Стартові')
    expect(w.text()).toContain('knowledge.folder.deleteConfirm')
    expect(lessonSaveApi.deleteFolder).not.toHaveBeenCalled()

    const confirmBtn = w.findAll('button').find((b: any) => b.text() === 'knowledge.folder.delete')!
    await confirmBtn.trigger('click')
    await flushPromises()
    expect(lessonSaveApi.deleteFolder).toHaveBeenCalledWith('f-start')
    expect(w.text()).not.toContain('knowledge.folder.deleteTitle')
  })

  it('«Скасувати» нічого не видаляє; у папки з підпапками — попередження про них', async () => {
    const w = mountFolders(null)
    await flushPromises()
    await deleteButtons(w)[1].trigger('click')
    await flushPromises()
    expect(w.text()).toContain('knowledge.folder.deleteConfirmWithChildren')

    const cancel = w.findAll('button').find((b: any) => b.text() === 'common.cancel')!
    await cancel.trigger('click')
    await flushPromises()
    expect(lessonSaveApi.deleteFolder).not.toHaveBeenCalled()
    expect(w.text()).not.toContain('knowledge.folder.deleteTitle')
  })
})
