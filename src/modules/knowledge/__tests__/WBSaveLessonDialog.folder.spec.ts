/**
 * «Зберегти як урок» — вибір папки і «+ Нова папка» прямо у вікні (власник 2026-10-17: «роби»).
 * Папки — списком з повним шляхом; за замовчуванням — та, що минулого разу; нова папка створюється всередині
 * вибраної і одразу стає вибраною; глибше 3 рівнів — пояснення словами, а не технічна помилка.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import uk from '../../../i18n/locales/uk.json'

const { saveLessonFromSession, getFolders, createFolder } = vi.hoisted(() => ({
  saveLessonFromSession: vi.fn(),
  getFolders: vi.fn(),
  createFolder: vi.fn(),
}))
vi.mock('../api/lessonSaveApi', () => ({ lessonSaveApi: { saveLessonFromSession, getFolders, createFolder } }))
vi.mock('@/modules/auth/store/authStore', () => ({ useAuthStore: () => ({ user: { id: 578 } }) }))

import WBSaveLessonDialog from '../components/WBSaveLessonDialog.vue'

const SF = (uk as unknown as { winterboard: { lesson: { saveFolder: Record<string, string> } } }).winterboard.lesson.saveFolder
const KEY = 'm4sh.saveLesson.lastFolder.578'
const F = (id: string, name: string, parent: string | null, order = 0) =>
  ({ id, name, parent, order, lesson_count: 0, children_count: 0, created_at: '', updated_at: '' })
const FOLDERS = [F('f9', '9 клас', null, 1), F('fa', 'Алгебра', 'f9'), F('fg', 'Геометрія', 'fa'), F('f5', '5 клас', null, 0)]

async function dialog() {
  const i18n = createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })
  const w = mount(WBSaveLessonDialog, {
    props: { modelValue: false, sessionId: 's-1', defaultTitle: 'Урок: Лінійні рівняння' },
    global: { plugins: [i18n], stubs: { Teleport: true } },
  })
  await w.setProps({ modelValue: true })
  await flushPromises()
  return w
}

const options = (w: Awaited<ReturnType<typeof dialog>>) =>
  w.findAll('[data-testid="save-lesson-folder"] option').map((o) => o.text())
const saveBtn = (w: Awaited<ReturnType<typeof dialog>>) => w.find('.save-lesson-dialog__btn--save')

describe('«Зберегти як урок» — папка', () => {
  beforeEach(() => {
    window.localStorage.clear()
    saveLessonFromSession.mockReset().mockResolvedValue({ id: 'l1', title: 'Урок: Лінійні рівняння' })
    getFolders.mockReset().mockResolvedValue(FOLDERS)
    createFolder.mockReset()
  })

  it('список папок з повним шляхом, першим — «Без папки»; за замовчуванням — «Без папки»', async () => {
    const w = await dialog()
    expect(options(w)).toEqual([SF.none, '5 клас', '9 клас', '9 клас › Алгебра', '9 клас › Алгебра › Геометрія'])
    await saveBtn(w).trigger('click')
    await flushPromises()
    expect(saveLessonFromSession).toHaveBeenCalledWith({ session_id: 's-1', title: 'Урок: Лінійні рівняння' })
  })

  it('обрана папка йде в збереження і пропонується наступного разу', async () => {
    const w = await dialog()
    await w.find('[data-testid="save-lesson-folder"]').setValue('fa')
    await saveBtn(w).trigger('click')
    await flushPromises()
    expect(saveLessonFromSession).toHaveBeenCalledWith({ session_id: 's-1', title: 'Урок: Лінійні рівняння', folder_id: 'fa' })
    expect(window.localStorage.getItem(KEY)).toBe('fa')

    const again = await dialog()
    expect((again.find('[data-testid="save-lesson-folder"]').element as HTMLSelectElement).value).toBe('fa')
  })

  it('запам’ятована папка вже видалена — «Без папки», а не неіснуюча', async () => {
    window.localStorage.setItem(KEY, 'gone')
    const w = await dialog()
    await saveBtn(w).trigger('click')
    await flushPromises()
    expect(saveLessonFromSession).toHaveBeenCalledWith({ session_id: 's-1', title: 'Урок: Лінійні рівняння' })
  })

  it('«+ Нова папка» — всередині вибраної, одразу вибрана; Enter у назві папки не зберігає урок', async () => {
    createFolder.mockResolvedValue(F('fnew', 'Лінійні', 'fa'))
    const w = await dialog()
    await w.find('[data-testid="save-lesson-folder"]').setValue('fa')
    await w.find('[data-testid="save-lesson-new-folder"]').trigger('click')
    expect(w.find('[data-testid="save-lesson-new-folder-where"]').text()).toBe('Буде в папці «9 клас › Алгебра»')
    await w.find('[data-testid="save-lesson-new-folder-name"]').setValue('Лінійні')
    await w.find('[data-testid="save-lesson-new-folder-name"]').trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(createFolder).toHaveBeenCalledWith('Лінійні', 'fa')
    expect(saveLessonFromSession).not.toHaveBeenCalled()
    expect(w.find('[data-testid="save-lesson-new-folder-form"]').exists()).toBe(false)
    await nextTick()
    expect((w.find('[data-testid="save-lesson-folder"]').element as HTMLSelectElement).value).toBe('fnew')
    expect(options(w)).toContain('9 клас › Алгебра › Лінійні')

    await saveBtn(w).trigger('click')
    await flushPromises()
    expect(saveLessonFromSession).toHaveBeenCalledWith({ session_id: 's-1', title: 'Урок: Лінійні рівняння', folder_id: 'fnew' })
  })

  it('без вибраної папки нова папка — на верхньому рівні', async () => {
    createFolder.mockResolvedValue(F('ftop', 'Олімпіада', null))
    const w = await dialog()
    await w.find('[data-testid="save-lesson-new-folder"]').trigger('click')
    expect(w.find('[data-testid="save-lesson-new-folder-where"]').text()).toBe(SF.top)
    await w.find('[data-testid="save-lesson-new-folder-name"]').setValue('Олімпіада')
    await w.find('[data-testid="save-lesson-new-folder-create"]').trigger('click')
    await flushPromises()
    expect(createFolder).toHaveBeenCalledWith('Олімпіада', null)
  })

  it('у папці 3-го рівня створити не можна — пояснення словами', async () => {
    const w = await dialog()
    await w.find('[data-testid="save-lesson-folder"]').setValue('fg')
    await w.find('[data-testid="save-lesson-new-folder"]').trigger('click')
    await w.find('[data-testid="save-lesson-new-folder-name"]').setValue('Ще глибше')
    expect(w.find('[data-testid="save-lesson-new-folder-where"]').text()).toBe(SF.tooDeep)
    expect(w.find('[data-testid="save-lesson-new-folder-create"]').attributes('disabled')).toBeDefined()
  })

  it('сервер відмовив — зрозуміла причина замість технічного тексту', async () => {
    createFolder.mockRejectedValueOnce({ response: { status: 400, data: { error: 'Maximum folder depth (3) exceeded (INV-ORG-1)' } } })
    const w = await dialog()
    await w.find('[data-testid="save-lesson-new-folder"]').trigger('click')
    await w.find('[data-testid="save-lesson-new-folder-name"]').setValue('X')
    await w.find('[data-testid="save-lesson-new-folder-create"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="save-lesson-new-folder-error"]').text()).toBe(SF.tooDeep)

    createFolder.mockRejectedValueOnce({ response: { status: 500, data: {} } })
    await w.find('[data-testid="save-lesson-new-folder-create"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="save-lesson-new-folder-error"]').text()).toBe(SF.createError)
  })

  it('папки не завантажились — сказано прямо, урок зберігається «Без папки»', async () => {
    getFolders.mockRejectedValue(new Error('network'))
    const w = await dialog()
    expect(w.find('[data-testid="save-lesson-folders-error"]').text()).toBe(SF.loadError)
    await saveBtn(w).trigger('click')
    await flushPromises()
    expect(saveLessonFromSession).toHaveBeenCalledWith({ session_id: 's-1', title: 'Урок: Лінійні рівняння' })
  })
})
