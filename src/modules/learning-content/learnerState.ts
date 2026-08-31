/**
 * Стан УЧНЯ — те, що переживає окреме заняття.
 *
 * Це третій рівень, і його відсутність була останньою незакритою межею
 * з ТЗ інтеграції: «Course Definition, Learning Path і учнівський стан
 * не змішуються в одній моделі».
 *
 *   1. `LessonPlan`  — що АВТОР описав. Кроки, гілки, корені.
 *                      Учня в ньому немає й бути не може.
 *   2. `Run`         — як ОДИН учень пройшов ОДНЕ заняття. Живе рівно
 *                      стільки, скільки триває заняття.
 *   3. `LearnerState`— що заняття лишили ПРО УЧНЯ. Переживає їх усі.
 *
 * Межу перетинає рівно один ключ — `rootId`. Не `stepId` (це спосіб
 * показу, його перейменують) і не `mistakeId` (це симптом, він
 * прив'язаний до родини задач). Тому стан учня не залежить ні від
 * верстки заняття, ні від того, з якого банку взято задачу.
 *
 * ЧОГО ЦЕЙ МОДУЛЬ СВІДОМО НЕ РОБИТЬ.
 *
 * Не глушить лікування, вже бачені в минулих заняттях. Спокуса була:
 * `treated` усередині проходження саме для цього й існує. Але правило
 * «показали раз — більше ніколи» всередині заняття і між заняттями —
 * різні правила. Учень, який спіткнувся на тому самому корені через
 * тиждень, потребує допомоги, а не мовчання; а повторення кореня — це
 * найцінніший сигнал, який у нас взагалі є. Тому стан НАКОПИЧУЄ
 * свідчення, а не забороняє показ.
 *
 * Зберігання тут теж немає — модуль чистий. Де це лежить (localStorage,
 * бекенд, нічого) вирішує виклик; міняти сховище можна, не чіпаючи
 * контракту.
 */
import type { RunReport } from './lessonMachine'

/** Що ми знаємо про один корінь у цього учня. */
export interface RootRecord {
  /** скільки разів корінь спрацював (у скількох заняттях сумарно) */
  hits: number
  /** у скількох РІЗНИХ заняттях — повторення важливіше за частоту */
  lessons: string[]
  /** скільки разів учневі показували лікування цього кореня */
  treated: number
  /** чи корінь спрацював у НАЙОСТАННІШОМУ занятті, де міг */
  recentlyHit: boolean
}

export interface LearnerState {
  version: 1
  /** id занять, доведених до кінця */
  completed: string[]
  roots: Record<string, RootRecord>
}

export function emptyLearnerState(): LearnerState {
  return { version: 1, completed: [], roots: {} }
}

/**
 * Влити підсумок заняття у стан учня.
 *
 * Чисто: вхідний стан не змінюється. Повторний виклик із тим самим
 * заняттям НЕ подвоює лічильники — учень міг перезавантажити сторінку,
 * і це не привід вважати, що він помилився двічі.
 */
export function applyReport(
  state: LearnerState,
  lessonId: string,
  report: RunReport,
): LearnerState {
  const already = state.completed.includes(lessonId)
  const roots: Record<string, RootRecord> = {}

  for (const [id, rec] of Object.entries(state.roots)) {
    roots[id] = { ...rec, lessons: [...rec.lessons], recentlyHit: false }
  }

  for (const id of report.roots) {
    const prev = roots[id] ?? { hits: 0, lessons: [], treated: 0, recentlyHit: false }
    const seenHere = prev.lessons.includes(lessonId)
    roots[id] = {
      hits: seenHere ? prev.hits : prev.hits + 1,
      lessons: seenHere ? prev.lessons : [...prev.lessons, lessonId],
      treated: prev.treated,
      recentlyHit: true,
    }
  }

  // `report.treated` — id кроків показу; нас цікавить лише ФАКТ показу,
  // тому рахуємо його для коренів, що спрацювали в цьому занятті
  for (const id of report.roots) {
    if (!already) roots[id].treated += 1
  }

  return {
    version: 1,
    completed: already ? state.completed : [...state.completed, lessonId],
    roots,
  }
}

/**
 * Корені, що потребують уваги: спрацювали більш ніж в одному занятті.
 *
 * Один випадок — це могла бути неуважність. Два різні заняття — це вже
 * про розуміння, і саме таке варто нести далі.
 */
export function persistentRoots(state: LearnerState): string[] {
  return Object.entries(state.roots)
    .filter(([, r]) => r.lessons.length > 1)
    .sort(([, a], [, b]) => b.lessons.length - a.lessons.length || b.hits - a.hits)
    .map(([id]) => id)
}

/** Корені останнього заняття — те, з чим учень щойно мав труднощі. */
export function freshRoots(state: LearnerState): string[] {
  return Object.entries(state.roots)
    .filter(([, r]) => r.recentlyHit)
    .map(([id]) => id)
}

export interface NextStepAdvice {
  kind: 'repeat' | 'continue' | 'done'
  /** корені, через які радимо повторити; порожньо для 'continue' */
  roots: string[]
  reason: string
}

/**
 * Що робити далі. РАДА, не рішення: жодного блокування наступного
 * заняття — те саме правило, що й для графа передумов.
 *
 * `order` — послідовність занять курсу; те, що курс планує, а не те, що
 * учень зробив. Учнівський стан сюди не втручається, він лише впливає
 * на пораду.
 */
export function adviseNext(
  state: LearnerState,
  order: string[],
  justFinished: string,
): NextStepAdvice {
  const persistent = persistentRoots(state)
  if (persistent.length) {
    return {
      kind: 'repeat',
      roots: persistent,
      reason: 'ці непорозуміння трапились не в одному занятті — варто закріпити',
    }
  }

  const i = order.indexOf(justFinished)
  const next = i >= 0 ? order[i + 1] : undefined
  if (!next) {
    return { kind: 'done', roots: [], reason: 'заняття курсу пройдено' }
  }
  return { kind: 'continue', roots: [], reason: 'можна рухатись далі' }
}
