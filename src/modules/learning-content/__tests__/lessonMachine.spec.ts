// Машина станів заняття — інваріанти маршруту.
//
// Тести названі за інваріантами, а не за функціями: якщо колись зміниться
// реалізація, має лишитись видно, ЯКА обіцянка перевіряється.

import { describe, it, expect } from 'vitest'
import {
  type LessonPlan,
  type Run,
  MAX_TREATMENTS_PER_MISTAKE,
  advance,
  answer,
  back,
  canAdvance,
  canGoBack,
  createRun,
  currentStep,
  isAnswered,
  isFinished,
  nextStepId,
  position,
  progress,
  report,
  validatePlan,
} from '../lessonMachine'

// ── Плани для перевірок ───────────────────────────────────────────────────

/** Пласка доріжка — те, чим заняття було до машини станів. */
function linearPlan(): LessonPlan {
  return {
    id: 'linear',
    course: 'Відсотки',
    session: 1,
    subgoal: 'П1',
    steps: [
      { id: 'a', type: 'explain', title: 'Пояснення' },
      { id: 'b', type: 'example', title: 'Приклад' },
      { id: 'c', type: 'summary', title: 'Підсумок' },
    ],
  }
}

/** Перевірка з гілкою лікування на одне непорозуміння. */
function branchingPlan(): LessonPlan {
  return {
    id: 'branching',
    course: 'Відсотки',
    session: 1,
    subgoal: 'П1',
    steps: [
      { id: 'explain', type: 'explain', title: 'Пояснення' },
      {
        id: 'check1',
        type: 'check',
        title: 'Спробуй сам',
        text: 'Запишіть 40% десятковим дробом.',
        choices: [
          { text: '0,4', correct: true },
          { text: '4', correct: false, mistakeId: 'percent_div_by_10', rootId: 'percent/hundredth' },
          { text: '40', correct: false, mistakeId: 'percent_ignore_conversion', rootId: 'percent/sign' },
        ],
        onMistake: { percent_div_by_10: 'fix_div10' },
        noBranch: ['percent_ignore_conversion'],
      },
      { id: 'check2', type: 'check', title: 'Ще одна', text: '?', choices: [{ text: 'так', correct: true }] },
      { id: 'summary', type: 'summary', title: 'Підсумок' },
      // лікування живе ПІСЛЯ підсумку в масиві — саме тому машина не може
      // покладатись на порядок і мусить вести за `returnTo`
      { id: 'fix_div10', type: 'remediate', title: 'Ділили на 10', returnTo: 'check2' },
    ],
  }
}

/** Пройти план до кінця, обираючи варіант за правилом. Захищено від петель. */
function playThrough(plan: LessonPlan, pick: (run: Run) => number): { run: Run; steps: string[] } {
  let run = createRun(plan)
  const steps = [run.stepId]
  for (let guard = 0; guard < 100; guard++) {
    const step = currentStep(plan, run)
    if (step?.type === 'check' && !isAnswered(run, step.id)) {
      run = answer(plan, run, pick(run))
      continue
    }
    if (!canAdvance(plan, run)) break
    run = advance(plan, run)
    steps.push(run.stepId)
  }
  return { run, steps }
}

// ── INV-M2: план без гілок грає точно як плаский список ───────────────────

describe('INV-M2 · лінійний план не змінює поведінку', () => {
  it('проходиться по порядку і завершується', () => {
    const plan = linearPlan()
    const { run, steps } = playThrough(plan, () => 0)
    expect(steps).toEqual(['a', 'b', 'c'])
    expect(isFinished(plan, run)).toBe(true)
  })

  it('«крок N з M» рахує весь план', () => {
    const plan = linearPlan()
    let run = createRun(plan)
    expect(position(plan, run)).toEqual({ index: 1, total: 3 })
    run = advance(plan, run)
    expect(position(plan, run)).toEqual({ index: 2, total: 3 })
    expect(progress(plan, run)).toBe(50)
  })
})

