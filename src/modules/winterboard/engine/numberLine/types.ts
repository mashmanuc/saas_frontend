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

export interface NumberLineData {
  version: 1
  /** Етап 1 — лише 'set'. 'intervals' (метод інтервалів) і 'ray' — наступні етапи. */
  mode: 'set'
  variable: string
  conditions: NumberLineCondition[]
  /** 'and' — система, 'or' — сукупність. */
  combine: 'and' | 'or'
  showAnswer: boolean
  showHatching: boolean
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
