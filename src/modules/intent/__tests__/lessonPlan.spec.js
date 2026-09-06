/**
 * План уроку на клієнті — гейт Г1.
 *
 * ⚠️ Цей файл — ДЗЕРКАЛО бекендних тестів
 * (`apps/winterboard/tests/test_lesson_plan.py`). Випадки навмисно ті самі:
 * перехід, пропуск, повернення назад, завершення уроку. Якщо два боки
 * розійдуться, розійдуться й ці два файли — і це буде видно, а не з'ясується
 * посеред уроку.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  activeStage, nextStage, advanceStage, isCompleted, looksLikePlan,
  loadPlan, savePlan, clearPlan, ROLE_LABELS,
} from '../lessonPlan'

const BOARD = 'b-1'

function makePlan(over = {}) {
  return {
    v: 1, rev: 0, subject: 'math', grade: 8,
    topic: 'Квадратні рівняння', goal: 'Учні розв’язують рівняння',
    current_stage: 'explain',
    stages: [
      { id: 'hook', role: 'motivation', goal: 'зацікавити', status: 'done' },
      { id: 'explain', role: 'explanation', goal: 'вивести формулу', status: 'active' },
      { id: 'practice', role: 'practice', goal: 'три задачі', status: 'planned' },
      { id: 'summary', role: 'summary', goal: 'три висновки', status: 'planned' },
    ],
    ...over,
  }
}

const byId = plan => Object.fromEntries(plan.stages.map(s => [s.id, s]))

describe('looksLikePlan', () => {
  it('приймає валідний план', () => {
    expect(looksLikePlan(makePlan())).toBe(true)
  })

  it.each([
    ['null', null],
    ['масив', []],
    ['рядок', 'план'],
    ['без етапів', { v: 1 }],
    ['етапи не масив', { v: 1, stages: 'нісенітниця' }],
  ])('відхиляє %s', (_label, bad) => {
    expect(looksLikePlan(bad)).toBe(false)
  })

  it('відхиляє невідому роль', () => {
    const p = makePlan()
    p.stages[2].role = 'homework'
    expect(looksLikePlan(p)).toBe(false)
  })

  it('відхиляє замало етапів', () => {
    const p = makePlan()
    p.stages = p.stages.slice(0, 2)
    expect(looksLikePlan(p)).toBe(false)
  })
})

describe('читання плану', () => {
  it('активний етап', () => {
    expect(activeStage(makePlan()).id).toBe('explain')
  })

  it('наступний — перший planned після активного', () => {
    expect(nextStage(makePlan()).id).toBe('practice')
  })

  it('пропущений етап не стає наступним', () => {
    const p = makePlan()
    p.stages[2].status = 'skipped'
    expect(nextStage(p).id).toBe('summary')
  })

  it('назад не обертається: пропущене позаду лишається позаду', () => {
    const p = makePlan({ current_stage: 'summary' })
    p.stages[1].status = 'done'
    p.stages[2].status = 'planned'
    p.stages[3].status = 'active'
    expect(nextStage(p)).toBeNull()
  })
})

describe('переходи', () => {
  it('next закриває активний і відкриває наступний', () => {
    const out = advanceStage(makePlan(), 'next')
    expect(byId(out).explain.status).toBe('done')
    expect(byId(out).practice.status).toBe('active')
    expect(out.current_stage).toBe('practice')
  })

  it('skip позначає пропущеним, а не пройденим', () => {
    const out = advanceStage(makePlan(), 'skip')
    expect(byId(out).explain.status).toBe('skipped')
  })

  it('rev росте', () => {
    expect(advanceStage(makePlan({ rev: 7 }), 'next').rev).toBe(8)
  })

  it('вхідний план не змінюється', () => {
    const p = makePlan()
    advanceStage(p, 'next')
    expect(p.current_stage).toBe('explain')
    expect(p.stages[1].status).toBe('active')
  })

  it('останній етап ЗАВЕРШУЄ урок — це фінал, не помилка', () => {
    const p = makePlan({ current_stage: 'summary' })
    p.stages[1].status = 'done'
    p.stages[2].status = 'done'
    p.stages[3].status = 'active'
    const out = advanceStage(p, 'next')
    expect(out.current_stage).toBeNull()
    expect(isCompleted(out)).toBe(true)
    expect(byId(out).summary.status).toBe('done')
  })

  it('завершений план далі не рухається', () => {
    const p = makePlan({ current_stage: null })
    p.stages.forEach(s => { s.status = 'done' })
    expect(advanceStage(p, 'next')).toBeNull()
  })

  it('set уперед — попередній пройдений', () => {
    const out = advanceStage(makePlan(), 'set', 'summary')
    expect(byId(out).summary.status).toBe('active')
    expect(byId(out).explain.status).toBe('done')
  })

  it('set назад не викреслює те, що між ними', () => {
    const mid = advanceStage(makePlan(), 'next')      // активна практика
    const out = advanceStage(mid, 'set', 'explain')
    expect(byId(out).explain.status).toBe('active')
    expect(byId(out).practice.status).toBe('planned')
  })

  it('set на неіснуючий етап — null', () => {
    expect(advanceStage(makePlan(), 'set', 'nope')).toBeNull()
  })

  it('невідома дія — null', () => {
    expect(advanceStage(makePlan(), 'rewind')).toBeNull()
  })
})

describe('сховище', () => {
  beforeEach(() => { sessionStorage.clear() })

  it('зберігає й читає', () => {
    expect(savePlan(BOARD, makePlan())).toBe(true)
    expect(loadPlan(BOARD).topic).toBe('Квадратні рівняння')
  })

  it('порожньо, коли нічого не збережено', () => {
    expect(loadPlan(BOARD)).toBeNull()
  })

  it('дошки не діляться планом', () => {
    savePlan(BOARD, makePlan())
    expect(loadPlan('b-2')).toBeNull()
  })

  it('не зберігає непридатне', () => {
    expect(savePlan(BOARD, { погань: true })).toBe(false)
    expect(loadPlan(BOARD)).toBeNull()
  })

  it('сміття у сховищі не тягнеться в промпт і чиститься', () => {
    sessionStorage.setItem(`m4sh:lessonPlan:${BOARD}`, '{"stages":"нісенітниця"}')
    expect(loadPlan(BOARD)).toBeNull()
    expect(sessionStorage.getItem(`m4sh:lessonPlan:${BOARD}`)).toBeNull()
  })

  it('битий JSON не валить палітру', () => {
    sessionStorage.setItem(`m4sh:lessonPlan:${BOARD}`, '{ це не json')
    expect(() => loadPlan(BOARD)).not.toThrow()
    expect(loadPlan(BOARD)).toBeNull()
  })

  it('clearPlan прибирає', () => {
    savePlan(BOARD, makePlan())
    clearPlan(BOARD)
    expect(loadPlan(BOARD)).toBeNull()
  })
})

describe('підписи ролей', () => {
  it('українською — саме їх читає модель і бачить учитель', () => {
    expect(ROLE_LABELS.explanation).toBe('пояснення')
    expect(ROLE_LABELS.check).toBe('перевірка')
  })
})
