/**
 * Діагностика — вимірювання, а не навчання.
 *
 * Це ОКРЕМИЙ рушій, не режим `lessonMachine`, і це навмисно. Заняття —
 * авторський граф: усі переходи описані наперед. Діагностика графа не
 * має: наступну задачу обирають у рантаймі за тим, як учень відповів.
 * Спроба звести одне до одного зробила б обидва гіршими.
 *
 * Контракт — `DIAGNOSTIC_PROFILE_SSOT`. Головне з нього, чого легко не
 * помітити: **32 задачі — це ПУЛ, а не прогін**. Стеля прогону ~12 задач
 * (§3), бо довга діагностика з'їдає мотивацію ще до початку навчання.
 *
 * ЩО ТУТ СВІДОМО ЗАБОРОНЕНО:
 *   • показувати розбір під час прогону — інакше міряємо вже підказане;
 *   • вести в лікування — на це є заняття;
 *   • вимагати повного виміру. Підціль без вердикту чесно позначається
 *     `not_measured`, а не вгадується (§4 п.2). Діагностика дає
 *     СТАРТОВИЙ профіль; уточнюють його мікродії занять.
 *
 * Профіль каже СТАН, не бал: «6 з 10» генератору курсу нічого не
 * говорить, а `fragile` — говорить.
 */

export type SubgoalState = 'solid' | 'working' | 'fragile' | 'absent' | 'not_measured'
export type ErrorKind = 'conceptual' | 'computational' | 'slip'
export type Level = 'easy' | 'mid' | 'hard'

export interface PoolChoice {
  text: string
  correct: boolean
  mistakeId?: string | null
  rootId?: string | null
  errorKind?: ErrorKind | null
}

export interface PoolTask {
  id: string
  subgoal: string
  level: Level
  diffScore: number
  text: string
  solution: string
  choices: PoolChoice[]
  source: string
}

export interface DiagnosticPool {
  poolVersion: string
  topicId: string
  topic: string
  /** порядок арки — у ньому й питаємо (§4 п.1) */
  arc: string[]
  subgoalLabels: Record<string, string>
  roots: Record<string, string>
  tasks: PoolTask[]
}

/**
 * Стеля прогону. §3: «10–15 хв, м'яка стеля ~12 задач».
 *
 * Чотири підцілі × 2 докази = 8, лишається 4 на перевірки стабільності.
 * Стеля м'яка саме тому: не «рівно 12», а «не більше».
 */
export const MAX_TASKS = 12

/** Скільки доказів достатньо на підціль (§4 п.1.2: «два докази — досить»). */
export const EVIDENCE_PER_SUBGOAL = 2

export interface Evidence {
  taskId: string
  diffScore: number
  level: Level
  result: 'correct' | 'wrong'
  rootId: string | null
  errorKind: ErrorKind | null
}

export interface DiagnosticRun {
  askedIds: string[]
  evidence: Record<string, Evidence[]>
  /** поточна задача; `null` — прогін скінчився */
  currentId: string | null
}

// ─── Добір задач ─────────────────────────────────────────────────────────

function tasksOf(pool: DiagnosticPool, subgoal: string): PoolTask[] {
  return pool.tasks.filter((t) => t.subgoal === subgoal)
}

function unused(pool: DiagnosticPool, run: DiagnosticRun, subgoal: string): PoolTask[] {
  return tasksOf(pool, subgoal).filter((t) => !run.askedIds.includes(t.id))
}

/**
 * Середньо-легка: найближча знизу до медіани підцілі (§3).
 *
 * Не найлегша: перше враження від курсу не має бути ні провалом, ні
 * прогулянкою. Униз опуститись устигнемо, і саме це робить крок 1.2.
 */
function mediumEasy(candidates: PoolTask[]): PoolTask | null {
  if (!candidates.length) return null
  const sorted = [...candidates].sort((a, b) => a.diffScore - b.diffScore)
  const median = sorted[Math.floor(sorted.length / 2)].diffScore
  const below = sorted.filter((t) => t.diffScore <= median)
  return below[below.length - 1] ?? sorted[0]
}

function nearest(candidates: PoolTask[], to: number, harder: boolean): PoolTask | null {
  const side = candidates.filter((t) => (harder ? t.diffScore > to : t.diffScore < to))
  const pick = harder
    ? side.sort((a, b) => a.diffScore - b.diffScore)[0]
    : side.sort((a, b) => b.diffScore - a.diffScore)[0]
  if (pick) return pick
  // потрібного боку немає — беремо найближче з того, що лишилось, і
  // це стане причиною перевірити стабільність (див. verdictFor)
  return [...candidates].sort(
    (a, b) => Math.abs(a.diffScore - to) - Math.abs(b.diffScore - to),
  )[0] ?? null
}

