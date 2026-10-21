/**
 * Генератор без сухої теорії (власник 2026-10-19: «теорія суха… не потрібна»; «так, роби»). Прибрано й «Режим
 * уроку»: «Практика» лишала теорію, «Іспит» не ховав розбору — перемикачі нічого не міняли. У «Додаткових
 * параметрах» лишились складність і назва дошки.
 *
 * 2026-10-21 (власник: «так, роби конспекти картками»): на початку уроку — конспект теми картками, галочкою
 * «Конспект теми» поза «Додатковими параметрами»; за замовчуванням увімкнено.
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

// Дерево тем — вигляд «НМТ»: з 2026-10-21 сторінка спершу пропонує клас учня (TopicGradePicker).
beforeEach(() => { localStorage.setItem('lc.topicView', 'nmt') })
beforeEach(() => generate.mockClear())

async function withTopic() {
  const w = mount(LessonConstructorPage)
  for (const head of w.findAll('.lc-topic-block__head')) await head.trigger('click')
  await w.findAll('.lc-topic-chip').find((c: any) => c.text().trim() === 'Похідна')!.trigger('click')
  return w
}

describe('генератор: без сухої теорії, з конспектом теми', () => {
  it('у «Додаткових параметрах» — лише складність і назва дошки', async () => {
    const w = await withTopic()
    await w.get('.lc-advanced-toggle').trigger('click')
    const labels = w.findAll('.lc-advanced .lc-label').map((l: any) => l.text())
    expect(labels).toEqual(['Складність задач', "Назва дошки (необов'язково)"])
    expect(w.find('.lc-advanced input[type=checkbox]').exists()).toBe(false)
    expect(w.text()).not.toContain('теорі')
  })

  it('конспект теми — за замовчуванням так: прев’ю каже про нього, запит просить сторінки конспекту', async () => {
    const w = await withTopic()
    expect(w.get('[data-testid=lc-konspekt] input').element.checked).toBe(true)
    expect(w.find('[data-testid=lc-preview-konspekt]').exists()).toBe(true)
    expect(w.find('.lc-preview-box').text()).toContain('4 сторінки')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(generate.mock.calls[0][0]).toMatchObject({ include_theory_page: true, include_solution_page: false })
  })

  it('без галочки — урок без конспекту, як до 2026-10-21', async () => {
    const w = await withTopic()
    await w.get('[data-testid=lc-konspekt] input').setValue(false)
    expect(w.find('[data-testid=lc-preview-konspekt]').exists()).toBe(false)
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(generate.mock.calls[0][0]).toMatchObject({ include_theory_page: false, include_solution_page: false })
  })
})
