/** Справжні картки й KaTeX із повторно прочитаного локального уроку. */
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import Preview from './Preview.vue'
import raw from './preview-data.json'
import katex from 'katex'

describe('Локальний перегляд змістовної прогресії', () => {
  it('усі 60 умов, варіантів і розборів мають валідний LaTeX', () => {
    expect(Object.keys(raw.tasks)).toHaveLength(60)
    for (const task of Object.values(raw.tasks)) {
      for (const text of [task.question, task.solution, ...task.choices.map(choice => choice.text)]) {
        for (const match of text.matchAll(/\$([^$]+)\$/g)) {
          expect(() => katex.renderToString(match[1], { throwOnError: true })).not.toThrow()
        }
      }
    }
  })
  it('показує всі 16 умов і розборів без підміни рендерера та формул', async () => {
    const wrapper = mount(Preview, { global: { plugins: [createPinia()] } })
    await wrapper.get('input[type="checkbox"]').setValue(true)
    expect(wrapper.findAll('.nmt-task')).toHaveLength(16)
    expect(wrapper.findAll('.nmt-task__question .katex').length).toBeGreaterThanOrEqual(16)
    expect(wrapper.findAll('.katex-error')).toHaveLength(0)
    await wrapper.get('.controls > button').trigger('click')
    expect(wrapper.findAll('.nmt-task__solution')).toHaveLength(16)
    expect(wrapper.text()).toContain('Віднімемо 2 від обох частин')
    expect(wrapper.findAll('.katex-error')).toHaveLength(0)
    wrapper.unmount()
  })

  it('перемикає справжні розкладки 1/2/5 без втрати початку добору', async () => {
    const wrapper = mount(Preview, { global: { plugins: [createPinia()] } })
    for (const [index, cards, pages] of [[0, 1, 16], [1, 2, 8], [2, 5, 4]]) {
      await wrapper.findAll('.layout-switch button')[index].trigger('click')
      expect(wrapper.findAll('.nmt-task')).toHaveLength(cards)
      expect(wrapper.get('nav').text()).toContain(`1 / ${pages}`)
      expect(wrapper.findAll('.caption strong')[0].text()).toBe('Задача 1')
    }
    wrapper.unmount()
  })

  it('штатна кнопка розбору змінює лише автономну копію картки', async () => {
    const wrapper = mount(Preview, { global: { plugins: [createPinia()] } })
    const button = wrapper.findAll('.nmt-task')[0].findAll('button')
      .find(item => item.text() === 'Показати розбір')!
    await button.trigger('click')
    expect(wrapper.findAll('.nmt-task__solution')).toHaveLength(1)
    expect(wrapper.text()).toContain('x=')
    wrapper.unmount()
  })
})