// ── INV-M4: активний крок не перестрибнути ────────────────────────────────

describe('INV-M4 · перевірку не можна проминути без відповіді', () => {
  it('поки не обрано варіант — уперед не можна', () => {
    const plan = branchingPlan()
    let run = advance(plan, createRun(plan)) // → check1
    expect(currentStep(plan, run)?.id).toBe('check1')
    expect(canAdvance(plan, run)).toBe(false)
    expect(nextStepId(plan, run)).toBeNull()

    run = answer(plan, run, 0)
    expect(canAdvance(plan, run)).toBe(true)
  })

  it('перший вибір остаточний — повторний ігнорується', () => {
    const plan = branchingPlan()
    let run = advance(plan, createRun(plan))
    run = answer(plan, run, 1) // помилився
    run = answer(plan, run, 0) // «передумав»
    expect(run.answers.check1.correct).toBe(false)
    expect(run.answers.check1.mistakeId).toBe('percent_div_by_10')
  })
})

// ── Гілкування за КОНКРЕТНИМ непорозумінням ───────────────────────────────

describe('маршрут залежить від того, ЩО саме учень зрозумів не так', () => {
  it('правильна відповідь веде далі по основній лінії', () => {
    const plan = branchingPlan()
    const { steps } = playThrough(plan, () => 0)
    expect(steps).toEqual(['explain', 'check1', 'check2', 'summary'])
  })

  it('помилка з гілкою веде в лікування САМЕ цього непорозуміння', () => {
    const plan = branchingPlan()
    let run = advance(plan, createRun(plan))
    run = answer(plan, run, 1) // percent_div_by_10
    run = advance(plan, run)
    expect(run.stepId).toBe('fix_div10')
    // і повертає туди, куди сказано, а не «наступним у масиві»
    run = advance(plan, run)
    expect(run.stepId).toBe('check2')
  })

  it('помилка без гілки (noBranch) веде далі, а не в глухий кут', () => {
    const plan = branchingPlan()
    let run = advance(plan, createRun(plan))
    run = answer(plan, run, 2) // percent_ignore_conversion — гілки нема свідомо
    run = advance(plan, run)
    expect(run.stepId).toBe('check2')
  })

  it('звіт віддає НЕПОРОЗУМІННЯ, а не лише кількість правильних', () => {
    const plan = branchingPlan()
    let run = advance(plan, createRun(plan))
    run = answer(plan, run, 1)
    run = advance(plan, run) // у лікування
    const r = report(run)
    expect(r.mistakes).toEqual(['percent_div_by_10'])
    expect(r.roots).toEqual(['percent/hundredth'])
    expect(r.correct).toBe(0)
    // `treated` — ПОКАЗАНІ корені; крок лікування лишається способом показу
    expect(r.treated).toEqual(['fix_div10'])
  })
})

// ── INV-M3 / INV-M1: ніяких петель і глухих кутів ─────────────────────────

describe('INV-M3 · те саме непорозуміння не крутить учня по колу', () => {
  it('друга поява того самого непорозуміння веде ДАЛІ, не в лікування', () => {
    // план, де обидві перевірки ловлять одне й те саме непорозуміння
    const plan: LessonPlan = {
      id: 'loop',
      course: 'c',
      session: 1,
      subgoal: 's',
      steps: [
        {
          id: 'q1',
          type: 'check',
          title: 'q1',
          choices: [
            { text: 'ok', correct: true },
            { text: 'no', correct: false, mistakeId: 'm', rootId: 'root/one' },
          ],
          onMistake: { m: 'fix' },
        },
        {
          id: 'q2',
          type: 'check',
          title: 'q2',
          choices: [
            { text: 'ok', correct: true },
            { text: 'no', correct: false, mistakeId: 'm', rootId: 'root/one' },
          ],
          onMistake: { m: 'fix' },
        },
        { id: 'end', type: 'summary', title: 'end' },
        { id: 'fix', type: 'remediate', title: 'fix', returnTo: 'q2' },
      ],
    }

    const { run, steps } = playThrough(plan, () => 1) // завжди помиляється
    expect(isFinished(plan, run)).toBe(true)
    expect(steps.filter((s) => s === 'fix')).toHaveLength(MAX_TREATMENTS_PER_MISTAKE)
    expect(steps[steps.length - 1]).toBe('end')
  })
})

