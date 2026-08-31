/**
 * Машина станів заняття — навчальний маршрут як переходи, а не масив.
 *
 * Навіщо: демо-доріжка була пласким списком із 9 блоків і кнопкою «Далі».
 * Усі учні йшли однією колією незалежно від того, що відповіли. Курс має
 * вести ЗАЛЕЖНО ВІД УЧНЯ: помилився на конкретному непорозумінні — отримав
 * лікування саме цього непорозуміння, а не «спробуй ще раз».
 *
 * Що ця одиниця НЕ робить (свідомо):
 *   • не знає про Vue, DOM і мережу — чиста функція над станом, тому
 *     перевіряється тестами без браузера;
 *   • не зберігає прогрес — це справа виклику;
 *   • не веде дошку. Крок типу `solve` оголошений, але не під'єднаний:
 *     курс і дошка розділені архітектурно (рішення власника 2026-08-31).
 *
 * ГОЛОВНЕ ПРАВИЛО, успадковане від графа передумов: **машина радить, а не
 * блокує**. Учень ніколи не замикається: з будь-якого досяжного стану є
 * вихід уперед, хоч би скільки разів він помилявся (INV-M1, INV-M3).
 */

// ─── План: що автор описав ───────────────────────────────────────────────

/**
 * Типи кроків. Пасивні (`explain`…`summary`) закриваються кнопкою «Далі»,
 * активні (`check`, `solve`) вимагають дії учня і дають СИГНАЛ, за яким
 * машина обирає наступний крок.
 */
export type StepType =
  | 'hook' // гачок: зачепити знайомим
  | 'explain' // пояснення поняття
  | 'emphasis' // ключова думка, яку треба запам'ятати
  | 'example' // показовий приклад, без дії учня
  | 'check' // задача з вибором — дає сигнал
  | 'solve' // розв'язування на дошці (оголошено, не під'єднано)
  | 'remediate' // лікування КОНКРЕТНОГО непорозуміння
  | 'summary' // підсумок

export const ACTIVE_STEPS: readonly StepType[] = ['check', 'solve']

export interface Choice {
  text: string
  correct: boolean
  /** ідентифікатор непорозуміння з банку задач; у правильного — null */
  mistakeId?: string | null
}

export interface Step {
  id: string
  type: StepType
  title: string
  body?: string
  items?: Array<{ q: string; a: string }>
  text?: string
  choices?: Choice[]
  solution?: string
  /** явний наступний крок; без нього — наступний за порядком у плані */
  next?: string
  /** `check`: куди вести, якщо відповів правильно */
  onCorrect?: string
  /** `check`: непорозуміння → крок, що його лікує */
  onMistake?: Record<string, string>
  /** `remediate`: куди повернутись після лікування */
  returnTo?: string
  /**
   * `check`: непорозуміння, для яких гілки НЕМА СВІДОМО.
   * Існує, щоб «немає гілки» не можна було отримати мовчки: валідатор
   * вимагає, аби кожен `mistakeId` із варіантів був або в `onMistake`,
   * або тут (INV-M6). Той самий принцип, що «неявний пропуск заборонено»
   * у семантичному гейті банку.
   */
  noBranch?: string[]
}

export interface LessonPlan {
  id: string
  course: string
  session: number
  subgoal: string
  steps: Step[]
  note?: string
  sourceLessons?: string[]
}

// ─── Виконання: що робить учень ──────────────────────────────────────────

export interface AnswerRecord {
  /** індекс обраного варіанта; `null` — крок закрито не вибором (`solve`) */
  choice: number | null
  /**
   * `true`/`false` — вердикт перевірки.
   * `null` — вердикту НЕМА: учень розв'язував на дошці, і хто б там що не
   * написав, машина цього не оцінює. Ставити тут `true` було б брехнею
   * («розв'язав» ≠ «розв'язав правильно»), а `false` — наклепом.
   */
  correct: boolean | null
  mistakeId: string | null
}

