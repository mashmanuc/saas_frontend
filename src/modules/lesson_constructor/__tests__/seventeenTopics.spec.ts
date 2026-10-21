import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const { generate, push } = vi.hoisted(() => ({
  generate: vi.fn(async (_body: Record<string, unknown>) => ({ session_id: 'topics-local' })),
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
  'rational-irrational-expressions.square-roots.arithmetic',
  'rational-irrational-expressions.square-roots.transformations',
  'rational-irrational-expressions.square-roots.add-subtract',
  'rational-irrational-expressions.square-roots.multiply-divide',
  'ratios-percents-word-problems.proportion.unknown-member',
  'ratios-percents-word-problems.proportion.direct',
  'ratios-percents-word-problems.proportion.inverse',
  'linear-quadratic-rational-equations.systems.linear.substitution',
  'linear-quadratic-rational-equations.systems.linear.elimination',
  'linear-quadratic-rational-equations.systems.linear.word-problems',
  'function-basics.introduction', 'linear-quadratic-functions.linear',
  'linear-quadratic-rational-equations.two-variables',
  'linear-quadratic-rational-equations.systems.linear.graphical',
  'linear-quadratic-rational-equations.systems.linear.solution-count',
  'rational-irrational-expressions.algebraic-fractions.domain',
  'rational-irrational-expressions.algebraic-fractions.reduction',
  'rational-irrational-expressions.algebraic-fractions.multiply-divide',
  'rational-irrational-expressions.algebraic-fractions.same-denominator',
  'rational-irrational-expressions.algebraic-fractions.unlike-denominators',
  'rational-irrational-expressions.algebraic-fractions.combined',
]

// Дерево тем — вигляд «НМТ»: з 2026-10-21 сторінка спершу пропонує клас учня (TopicGradePicker).
beforeEach(() => { localStorage.setItem('lc.topicView', 'nmt') })
beforeEach(() => { generate.mockClear(); push.mockClear() })

describe('Двадцять одна добірка у незміненій формі конструктора', () => {
  it('усі21тема унікальні та є в переліку', () => {
    expect(new Set(topics).size).toBe(21)
    expect(new Set(TOPICS.map(t => t.value)).size).toBe(TOPICS.length)
    for (const id of topics) expect(TOPICS.some(t => t.value === id)).toBe(true)
  })
  for (const id of topics) {
    it(`${id}: вибір передає саме цю тему та16задач`, async () => {
      const wrapper = mount(LessonConstructorPage)
      await wrapper.get('.lc-topic-block__head').trigger('click')
      const parts = id.split('.')
      for (let depth = 1; depth < parts.length; depth++) {
        const expand = wrapper.find(`.lc-topic-expand[data-topic="${parts.slice(0, depth).join('.')}"]`)
        if (expand.exists()) await expand.trigger('click')
      }
      const label = TOPICS.find(t => t.value === id)!.label
      const chip = wrapper.findAll('.lc-topic-chip').find(b => b.text().trim() === label)
      expect(chip).toBeDefined()
      await chip!.trigger('click')
      await wrapper.get('input[type=range]').setValue(16)
      await wrapper.get('form').trigger('submit')
      await flushPromises()
      expect(generate).toHaveBeenCalledTimes(1)
      expect(generate.mock.calls[0][0]).toMatchObject({ topics: [id], task_count: 16, diff_profile: 'balanced' })
      expect(push).toHaveBeenCalledWith({ name: 'winterboard-prepare', params: { id: 'topics-local' } })
      wrapper.unmount()
    })
  }
})