describe('INV-M1 · граф радить, але не блокує', () => {
  it('учень, який помиляється скрізь, усе одно доходить до кінця', () => {
    const plan = branchingPlan()
    const { run } = playThrough(plan, (r) => {
      const s = currentStep(plan, r)
      return (s?.choices?.length ?? 1) - 1 // завжди останній варіант
    })
    expect(isFinished(plan, run)).toBe(true)
  })

  it('поступ не відкочується назад під час лікування', () => {
    const plan = branchingPlan()
    let run = advance(plan, createRun(plan))
    const before = progress(plan, run)
    run = advance(plan, answer(plan, run, 1)) // у лікування
    expect(currentStep(plan, run)?.type).toBe('remediate')
    expect(progress(plan, run)).toBe(before)
  })
})

// ── «Назад» іде фактичним шляхом ─────────────────────────────────────────

describe('«Назад» веде туди, де учень справді був', () => {
  it('після лікування назад вертає в лікування, а не в сусіда по масиву', () => {
    const plan = branchingPlan()
    let run = advance(plan, createRun(plan))
    run = advance(plan, answer(plan, run, 1)) // fix_div10
    run = advance(plan, run) // check2
    expect(canGoBack(run)).toBe(true)
    run = back(run)
    expect(run.stepId).toBe('fix_div10')
  })

  it('з першого кроку назад нікуди', () => {
    const plan = linearPlan()
    const run = createRun(plan)
    expect(canGoBack(run)).toBe(false)
    expect(back(run)).toEqual(run)
  })
})

// ── INV-M5 / INV-M6: валідатор плану ─────────────────────────────────────

describe('валідатор ловить биті плани ДО показу учневі', () => {
  it('справний план не має зауваг', () => {
    expect(validatePlan(branchingPlan())).toEqual([])
    expect(validatePlan(linearPlan())).toEqual([])
  })

  it('INV-M5 · перехід у неіснуючий крок', () => {
    const plan = branchingPlan()
    plan.steps[1].onMistake = { percent_div_by_10: 'нема-такого' }
    expect(validatePlan(plan).map((p) => p.problem).join()).toContain('неіснуючий крок')
  })

  it('INV-M6 · непорозуміння без гілки і без позначки — заборонено', () => {
    const plan = branchingPlan()
    plan.steps[1].noBranch = [] // прибрали свідому позначку
    const problems = validatePlan(plan)
    expect(problems.map((p) => p.problem).join()).toContain('percent_ignore_conversion')
  })

  it('перевірка без рівно одного правильного варіанта', () => {
    const plan = branchingPlan()
    plan.steps[1].choices = [
      { text: 'a', correct: true },
      { text: 'b', correct: true },
    ]
    expect(validatePlan(plan).map((p) => p.problem).join()).toContain('рівно один правильний')
  })

  it('недосяжне лікування — тихо мертвий крок', () => {
    const plan = branchingPlan()
    plan.steps[1].onMistake = {}
    plan.steps[1].noBranch = ['percent_div_by_10', 'percent_ignore_conversion']
    expect(validatePlan(plan).map((p) => p.problem).join()).toContain('не веде жодна гілка')
  })

  it('дубль id кроку', () => {
    const plan = linearPlan()
    plan.steps.push({ id: 'a', type: 'summary', title: 'дубль' })
    expect(validatePlan(plan).map((p) => p.problem).join()).toContain('дубль id')
  })
})