export interface Run {
  stepId: string
  /** пройдені кроки в порядку відвідування — для «Назад» і для звіту */
  path: string[]
  answers: Record<string, AnswerRecord>
  /**
   * Скільки разів учень уже бачив КОЖНЕ лікування (ключ — id кроку
   * `remediate`, не `mistakeId`).
   *
   * ⚠️ Спершу тут був `mistakeId` — і це давало повтор, який 20 тестів
   * не побачили, а живий клік показав одразу: `percent_div_by_10` і
   * `percent_mul_by_10` — РІЗНІ id з одним коренем, тож обидва вели в
   * `fix_hundredth`, і учень читав той самий текст двічі. Учневі байдуже
   * до наших ідентифікаторів: він питає «я це вже бачив?».
   */
  treated: Record<string, number>
}

/**
 * Скільки разів лікуємо ОДНЕ непорозуміння за заняття.
 *
 * 1, а не «поки не виправить»: інакше впертий учень крутиться в петлі і
 * заняття не має кінця. Друга поява того самого непорозуміння веде далі
 * за планом — сигнал уже зафіксовано, з ним розбереться наступне заняття
 * (або тьютор), а не нескінченне коло. Це і є INV-M3.
 */
export const MAX_TREATMENTS_PER_MISTAKE = 1

// ─── Валідація плану ─────────────────────────────────────────────────────

export interface PlanProblem {
  stepId: string
  problem: string
}

/**
 * Перевірка плану ПЕРЕД показом учневі. Дешевше зловити тут, ніж побачити
 * порожній екран на кроці 6.
 */
export function validatePlan(plan: LessonPlan): PlanProblem[] {
  const problems: PlanProblem[] = []
  const ids = new Set<string>()

  for (const step of plan.steps) {
    if (ids.has(step.id)) problems.push({ stepId: step.id, problem: 'дубль id кроку' })
    ids.add(step.id)
  }

  const exists = (target: string | undefined, where: string, from: string) => {
    if (target && !ids.has(target)) {
      problems.push({ stepId: from, problem: `${where} веде в неіснуючий крок «${target}»` })
    }
  }

  for (const step of plan.steps) {
    exists(step.next, 'next', step.id)
    exists(step.onCorrect, 'onCorrect', step.id)
    exists(step.returnTo, 'returnTo', step.id)
    for (const [mistake, target] of Object.entries(step.onMistake ?? {})) {
      exists(target, `onMistake[${mistake}]`, step.id)
    }

    if (step.type === 'check') {
      const choices = step.choices ?? []
      if (choices.filter((c) => c.correct).length !== 1) {
        problems.push({ stepId: step.id, problem: 'у перевірці має бути рівно один правильний варіант' })
      }
      // INV-M6: жодного непорозуміння без явного рішення
      const covered = new Set([...Object.keys(step.onMistake ?? {}), ...(step.noBranch ?? [])])
      for (const c of choices) {
        if (!c.correct && c.mistakeId && !covered.has(c.mistakeId)) {
          problems.push({
            stepId: step.id,
            problem: `непорозуміння «${c.mistakeId}» не має ні гілки, ні позначки noBranch`,
          })
        }
      }
    }

    // `remediate` без `returnTo`/`next` — НЕ помилка: він вертає туди,
    // звідки звернули (див. nextStepId). Заборонено інше: лікування, до
    // якого не веде ЖОДНА гілка, — воно недосяжне й тихо мертве.
    if (step.type === 'remediate') {
      const reachable = plan.steps.some((s) =>
        Object.values(s.onMistake ?? {}).includes(step.id) || s.next === step.id,
      )
      if (!reachable) problems.push({ stepId: step.id, problem: 'до лікування не веде жодна гілка' })
    }
  }

  return problems
}

// ─── Хід заняття ─────────────────────────────────────────────────────────

export function createRun(plan: LessonPlan): Run {
  const first = plan.steps[0]
  if (!first) throw new Error('порожній план заняття')
  return { stepId: first.id, path: [first.id], answers: {}, treated: {} }
}

export function stepById(plan: LessonPlan, id: string): Step | null {
  return plan.steps.find((s) => s.id === id) ?? null
}

export function currentStep(plan: LessonPlan, run: Run): Step | null {
  return stepById(plan, run.stepId)
}

