import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { generate, push } = vi.hoisted(() => ({
  generate: vi.fn(async (_payload: Record<string, any>) => ({ session_id: 'linear-synthetic' })),
  push: vi.fn(),
}))
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))
vi.mock('../api/lessonConstructorApi', async () => ({
  ...await vi.importActual<any>('../api/lessonConstructorApi'),
  lessonConstructorApi: { generate },
}))
vi.mock('@/modules/intent/IntegralykThinking.vue', () => ({ default: { template: '<span />' } }))
vi.mock('@/modules/intent/IntegralykLoader.vue', () => ({ default: { template: '<span />' } }))

import LessonConstructorPage from '../views/LessonConstructorPage.vue'
import { TOPICS } from '../api/lessonConstructorApi'
import { gradeTracks, filterUnits } from '../topicByGrade'

const TOPIC = 'linear-quadratic-rational-equations.linear'
const labels = Object.fromEntries(TOPICS.map(t => [t.value, t.label]))

beforeEach(() => {
  localStorage.clear()
  generate.mockClear()
  push.mockClear()
})

describe('Лінійні рівняння доступні в класі, а не лише в НМТ', () => {
  it.each([6, 7] as const)('%s клас: пошук і генерація ведуть у точну перевірену добірку', async grade => {
    const tracks = gradeTracks(grade, labels)
    const linear = tracks.flatMap(t => filterUnits(t.units, 'лінійні рівняння', labels))
      .find(u => u.topics.includes(TOPIC))!
    expect(linear).toBeDefined()
    expect(linear.topics).toEqual([TOPIC])
    const wrapper = mount(LessonConstructorPage)
    await wrapper.get(`[data-testid="topic-grade-${grade}"]`).trigger('click')
    await wrapper.get('[data-testid="topic-grade-search"]').setValue('лінійні рівняння')
    const button = wrapper.findAll('.tgp-unit').find(b => b.find('.tgp-unit__title').text() === linear.title)!
    expect(button).toBeDefined()
    await button.trigger('click')
    expect(wrapper.get('[data-testid="lc-slot-topic"]').text()).toBe('Лінійні рівняння')
    await wrapper.get('.lc-btn-generate').trigger('submit')
    await flushPromises()
    expect(generate).toHaveBeenCalledOnce()
    expect(generate.mock.calls[0][0].topics).toEqual([TOPIC])
    expect(generate.mock.calls[0][0].topics).not.toContain('linear-quadratic-rational-equations')
    expect(push).toHaveBeenCalled()
  })
})