describe('лікування без явного returnTo вертає туди, звідки звернули', () => {
  it('після лікування з ДРУГОЇ перевірки заняття йде далі, а не назад', () => {
    const plan: LessonPlan = {
      id: 'shared-fix',
      course: 'c',
      session: 1,
      subgoal: 's',
      steps: [
        {
          id: 'q1',
          type: 'check',
          title: 'q1',
          choices: [
            { text: 'ok', correct: true },
            { text: 'no', correct: false, mistakeId: 'm', rootId: 'root/one' },
          ],
          onMistake: { m: 'fix' },
        },
        {
          id: 'q2',
          type: 'check',
          title: 'q2',
          choices: [
            { text: 'ok', correct: true },
            { text: 'no', correct: false, mistakeId: 'm2', rootId: 'root/two' },
          ],
          onMistake: { m2: 'fix' },
        },
        { id: 'end', type: 'summary', title: 'end' },
        // одне лікування на дві перевірки, БЕЗ returnTo
        { id: 'fix', type: 'remediate', title: 'fix' },
      ],
    }
    // помиляємось на ДРУГІЙ перевірці
    let run = createRun(plan)
    run = advance(plan, answer(plan, run, 0)) // q1 правильно → q2
    expect(run.stepId).toBe('q2')
    run = advance(plan, answer(plan, run, 1)) // q2 помилка → лікування
    expect(run.stepId).toBe('fix')
    run = advance(plan, run)
    // саме 'end', а не 'q1': вертаємось у місце звороту, не в початок
    expect(run.stepId).toBe('end')
  })
})

describe('INV-M3 · те саме ЛІКУВАННЯ не показуємо двічі', () => {
  it('різні mistakeId з одним коренем дають одне лікування, не два', () => {
    // Знайдено ЖИВИМ КЛІКОМ, не тестом: percent_div_by_10 і
    // percent_mul_by_10 — різні id одного кореня «сота, не десята», обидва
    // ведуть у fix_hundredth. Лічильник за mistakeId вважав їх різними, і
    // учень читав однаковий текст двічі.
    const plan: LessonPlan = {
      id: 'shared-root',
      course: 'c',
      session: 1,
      subgoal: 's',
      steps: [
        {
          id: 'q1',
          type: 'check',
          title: 'q1',
          choices: [
            { text: 'ok', correct: true },
            { text: 'no', correct: false, mistakeId: 'div_by_10', rootId: 'root/hundredth' },
          ],
          onMistake: { div_by_10: 'fix_root' },
        },
        {
          id: 'q2',
          type: 'check',
          title: 'q2',
          choices: [
            { text: 'ok', correct: true },
            { text: 'no', correct: false, mistakeId: 'mul_by_10', rootId: 'root/hundredth' },
          ],
          onMistake: { mul_by_10: 'fix_root' },
        },
        { id: 'end', type: 'summary', title: 'end' },
        { id: 'fix_root', type: 'remediate', title: 'сота, не десята', rootId: 'root/hundredth' },
      ],
    }

    const { run, steps } = playThrough(plan, () => 1) // помиляється всюди
    expect(steps.filter((id) => id === 'fix_root')).toHaveLength(1)
    expect(isFinished(plan, run)).toBe(true)
    // сигнал діагностики при цьому НЕ втрачено: обидва непорозуміння в звіті
    expect(report(run).mistakes).toEqual(['div_by_10', 'mul_by_10'])
    // симптоми різні, ДІАГНОЗ один — саме він піде в наступне заняття
    expect(report(run).roots).toEqual(['root/hundredth'])
  })
})

// ── Завершуваність як ВЛАСТИВІСТЬ, а не як приклад ───────────────────────
// Заувага рев'ю: попередні тести доводять конкретний маршрут. Тут
// перевіряється, що З БУДЬ-ЯКОГО стану при БУДЬ-ЯКИХ відповідях учень
// доходить до кінця.

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DEFAULT_STREAK_GOAL,
  answerPractice,
  completeSolve,
  findDeadEnds,
  isActive,
  practiceDone,
  practiceStreak,
  practiceTask,
} from '../lessonMachine'

