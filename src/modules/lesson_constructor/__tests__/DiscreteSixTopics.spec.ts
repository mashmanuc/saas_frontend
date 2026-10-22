/** Ті самі теми у списку й за класом, без зміни форми конструктора. */
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { TOPICS } from '../api/lessonConstructorApi'
import { VERIFIED_TOPICS } from '../curriculum'
import { gradeTracks } from '../topicByGrade'
import TopicGradePicker from '../components/TopicGradePicker.vue'

const full = ['combinatorics.counting', 'combinatorics.permutations', 'combinatorics.arrangements',
  'combinatorics.combinations', 'probability-statistics.probability', 'probability-statistics.statistics']
const basic = [full[0], 'probability-statistics.probability.basic', full[5]]
const labels = Object.fromEntries(TOPICS.map(t => [t.value, t.label]))

describe('Комбінаторика, ймовірність та статистика у конструкторі', () => {
  it.each([...full, basic[1]])('%s є один раз у списку й має перевірений маршрут', id => {
    expect(TOPICS.filter(t => t.value === id)).toHaveLength(1)
    expect([...VERIFIED_TOPICS]).toContain(id)
  })
  it('звичайний 9 клас веде лише до трьох базових маршрутів', () => {
    const unit = gradeTracks(9, labels).find(t => t.track === 'algebra')!.units.find(u => u.title.startsWith('Основи комбінаторики'))!
    expect(unit.topics).toEqual(basic)
    expect(unit.topics).not.toContain('combinatorics')
    expect(unit.topics).not.toContain(full[4])
  })
  it('11 клас містить усі шість, а не широку змішану тему', () => {
    const unit = gradeTracks(11, labels).find(t => t.track === 'algebra')!.units.find(u => u.title.startsWith('Елементи комбінаторики'))!
    expect(unit.topics).toEqual(full)
  })
  it('чинна форма вибору 9 класу передає вузький topicID базової ймовірності', async () => {
    const wrapper = mount(TopicGradePicker, { props: { view: 9, labels, selected: [], part: 'topics' } })
    const unit = gradeTracks(9, labels).find(t => t.track === 'algebra')!.units.find(u => u.title.startsWith('Основи комбінаторики'))!
    await wrapper.find(`[data-testid="topic-unit-algebra-${unit.no}"]`).trigger('click')
    await wrapper.find(`[data-testid="topic-refine-${basic[1]}"]`).trigger('click')
    const picks = wrapper.emitted('pick')!
    expect(picks[picks.length - 1]).toEqual([basic[1]])
    expect(wrapper.find(`[data-testid="topic-refine-${full[4]}"]`).exists()).toBe(false)
    wrapper.unmount()
  })
})