/** Підцілі, яким ще бракує доказів, у порядку арки. */
function pending(pool: DiagnosticPool, run: DiagnosticRun): string[] {
  return pool.arc.filter((s) => {
    const ev = run.evidence[s] ?? []
    if (ev.length >= EVIDENCE_PER_SUBGOAL && !needsStability(ev)) return false
    return unused(pool, run, s).length > 0
  })
}

/**
 * Чи потрібен третій доказ (§4 п.1.3 «два суперечливі результати»).
 *
 * Суперечність — не «різні результати», а РЕЗУЛЬТАТИ ПРОТИ СКЛАДНОСТІ:
 * правильно на важчій і хибно на легшій. Такий учень або вгадав, або
 * помилився через неуважність, і вердикт із двох доказів був би
 * вигаданим.
 */
export function needsStability(ev: Evidence[]): boolean {
  if (ev.length !== 2) return false
  const [a, b] = [...ev].sort((x, y) => x.diffScore - y.diffScore)
  return a.result === 'wrong' && b.result === 'correct' && a.diffScore !== b.diffScore
    ? false // це штатний спуск: спершу помилився, потім легша — правильно
    : a.result === 'correct' && b.result === 'wrong' && a.diffScore === b.diffScore
}

export function createDiagnosticRun(pool: DiagnosticPool): DiagnosticRun {
  const run: DiagnosticRun = { askedIds: [], evidence: {}, currentId: null }
  const first = nextTask(pool, run)
  return first ? { ...run, askedIds: [first.id], currentId: first.id } : run
}

/**
 * Наступна задача або `null`, якщо прогін вичерпано.
 *
 * НЕ додає її в `askedIds` — це робить `answerDiagnostic`, щоб функція
 * лишалась чистою і її можна було спитати «а що було б далі».
 */
export function nextTask(pool: DiagnosticPool, run: DiagnosticRun): PoolTask | null {
  if (run.askedIds.length >= MAX_TASKS) return null
  const queue = pending(pool, run)
  if (!queue.length) return null

  const subgoal = queue[0]
  const ev = run.evidence[subgoal] ?? []
  const free = unused(pool, run, subgoal)
  if (!free.length) return null

  if (!ev.length) return mediumEasy(free)
  const last = ev[ev.length - 1]
  // впорався → складніше; ні → простіше (§4 п.1.2)
  return nearest(free, last.diffScore, last.result === 'correct')
}

export function currentTask(pool: DiagnosticPool, run: DiagnosticRun): PoolTask | null {
  return run.currentId ? (pool.tasks.find((t) => t.id === run.currentId) ?? null) : null
}

/** Відповідь учня. Розбору НЕ показуємо — це вимір, не навчання. */
export function answerDiagnostic(
  pool: DiagnosticPool,
  run: DiagnosticRun,
  choiceIndex: number,
): DiagnosticRun {
  const task = currentTask(pool, run)
  if (!task) return run
  const choice = task.choices[choiceIndex]
  if (!choice) return run

  const record: Evidence = {
    taskId: task.id,
    diffScore: task.diffScore,
    level: task.level,
    result: choice.correct ? 'correct' : 'wrong',
    rootId: choice.correct ? null : (choice.rootId ?? null),
    errorKind: choice.correct ? null : (choice.errorKind ?? null),
  }
  const evidence = {
    ...run.evidence,
    [task.subgoal]: [...(run.evidence[task.subgoal] ?? []), record],
  }

  const after: DiagnosticRun = { ...run, evidence, currentId: null }
  const next = nextTask(pool, after)
  return next
    ? { ...after, askedIds: [...after.askedIds, next.id], currentId: next.id }
    : after
}

export function isDiagnosticDone(run: DiagnosticRun): boolean {
  return run.currentId === null
}

export function diagnosticProgress(pool: DiagnosticPool, run: DiagnosticRun): number {
  const measured = pool.arc.filter((s) => (run.evidence[s] ?? []).length > 0).length
  return Math.round((measured / pool.arc.length) * 100)
}

// ─── Профіль ─────────────────────────────────────────────────────────────

export interface SubgoalProfile {
  subgoal: string
  label: string
  state: SubgoalState
  evidence: Evidence[]
}

