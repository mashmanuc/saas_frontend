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
}

/** Подвійна нерівність `from ⋚ x ⋚ to`. */
export interface NumberLineRangeCondition {
  from: string
  fromIncluded: boolean
  to: string
  toIncluded: boolean
}

export type NumberLineCondition = NumberLineSimpleCondition | NumberLineRangeCondition

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
