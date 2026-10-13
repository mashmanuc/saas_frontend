// «Перемістити в папку» (2026-10-13): клік по папці НЕ доходить до document — інакше сторінка закривала
// меню «⋯» разом із цим компонентом до відповіді сервера, і `moved` губився (лічильник папки «(0)»).
import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import MoveToFolderDropdown from '../components/MoveToFolderDropdown.vue'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (k: string) => k }) }))
vi.mock('../api/lessonSaveApi', () => ({
  lessonSaveApi: {
    getFolders: vi.fn().mockResolvedValue([
      { id: 'f-start', name: 'Стартові', parent: null, order: 0, lesson_count: 0, children_count: 0 },
    ]),
    bulkMove: vi.fn().mockResolvedValue({ moved_count: 1 }),
  },
}))

import { lessonSaveApi } from '../api/lessonSaveApi'

describe('MoveToFolderDropdown', () => {
  afterEach(() => { document.body.innerHTML = '' })

  it('клік по папці не закриває зовнішнє меню і доносить `moved` до сторінки', async () => {
    const documentClick = vi.fn()
    document.addEventListener('click', documentClick)
    const w = mount(MoveToFolderDropdown, {
      props: { lessonId: 'L1', currentFolder: null },
      attachTo: document.body,
      global: { mocks: { $t: (k: string) => k } },
    })
    await w.find('button').trigger('click')                    // відкрити список
    await flushPromises()
    documentClick.mockClear()
    const item = [...document.body.querySelectorAll('button')].find(b => b.textContent?.includes('Стартові'))
    expect(item).toBeTruthy()
    item!.click()
    await flushPromises()
    expect(documentClick).not.toHaveBeenCalled()              // сторінка не закрила меню передчасно
    expect(lessonSaveApi.bulkMove).toHaveBeenCalledWith(['L1'], 'f-start')
    expect(w.emitted('moved')?.[0]).toEqual(['f-start'])
    document.removeEventListener('click', documentClick)
    w.unmount()
  })
})
