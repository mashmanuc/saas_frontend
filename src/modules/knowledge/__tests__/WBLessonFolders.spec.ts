// Папки «Моїх уроків» (2026-10-13): відкрита папка мусить бути ВИДНО — раніше стояли класи, яких у темі немає.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import WBLessonFolders from '../components/WBLessonFolders.vue'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (k: string) => k }) }))
vi.mock('../api/lessonSaveApi', () => ({
  lessonSaveApi: {
    getFolders: vi.fn().mockResolvedValue([
      { id: 'f-start', name: 'Стартові', parent: null, order: 0, lesson_count: 1, children_count: 0 },
      { id: 'f-dan', name: 'Данилко', parent: null, order: 1, lesson_count: 0, children_count: 0 },
    ]),
    createFolder: vi.fn(),
    deleteFolder: vi.fn(),
    updateFolder: vi.fn(),
  },
}))

function mountFolders(activeFolder: string | null) {
  return mount(WBLessonFolders, {
    props: { activeFolder, totalCount: 12 },
    global: { mocks: { $t: (k: string) => k } },
  })
}

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
})
