/**
 * Генератор без теорії (власник 2026-10-19: «теорія суха… не потрібна»; «так, роби»). Прибрано й «Режим
 * уроку»: «Практика» лишала теорію, «Іспит» не ховав розбору — перемикачі нічого не міняли. У «Додаткових
 * параметрах» лишились складність і назва дошки.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const { generate } = vi.hoisted(() => ({ generate: vi.fn(async (_body: Record<string, unknown>) => ({ session_id: 'nt-1' })) }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('../api/lessonConstructorApi', async () => {
  const actual = await vi.importActual<any>('../api/lessonConstructorApi')
  return { ...actual, lessonConstructorApi: { generate } }
})
import LessonConstructorPage from '../views/LessonConstructorPage.vue'

beforeEach(() => generate.mockClear())

async function withTopic() {
  const w = mount(LessonConstructorPage)
  for (const head of w.findAll('.lc-topic-block__head')) await head.trigger('click')
  await w.findAll('.lc-topic-chip').find((c: any) => c.text().trim() === 'Похідна')!.trigger('click')
  return w
}

describe('генератор без теорії', () => {
  it('у «Додаткових параметрах» — лише складність і назва дошки', async () => {
    const w = await withTopic()
    await w.get('.lc-advanced-toggle').trigger('click')
    const labels = w.findAll('.lc-advanced .lc-label').map((l: any) => l.text())
    expect(labels).toEqual(['Складність задач', "Назва дошки (необов'язково)"])
    expect(w.find('.lc-advanced input[type=checkbox]').exists()).toBe(false)
    expect(w.text()).not.toContain('теорі')
  })

  it('урок іде без сторінки теорії, і в підрахунку сторінок її немає', async () => {
    const w = await withTopic()
    expect(w.find('.lc-preview-box').text()).toContain('4 сторінки')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(generate.mock.calls[0][0]).toMatchObject({ include_theory_page: false, include_solution_page: false })
  })
})