/**
 * Наступний крок ОСНОВНОЇ лінії.
 *
 * ⚠️ Пропускає `remediate`. Лікування лежить у тому самому масиві, але
 * ЗА межами маршруту: воно досяжне лише явною гілкою `onMistake`. Без
 * цього пропуску виходила петля — зловлено тестом, де лікування навмисне
 * покладене ПІСЛЯ підсумку: `summary → fix → returnTo check2 → summary`.
 * Порядок у масиві не має визначати маршрут.
 */
function linearNext(plan: LessonPlan, id: string): string | null {
  const i = plan.steps.findIndex((s) => s.id === id)
  if (i < 0) return null
  for (let j = i + 1; j < plan.steps.length; j++) {
    if (plan.steps[j].type !== 'remediate') return plan.steps[j].id
  }
  return null
}

/** Чи крок вимагає дії учня перед «Далі». */
export function isActive(step: Step | null): boolean {
  return !!step && ACTIVE_STEPS.includes(step.type)
}

/** Чи учень уже дав сигнал на цьому кроці. */
export function isAnswered(run: Run, stepId: string): boolean {
  return run.answers[stepId] !== undefined
}

/**
 * Учень обрав варіант. НЕ рухає вперед: спершу він бачить розбір, і лише
 * тоді тисне «Далі». Повторний вибір на тому самому кроці ігнорується —
 * сигнал діагностики має бути ПЕРШОЮ реакцією, не найкращою з кількох.
 */
export function answer(plan: LessonPlan, run: Run, choiceIndex: number): Run {
  const step = currentStep(plan, run)
  if (!step || step.type !== 'check') return run
  if (isAnswered(run, step.id)) return run
  const choice = step.choices?.[choiceIndex]
  if (!choice) return run

  return {
    ...run,
    answers: {
      ...run.answers,
      [step.id]: {
        choice: choiceIndex,
        correct: !!choice.correct,
        mistakeId: choice.correct ? null : (choice.mistakeId ?? null),
      },
    },
  }
}

/**
 * Крок `solve` завершено (учень попрацював на дошці).
 *
 * Існує, бо без нього `solve` був **глухим кутом**: тип оголошений
 * активним, а закрити його могла лише `answer()`, яка приймає тільки
 * `check`. Будь-який план із `solve` завис би назавжди — пряме порушення
 * INV-M1, якого не бачив жоден із тестів, бо в жодному плані не було
 * `solve`. Оголосити активний тип і не дати йому виходу — те саме, що
 * лишити двері намальованими.
 */
export function completeSolve(plan: LessonPlan, run: Run): Run {
  const step = currentStep(plan, run)
  if (!step || step.type !== 'solve') return run
  if (isAnswered(run, step.id)) return run
  return {
    ...run,
    answers: {
      ...run.answers,
      [step.id]: { choice: null, correct: null, mistakeId: null },
    },
  }
}

/**
 * Куди веде поточний крок. `null` = вперед не можна (активний крок без
 * відповіді) або заняття скінчилось — розрізняє `canAdvance`/`done`.
 */
export function nextStepId(plan: LessonPlan, run: Run): string | null {
  const step = currentStep(plan, run)
  if (!step) return null

  if (isActive(step)) {
    const given = run.answers[step.id]
    if (!given) return null // INV-M4: перевірку не перестрибнути

    // `null` (дошка, вердикту нема) веде тим самим шляхом, що й правильна
    // відповідь: гілки лікування чіпляються за ПОМИЛКУ, а її тут не заявлено
    if (given.correct !== false) return step.onCorrect ?? step.next ?? linearNext(plan, step.id)

    const treatment = given.mistakeId ? step.onMistake?.[given.mistakeId] : undefined
    const already = treatment ? (run.treated[treatment] ?? 0) : 0
    // INV-M3: те саме непорозуміння лікуємо обмежену кількість разів,
    // інакше впертий учень не вийде з петлі.
    if (treatment && already < MAX_TREATMENTS_PER_MISTAKE) return treatment
    return step.next ?? linearNext(plan, step.id)
  }

  if (step.type === 'remediate') {
    if (step.returnTo) return step.returnTo
    if (step.next) return step.next
    // Без явного `returnTo` лікування вертає ТУДИ, ЗВІДКИ ЗВЕРНУЛИ:
    // на крок після перевірки, що привела сюди. Статичного `returnTo` для
    // цього не вистачає — одне непорозуміння ловлять кілька перевірок, і
    // фіксована ціль відкинула б учня назад або в чужу частину заняття.
    const from = [...run.path].reverse().find((id) => stepById(plan, id)?.type === 'check')
    return from ? linearNext(plan, from) : linearNext(plan, step.id)
  }
  return step.next ?? linearNext(plan, step.id)
}

