/**
 * Числова пряма (Б-184) — дані обʼєкта `number_line`. Контракт наш (ТЗ §2.1):
 * зберігається ЛИШЕ застосований вхід учителя; множина розвʼязків, відповідь і
 * рисунок завжди обчислюються з нього одним рушієм (`evaluate`).
 */

export type NumberLineOp = '<' | '<=' | '>' | '>=' | '!=' | '='

/** Одна нерівність `x ⋚ a`. `value` — число так, як записав учитель (`-3`, `2,5`, `-1/3`). */
export interface NumberLineSimpleCondition {
  op: NumberLineOp
  value: string
  /** Лінійна нерівність, як її записав учитель (`2x + 3 > 7`); `op`/`value` — розвʼязок. */
  source?: string
}

/** Подвійна нерівність `from ⋚ x ⋚ to`. */
export interface NumberLineRangeCondition {
  from: string
  fromIncluded: boolean
  to: string
  toIncluded: boolean
  /** Подвійна лінійна нерівність, як записав учитель (`-1 < 2x + 1 ≤ 5`). */
  source?: string
}

/**
 * Коефіцієнт при змінній дорівнює 0 (`0x > −1`, `2x > 2x − 1`): 0·x = 0 при будь-якому x,
 * тож умова — числова нерівність `reduced` (`0 > -1`). Правильна → усі числа, ні → ∅.
 */
export interface NumberLineConstCondition {
  holds: boolean
  reduced: string
  source: string
}

export type NumberLineCondition = NumberLineSimpleCondition | NumberLineRangeCondition | NumberLineConstCondition

/** Знак методу інтервалів (ТЗ §2.1): лише нерівності. */
export type IntervalsOp = '<' | '<=' | '>' | '>='

export interface IntervalsPoint {
  /** Число в нашому записі (`-3`, `2,5`, `√3`). */
  value: string
  /** Зафарбована (входить у відповідь) чи виколота. */
  included: boolean
}

export interface NumberLineData {
  version: 1
  /** 'set' — нерівності, системи, сукупності (етап 1); 'intervals' — метод інтервалів (етап 2). */
  mode: 'set' | 'intervals' | 'solved'
  variable: string
  /** set: кожна умова — одна нерівність. */
  conditions: NumberLineCondition[]
  /** 'and' — система, 'or' — сукупність. */
  combine: 'and' | 'or'
  /** intervals · вираз: ліва частина як записав учитель — `(x-1)(x+3)/(x-2)`. */
  expression?: string
  /** intervals · вираз: права частина (за замовчуванням 0). Ненульова — лише для многочленів. */
  rhs?: string
  /** intervals: знак нерівності. */
  op?: IntervalsOp
  /** intervals · вручну: точки, які поставив учитель (дошка лише малює). */
  points?: IntervalsPoint[]
  /** intervals · вручну: знаки на проміжках зліва направо, `points.length + 1`. */
  signs?: Array<'+' | '-'>
  /** solved (ТЗ розвʼязувача §3.2): нерівність, як ввів учитель. */
  inequality?: string
  /** solved: відповідь сервера, як прийшла (наш контракт), — рисунок малюється з неї. */
  result?: SolverResult
  /** solved: чим розвʼязано (`sympy-1.13.3`). */
  solver?: string
  showAnswer: boolean
  showHatching: boolean
}

/** Межа з сервера: точний `latex`, позиція — `approx`, `exact: false` → на рисунку «≈». */
export interface SolverBound {
  latex: string
  approx: number
  exact: boolean
  closed: boolean
  /** Запис без LaTeX (`1 + √2`); null, якщо точний запис громіздкий. */
  text: string | null
}

/** Контракт `POST /winterboard/number-line/solve/` (ТЗ §3.1), успішна відповідь. */
export interface SolverResult {
  ok: true
  intervals: Array<{ from: SolverBound | null; to: SolverBound | null }>
  points: SolverBound[]
  domain: string | null
  answer: string
}

export type SolverReason = 'parse' | 'too_long' | 'degree' | 'timeout' | 'unsolvable' | 'busy' | 'not_pilot'

export interface SolverRefusal {
  ok: false
  reason: SolverReason
  detail: string
}

export function isRangeCondition(c: NumberLineCondition): c is NumberLineRangeCondition {
  return 'from' in c
}

export function isConstCondition(c: NumberLineCondition): c is NumberLineConstCondition {
  return 'holds' in c
}

/** Помилка вводу: код для i18n + параметри + позиція в рядку (для підказки біля нього). */
export interface NumberLineError {
  /** Номер рядка (умови), 0-based. */
  line: number
  /** Символ у рядку, з якого починається проблема. */
  index: number
  code:
    | 'empty'
    | 'unexpected_char'
    | 'bad_number'
    | 'division_by_zero'
    | 'roots_not_supported'
    | 'expect_number_after'
    | 'expect_op'
    | 'no_variable'
    | 'variable_twice'
    | 'other_variable'
    | 'mixed_direction'
    | 'eq_in_range'
    | 'trailing'
    | 'too_many_conditions'
    | 'not_linear'
    | 'root_sum'
    | 'root_form'
    | 'sum_with_fraction'
    | 'too_complex'
    | 'bad_power'
    | 'rhs_not_zero'
    | 'cannot_factor'
    | 'not_inequality'
    | 'duplicate_point'
    | 'signs_count'
    | 'no_points'
    | 'ambiguous_denominator'
    | 'too_large'
    | 'too_long'
    | 'too_deep'
    | 'bad_data'
    | 'unbalanced_paren'
  params?: Record<string, string>
}

export const NUMBER_LINE_MAX_CONDITIONS = 6

export function defaultNumberLineData(): NumberLineData {
  return {
    version: 1,
    mode: 'set',
    variable: 'x',
    conditions: [],
    combine: 'and',
    showAnswer: true,
    showHatching: true,
  }
}
