// Незавершене проходження — обіцянки сховища.
//
// Головна з них не «зберігає й читає», а «НЕ відновлює те, що вже не
// підходить до плану»: банк перезбирається, кроки міняються, і мовчки
// відновлений стан = порожній екран у людини, яка ні в чому не винна.

import { describe, it, expect, beforeEach } from 'vitest'
import type { LessonPlan } from '../lessonMachine'
import { advance, answer, createRun } from '../lessonMachine'
import {
  clearRun,
  lessonProgress,
  loadRun,
  saveRun,
} from '../progressStore'

function plan(): LessonPlan {
  return {
    id: 'p',
    course: 'c',
    session: 1,
    subgoal: 's',
    steps: [
      { id: 'a', type: 'explain', title: 'a' },
      {
        id: 'q',
        type: 'check',
        title: 'q',
        choices: [
          { text: 'ok', correct: true },
          { text: 'no', correct: false, mistakeId: 'm', rootId: 'r/x' },
        ],
        onMistake: { m: 'fix' },
      },
      { id: 'end', type: 'summary', title: 'end' },
      { id: 'fix', type: 'remediate', title: 'fix', rootId: 'r/x' },
    ],
  }
}

beforeEach(() => localStorage.clear())

describe('збереження й відновлення проходження', () => {
  it('крок і відповіді повертаються тими самими', () => {
    const p = plan()
    let run = advance(p, createRun(p))
    run = answer(p, run, 1)
    saveRun('p', run)

    const back = loadRun(p, 'p')
    expect(back?.stepId).toBe('q')
    expect(back?.answers.q.rootId).toBe('r/x')
  })

  it('порожнє сховище — null, а не падіння', () => {
    expect(loadRun(plan(), 'p')).toBeNull()
  })

  it('биті дані — null, а не викид', () => {
    localStorage.setItem('m4sh:lesson-run:p', '{не json')
    expect(loadRun(plan(), 'p')).toBeNull()
  })

  it('крок, якого В ПЛАНІ ВЖЕ НЕМА → не відновлюємо', () => {
    // саме те, що станеться після перезбирання банку
    const p = plan()
    saveRun('p', { stepId: 'q-old', path: ['a', 'q-old'], answers: {}, treated: {} })
    expect(loadRun(p, 'p')).toBeNull()
  })

  it('шлях із чужим кроком → теж не відновлюємо', () => {
    const p = plan()
    saveRun('p', { stepId: 'q', path: ['a', 'зниклий', 'q'], answers: {}, treated: {} })
    expect(loadRun(p, 'p')).toBeNull()
  })
})

describe('стан заняття для вітрини курсу', () => {
  it('нічого не відкривали → «не почато»', () => {
    expect(lessonProgress(plan(), 'p', []).state).toBe('new')
  })

  it('відкрив, але не відповідав → все ще «не почато», а не «в процесі»', () => {
    const p = plan()
    saveRun('p', createRun(p))
    expect(lessonProgress(p, 'p', []).state).toBe('new')
  })

  it('відповів → «в процесі», з номером кроку', () => {
    const p = plan()
    let run = advance(p, createRun(p))
    run = answer(p, run, 0)
    saveRun('p', run)
    const got = lessonProgress(p, 'p', [])
    expect(got.state).toBe('in-progress')
    expect(got.step).toBe(2)
    expect(got.total).toBe(3) // лікування в основну лінію не рахується
  })

  it('«пройдено» — зі стану учня, не з наявності чернетки', () => {
    // дійшов до кінця, але вкладку закрив: підсумок у стан учня не влився,
    // і курс не має вдавати, що заняття зараховане
    const p = plan()
    expect(lessonProgress(p, 'p', ['p']).state).toBe('done')
    expect(lessonProgress(p, 'p', []).state).not.toBe('done')
  })

  it('очищення прибирає чернетку', () => {
    const p = plan()
    saveRun('p', advance(p, createRun(p)))
    clearRun('p')
    expect(loadRun(p, 'p')).toBeNull()
  })
})
