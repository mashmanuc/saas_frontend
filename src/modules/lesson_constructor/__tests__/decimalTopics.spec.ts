import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const { generate, push } = vi.hoisted(() => ({generate:vi.fn(async (_body:Record<string,unknown>) => ({session_id:'decimal-local'})), push:vi.fn()}))
vi.mock('vue-router', () => ({useRouter:() => ({push})}))
vi.mock('../api/lessonConstructorApi', async () => {
  const actual = await vi.importActual<any>('../api/lessonConstructorApi')
  return {...actual, lessonConstructorApi:{generate}}
})
import LessonConstructorPage from '../views/LessonConstructorPage.vue'
import { TOPICS } from '../api/lessonConstructorApi'

// Дерево тем — вигляд «НМТ»: з 2026-10-21 сторінка спершу пропонує клас учня (TopicGradePicker).
beforeEach(() => { localStorage.setItem('lc.topicView', 'nmt') })
beforeEach(() => {generate.mockClear();push.mockClear()})

describe('Три окремі добірки десяткових у справжній формі конструктора', () => {
  const prefix='real-numbers.fractions.decimal.'
  it('три людські назви, без зміни старого батьківського id', () => {
    expect(TOPICS.filter(t => t.value.startsWith(prefix)).map(t => t.value)).toEqual([
      prefix+'add-subtract',prefix+'multiply-divide',prefix+'order-of-operations',
    ])
    expect(TOPICS.find(t => t.value==='real-numbers.fractions.decimal')?.label).toBe('Десяткові дроби')
  })
  for(const suffix of ['add-subtract','multiply-divide','order-of-operations']) {
    it(`${suffix}: передає вузьку тему, кількість16 і збалансований профіль`, async () => {
      const w=mount(LessonConstructorPage)
      await w.get('.lc-topic-block__head').trigger('click')
      // Вужчі теми згорнуті (власник 2026-10-19) — шлях учителя: Дійсні числа ▸ Дроби ▸ Десяткові дроби ▸.
      for (const id of ['real-numbers','real-numbers.fractions','real-numbers.fractions.decimal'])
        await w.get(`.lc-topic-expand[data-topic="${id}"]`).trigger('click')
      const label=TOPICS.find(t => t.value===prefix+suffix)!.label
      const chip=w.findAll('.lc-topic-chip').find(b => b.text().trim()===label)!
      expect(chip).toBeDefined()
      await chip.trigger('click')
      await w.get('input[type=range]').setValue(16)
      await w.get('form').trigger('submit')
      await flushPromises()
      expect(generate).toHaveBeenCalledTimes(1)
      expect(generate.mock.calls[0][0]).toMatchObject({topics:[prefix+suffix],task_count:16,diff_profile:'balanced'})
      expect(push).toHaveBeenCalledWith({name:'winterboard-prepare',params:{id:'decimal-local'}})
      w.unmount()
    })
  }
})