const HERE = dirname(fileURLToPath(import.meta.url))
const PUBLIC = resolve(HERE, '../../../../public')

/**
 * УСІ зібрані курси, а не один вшитий.
 *
 * Тут стояв `lesson-percent.concept.json` — і поки курс був один, гейт
 * покривав усе. Друга тема зробила з нього перевірку однієї четвертої:
 * заняття десяткових могли зламатись, і жоден тест не помітив би.
 * Тепер список береться з покажчика, який збирає бекенд із того, що
 * реально лежить у теці, тож новий курс потрапляє під гейт сам.
 */
const CATALOGUE = JSON.parse(
  readFileSync(resolve(PUBLIC, 'courses.json'), 'utf-8'),
).courses as Array<{ topic: string; entry: string }>

const COURSES = CATALOGUE.map((c) => ({
  topic: c.topic,
  order: JSON.parse(readFileSync(resolve(PUBLIC, `lesson-${c.entry}.json`), 'utf-8'))
    .courseOrder as string[],
}))

describe('INV-M1 як властивість плану, не як приклад', () => {
  it('навчальні плани не мають станів без виходу', () => {
    expect(findDeadEnds(linearPlan())).toEqual([])
    expect(findDeadEnds(branchingPlan())).toEqual([])
  })

  it('КОЖЕН план КОЖНОГО курсу проходиться за будь-яких відповідей', () => {
    // саме «кожен», а не «перший»: банк перезбирається, і зламатись може
    // будь-яке заняття будь-якої теми
    expect(COURSES.length).toBeGreaterThan(0)
    for (const course of COURSES) {
      expect(course.order.length, `курс ${course.topic}`).toBeGreaterThan(1)
      for (const id of course.order) {
        const plan = JSON.parse(readFileSync(resolve(PUBLIC, `lesson-${id}.json`), 'utf-8'))
        expect(validatePlan(plan), `план ${id}`).toEqual([])
        expect(findDeadEnds(plan), `план ${id}`).toEqual([])
      }
    }
  })

  it('тренування має пул, який витримує серію за середньої влучності', () => {
    // вихід із тренування — три ПОСПІЛЬ; при влучності 0,5 це в середньому
    // ~14 спроб, тож вісім задач упирались у порожній пул саме в того, кому
    // тренування й потрібне
    for (const course of COURSES) {
      for (const id of course.order) {
        const plan = JSON.parse(readFileSync(resolve(PUBLIC, `lesson-${id}.json`), 'utf-8'))
        const practice = plan.steps.find((s: { type: string }) => s.type === 'practice')
        expect(practice, `у ${id} немає тренування`).toBeTruthy()
        expect(practice.tasks.length, `пул ${id}`).toBeGreaterThanOrEqual(14)
      }
    }
  })

  it('покажчик курсів не бреше: усе, що обіцяне, справді лежить', () => {
    // покажчик збирається бекендом; якщо він розійдеться з текою,
    // вітрина покаже курс, який не відкриється
    for (const c of CATALOGUE) {
      const entry = JSON.parse(
        readFileSync(resolve(PUBLIC, `lesson-${c.entry}.json`), 'utf-8'),
      )
      expect(entry.id, `вхід курсу ${c.topic}`).toBe(c.entry)
      expect(entry.course).toBeTruthy()
    }
  })

  it('цикл через next ловиться, хоч усі цілі існують', () => {
    const plan: LessonPlan = {
      id: 'cycle',
      course: 'c',
      session: 1,
      subgoal: 's',
      steps: [
        { id: 'a', type: 'explain', title: 'a', next: 'b' },
        { id: 'b', type: 'explain', title: 'b', next: 'a' }, // ← петля
        { id: 'end', type: 'summary', title: 'end' },
      ],
    }
    // валідатор посилань мовчить: обидві цілі існують
    expect(validatePlan(plan)).toEqual([])
    // а перевірка завершуваності — ні
    expect(findDeadEnds(plan).sort()).toEqual(['a', 'b'])
  })

  it('одна лиха гілка ламає крок цілком — учень обирає сам', () => {
    const plan: LessonPlan = {
      id: 'one-bad-branch',
      course: 'c',
      session: 1,
      subgoal: 's',
      steps: [
        {
          id: 'q',
          type: 'check',
          title: 'q',
          choices: [
            { text: 'ok', correct: true },
            { text: 'no', correct: false, mistakeId: 'm', rootId: 'root/one' },
          ],
          onMistake: { m: 'trap' },
        },
        { id: 'end', type: 'summary', title: 'end' },
        // лікування, що вертає САМЕ В СЕБЕ
        { id: 'trap', type: 'remediate', title: 'trap', returnTo: 'trap' },
      ],
    }
    expect(findDeadEnds(plan)).toContain('q')
    expect(findDeadEnds(plan)).toContain('trap')
  })
})

