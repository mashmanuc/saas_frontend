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
  // З 2026-10-21 (конструктор-речення): складність — окреме слово речення, а «Ще про урок» — конспект і назва.
  it('«Ще про урок» — лише конспект і назва дошки; ні режиму, ні теорії', async () => {
    const w = await withTopic()
    await w.get('[data-testid="lc-slot-more"]').trigger('click')
    const labels = w.findAll('.lc-panel .lc-label').map((l: any) => l.text())
    expect(labels).toEqual(["Назва дошки (необов'язково)"])
    expect(w.findAll('.lc-panel input[type=checkbox]')).toHaveLength(1)
    expect(w.find('[data-testid=lc-konspekt]').exists()).toBe(true)
    expect(w.text()).not.toContain('теорі')
    expect(w.text()).not.toContain('Режим')
  })

  it('конспект теми — за замовчуванням так: прев’ю каже про нього, запит просить сторінки конспекту', async () => {
    const w = await withTopic()
    await w.get('[data-testid="lc-slot-more"]').trigger('click')
    expect(w.get('[data-testid=lc-konspekt] input').element.checked).toBe(true)
    await w.get('[data-testid="lc-slot-count"]').trigger('click')
    expect(w.find('[data-testid=lc-preview-konspekt]').exists()).toBe(true)
    expect(w.get('.lc-preview-item--total').text()).toBe('конспект + 4 сторінки')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(generate.mock.calls[0][0]).toMatchObject({ include_theory_page: true, include_solution_page: false })
  })

  it('без галочки — урок без конспекту, як до 2026-10-21', async () => {
    const w = await withTopic()
    await w.get('[data-testid="lc-slot-more"]').trigger('click')
    await w.get('[data-testid=lc-konspekt] input').setValue(false)
    await w.get('[data-testid="lc-slot-count"]').trigger('click')
    expect(w.find('[data-testid=lc-preview-konspekt]').exists()).toBe(false)
    expect(w.get('.lc-preview-item--total').text()).toBe('4 сторінки')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(generate.mock.calls[0][0]).toMatchObject({ include_theory_page: false, include_solution_page: false })
  })
})