export interface DiagnosticProfile {
  profileVersion: '1.0'
  topicId: string
  subgoals: SubgoalProfile[]
  meta: { asked: number; ceilingHit: boolean }
  recommendation: {
    allocationHint: Record<string, number>
    scopeWarning: string | null
    humanSummary: string
  }
}

/**
 * Стан підцілі з доказів. Жодного «система вважає» без задач (§2 п.1).
 *
 * Драбина проста і читається з §4 п.1.2: два правильні — впевнено; впорався
 * із середньою, але не з важчою — робоче; не впорався із середньою, але
 * впорався з легшою — хитко; двічі ні — немає.
 */
export function stateFor(ev: Evidence[]): SubgoalState {
  if (!ev.length) return 'not_measured'
  if (ev.length === 1) {
    // одного доказу для вердикту замало: §4 просить два. Але мовчати теж
    // не можна, тому даємо найобережніше з можливого.
    return ev[0].result === 'correct' ? 'working' : 'fragile'
  }
  const right = ev.filter((e) => e.result === 'correct').length
  if (right === ev.length) return 'solid'
  if (right === 0) return 'absent'

  // ⚠️ Розрізняє ПОРЯДОК ПИТАННЯ, не складність. Обидва змішані випадки
  // дають однакові докази «легшу правильно, важчу хибно», і за
  // складністю вони нерозрізненні. Різниця в тому, з чого почали:
  //   впорався із середньою, не взяв важчу  → тримає базу     → working
  //   провалив середню, піднявся з легшої   → база хитається  → fragile
  // Перша спроба сортувала за `diffScore` і через це стирала саме ту
  // інформацію, заради якої драбина й будувалась. Зловлено тестом.
  return ev[0].result === 'correct' ? 'working' : 'fragile'
}

/** Скільки занять радимо на підціль. Підказка генератору, не наказ (§2 п.3). */
const WEIGHT: Record<SubgoalState, number> = {
  absent: 3,
  fragile: 2,
  working: 1,
  not_measured: 1, // §4 п.2: без вердикту генератор ставить working
  solid: 0,
}

function humanSummary(profiles: SubgoalProfile[]): string {
  const weak = profiles.filter((p) => p.state === 'absent' || p.state === 'fragile')
  const solid = profiles.filter((p) => p.state === 'solid')

  if (!weak.length && solid.length === profiles.length) {
    return 'Тему ти вже тримаєш упевнено. Тут курс тобі мало що додасть — ' +
      'краще взяти складнішу тему або поглиблений варіант цієї.'
  }
  if (!weak.length) {
    return 'База є, провалів немає. Пройдемось по темі рівно, без затримок.'
  }
  const names = weak.map((p) => p.label)
  const head = solid.length
    ? `Основа є — ${solid.map((p) => p.label).join(', ')} тримається.`
    : 'Почнемо від основ.'
  // ⚠️ Не склеювати закінчення умовним оператором: перша спроба робила
  // `над тим, що${n>1?'о':''}` і давала учневі «над тим, щоо».
  // Формулювання має бути цілим реченням для обох випадків.
  return `${head} Найбільше попрацюємо ось над чим: ${names.join(', ')}.`
}

export function buildProfile(
  pool: DiagnosticPool,
  run: DiagnosticRun,
  budget?: number,
): DiagnosticProfile {
  const subgoals: SubgoalProfile[] = pool.arc.map((s) => {
    const ev = run.evidence[s] ?? []
    return {
      subgoal: s,
      label: pool.subgoalLabels[s] ?? s,
      state: stateFor(ev),
      evidence: ev,
    }
  })

  const allocationHint: Record<string, number> = {}
  for (const p of subgoals) allocationHint[p.subgoal] = WEIGHT[p.state]
  const needed = Object.values(allocationHint).reduce((a, b) => a + b, 0)

  return {
    profileVersion: '1.0',
    topicId: pool.topicId,
    subgoals,
    meta: { asked: run.askedIds.length, ceilingHit: run.askedIds.length >= MAX_TASKS },
    recommendation: {
      allocationHint,
      scopeWarning:
        budget !== undefined && needed > budget
          ? `за профілем потрібно щонайменше ${needed} занять, а в курсі ${budget}`
          : null,
      humanSummary: humanSummary(subgoals),
    },
  }
}

/** Корені, що спрацювали під час діагностики — вхід у стан учня. */
export function rootsFromRun(run: DiagnosticRun): string[] {
  const all = Object.values(run.evidence).flat().map((e) => e.rootId)
  return [...new Set(all.filter((r): r is string => !!r))]
}
