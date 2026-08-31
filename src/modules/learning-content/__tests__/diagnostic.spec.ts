// Діагностика — інваріанти вимірювання.
//
// Перевіряється не «функція повертає значення», а обіцянки контракту
// DIAGNOSTIC_PROFILE_SSOT: короткість, докази під кожним станом,
// чесний not_measured, порада замість наказу.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  type DiagnosticPool,
  type DiagnosticRun,
  MAX_TASKS,
  answerDiagnostic,
  buildProfile,
  createDiagnosticRun,
  currentTask,
  diagnosticProgress,
  isDiagnosticDone,
  nextTask,
  rootsFromRun,
  stateFor,
} from '../diagnostic'

const HERE = dirname(fileURLToPath(import.meta.url))
const POOL_FILE = resolve(HERE, '../../../../public/diagnostic-percent.json')
const realPool = (): DiagnosticPool => JSON.parse(readFileSync(POOL_FILE, 'utf-8'))

/** Пройти діагностику, обираючи відповіді за правилом. */
function play(pool: DiagnosticPool, pick: (t: ReturnType<typeof currentTask>) => number) {
  let run = createDiagnosticRun(pool)
  for (let guard = 0; guard < 60 && !isDiagnosticDone(run); guard++) {
    run = answerDiagnostic(pool, run, pick(currentTask(pool, run)))
  }
  return run
}

const correctIndex = (t: ReturnType<typeof currentTask>) =>
  Math.max(0, (t?.choices ?? []).findIndex((c) => c.correct))
const wrongIndex = (t: ReturnType<typeof currentTask>) =>
  Math.max(0, (t?.choices ?? []).findIndex((c) => !c.correct))

// ── Пул, що реально поїде клієнту ────────────────────────────────────────

describe('пул придатний для діагностики', () => {
  const pool = realPool()

  it('усі 4 підцілі арки представлені, по 8 задач', () => {
    expect(pool.arc).toHaveLength(4)
    for (const s of pool.arc) {
      expect(pool.tasks.filter((t) => t.subgoal === s)).toHaveLength(8)
    }
  })

  it('у кожній підцілі є розкид складності — інакше адаптивний крок нікуди робити', () => {
    for (const s of pool.arc) {
      const ds = pool.tasks.filter((t) => t.subgoal === s).map((t) => t.diffScore)
      expect(new Set(ds).size).toBeGreaterThan(3)
      expect(Math.max(...ds) - Math.min(...ds)).toBeGreaterThan(0.5)
    }
  })

  it('КОЖЕН хибний варіант має корінь — інакше помилку нікуди приписати', () => {
    const naked = pool.tasks.flatMap((t) =>
      t.choices.filter((c) => !c.correct && !c.rootId).map(() => t.id),
    )
    expect(naked).toEqual([])
  })

  it('рівно один правильний варіант у кожній задачі', () => {
    for (const t of pool.tasks) {
      expect(t.choices.filter((c) => c.correct)).toHaveLength(1)
    }
  })
})

// ── §3: коротка ──────────────────────────────────────────────────────────

describe('INV-D1 · діагностика КОРОТКА, а не «весь пул»', () => {
  it('прогін не перевищує стелю, хоч би як учень відповідав', () => {
    const pool = realPool()
    for (const pick of [correctIndex, wrongIndex]) {
      const run = play(pool, pick)
      expect(run.askedIds.length).toBeLessThanOrEqual(MAX_TASKS)
    }
  })

  it('усе правильно → по два докази на підціль, 8 задач із 32', () => {
    const pool = realPool()
    const run = play(pool, correctIndex)
    expect(run.askedIds.length).toBe(8)
    for (const s of pool.arc) expect(run.evidence[s]).toHaveLength(2)
  })

  it('жодна задача не питається двічі', () => {
    const pool = realPool()
    const run = play(pool, wrongIndex)
    expect(new Set(run.askedIds).size).toBe(run.askedIds.length)
  })
})

// ── §4 п.1.2: адаптивний крок ────────────────────────────────────────────

describe('INV-D2 · крок залежить від відповіді', () => {
  it('впорався → наступна СКЛАДНІША в тій самій підцілі', () => {
    const pool = realPool()
    let run = createDiagnosticRun(pool)
    const first = currentTask(pool, run)!
    run = answerDiagnostic(pool, run, correctIndex(first))
    const second = currentTask(pool, run)!
    expect(second.subgoal).toBe(first.subgoal)
    expect(second.diffScore).toBeGreaterThan(first.diffScore)
  })

  it('не впорався → наступна ПРОСТІША в тій самій підцілі', () => {
    const pool = realPool()
    let run = createDiagnosticRun(pool)
    const first = currentTask(pool, run)!
    run = answerDiagnostic(pool, run, wrongIndex(first))
    const second = currentTask(pool, run)!
    expect(second.subgoal).toBe(first.subgoal)
    expect(second.diffScore).toBeLessThan(first.diffScore)
  })

  it('перша задача підцілі — середньо-легка, не найлегша й не найважча', () => {
    const pool = realPool()
    const run = createDiagnosticRun(pool)
    const first = currentTask(pool, run)!
    const ds = pool.tasks.filter((t) => t.subgoal === first.subgoal).map((t) => t.diffScore)
    expect(first.diffScore).toBeGreaterThan(Math.min(...ds))
    expect(first.diffScore).toBeLessThan(Math.max(...ds))
  })

  it('підцілі опитуються в порядку арки', () => {
    const pool = realPool()
    const run = play(pool, correctIndex)
    const order = run.askedIds.map((id) => pool.tasks.find((t) => t.id === id)!.subgoal)
    expect([...new Set(order)]).toEqual(pool.arc)
  })
})

