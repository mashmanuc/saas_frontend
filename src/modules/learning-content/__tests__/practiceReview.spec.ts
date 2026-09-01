// Розбір тренування — інваріант ЕКРАНА, не машини.
//
// Машина весь час була права: відповідь зараховувалась, наступна задача
// віддавалась. Хибним був екран — зелене «Правильно» з розбором стояло
// під УЖЕ НАСТУПНИМ питанням і читалось як вердикт на нього. Жоден із
// 134 тестів чистих функцій цього не бачив і побачити не міг, бо дефект
// був виключно в тому, що з чим стоїть поруч.
//
// Тому тест монтує компонент і питає саме про сусідство: поки показано
// розбір, питання на екрані — те саме, до якого він написаний.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import DemoLessonView from '../views/DemoLessonView.vue'

const PLAN = {
  id: 'p',
  course: 'Курс',
  session: 1,
  subgoal: 'S',
  objective: 'о',
  courseOrder: ['p'],
  steps: [
    {
      id: 'practice',
      type: 'practice',
      title: 'Потренуйся',
      streakGoal: 3,
      tasks: [
        {
          id: 't1',
          text: 'ПЕРШЕ питання',
          solution: 'РОЗБІР ПЕРШОГО',
          choices: [
            { text: 'вірно-1', correct: true },
            { text: 'хибно-1', correct: false, mistakeId: 'm', rootId: 'r/x' },
          ],
        },
        {
          id: 't2',
          text: 'ДРУГЕ питання',
          solution: 'РОЗБІР ДРУГОГО',
          choices: [
            { text: 'вірно-2', correct: true },
            { text: 'хибно-2', correct: false, mistakeId: 'm', rootId: 'r/x' },
          ],
        },
        // ще дві — щоб серія 3 була досяжна: валідатор плану цього вимагає,
        // і правильно робить (інакше тренування завжди «не вдалось»)
        {
          id: 't3',
          text: 'ТРЕТЄ питання',
          solution: 'РОЗБІР ТРЕТЬОГО',
          choices: [
            { text: 'вірно-3', correct: true },
            { text: 'хибно-3', correct: false, mistakeId: 'm', rootId: 'r/x' },
          ],
        },
        {
          id: 't4',
          text: 'ЧЕТВЕРТЕ питання',
          solution: 'РОЗБІР ЧЕТВЕРТОГО',
          choices: [
            { text: 'вірно-4', correct: true },
            { text: 'хибно-4', correct: false, mistakeId: 'm', rootId: 'r/x' },
          ],
        },
      ],
    },
    { id: 'end', type: 'summary', title: 'Підсумок', body: 'кінець' },
  ],
}

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: { lesson: 'p' } }),
}))

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem(
    'm4sh:lesson-run:p',
    JSON.stringify({ stepId: 'practice', path: ['practice'], answers: {}, practice: {}, treated: {} }),
  )
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => PLAN })),
  )
})

async function openPractice() {
  const w = mount(DemoLessonView)
  await flushPromises()
  return w
}

/** Кнопки варіантів — усе, крім навігації. */
function choices(w: ReturnType<typeof mount>) {
  return w
    .findAll('button')
    .filter((b) => !/Назад|Далі|Обери|Наступна задача/.test(b.text()))
}

describe('INV-P1 · розбір стоїть під СВОЄЮ задачею', () => {
  it('після відповіді питання НЕ підмінюється наступним', async () => {
    const w = await openPractice()
    expect(w.text()).toContain('ПЕРШЕ питання')

    await choices(w)[0].trigger('click')
    await flushPromises()

    // головне: розбір і питання — одна пара
    expect(w.text()).toContain('РОЗБІР ПЕРШОГО')
    expect(w.text()).toContain('ПЕРШЕ питання')
    expect(w.text()).not.toContain('ДРУГЕ питання')
    expect(w.text()).not.toContain('РОЗБІР ДРУГОГО')
  })

  it('наступна задача приходить лише за окремим натисканням', async () => {
    const w = await openPractice()
    await choices(w)[0].trigger('click')
    await flushPromises()

    const next = w.findAll('button').find((b) => /Наступна задача/.test(b.text()))
    expect(next, 'кнопки «Наступна задача» немає').toBeTruthy()
    await next!.trigger('click')
    await flushPromises()

    expect(w.text()).toContain('ДРУГЕ питання')
    expect(w.text()).not.toContain('РОЗБІР ПЕРШОГО')
  })

  it('під час розбору варіанти не приймають кліків', async () => {
    // інакше подвійний клік зараховував би відповідь на задачу, якої
    // учень уже не бачить
    const w = await openPractice()
    await choices(w)[0].trigger('click')
    await flushPromises()

    for (const b of choices(w)) expect(b.attributes('disabled')).toBeDefined()

    await choices(w)[1].trigger('click')
    await flushPromises()
    const run = JSON.parse(localStorage.getItem('m4sh:lesson-run:p')!)
    expect(run.practice.practice).toHaveLength(1)
  })

  it('помилка теж лишається біля своєї задачі', async () => {
    const w = await openPractice()
    await choices(w)[1].trigger('click') // хибний варіант
    await flushPromises()

    expect(w.text()).toContain('ПЕРШЕ питання')
    expect(w.text()).toContain('РОЗБІР ПЕРШОГО')
    expect(w.text()).toMatch(/Не вийшло/)
  })
})
