import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const { generate, push } = vi.hoisted(() => ({
  generate: vi.fn(async (_body: Record<string, unknown>) => ({ session_id: 'algebra-local' })),
  push: vi.fn(),
}))
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))
vi.mock('../api/lessonConstructorApi', async () => ({
  ...await vi.importActual<any>('../api/lessonConstructorApi'),
  lessonConstructorApi: { generate },
}))
import LessonConstructorPage from '../views/LessonConstructorPage.vue'
import { TOPICS } from '../api/lessonConstructorApi'

const topics = [
  ['powers.natural-exponent', 'Степінь із натуральним показником'],
  ['polynomials.monomials.standard-form', 'Стандартний вигляд одночлена'],
  ['polynomials.monomials.add-subtract', 'Додавання і віднімання одночленів'],
  ['polynomials.monomials.multiply-power', 'Множення і піднесення одночленів до степеня'],
  ['polynomials.operations.progression', 'Дії з многочленами: від простого до складного'],
  ['polynomials.abbreviated-multiplication.identities', 'Формули скороченого множення: перетворення'],
  ['polynomials.factorization.progression', 'Розкладання многочленів на множники'],
] as const

// Дерево тем — вигляд «НМТ»: з 2026-10-21 сторінка спершу пропонує клас учня (TopicGradePicker).
beforeEach(() => { localStorage.setItem('lc.topicView', 'nmt') })
beforeEach(() => { generate.mockClear(); push.mockClear() })

describe('Сім перевірених алгебраїчних добірок у чинній формі', () => {
  it('усі вузькі теми унікальні, старі батьківські теми збережені', () => {
    expect(new Set(TOPICS.map(t => t.value)).size).toBe(TOPICS.length)
    for (const [id, label] of topics)
      expect(TOPICS.find(t => t.value === id)?.label).toBe(label)
    for (const id of ['powers', 'polynomials', 'polynomials.operations', 'polynomials.abbreviated-multiplication'])
      expect(TOPICS.some(t => t.value === id)).toBe(true)
  })

  for (const [id, label] of topics) {
    it(`${id}: вибір вузької теми передає правильний запит`, async () => {
      const w = mount(LessonConstructorPage)
      await w.get('.lc-topic-block__head').trigger('click')
      // Розгортаємо тільки шлях цієї теми, не змінюючи поведінку форми.
      const parts = id.split('.')
      for (let depth = 1; depth < parts.length; depth++) {
        const expand = w.find(`.lc-topic-expand[data-topic="${parts.slice(0, depth).join('.')}"]`)
        if (expand.exists()) await expand.trigger('click')
      }
      const chip = w.findAll('.lc-topic-chip').find(b => b.text().trim() === label)
      expect(chip).toBeDefined()
      await chip!.trigger('click')
      await w.get('input[type=range]').setValue(16)
      await w.get('form').trigger('submit')
      await flushPromises()
      expect(generate).toHaveBeenCalledTimes(1)
      expect(generate.mock.calls[0][0]).toMatchObject({ topics: [id], task_count: 16, diff_profile: 'balanced' })
      expect(push).toHaveBeenCalledWith({ name: 'winterboard-prepare', params: { id: 'algebra-local' } })
      w.unmount()
    })
  }
})