// ── §2: стан із доказів ──────────────────────────────────────────────────

describe('INV-D3 · стан — з доказів, і їх видно', () => {
  const ev = (diff: number, ok: boolean) => ({
    taskId: 't' + diff, diffScore: diff, level: 'mid' as const,
    result: (ok ? 'correct' : 'wrong') as 'correct' | 'wrong',
    rootId: ok ? null : 'r/x', errorKind: null,
  })

  it('драбина станів читається з відповідей', () => {
    expect(stateFor([ev(1, true), ev(1.5, true)])).toBe('solid')
    expect(stateFor([ev(1, true), ev(1.5, false)])).toBe('working')
    expect(stateFor([ev(1.5, false), ev(1, true)])).toBe('fragile')
    expect(stateFor([ev(1, false), ev(0.9, false)])).toBe('absent')
  })

  it('без доказів — not_measured, а не вгадане', () => {
    expect(stateFor([])).toBe('not_measured')
  })

  it('кожен стан у профілі має свої задачі під собою', () => {
    const pool = realPool()
    const run = play(pool, wrongIndex)
    const profile = buildProfile(pool, run)
    for (const s of profile.subgoals) {
      if (s.state === 'not_measured') continue
      expect(s.evidence.length).toBeGreaterThan(0)
      for (const e of s.evidence) {
        expect(pool.tasks.some((t) => t.id === e.taskId)).toBe(true)
      }
    }
  })
})

// ── §2 п.3-4: порада і людське речення ───────────────────────────────────

describe('INV-D4 · профіль радить і говорить по-людськи', () => {
  it('усе правильно → нуль занять і чесна розмова, а не порожній курс', () => {
    const pool = realPool()
    const profile = buildProfile(pool, play(pool, correctIndex))
    expect(profile.subgoals.every((s) => s.state === 'solid')).toBe(true)
    expect(Object.values(profile.recommendation.allocationHint).every((n) => n === 0)).toBe(true)
    expect(profile.recommendation.humanSummary).toMatch(/склад|поглиблен|інш/i)
  })

  it('усе хибно → найбільша вага, і підказка не мовчить', () => {
    const pool = realPool()
    const profile = buildProfile(pool, play(pool, wrongIndex))
    expect(profile.subgoals.every((s) => s.state === 'absent')).toBe(true)
    expect(Object.values(profile.recommendation.allocationHint).every((n) => n === 3)).toBe(true)
  })

  it('профіль ≫ бюджет → попередження, а не тихе врізання', () => {
    const pool = realPool()
    const profile = buildProfile(pool, play(pool, wrongIndex), 5)
    expect(profile.recommendation.scopeWarning).toContain('5')
  })

  it('речення для учня — ціле й читабельне, а не склеєне закінченнями', () => {
    // Перша версія давала «над тим, щоо: …» — умовне закінчення в
    // шаблонному рядку. Пін на точний текст, бо граматику не зловить
    // жоден інший тест.
    const pool = realPool()
    const s = buildProfile(pool, play(pool, wrongIndex)).recommendation.humanSummary
    expect(s).toContain('Найбільше попрацюємо ось над чим:')
    expect(s).not.toMatch(/щоо|тим, що:/)
    expect(s.endsWith('.')).toBe(true)
  })

  it('human_summary не містить чисел — учневі кажемо словами', () => {
    const pool = realPool()
    for (const pick of [correctIndex, wrongIndex]) {
      const s = buildProfile(pool, play(pool, pick)).recommendation.humanSummary
      expect(s).not.toMatch(/\d/)
    }
  })
})

// ── Стик зі станом учня ──────────────────────────────────────────────────

describe('діагностика годує стан учня тими самими коренями', () => {
  it('корені прогону — стабільні ключі, не id задач і не симптоми', () => {
    const pool = realPool()
    const roots = rootsFromRun(play(pool, wrongIndex))
    expect(roots.length).toBeGreaterThan(0)
    for (const r of roots) {
      expect(r).toMatch(/\//) // корені виду «percent/…»
      expect(pool.roots[r]).toBeTruthy() // і мають людську назву
    }
  })

  it('поступ рахується підцілями, а не задачами', () => {
    const pool = realPool()
    let run: DiagnosticRun = createDiagnosticRun(pool)
    expect(diagnosticProgress(pool, run)).toBe(0)
    run = answerDiagnostic(pool, run, correctIndex(currentTask(pool, run)))
    expect(diagnosticProgress(pool, run)).toBe(25)
  })
})