export function canAdvance(plan: LessonPlan, run: Run): boolean {
  return nextStepId(plan, run) !== null
}

/**
 * Чи заняття скінчилось. Це ПИТАННЯ ДО СТАНУ, а не прапорець: інакше
 * «дійшов до кінця» дізнаєшся лише тоді, коли даремно смикнеш `advance`.
 * Кінець — це «далі нема куди», а активний крок без відповіді кінцем не є.
 */
export function isFinished(plan: LessonPlan, run: Run): boolean {
  const step = currentStep(plan, run)
  if (!step) return true
  if (isActive(step) && !isAnswered(run, step.id)) return false
  return nextStepId(plan, run) === null
}

/** Крок уперед. На останньому кроці нічого не робить. */
export function advance(plan: LessonPlan, run: Run): Run {
  const target = nextStepId(plan, run)
  if (!target) return run

  const treated = { ...run.treated }
  // лічильник росте на ВХОДІ в лікування — рівно тоді, коли воно сталось
  if (stepById(plan, target)?.type === 'remediate') {
    treated[target] = (treated[target] ?? 0) + 1
  }

  return { ...run, stepId: target, path: [...run.path, target], treated }
}

/** Крок назад по фактично пройденому шляху, а не по порядку в плані. */
export function back(run: Run): Run {
  if (run.path.length < 2) return run
  const path = run.path.slice(0, -1)
  return { ...run, stepId: path[path.length - 1], path }
}

export function canGoBack(run: Run): boolean {
  return run.path.length > 1
}

/**
 * Поступ у відсотках. Рахуємо по ПЛАНУ, а не по пройденому шляху: інакше
 * лікування (крок убік) виглядало б як відкат назад, хоч учень рухається.
 */
export function progress(plan: LessonPlan, run: Run): number {
  const main = plan.steps.filter((s) => s.type !== 'remediate')
  const i = main.findIndex((s) => s.id === run.stepId)
  if (main.length < 2) return isFinished(plan, run) ? 100 : 0
  if (i < 0) {
    // усередині лікування — тримаємо поступ на кроці, з якого зайшли
    const prev = [...run.path].reverse().find((id) => main.some((s) => s.id === id))
    const j = main.findIndex((s) => s.id === prev)
    return j < 0 ? 0 : Math.round((j / (main.length - 1)) * 100)
  }
  return Math.round((i / (main.length - 1)) * 100)
}

/** Позиція для підпису «крок N з M» — теж по основній лінії. */
export function position(plan: LessonPlan, run: Run): { index: number; total: number } {
  const main = plan.steps.filter((s) => s.type !== 'remediate')
  const i = main.findIndex((s) => s.id === run.stepId)
  if (i >= 0) return { index: i + 1, total: main.length }
  const prev = [...run.path].reverse().find((id) => main.some((s) => s.id === id))
  const j = main.findIndex((s) => s.id === prev)
  return { index: Math.max(1, j + 1), total: main.length }
}

/**
 * Що заняття дізналось про учня. Це і є вхід для наступного заняття:
 * не «5 із 7», а ЯКІ саме непорозуміння спрацювали.
 */
export interface RunReport {
  /** кроків із вердиктом (перевірки) */
  answered: number
  /** кроків, закритих роботою на дошці — без вердикту */
  solved: number
  correct: number
  /** які саме непорозуміння спрацювали — вхід для наступного заняття */
  mistakes: string[]
  /** які лікування учень бачив (id кроків `remediate`) */
  treated: string[]
}