describe('крок `solve` має вихід, а не намальовані двері', () => {
  const withSolve = (): LessonPlan => ({
    id: 'with-solve',
    course: 'c',
    session: 1,
    subgoal: 's',
    steps: [
      { id: 'board', type: 'solve', title: 'Розв’яжи на дошці' },
      { id: 'end', type: 'summary', title: 'end' },
    ],
  })

  it('без завершення solve — глухий кут (те, що було до правки)', () => {
    const plan = withSolve()
    let run = createRun(plan)
    expect(isActive(currentStep(plan, run))).toBe(true)
    expect(canAdvance(plan, run)).toBe(false)
    // `answer()` тут не працює: вона приймає лише `check`
    run = answer(plan, run, 0)
    expect(canAdvance(plan, run)).toBe(false)
  })

  it('completeSolve відкриває вихід і НЕ вигадує вердикту', () => {
    const plan = withSolve()
    let run = completeSolve(plan, createRun(plan))
    expect(run.answers.board.correct).toBeNull()
    expect(canAdvance(plan, run)).toBe(true)
    run = advance(plan, run)
    expect(run.stepId).toBe('end')
    // «розв'язав» не зараховується як «відповів правильно»
    const r = report(run)
    expect(r.answered).toBe(0)
    expect(r.solved).toBe(1)
    expect(r.correct).toBe(0)
  })

  it('план із solve завершуваний', () => {
    expect(findDeadEnds(withSolve())).toEqual([])
  })
})

describe('корінь — стабільний ключ діагностики, крок лікування — лише показ', () => {
  it('симптом без rootId — мовчазна діра, валідатор її називає', () => {
    const plan = branchingPlan()
    delete plan.steps[1].choices[1].rootId
    expect(validatePlan(plan).map((p) => p.problem).join()).toContain('без стабільного rootId')
  })

  it('перейменування кроку лікування НЕ міняє діагноз', () => {
    const plan = branchingPlan()
    let run = advance(plan, createRun(plan))
    run = advance(plan, answer(plan, run, 1))
    const before = report(run).roots

    // той самий корінь, інший спосіб показу
    const renamed = branchingPlan()
    renamed.steps[4].id = 'fix_div10_v2'
    renamed.steps[4].title = 'Інакше про те саме'
    renamed.steps[1].onMistake = { percent_div_by_10: 'fix_div10_v2' }
    let r2 = advance(renamed, createRun(renamed))
    r2 = advance(renamed, answer(renamed, r2, 1))

    expect(report(r2).roots).toEqual(before)
    expect(validatePlan(renamed)).toEqual([])
  })
})

// ── Тренування: зупинка за СЕРІЄЮ, не за числом ──────────────────────────

