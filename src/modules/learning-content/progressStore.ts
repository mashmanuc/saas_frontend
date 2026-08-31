/**
 * Незавершене проходження — щоб повернутись туди, де зупинився.
 *
 * Третій вид пам'яті поруч із двома наявними, і межі між ними чіткі:
 *
 *   `LessonPlan`   — що автор описав. Не змінюється ніколи.
 *   `Run`          — ЯК ідеш зараз: крок, відповіді, показані лікування.
 *                    Живе, поки триває заняття. **Це тут.**
 *   `LearnerState` — що заняття лишили ПРО ТЕБЕ: корені, повторення.
 *                    Переживає всі заняття.
 *
 * Чому окремо від `learnerState`, а не поруч: незавершене проходження —
 * дані ОДНОГО заняття і мають зникати разом із ним. Стан учня, навпаки,
 * має пережити все. Складене в один ключ, воно рано чи пізно почало б
 * чиститись разом, і разом із чернеткою полетів би діагноз.
 *
 * Сховище — localStorage, і це названа тимчасова межа: без бекенду
 * прогрес не переживе іншого пристрою, і вдавати протилежне не варто.
 * Модуль лишається чистим щодо форми даних: `Run` і `DiagnosticRun`
 * зберігаються як є, без власної схеми, тож зміна рушія не вимагає
 * міграції сховища.
 */
import type { LessonPlan, Run } from './lessonMachine'
import { currentStep, isFinished, position } from './lessonMachine'

const PREFIX = 'm4sh:lesson-run:'
const DIAGNOSTIC_KEY = 'm4sh:diagnostic-run'

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    // приватне вікно або биті дані — починаємо спочатку, але НЕ падаємо
    return null
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // не зберіглось — заняття має грати далі
  }
}

// ─── Проходження заняття ─────────────────────────────────────────────────

export function saveRun(lessonId: string, run: Run): void {
  write(PREFIX + lessonId, run)
}

/**
 * Збережене проходження, якщо воно ПРИДАТНЕ до цього плану.
 *
 * Перевірка не зайва: план перезбирається щоразу, коли міняється банк
 * задач, і крок зі старого проходження може вже не існувати. Мовчки
 * відновити такий стан — це порожній екран у людини, яка ні в чому не
 * винна. Краще почати спочатку й сказати про це.
 */
export function loadRun(plan: LessonPlan, lessonId: string): Run | null {
  const run = read<Run>(PREFIX + lessonId)
  if (!run?.stepId || !Array.isArray(run.path)) return null
  const known = new Set(plan.steps.map((s) => s.id))
  if (!known.has(run.stepId)) return null
  if (run.path.some((id) => !known.has(id))) return null
  return run
}

export function clearRun(lessonId: string): void {
  try {
    localStorage.removeItem(PREFIX + lessonId)
  } catch {
    /* нічого */
  }
}

// ─── Проходження діагностики ─────────────────────────────────────────────

export function saveDiagnosticRun(run: unknown): void {
  write(DIAGNOSTIC_KEY, run)
}

export function loadDiagnosticRun<T>(): T | null {
  return read<T>(DIAGNOSTIC_KEY)
}

export function clearDiagnosticRun(): void {
  try {
    localStorage.removeItem(DIAGNOSTIC_KEY)
  } catch {
    /* нічого */
  }
}

// ─── Профіль діагностики: щоб фінал мав із чим порівняти ─────────────────

const PROFILE_KEY = 'm4sh:diagnostic-profile:'

/**
 * Зберігається саме ПРОФІЛЬ, а не лише корені.
 *
 * Стан учня несе корені — вони перетинають межу між заняттями. Але
 * питання «чи стало краще» вимагає станів ПО ПІДЦІЛЯХ до і після, а їх
 * у коренях немає. Це вимір, а не властивість учня, тому лежить тут,
 * поруч із проходженнями, а не в стані учня.
 */
export function saveDiagnosticProfile(topicId: string, profile: unknown): void {
  write(PROFILE_KEY + topicId, profile)
}

export function loadDiagnosticProfile<T>(topicId: string): T | null {
  return read<T>(PROFILE_KEY + topicId)
}

// ─── Підсумкова робота ───────────────────────────────────────────────────

const FINAL_KEY = 'm4sh:final-run:'

export function saveFinalRun(topicId: string, run: unknown): void {
  write(FINAL_KEY + topicId, run)
}

export function loadFinalRun<T>(topicId: string): T | null {
  return read<T>(FINAL_KEY + topicId)
}

export function clearFinalRun(topicId: string): void {
  try {
    localStorage.removeItem(FINAL_KEY + topicId)
  } catch {
    /* нічого */
  }
}

// ─── Що показати на вітрині курсу ────────────────────────────────────────

export type LessonProgressState = 'new' | 'in-progress' | 'done'

export interface LessonProgress {
  state: LessonProgressState
  /** крок основної лінії, 1-based; 0 якщо не починали */
  step: number
  total: number
}

/**
 * Стан заняття для списку курсу.
 *
 * `done` береться з `learnerState.completed`, а не з наявності
 * збереженого проходження: заняття вважається пройденим тоді, коли його
 * підсумок влився у стан учня. Інакше «дійшов до кінця, але вкладку
 * закрив» рахувалось би як пройдене, і курс брехав би про прогрес.
 */
export function lessonProgress(
  plan: LessonPlan,
  lessonId: string,
  completed: string[],
): LessonProgress {
  const main = plan.steps.filter((s) => s.type !== 'remediate')
  const total = main.length
  if (completed.includes(lessonId)) return { state: 'done', step: total, total }

  const run = loadRun(plan, lessonId)
  if (!run) return { state: 'new', step: 0, total }
  if (isFinished(plan, run)) return { state: 'done', step: total, total }
  if (!currentStep(plan, run)) return { state: 'new', step: 0, total }

  const { index } = position(plan, run)
  // на першому кроці без жодної відповіді вважати «розпочато» — брехня:
  // людина просто відкрила сторінку
  if (index <= 1 && !Object.keys(run.answers ?? {}).length) {
    return { state: 'new', step: 0, total }
  }
  return { state: 'in-progress', step: index, total }
}
