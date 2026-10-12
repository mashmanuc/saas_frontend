/**
 * Строга граматика нерівностей і чисел для числової прямої (ТЗ §2.2 `parse`).
 *
 * Рядок — одна умова:  `x > 3`, `3 < x`, `x ≤ -2`, `-3 < x ≤ 5`, `x ≠ 1`, `x = 3`,
 * або лінійна нерівність (`2x + 3 > 7`, `-1 < 2x + 1 ≤ 5`) — її розвʼязує `linear.ts`.
 * Числа: цілі, десяткові з комою чи крапкою (`2,5`), дроби (`-1/3`).
 * Помилка — кодом і з місцем, без жодного «приблизно» (інваріант 3).
 */
import { rational, type Rational } from './rational'
import type {
  NumberLineCondition,
  NumberLineError,
  NumberLineOp,
} from './types'
import { isConstCondition, isRangeCondition } from './types'
import { parseLinear } from './linear'

type ErrorWithoutLine = Omit<NumberLineError, 'line'>

export type ParsedNumber = { ok: true; value: Rational; label: string } | { ok: false; error: ErrorWithoutLine }

const MINUS = /[−–—]/g

/** Число з тексту вчителя → точне значення. `label` — як записано (з нормалізованим мінусом). */
export function parseNumber(raw: string, index = 0): ParsedNumber {
  const text = raw.replace(MINUS, '-').replace(/\s+/g, '')
  if (/√|sqrt/i.test(text)) {
    return { ok: false, error: { index, code: 'roots_not_supported' } }
  }
  const m = /^([+-]?)(?:(\d+)(?:[.,](\d+))?|(\d+)\/(\d+))$/.exec(text)
  if (!m) {
    return { ok: false, error: { index, code: 'bad_number', params: { text: raw.trim() } } }
  }
  const sign = m[1] === '-' ? -1n : 1n
  let value: Rational
  if (m[4] !== undefined) {
    const den = BigInt(m[5])
    if (den === 0n) return { ok: false, error: { index, code: 'division_by_zero', params: { text: raw.trim() } } }
    value = rational(sign * BigInt(m[4]), den)
  } else {
    const intPart = m[2]
    const frac = m[3] ?? ''
    value = rational(sign * BigInt(intPart + frac), 10n ** BigInt(frac.length))
  }
  return { ok: true, value, label: text.replace(/^\+/, '') }
}

type Token =
  | { kind: 'num'; text: string; start: number }
  | { kind: 'var'; name: string; start: number }
  | { kind: 'op'; op: NumberLineOp; start: number }

const OP_PATTERNS: Array<[string, NumberLineOp]> = [
  ['<=', '<='], ['=<', '<='], ['≤', '<='], ['⩽', '<='],
  ['>=', '>='], ['=>', '>='], ['≥', '>='], ['⩾', '>='],
  ['!=', '!='], ['<>', '!='], ['≠', '!='],
  ['<', '<'], ['>', '>'], ['=', '='],
]

function tokenize(line: string): { tokens: Token[] } | { error: ErrorWithoutLine } {
  const tokens: Token[] = []
  let i = 0
  while (i < line.length) {
    const ch = line[i]
    if (/\s/.test(ch)) { i++; continue }
    const op = OP_PATTERNS.find(([p]) => line.startsWith(p, i))
    if (op) {
      tokens.push({ kind: 'op', op: op[1], start: i })
      i += op[0].length
      continue
    }
    if (/^sqrt/i.test(line.slice(i))) {
      return { error: { index: i, code: 'roots_not_supported' } }
    }
    if (/[a-zA-Z]/.test(ch)) {
      tokens.push({ kind: 'var', name: ch, start: i })
      i++
      if (i < line.length && /[a-zA-Z0-9]/.test(line[i])) {
        return { error: { index: i - 1, code: 'unexpected_char', params: { char: line.slice(i - 1, i + 1) } } }
      }
      continue
    }
    if (/[0-9+\-−–—.,/√]/.test(ch)) {
      const rest = line.slice(i)
      // Корені — окремий етап (1б): рядок із √ відхиляється словами.
      if (/^[+\-−–—]?\s*[0-9.,/]*\s*√/.test(rest)) {
        return { error: { index: i, code: 'roots_not_supported' } }
      }
      // Число: знак, цифри, кома/крапка, дріб. Перевірка форми — у parseNumber.
      const text = (/^[+\-−–—]?\s*[0-9.,/]*/.exec(rest) as RegExpExecArray)[0]
      tokens.push({ kind: 'num', text, start: i })
      i += text.length
      continue
    }
    return { error: { index: i, code: 'unexpected_char', params: { char: ch } } }
  }
  return { tokens }
}

const FLIP: Record<NumberLineOp, NumberLineOp> = {
  '<': '>', '<=': '>=', '>': '<', '>=': '<=', '!=': '!=', '=': '=',
}

const OP_DISPLAY: Record<NumberLineOp, string> = {
  '<': '<', '<=': '≤', '>': '>', '>=': '≥', '!=': '≠', '=': '=',
}

export function displayOp(op: NumberLineOp): string {
  return OP_DISPLAY[op]
}

export type ParsedLine =
  | { ok: true; condition: NumberLineCondition; variable: string }
  | { ok: false; error: ErrorWithoutLine }

function checkNumber(tok: Token): ParsedNumber {
  if (tok.kind !== 'num') return { ok: false, error: { index: tok.start, code: 'bad_number', params: { text: '' } } }
  return parseNumber(tok.text, tok.start)
}

/** Помилки лінійного розбору, які точніші за помилку простого запису. */
const LINEAR_FIRST: ReadonlySet<NumberLineError['code']> = new Set([
  'not_linear', 'unbalanced_paren', 'division_by_zero', 'roots_not_supported',
])