export function report(run: Run): RunReport {
  const all = Object.values(run.answers)
  const given = all.filter((a) => a.correct !== null)   // кроки з вердиктом
  const mistakes = given.map((a) => a.mistakeId).filter((m): m is string => !!m)
  return {
    answered: given.length,
    solved: all.length - given.length,
    correct: given.filter((a) => a.correct === true).length,
    mistakes: [...new Set(mistakes)],
    treated: Object.keys(run.treated),
  }
}

// ─── Завершуваність: властивість УСІХ шляхів, а не одного ─────────────────

/**
 * Стани плану, з яких учень НЕ може дійти до кінця.
 *
 * Навіщо окремо від `validatePlan`: перевірки цілей ловлять биті посилання,
 * але не ловлять ЦИКЛ. `check → next → інший крок → returnTo назад` — усі
 * цілі існують, план «валідний», а учень крутиться вічно. Приклади-тести
 * доводять конкретний маршрут; тут доводиться властивість плану.
 *
 * Як рахуємо: зворотна досяжність по простору станів
 * `(крок, які лікування вже показані)`. Стан «добрий», якщо він кінцевий
 * або веде в добрий; для АКТИВНОГО кроку — якщо добрі ВСІ варіанти, бо
 * учень обирає сам, і одна лиха гілка ламає обіцянку. Простір скінченний:
 * лічильник лікувань лише зростає й обмежений.
 *
 * ⚠️ Ходимо ТИМИ САМИМИ функціями, якими грає заняття (`answer`,
 * `completeSolve`, `advance`). Друга реалізація маршруту поруч із першою
 * розійшлася б із нею, і перевірка почала б підтверджувати саму себе.
 */
export function findDeadEnds(plan: LessonPlan): string[] {
  // Лічильник у ключі ОБРІЗАЄМО до стелі: маршрут питає лише «вже
  // показували чи ні», а самолуп (`returnTo` у себе) інакше нарощував би
  // 1,2,3… і давав нескінченний простір станів — перевірка з'їдала пам'ять
  // замість того, щоб доповісти про глухий кут.
  const key = (run: Run): string =>
    run.stepId +
    '|' +
    Object.entries(run.treated)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${Math.min(v, MAX_TREATMENTS_PER_MISTAKE)}`)
      .join(',')

  interface Node {
    run: Run
    /** активний крок: добрий, лише якщо добрі ВСІ гілки */
    all: boolean
    next: string[]
    terminal: boolean
  }

  const nodes = new Map<string, Node>()
  const queue: Run[] = [createRun(plan)]

  while (queue.length) {
    const run = queue.shift() as Run
    const k = key(run)
    if (nodes.has(k)) continue

    const step = currentStep(plan, run)
    const node: Node = { run, all: false, next: [], terminal: false }
    nodes.set(k, node)

    if (!step || isFinished(plan, run)) {
      node.terminal = true
      continue
    }

    const successors: Run[] = []
    if (isActive(step) && !isAnswered(run, step.id)) {
      node.all = true
      const options =
        step.type === 'check'
          ? (step.choices ?? []).map((_, i) => answer(plan, run, i))
          : [completeSolve(plan, run)]
      for (const afterAnswer of options) {
        // варіант, який нічого не змінив (порожні choices, чужий тип),
        // лишає учня на місці — це глухий кут, і він має бути видним
        successors.push(isFinished(plan, afterAnswer) ? afterAnswer : advance(plan, afterAnswer))
      }
      if (!options.length) node.next = [] // активний крок без виходу
    } else {
      successors.push(advance(plan, run))
    }

    for (const s of successors) {
      node.next.push(key(s))
      queue.push(s)
    }
  }

  // Зворотна досяжність до нерухомої точки.
  const good = new Set<string>()
  for (const [k, n] of nodes) if (n.terminal) good.add(k)
  for (let changed = true; changed; ) {
    changed = false
    for (const [k, n] of nodes) {
      if (good.has(k) || n.terminal) continue
      if (!n.next.length) continue
      const ok = n.all ? n.next.every((t) => good.has(t)) : n.next.some((t) => good.has(t))
      if (ok) {
        good.add(k)
        changed = true
      }
    }
  }

  const bad = [...nodes.keys()].filter((k) => !good.has(k))
  // назовні віддаємо КРОКИ, а не внутрішні ключі станів
  return [...new Set(bad.map((k) => k.split('|')[0]))]
}
