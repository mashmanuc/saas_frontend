/**
 * Підсумкова робота теми — чи навчив курс.
 *
 * Третій вид виміру в курсі, і межі між ними принципові:
 *
 *   ДІАГНОСТИКА  адаптивна, до курсу, міряє що людина ЗНАЛА
 *   ТРЕНУВАННЯ   показує розбір одразу, бо вчить
 *   ФІНАЛ        фіксований, після курсу, міряє чого НАВЧИЛИ
 *
 * Чому набір ФІКСОВАНИЙ, хоч адаптивний код уже написаний і його
 * спокусливо перевикористати: адаптивність підбирає складність під
 * людину, і два учні проходять різні роботи. Для діагностики це добре —
 * вона економить задачі. Для підсумку це руйнує саме те, заради чого
 * він існує: порівнюваність. «Стало краще» не має сенсу, якщо «до» і
 * «після» міряні різними наборами.
 *
 * Розборів під час роботи немає з тієї ж причини, що й у діагностиці:
 * підказана задача більше нічого не міряє. Усе показуємо в кінці.
 *
 * Станів тут ТРИ, а не чотири. `fragile` у діагностиці означав «не взяв
 * середню, але взяв легшу» — це властивість драбини складності, якої у
 * фіксованому наборі немає. Вигадувати четвертий стан із двох задач
 * означало б назвати діагнозом підкинуту монету.
 */
import type { SubgoalState } from './diagnostic'

export interface FinalChoice {
  text: string
  correct: boolean
  mistakeId?: string | null
  rootId?: string | null
}

export interface FinalTask {
  id: string
  subgoal: string
  text: string
  solution: string
  choices: FinalChoice[]
}

export interface FinalWork {
  version: string
  topicId: string
  topic: string
  arc: string[]
  subgoalLabels: Record<string, string>
  roots: Record<string, string>
  tasks: FinalTask[]
}

export interface FinalAnswer {
  taskId: string
  subgoal: string
  choice: number
  correct: boolean
  rootId: string | null
}

export interface FinalRun {
  index: number
  answers: FinalAnswer[]
}

export function createFinalRun(): FinalRun {
  return { index: 0, answers: [] }
}

export function finalTask(work: FinalWork, run: FinalRun): FinalTask | null {
  return work.tasks[run.index] ?? null
}

export function isFinalDone(work: FinalWork, run: FinalRun): boolean {
  return run.index >= work.tasks.length
}

export function finalProgress(work: FinalWork, run: FinalRun): number {
  if (!work.tasks.length) return 100
  return Math.round((run.index / work.tasks.length) * 100)
}

/** Відповідь. Нічого не показуємо — це вимір. */
export function answerFinal(work: FinalWork, run: FinalRun, choiceIndex: number): FinalRun {
  const task = finalTask(work, run)
  if (!task) return run
  const choice = task.choices[choiceIndex]
  if (!choice) return run
  return {
    index: run.index + 1,
    answers: [
      ...run.answers,
      {
        taskId: task.id,
        subgoal: task.subgoal,
        choice: choiceIndex,
        correct: !!choice.correct,
        rootId: choice.correct ? null : (choice.rootId ?? null),
      },
    ],
  }
}

// ─── Підсумок ────────────────────────────────────────────────────────────

export type FinalState = Extract<SubgoalState, 'solid' | 'working' | 'absent' | 'not_measured'>

export interface SubgoalResult {
  subgoal: string
  label: string
  correct: number
  total: number
  state: FinalState
  /** куди зрушило проти діагностики, якщо вона була */
  movedFrom?: SubgoalState
  direction?: 'up' | 'same' | 'down'
}

export interface FinalResult {
  subgoals: SubgoalResult[]
  correct: number
  total: number
  /** корені, що спрацювали ЗАРАЗ — вхід для повторення */
  roots: string[]
  humanSummary: string
  /** чи було з чим порівнювати */
  compared: boolean
}

function stateOf(correct: number, total: number): FinalState {
  if (!total) return 'not_measured'
  if (correct === total) return 'solid'
  if (correct === 0) return 'absent'
  return 'working'
}

/** Порядок для порівняння «було → стало». */
const RANK: Record<string, number> = {
  absent: 0,
  fragile: 1,
  working: 2,
  solid: 3,
}

function direction(before: SubgoalState, after: FinalState): 'up' | 'same' | 'down' {
  const b = RANK[before]
  const a = RANK[after]
  if (b === undefined || a === undefined) return 'same'
  if (a > b) return 'up'
  if (a < b) return 'down'
  return 'same'
}

function summary(rows: SubgoalResult[], compared: boolean): string {
  const weak = rows.filter((r) => r.state === 'absent')
  const partial = rows.filter((r) => r.state === 'working')
  // Хвалимо лише те, що ДОРОСЛО ДО КІНЦЯ. Підціль, яка зросла, але ще
  // хитається, стоїть нижче в «ще трохи хитається» — і якби вона була в
  // обох списках, речення називало б її двічі поспіль. Про сам рух
  // однаково каже стрілка в рядку, тож текст його не дублює.
  const grew = rows.filter((r) => r.direction === 'up' && r.state === 'solid')

  if (!weak.length && !partial.length) {
    return compared && grew.length
      ? 'Тема закрита, і видно, що курс не пройшов дарма — там, де на початку ' +
          'було хитко, тепер упевнено.'
      : 'Тема закрита: усе, що вчили, тримається.'
  }

  const parts: string[] = []
  if (grew.length) {
    parts.push(`Порівняно з початком стало краще: ${grew.map((r) => r.label).join(', ')}.`)
  }
  // Обидва списки — незалежні. Через `else if` речення називало б лише
  // провали, а список «варто повернутись» під ним показував би ще й
  // хиткі: текст мовчав би про те, що видно очима на два сантиметри нижче.
  if (weak.length) {
    parts.push(`Не склалось поки що: ${weak.map((r) => r.label).join(', ')}.`)
  }
  if (partial.length) {
    parts.push(`Ще трохи хитається: ${partial.map((r) => r.label).join(', ')}.`)
  }
  parts.push('Це не оцінка, а те, куди варто повернутись.')
  return parts.join(' ')
}

/**
 * Підсумок роботи. `before` — профіль діагностики, якщо він зберігся;
 * без нього просто немає порівняння, і ми про це чесно кажемо
 * (`compared: false`), а не вдаємо рух від нуля.
 */
export function buildFinalResult(
  work: FinalWork,
  run: FinalRun,
  before?: { subgoals: Array<{ subgoal: string; state: SubgoalState }> } | null,
): FinalResult {
  const rows: SubgoalResult[] = work.arc.map((sub) => {
    const mine = run.answers.filter((a) => a.subgoal === sub)
    const correct = mine.filter((a) => a.correct).length
    const state = stateOf(correct, mine.length)
    const prev = before?.subgoals?.find((s) => s.subgoal === sub)?.state
    return {
      subgoal: sub,
      label: work.subgoalLabels[sub] ?? sub,
      correct,
      total: mine.length,
      state,
      ...(prev ? { movedFrom: prev, direction: direction(prev, state) } : {}),
    }
  })

  const compared = rows.some((r) => r.movedFrom !== undefined)
  const roots = [
    ...new Set(run.answers.map((a) => a.rootId).filter((r): r is string => !!r)),
  ]

  return {
    subgoals: rows,
    correct: run.answers.filter((a) => a.correct).length,
    total: run.answers.length,
    roots,
    humanSummary: summary(rows, compared),
    compared,
  }
}
