// Підсумкова робота — обіцянки, а не функції.
//
// Головні дві: набір НЕ адаптивний (інакше «до» і «після» неспівставні)
// і під час роботи нічого не показуємо (інакше далі міряємо підказане).

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { FinalWork } from '../finalWork'
import {
  answerFinal,
  buildFinalResult,
  createFinalRun,
  finalProgress,
  finalTask,
  isFinalDone,
} from '../finalWork'

const HERE = dirname(fileURLToPath(import.meta.url))
const PUBLIC = resolve(HERE, '../../../../public')

function work(): FinalWork {
  const mk = (id: string, sub: string, root: string) => ({
    id,
    subgoal: sub,
    text: id,
    solution: 's',
    choices: [
      { text: 'ok', correct: true },
      { text: 'no', correct: false, mistakeId: 'm', rootId: root },
    ],
  })
  return {
    version: '1.0',
    topicId: 't',
    topic: 'Тема',
    arc: ['a', 'b'],
    subgoalLabels: { a: 'перше', b: 'друге' },
    roots: { 'r/x': 'корінь X', 'r/y': 'корінь Y' },
    tasks: [mk('1', 'a', 'r/x'), mk('2', 'a', 'r/x'), mk('3', 'b', 'r/y'), mk('4', 'b', 'r/y')],
  }
}

/** Пройти роботу, вказавши для кожної задачі, чи відповідати правильно. */
function play(w: FinalWork, ok: boolean[]) {
  let run = createFinalRun()
  for (const right of ok) run = answerFinal(w, run, right ? 0 : 1)
  return run
}

// ── Хід роботи ───────────────────────────────────────────────────────────

describe('INV-F1 · порядок задач той самий для всіх', () => {
  it('послідовність не залежить від відповідей', () => {
    const w = work()
    const good = play(w, [true, true, true, true])
    const bad = play(w, [false, false, false, false])
    expect(good.answers.map((a) => a.taskId)).toEqual(['1', '2', '3', '4'])
    expect(bad.answers.map((a) => a.taskId)).toEqual(['1', '2', '3', '4'])
  })

  it('усі бачать усі задачі — дострокового виходу немає', () => {
    const w = work()
    expect(play(w, [false, false, false, false]).answers).toHaveLength(4)
    expect(isFinalDone(w, play(w, [true, true, true, true]))).toBe(true)
  })
})

describe('хід', () => {
  it('прогрес рахується від пройдених задач', () => {
    const w = work()
    expect(finalProgress(w, createFinalRun())).toBe(0)
    expect(finalProgress(w, play(w, [true, true]))).toBe(50)
    expect(finalProgress(w, play(w, [true, true, true, true]))).toBe(100)
  })

  it('після останньої задачі поточної вже немає', () => {
    const w = work()
    expect(finalTask(w, play(w, [true, true, true, true]))).toBeNull()
  })

  it('неіснуючий варіант не зсуває роботу', () => {
    const w = work()
    const run = answerFinal(w, createFinalRun(), 9)
    expect(run.index).toBe(0)
    expect(run.answers).toHaveLength(0)
  })

  it('корінь записується лише за помилкою', () => {
    const w = work()
    const run = play(w, [true, false])
    expect(run.answers[0].rootId).toBeNull()
    expect(run.answers[1].rootId).toBe('r/x')
  })
})

// ── Підсумок ─────────────────────────────────────────────────────────────

describe('стан підцілі', () => {
  it('обидві правильні → тримається', () => {
    const w = work()
    const r = buildFinalResult(w, play(w, [true, true, false, false]))
    expect(r.subgoals[0].state).toBe('solid')
  })

  it('жодної → не склалось', () => {
    const w = work()
    const r = buildFinalResult(w, play(w, [false, false, true, true]))
    expect(r.subgoals[0].state).toBe('absent')
  })

  it('одна з двох → у роботі, і порядок відповідей цього НЕ міняє', () => {
    // на відміну від діагностики, тут немає драбини складності, тому
    // «спершу помилився» і «спершу вгадав» — та сама інформація
    const w = work()
    const first = buildFinalResult(w, play(w, [true, false, true, true]))
    const second = buildFinalResult(w, play(w, [false, true, true, true]))
    expect(first.subgoals[0].state).toBe('working')
    expect(second.subgoals[0].state).toBe('working')
  })

  it('підціль без задач → «не міряли», а не «провалив»', () => {
    const w = work()
    w.arc.push('c')
    w.subgoalLabels.c = 'третє'
    const r = buildFinalResult(w, play(w, [true, true, true, true]))
    expect(r.subgoals[2].state).toBe('not_measured')
  })
})