/** Один рядок учителя → умова контракту. Простий запис — як є; інакше — лінійна нерівність. */
export function parseLine(line: string): ParsedLine {
  if (!line.trim()) return { ok: false, error: { index: 0, code: 'empty' } }
  const simple = parseSimple(line)
  if (simple.ok) return simple
  const linear = parseLinear(line)
  if (linear.ok) return linear
  return 'error' in linear && LINEAR_FIRST.has(linear.error.code) ? linear : simple
}

function parseSimple(line: string): ParsedLine {
  const t = tokenize(line)
  if ('error' in t) return { ok: false, error: t.error }
  const toks = t.tokens

  const vars = toks.filter((x) => x.kind === 'var')
  if (vars.length === 0) return { ok: false, error: { index: 0, code: 'no_variable' } }
  if (vars.length > 1) return { ok: false, error: { index: vars[1].start, code: 'variable_twice' } }
  const variable = (vars[0] as Extract<Token, { kind: 'var' }>).name

  // Перевірка послідовності «число / змінна / знак».
  for (let k = 0; k < toks.length; k++) {
    const want = k % 2 === 0 ? 'operand' : 'op'
    const tok = toks[k]
    const isOp = tok.kind === 'op'
    if (want === 'op' && !isOp) return { ok: false, error: { index: tok.start, code: 'expect_op' } }
    if (want === 'operand' && isOp) {
      const prev = toks[k - 1]
      return prev && prev.kind === 'op'
        ? { ok: false, error: { index: tok.start, code: 'expect_number_after', params: { op: OP_DISPLAY[prev.op] } } }
        : { ok: false, error: { index: tok.start, code: 'bad_number', params: { text: OP_DISPLAY[tok.op] } } }
    }
  }
  const last = toks[toks.length - 1]
  if (last.kind === 'op') {
    return { ok: false, error: { index: last.start + 1, code: 'expect_number_after', params: { op: OP_DISPLAY[last.op] } } }
  }
  for (const tok of toks) {
    if (tok.kind === 'num') {
      const n = checkNumber(tok)
      if ('error' in n) return { ok: false, error: n.error }
    }
  }

  if (toks.length === 3) {
    const [a, op, b] = toks as [Token, Extract<Token, { kind: 'op' }>, Token]
    if (a.kind === 'var' && b.kind === 'num') {
      return { ok: true, variable, condition: { op: op.op, value: (checkNumber(b) as { label: string }).label } }
    }
    if (a.kind === 'num' && b.kind === 'var') {
      return { ok: true, variable, condition: { op: FLIP[op.op], value: (checkNumber(a) as { label: string }).label } }
    }
    return { ok: false, error: { index: b.start, code: 'no_variable' } }
  }

  if (toks.length === 5) {
    const [a, op1, v, op2, b] = toks as [Token, Extract<Token, { kind: 'op' }>, Token, Extract<Token, { kind: 'op' }>, Token]
    if (a.kind !== 'num' || v.kind !== 'var' || b.kind !== 'num') {
      return { ok: false, error: { index: v.start, code: 'variable_twice' } }
    }
    const ops = [op1.op, op2.op]
    if (ops.some((o) => o === '=' || o === '!=')) {
      return { ok: false, error: { index: (op1.op === '=' || op1.op === '!=' ? op1 : op2).start, code: 'eq_in_range' } }
    }
    const left = (checkNumber(a) as { label: string }).label
    const right = (checkNumber(b) as { label: string }).label
    const lessSide = ops.every((o) => o === '<' || o === '<=')
    const greaterSide = ops.every((o) => o === '>' || o === '>=')
    if (lessSide) {
      return { ok: true, variable, condition: { from: left, fromIncluded: op1.op === '<=', to: right, toIncluded: op2.op === '<=' } }
    }
    if (greaterSide) {
      return { ok: true, variable, condition: { from: right, fromIncluded: op2.op === '>=', to: left, toIncluded: op1.op === '>=' } }
    }
    return { ok: false, error: { index: op2.start, code: 'mixed_direction' } }
  }

  return { ok: false, error: { index: toks[Math.min(toks.length - 1, 5)].start, code: 'trailing' } }
}

/** Рядки вчителя → умови. Помилки — по кожному рядку окремо. */
export function parseLines(lines: string[]):
  | { ok: true; conditions: NumberLineCondition[]; variable: string }
  | { ok: false; errors: NumberLineError[] } {
  const errors: NumberLineError[] = []
  const conditions: NumberLineCondition[] = []
  let variable: string | null = null
  lines.forEach((line, i) => {
    const r = parseLine(line)
    if ('error' in r) {
      errors.push({ ...r.error, line: i })
      return
    }
    if (variable === null) variable = r.variable
    else if (r.variable !== variable) {
      errors.push({ line: i, index: Math.max(0, line.indexOf(r.variable)), code: 'other_variable', params: { first: variable, here: r.variable } })
      return
    }
    conditions.push(r.condition)
  })
  if (errors.length) return { ok: false, errors }
  return { ok: true, conditions, variable: variable ?? 'x' }
}

/** Умова контракту → текст рядка для поля вводу (зворотне до `parseLine`). */
export function conditionToText(c: NumberLineCondition, variable: string): string {
  if (isConstCondition(c)) return c.source
  if (c.source) return c.source
  if (isRangeCondition(c)) {
    return `${c.from} ${c.fromIncluded ? '≤' : '<'} ${variable} ${c.toIncluded ? '≤' : '<'} ${c.to}`
  }
  return `${variable} ${OP_DISPLAY[c.op]} ${c.value}`
}
