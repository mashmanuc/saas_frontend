// З екрана результату діагностики ЗАВЖДИ є куди піти.
//
// Знайдено не тестами, а власником, який пройшов діагностику вручну й
// написав «а далі що?». Сторінка закінчувалась текстом: у гілці з
// прогалинами були посилання на заняття, а в гілці «усе тримається» —
// жодної дії взагалі. Людина, яка добре впоралась, упиралась у стіну
// рівно за те, що впоралась.
//
// Усі 142 тести до того перевіряли ЧИСЛА профілю — стани, докази,
// речення. Жоден не питав, чи можна з екрана піти далі, бо це не
// властивість профілю, а властивість сторінки.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import DiagnosticView from '../views/DiagnosticView.vue'

function task(id: string, subgoal: string, diffScore: number) {
  return {
    id,
    subgoal,
    diffScore,
    level: 'mid',
    text: `питання ${id}`,
    solution: 'розбір',
    choices: [
      { text: 'вірно', correct: true, mistakeId: null, rootId: null },
      { text: 'хибно', correct: false, mistakeId: 'm', rootId: 'r/x' },
    ],
  }
}

const POOL = {
  poolVersion: '1.0',
  topicId: 'demo.topic',
  topic: 'Демо',
  arc: ['s.one', 's.two'],
  subgoalLabels: { 's.one': 'перше', 's.two': 'друге' },
  roots: { 'r/x': 'корінь' },
  lessons: ['s.one', 's.two'],
  tasks: [
    task('1', 's.one', 1.0), task('2', 's.one', 1.2),
    task('3', 's.one', 1.4), task('4', 's.one', 1.6),
    task('5', 's.two', 1.0), task('6', 's.two', 1.2),
    task('7', 's.two', 1.4), task('8', 's.two', 1.6),
  ],
}

const CATALOGUE = {
  version: '1.0',
  courses: [
    { topic: 'demo', title: 'Демо', entry: 's.one', lessons: 2 },
    { topic: 'other', title: 'Сусідня тема', entry: 'o.one', lessons: 3 },
  ],
}

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: { topic: 'demo' } }),
}))

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
    ok: true,
    json: async () => (String(url).includes('courses') ? CATALOGUE : POOL),
  })))
})

/** Пройти діагностику до кінця, відповідаючи за правилом. */
async function play(right: boolean) {
  const w = mount(DiagnosticView)
  await flushPromises()
  const start = w.findAll('button').find((b) => /Почати/.test(b.text()))
  await start!.trigger('click')
  await flushPromises()

  for (let guard = 0; guard < 20; guard++) {
    const opts = w.findAll('section button').filter((b) => /вірно|хибно/.test(b.text()))
    if (!opts.length) break
    await opts[right ? 0 : 1].trigger('click')
    await flushPromises()
  }
  return w
}

function links(w: ReturnType<typeof mount>) {
  return w.findAll('a').map((a) => a.attributes('href') ?? '')
}

describe('INV-D5 · результат діагностики не буває глухим кутом', () => {
  it('усе тримається → пропонуємо підсумкову роботу, а не порожній екран', async () => {
    const w = await play(true)
    expect(w.text()).toContain('Ось що видно')
    expect(links(w).some((h) => h.startsWith('/final'))).toBe(true)
  })

  it('є прогалини → ведемо на перше слабке заняття', async () => {
    const w = await play(false)
    expect(links(w).some((h) => h.includes('/demo-lesson?lesson='))).toBe(true)
  })

  it('у ОБОХ випадках лишається шлях до курсу', async () => {
    for (const right of [true, false]) {
      const w = await play(right)
      expect(links(w).some((h) => h.startsWith('/course')), `right=${right}`).toBe(true)
    }
  })

  it('сусідні теми пропонуються, а поточна в переліку не дублюється', async () => {
    const w = await play(true)
    const hrefs = links(w)
    expect(hrefs).toContain('/course?topic=other')
    expect(hrefs.filter((h) => h === '/course?topic=demo')).toHaveLength(1)
  })

  it('кожна дія веде КУДИСЬ — порожніх посилань немає', async () => {
    // порожній href виглядає як кнопка й нічого не робить: та сама стіна,
    // лише з виглядом виходу
    for (const right of [true, false]) {
      for (const h of links(await play(right))) {
        expect(h, `right=${right}`).toBeTruthy()
      }
    }
  })
})