describe('INV-F2 · порівняння з діагностикою чесне', () => {
  const before = {
    subgoals: [
      { subgoal: 'a', state: 'absent' as const },
      { subgoal: 'b', state: 'solid' as const },
    ],
  }

  it('було absent, стало solid → зростання', () => {
    const w = work()
    const r = buildFinalResult(w, play(w, [true, true, true, true]), before)
    expect(r.subgoals[0].direction).toBe('up')
    expect(r.subgoals[0].movedFrom).toBe('absent')
    expect(r.subgoals[1].direction).toBe('same')
  })

  it('було solid, стало absent → падіння, і ми його не ховаємо', () => {
    const w = work()
    const r = buildFinalResult(w, play(w, [true, true, false, false]), before)
    expect(r.subgoals[1].direction).toBe('down')
  })

  it('без профілю діагностики руху НЕМА, а не «зросло з нуля»', () => {
    const w = work()
    const r = buildFinalResult(w, play(w, [true, true, true, true]), null)
    expect(r.compared).toBe(false)
    expect(r.subgoals[0].direction).toBeUndefined()
    expect(r.humanSummary).not.toMatch(/стало краще|не пройшов дарма/)
  })

  it('«fragile» діагностики лягає МІЖ absent і working', () => {
    const w = work()
    const mid = { subgoals: [{ subgoal: 'a', state: 'fragile' as const }] }
    const grew = buildFinalResult(w, play(w, [true, false, true, true]), mid)
    expect(grew.subgoals[0].direction).toBe('up') // fragile → working
    const fell = buildFinalResult(w, play(w, [false, false, true, true]), mid)
    expect(fell.subgoals[0].direction).toBe('down') // fragile → absent
  })
})

describe('що віддається далі', () => {
  it('корені без повторів — вхід для повторення', () => {
    const w = work()
    const r = buildFinalResult(w, play(w, [false, false, false, true]))
    expect(r.roots.slice().sort()).toEqual(['r/x', 'r/y'])
  })

  it('людське речення без цифр', () => {
    const w = work()
    const runs = [
      [true, true, true, true],
      [false, false, false, false],
      [true, false, true, false],
    ]
    for (const ok of runs) {
      const r = buildFinalResult(w, play(w, ok))
      expect(r.humanSummary).not.toMatch(/[0-9]/)
      expect(r.humanSummary.length).toBeGreaterThan(20)
    }
  })

  it('речення не обіцяє успіху там, де провал', () => {
    const w = work()
    const r = buildFinalResult(w, play(w, [false, false, false, false]))
    expect(r.humanSummary).toContain('перше')
    expect(r.humanSummary).toContain('друге')
    expect(r.humanSummary).not.toMatch(/закрит/)
  })

  it('речення називає І провалене, І хитке — інакше воно мовчить про список під ним', () => {
    // рівно те, що показує «варто повернутись»: два рядки, а не один
    const w = work()
    const r = buildFinalResult(w, play(w, [false, false, true, false]))
    expect(r.subgoals[0].state).toBe('absent')
    expect(r.subgoals[1].state).toBe('working')
    expect(r.humanSummary).toContain('перше')
    expect(r.humanSummary).toContain('друге')
  })

  it('жодна підціль не названа в реченні двічі', () => {
    // «зросла, але ще хитається» — правда обидва рази, і саме тому
    // спокуса сказати обидва. У реченні це читається як затинання;
    // про рух каже стрілка в рядку, а не другий згадок у тексті
    const w = work()
    const before = { subgoals: [{ subgoal: 'a', state: 'absent' as const }] }
    const r = buildFinalResult(w, play(w, [true, false, true, true]), before)
    expect(r.subgoals[0].direction).toBe('up')
    expect(r.subgoals[0].state).toBe('working')
    expect(r.humanSummary.split('перше').length - 1).toBe(1)
  })

  it('усього правильних рахується по всій роботі', () => {
    const w = work()
    const r = buildFinalResult(w, play(w, [true, false, true, true]))
    expect(r.correct).toBe(3)
    expect(r.total).toBe(4)
  })
})

// ── Зібрані дані ─────────────────────────────────────────────────────────

describe('INV-F3 · зібрана робота не повторює показаного', () => {
  const raw = JSON.parse(readFileSync(resolve(PUBLIC, 'final-percent.json'), 'utf-8')) as FinalWork

  it('жодної задачі із занять і діагностики', () => {
    const seen = new Set<string>()
    for (const sub of raw.arc) {
      const plan = JSON.parse(readFileSync(resolve(PUBLIC, `lesson-${sub}.json`), 'utf-8'))
      for (const step of plan.steps) {
        if (step.type === 'check' && step.taskId != null) seen.add(String(step.taskId))
        if (step.type === 'practice') for (const t of step.tasks ?? []) seen.add(String(t.id))
      }
    }
    const diag = JSON.parse(readFileSync(resolve(PUBLIC, 'diagnostic-percent.json'), 'utf-8'))
    for (const t of diag.tasks) seen.add(String(t.id))

    expect(seen.size).toBeGreaterThan(50) // сама перевірка має що перевіряти
    const overlap = raw.tasks.filter((t) => seen.has(String(t.id)))
    expect(overlap.map((t) => t.id)).toEqual([])
  })

  it('кожна підціль курсу виміряна, і однаково', () => {
    const per = raw.arc.map((s) => raw.tasks.filter((t) => t.subgoal === s).length)
    expect(per.every((n) => n === per[0])).toBe(true)
    expect(per[0]).toBeGreaterThanOrEqual(2)
  })

  it('у кожної задачі рівно одна правильна відповідь', () => {
    for (const t of raw.tasks) {
      expect(t.choices.filter((c) => c.correct)).toHaveLength(1)
      expect(t.choices.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('назвати помилку коренем можна лише відомим коренем', () => {
    for (const t of raw.tasks) {
      for (const c of t.choices) {
        if (c.rootId) expect(Object.keys(raw.roots)).toContain(c.rootId)
        if (c.mistakeId) expect(c.rootId).toBeTruthy()
      }
    }
  })

  it('кожна задача має хоч одну названу помилку — інакше провал німий', () => {
    for (const t of raw.tasks) {
      expect(t.choices.some((c) => !!c.rootId)).toBe(true)
    }
  })
})
