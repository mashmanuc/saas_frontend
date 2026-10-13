/**
 * Один рядок замість трьох режимів (ТЗ «Числова пряма — один рядок», 2026-10-13, §2).
 *
 * Учитель лише пише нерівність (або кілька рядків) і, якщо хоче, вмикає «Знаки інтервалів».
 * Чим рахувати — вирішує ця функція, а не вчитель; `mode` у даних ставить вона ж. Одна функція на
 * обидва шляхи: «Застосувати» в інспекторі й дія Інтегралика. Порядок — зверху вниз, перший, що
 * підходить:
 *
 *   кілька рядків, усі лінійні / подвійні        → рушій «Нерівності»          set
 *   кілька рядків, хоч один нелінійний            → відмова словами під рядком
 *   один рядок + «Знаки», рушій інтервалів бере   → метод інтервалів            intervals
 *   один рядок + «Знаки», рушій інтервалів не бере → лінійний — рушій «Нерівності»,
 *                                                    нелінійний (пілот) — сервер; тиха примітка
 *   один рядок, лінійний / подвійний              → рушій «Нерівності»          set
 *   один рядок, нелінійний, пілот                 → сервер                      solved
 *   один рядок, нелінійний, не пілот              → відмова словами, без запиту на сервер
 *
 * Помилки — у рядках (`line`), відмова сервера — окремо (текст складає той, хто показує).
 * Контракт `NumberLineData` не змінюється; поля інших способів очищаються.
 */
import { evaluate } from './evaluate'
import { parseIntervalsLine } from './intervals'
import { parseLines } from './parse'
import type { NumberLineData, NumberLineError, SolverRefusal, SolverResult } from './types'

export interface ChooseInput {
  /** Рядки, як у полі (порожні пропускаються). */
  lines: string[]
  combine: 'and' | 'or'
  /** «Знаки інтервалів» — лише для одного рядка. */
  signs: boolean
  /** Цьому акаунту можна сервер (той самий гейт, що й «Знаки», — engine/numberLine/pilot.ts). */
  pilot: boolean
}

export type SolveFn = (inequality: string) => Promise<(SolverResult & { solver?: string }) | SolverRefusal>

/** Поля даних, які ставить вибирач; решта (`showAnswer`, …) — як були. */
export type ChosenFields = Pick<NumberLineData, 'mode' | 'variable' | 'conditions' | 'combine'>
  & Partial<Pick<NumberLineData, 'expression' | 'rhs' | 'op' | 'points' | 'signs' | 'inequality' | 'result' | 'solver'>>

export type ChooseOutcome =
  | { ok: true; fields: ChosenFields; note?: 'signs_only_products' }
  | { ok: false; errors: NumberLineError[] }
  | { ok: false; refusal: SolverRefusal; line: number }

/**
 * Помилки рушія «Нерівності», за якими стоїть нелінійна нерівність (не одруківка): такі
 * вміє сервер. Решта (порожньо, незрозумілий символ, знак без числа…) — помилка вчителю.
 */
const NONLINEAR: ReadonlySet<NumberLineError['code']> = new Set([
  'not_linear',
  'root_form',
  'roots_not_supported',
  'root_sum',
  'sum_with_fraction',
])

/** Поля всіх способів, крім рушія «Нерівності», — щоб у даних не лишалось чужого. */
const CLEAR = {
  expression: undefined,
  rhs: undefined,
  op: undefined,
  points: undefined,
  signs: undefined,
  inequality: undefined,
  result: undefined,
  solver: undefined,
} as const

function check(fields: ChosenFields, base: NumberLineData, toLine: (l: number) => number): ChooseOutcome {
  const ev = evaluate({ ...base, ...fields })
  if ('errors' in ev) return { ok: false, errors: ev.errors.map((e) => ({ ...e, line: toLine(e.line) })) }
  return { ok: true, fields }
}

export async function chooseNumberLine(input: ChooseInput, base: NumberLineData, solve: SolveFn): Promise<ChooseOutcome> {
  const rows = input.lines.map((text, line) => ({ text, line })).filter((r) => r.text.trim())
  if (!rows.length) return { ok: false, errors: [{ line: 0, index: 0, code: 'empty' }] }
  const toLine = (i: number) => rows[i]?.line ?? rows[0].line

  const asSet = (texts: string[]): ChooseOutcome | null => {
    const parsed = parseLines(texts)
    if ('errors' in parsed) return null
    const fields: ChosenFields = {
      ...CLEAR,
      mode: 'set',
      conditions: parsed.conditions,
      variable: parsed.variable,
      combine: parsed.conditions.length > 1 ? input.combine : base.combine,
    }
    return check(fields, base, toLine)
  }

  // ── Кілька рядків: лише рушій «Нерівності» ──
  if (rows.length > 1) {
    const parsed = parseLines(rows.map((r) => r.text))
    if ('errors' in parsed) {
      return {
        ok: false,
        errors: parsed.errors.map((e) => (NONLINEAR.has(e.code)
          ? { line: toLine(e.line), index: 0, code: 'system_not_linear' as const }
          : { ...e, line: toLine(e.line) })),
      }
    }
    return asSet(rows.map((r) => r.text))!
  }

  // ── Один рядок ──
  const q = rows[0].text.trim()
  const setParsed = parseLines([q])
  const setError = 'errors' in setParsed ? setParsed.errors[0] : null
  const nonlinear = !!setError && NONLINEAR.has(setError.code)
  const refuse = (): ChooseOutcome => ({ ok: false, errors: [{ ...setError!, line: rows[0].line }] })

  if (input.signs) {
    const iv = parseIntervalsLine(q)
    if (iv.ok) {
      return check({
        ...CLEAR,
        mode: 'intervals',
        conditions: [],
        combine: base.combine,
        expression: iv.expression,
        rhs: iv.rhs,
        op: iv.op,
        variable: iv.variable,
      }, base, toLine)
    }
    // Знаки рахує лише рушій інтервалів (добутки й дроби); інше — без знаків, з тихою приміткою.
    if (!setError) return withNote(asSet([q])!)
    // Одруківка — пояснення рушія інтервалів (учитель писав саме для знаків).
    if (!nonlinear) return { ok: false, errors: [{ ...(iv as { error: Omit<NumberLineError, 'line'> }).error, line: rows[0].line }] }
    if (!input.pilot) return refuse()
    return withNote(await viaServer(q, rows[0].line, base, solve, toLine))
  }

  if (!setError) return asSet([q])!
  if (!nonlinear || !input.pilot) return refuse()
  return viaServer(q, rows[0].line, base, solve, toLine)
}

function withNote(o: ChooseOutcome): ChooseOutcome {
  return o.ok ? { ...o, note: 'signs_only_products' } : o
}

async function viaServer(q: string, line: number, base: NumberLineData, solve: SolveFn, toLine: (l: number) => number):
  Promise<ChooseOutcome> {
  const r = await solve(q)
  if (!r || r.ok !== true) {
    const refusal = r && typeof (r as SolverRefusal).reason === 'string'
      ? r as SolverRefusal
      : { ok: false as const, reason: 'server_error' as const, detail: '' }
    return { ok: false, refusal, line }
  }
  const { solver, ...result } = r as SolverResult & { solver?: string }
  return check({
    ...CLEAR,
    mode: 'solved',
    conditions: [],
    combine: base.combine,
    variable: 'x',
    inequality: q,
    result: result as SolverResult,
    solver: solver ?? '',
  }, base, toLine)
}