describe('INV-M7 · тренування триває, доки не вийде поспіль', () => {
  /** Набір із `n` задач, у кожній два варіанти: [0] правильний. */
  const trainingPlan = (n: number, goal?: number): LessonPlan => ({
    id: 'training',
    course: 'c',
    session: 1,
    subgoal: 's',
    steps: [
      {
        id: 'drill',
        type: 'practice',
        title: 'Потренуйся',
        streakGoal: goal,
        tasks: Array.from({ length: n }, (_, i) => ({
          id: `t${i}`,
          text: `задача ${i}`,
          solution: `розбір ${i}`,
          choices: [
            { text: 'ok', correct: true },
            { text: 'no', correct: false, mistakeId: 'm', rootId: 'r/x' },
          ],
        })),
      },
      { id: 'end', type: 'summary', title: 'end' },
    ],
  })

  const rightAway = (plan: LessonPlan) => {
    let run = createRun(plan)
    for (let i = 0; i < 50 && practiceTask(plan.steps[0], run); i++) {
      run = answerPractice(plan, run, 0)
    }
    return run
  }

  it('три правильні поспіль — і досить, решта задач не питається', () => {
    const plan = trainingPlan(10)
    const run = rightAway(plan)
    expect(practiceStreak(run, 'drill')).toBe(DEFAULT_STREAK_GOAL)
    expect(run.practice.drill).toHaveLength(DEFAULT_STREAK_GOAL)
    expect(practiceDone(plan.steps[0], run)).toBe(true)
    expect(canAdvance(plan, run)).toBe(true)
  })

  it('поки серії немає — уперед не можна', () => {
    const plan = trainingPlan(10)
    let run = createRun(plan)
    run = answerPractice(plan, run, 0)
    run = answerPractice(plan, run, 0)
    expect(practiceStreak(run, 'drill')).toBe(2)
    expect(canAdvance(plan, run)).toBe(false)
    expect(isFinished(plan, run)).toBe(false)
  })

  it('помилка ОБНУЛЯЄ серію — саме тому це «поспіль»', () => {
    const plan = trainingPlan(10)
    let run = createRun(plan)
    run = answerPractice(plan, run, 0) // +1
    run = answerPractice(plan, run, 1) // помилка
    expect(practiceStreak(run, 'drill')).toBe(0)
    run = answerPractice(plan, run, 0)
    expect(practiceStreak(run, 'drill')).toBe(1)
  })

  it('INV-M1 живий: хто помиляється завжди — виходить по стелі набору', () => {
    const plan = trainingPlan(5)
    let run = createRun(plan)
    for (let i = 0; i < 50 && practiceTask(plan.steps[0], run); i++) {
      run = answerPractice(plan, run, 1) // завжди хибно
    }
    expect(run.practice.drill).toHaveLength(5) // набір вичерпано
    expect(practiceDone(plan.steps[0], run)).toBe(true)
    run = advance(plan, run)
    expect(run.stepId).toBe('end')
  })

  it('задачі не повторюються і йдуть по порядку', () => {
    const plan = trainingPlan(4)
    let run = createRun(plan)
    const seen: string[] = []
    for (let i = 0; i < 10 && practiceTask(plan.steps[0], run); i++) {
      seen.push(practiceTask(plan.steps[0], run)!.id)
      run = answerPractice(plan, run, 1)
    }
    expect(seen).toEqual(['t0', 't1', 't2', 't3'])
  })

  it('план із тренуванням не має станів без виходу', () => {
    expect(findDeadEnds(trainingPlan(6))).toEqual([])
  })

  it('корені з тренування потрапляють у звіт', () => {
    const plan = trainingPlan(6)
    let run = answerPractice(plan, createRun(plan), 1)
    const r = report(run)
    expect(r.roots).toEqual(['r/x'])
    expect(r.practice).toEqual({ attempts: 1, correct: 0 })
  })

  it('валідатор: тренування без задач і недосяжна серія', () => {
    const empty = trainingPlan(0)
    expect(validatePlan(empty).map((p) => p.problem).join()).toContain('без задач')

    const tooShort = trainingPlan(2, 5)
    expect(validatePlan(tooShort).map((p) => p.problem).join()).toContain('недосяжна')
  })
})
