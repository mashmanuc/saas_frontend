/**
 * Дерево тем у генераторі (власник 2026-10-19): вузькі теми — під своєю широкою з відступом і підписом
 * батька («Дроби › …»), і СПЕРШУ згорнуті: ▸ біля теми розкриває один рівень («щоб підтеми розгорталися» —
 * розкрите все разом було «кишкою» на весь екран).
 */
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))

import LessonConstructorPage from '../views/LessonConstructorPage.vue'
import { TOPICS } from '../api/lessonConstructorApi'

async function openBlocks() {
  const w = mount(LessonConstructorPage)
  for (const head of w.findAll('.lc-topic-block__head')) await head.trigger('click')
  return w
}

const section = (w: any, title: string) =>
  w.findAll('.lc-topic-row').find((r: any) => r.find('.lc-topic-row__title').text() === title)
const chipsOf = (row: any) => row.findAll('.lc-topic-chip').map((c: any) => c.text().trim())
const rowUnder = (w: any, parentLabel: string) => w.findAll('.lc-topics')
  .find((r: any) => r.find('.lc-topics__parent').exists() && r.find('.lc-topics__parent').text() === `${parentLabel} ›`)
const caret = (w: any, topic: string) => w.find(`.lc-topic-expand[data-topic="${topic}"]`)

// Дерево тем — вигляд «НМТ»: з 2026-10-21 сторінка спершу пропонує клас учня (TopicGradePicker).
beforeEach(() => { localStorage.setItem('lc.topicView', 'nmt') })
describe('дерево тем генератора', () => {
  it('спершу видно лише широкі теми; біля тих, що мають вужчі, — ▸', async () => {
    const w = await openBlocks()
    const rows = section(w, 'Числа й вирази').findAll('.lc-topics')
    expect(rows).toHaveLength(1)
    expect(chipsOf(rows[0])).toContain('Дійсні числа')
    expect(chipsOf(rows[0])).not.toContain('Дроби')
    const c = caret(w, 'real-numbers')
    expect(c.text()).toBe('▸')
    expect(c.attributes('aria-expanded')).toBe('false')
  })

  it('▸ розкриває один рівень: «Дійсні числа › … Дроби», далі «Дроби › Звичайні…»; ▾ згортає гілку', async () => {
    const w = await openBlocks()
    await caret(w, 'real-numbers').trigger('click')
    expect(chipsOf(rowUnder(w, 'Дійсні числа'))).toContain('Дроби')
    expect(rowUnder(w, 'Дроби')).toBeUndefined()            // лише один рівень

    await caret(w, 'real-numbers.fractions').trigger('click')
    expect(chipsOf(rowUnder(w, 'Дроби'))).toContain('Звичайні дроби')
    await caret(w, 'real-numbers.fractions.ordinary').trigger('click')
    expect(chipsOf(rowUnder(w, 'Звичайні дроби'))).toContain('Додавання і віднімання дробів з різними знаменниками')
    expect(Number(rowUnder(w, 'Звичайні дроби').attributes('data-depth')))
      .toBe(Number(rowUnder(w, 'Дроби').attributes('data-depth')) + 1)

    await caret(w, 'real-numbers').trigger('click')         // згорнути верх — ховається вся гілка
    expect(caret(w, 'real-numbers').text()).toBe('▸')
    expect(rowUnder(w, 'Дійсні числа')).toBeUndefined()
    expect(rowUnder(w, 'Звичайні дроби')).toBeUndefined()
  })

  it('кнопка теми, як і раніше, лише вибирає — гілку не розкриває', async () => {
    const w = await openBlocks()
    const chip = w.findAll('.lc-topic-chip').find((c: any) => c.text().trim() === 'Дійсні числа')!
    await chip.trigger('click')
    expect(chip.classes()).toContain('lc-topic-chip--active')
    expect(rowUnder(w, 'Дійсні числа')).toBeUndefined()
  })

  it('розкривши все, бачимо кожну тему рівно раз', async () => {
    const w = await openBlocks()
    for (let guard = 0; guard < 10; guard++) {
      const closed = w.findAll('.lc-topic-expand[aria-expanded="false"]')
      if (!closed.length) break
      for (const b of closed) await b.trigger('click')
    }
    const shown = w.findAll('.lc-topic-chip').map((c: any) => c.text().trim())
    expect(shown).toHaveLength(TOPICS.length)
  })
})
