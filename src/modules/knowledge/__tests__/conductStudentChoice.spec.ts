// «З ким урок?» (LAW §9 v1.68): вибір учня — свої учні, пошук, нове ім'я (учень без акаунта), «Без учня».
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '@/i18n/locales/uk.json'

const listConductStudents = vi.fn()
vi.mock('../api/lessonViewApi', () => ({
  lessonViewApi: { listConductStudents: (...a: any[]) => listConductStudents(...a) },
}))
const createPlaceholderStudent = vi.fn()
vi.mock('@/api/relations', () => ({
  default: { createPlaceholderStudent: (...a: any[]) => createPlaceholderStudent(...a) },
}))

import ConductStudentChoice from '../components/ConductStudentChoice.vue'

const i18n = () => createI18n({ legacy: false, locale: 'uk', messages: { uk } })
const STUDENTS = [{ id: 7, name: 'Толік' }, { id: 9, name: 'Аня Коваль' }]

async function mountChoice(props: Record<string, unknown> = {}) {
  const w = mount(ConductStudentChoice, { props, global: { plugins: [i18n()] } })
  await flushPromises()
  return w
}
const names = (w: any) => w.findAll('[data-testid=conduct-student-item]').map((b: any) => b.text())

describe('ConductStudentChoice', () => {
  beforeEach(() => {
    listConductStudents.mockReset().mockResolvedValue({ students: STUDENTS })
    createPlaceholderStudent.mockReset()
  })

  it('учні в порядку сервера; дотик — вибір; «Без учня» — null', async () => {
    const w = await mountChoice()
    expect(names(w)).toEqual(['ТТолік', 'ААня Коваль'])
    await w.findAll('[data-testid=conduct-student-item]')[1].trigger('click')
    await w.get('[data-testid=conduct-student-none]').trigger('click')
    expect(w.emitted('choose')).toEqual([[9], [null]])
  })

  it('пошук звужує список; точний збіг — без «Новий учень»; Enter з одним — вибір', async () => {
    const w = await mountChoice()
    await w.get('[data-testid=conduct-student-input]').setValue('  ан ')
    expect(names(w)).toEqual(['ААня Коваль'])
    expect(w.find('[data-testid=conduct-student-add]').exists()).toBe(true)
    await w.get('[data-testid=conduct-student-input]').setValue('толік')
    expect(w.find('[data-testid=conduct-student-add]').exists()).toBe(false)
    await w.get('[data-testid=conduct-student-input]').trigger('keydown', { key: 'Enter' })
    expect(w.emitted('choose')).toEqual([[7]])
  })

  it('нове ім\'я — учень без акаунта, одразу обраний; збій — словами, вибору немає', async () => {
    createPlaceholderStudent.mockRejectedValueOnce(new Error('500')).mockResolvedValueOnce({ student: { id: 31 } })
    const w = await mountChoice()
    await w.get('[data-testid=conduct-student-input]').setValue('Петро   Іванов')
    expect(w.get('[data-testid=conduct-student-add]').text()).toContain('«Петро Іванов»')
    await w.get('[data-testid=conduct-student-add]').trigger('click')
    await flushPromises()
    expect(w.emitted('choose')).toBeUndefined()
    expect(w.text()).toContain('Не вдалося додати учня')
    await w.get('[data-testid=conduct-student-input]').trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(createPlaceholderStudent).toHaveBeenLastCalledWith({ name: 'Петро Іванов' })
    expect(w.emitted('choose')).toEqual([[31]])
  })

  it('поточний учень позначений; currentId=null — «Без учня»; busy — нічого не натискається', async () => {
    let w = await mountChoice({ currentId: 9 })
    expect(w.findAll('[data-testid=conduct-student-item]')[1].classes()).toContain('csc__item--current')
    w = await mountChoice({ currentId: null })
    expect(w.get('[data-testid=conduct-student-none]').classes()).toContain('csc__item--current')
    w = await mountChoice({ busy: true })
    expect(w.get('[data-testid=conduct-student-none]').attributes('disabled')).toBeDefined()
    expect(w.get('[data-testid=conduct-student-input]').attributes('disabled')).toBeDefined()
  })

  it('список не завантажився — словами, «Без учня» працює', async () => {
    listConductStudents.mockReset().mockRejectedValue(new Error('500'))
    const w = await mountChoice()
    expect(w.text()).toContain('Не вдалося завантажити учнів')
    await w.get('[data-testid=conduct-student-none]').trigger('click')
    expect(w.emitted('choose')).toEqual([[null]])
  })
})
