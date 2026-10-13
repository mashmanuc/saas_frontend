/**
 * Строга граматика нерівностей і чисел для числової прямої (ТЗ §2.2 `parse`).
 *
 * Рядок — одна умова:  `x > 3`, `3 < x`, `x ≤ -2`, `-3 < x ≤ 5`, `x ≠ 1`, `x = 3`,
 * або лінійна нерівність (`2x + 3 > 7`, `-1 < 2x + 1 ≤ 5`) — її розвʼязує `linear.ts`.
 * Числа: цілі, десяткові з комою чи крапкою (`2,5`), дроби (`-1/3`).
 * Помилка — кодом і з місцем, без жодного «приблизно» (інваріант 3).
 */
import { rational } from './rational'
import { real, type Real } from './real'
import type {
  NumberLineCondition,
  NumberLineError,
  NumberLineOp,
} from './types'
import { isConstCondition, isRangeCondition } from './types'
import { parseLinear } from './linear'
import { MAX_INPUT, normalizeInput } from './expr'

type ErrorWithoutLine = Omit<NumberLineError, 'line'>

export type ParsedNumber = { ok: true; value: Real; label: string } | { ok: false; error: ErrorWithoutLine }

const MINUS = /[−–—]/g

/** Корінь (етап 1б): `[коефіцієнт][·]√n[/d]` або `sqrt(n)`; коефіцієнт — ціле, десяткове чи дріб. */
const ROOT = /^([+-]?)(?:(\d+)(?:[.,](\d+))?|(\d+)\/(\d+))?[·*]?(?:√|sqrt)(?:\((\d+)\)|(\d+))(?:\/(\d+))?$/i
const PLAIN = /^([+-]?)(?:(\d+)(?:[.,](\d+))?|(\d+)\/(\d+))$/
/** Підкореневе — до 9 цифр (розклад на множники миттєвий). */
const MAX_RADICAND_DIGITS = 9

/**
 * Число з тексту вчителя → точне значення. `label` — як записано (з нормалізованим мінусом).
 * Цілі, десяткові з комою чи крапкою, дроби; етап 1б — корені `a·√n` (`√12` = `2√3`).
 */
export function parseNumber(input: string, index = 0): ParsedNumber {
  const raw = String(input ?? '')
  const text = raw.replace(MINUS, '-').replace(/\s+/g, '')
  const bad = (): ParsedNumber => ({ ok: false, error: { index, code: 'bad_number', params: { text: raw.trim() } } })
  const zeroDiv = (): ParsedNumber => ({ ok: false, error: { index, code: 'division_by_zero', params: { text: raw.trim() } } })
  const isRoot = /√|sqrt/i.test(text)
  const m = (isRoot ? ROOT : PLAIN).exec(text)
  if (!m) {
    // `√-3`, `√x`, `1+√2` у полі числа — не корінь виду a·√n.
    return isRoot ? { ok: false, error: { index, code: 'root_form', params: { text: raw.trim() } } } : bad()
  }
  const sign = m[1] === '-' ? -1n : 1n
  let coef = rational(sign)
  if (m[4] !== undefined) {
    const den = BigInt(m[5])
    if (den === 0n) return zeroDiv()
    coef = rational(sign * BigInt(m[4]), den)
  } else if (m[2] !== undefined) {
    const frac = m[3] ?? ''
    coef = rational(sign * BigInt(m[2] + frac), 10n ** BigInt(frac.length))
  } else if (!isRoot) {
    return bad()
  }
  let value: Real = real(coef)
  if (isRoot) {
    const radicand = m[6] ?? m[7]
    if (radicand.length > MAX_RADICAND_DIGITS) return bad()
    const den = m[8] !== undefined ? BigInt(m[8]) : 1n
    if (den === 0n) return zeroDiv()
    value = real(rational(coef.n, coef.d * den), BigInt(radicand))
  }
  // «−0» учителеві ні до чого: нуль — це 0.
  return { ok: true, value, label: value.q.n === 0n ? '0' : text.replace(/^\+/, '') }
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
    const rootNum = /^[+\-−–—]?\s*(?:\d+(?:[.,]\d+)?|\d+\/\d+)?\s*[·*]?\s*(?:√|sqrt)\s*(?:\(\s*\d+\s*\)|\d+)(?:\s*\/\s*\d+)?/i.exec(line.slice(i))
    if (rootNum) {
      tokens.push({ kind: 'num', text: rootNum[0], start: i })
      i += rootNum[0].length
      continue
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
      // Число: знак, цифри, кома/крапка, дріб. Перевірка форми — у parseNumber.
      const text = (/^[+\-−–—]?\s*[0-9.,/]*/.exec(rest) as RegExpExecArray)[0]
      // Порожній збіг (напр., `√-3`) — інакше цикл не зрушив би з місця.
      if (!text.trim()) return { error: { index: i, code: 'root_form', params: { text: line.slice(i).trim() } } }
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
  'not_linear', 'unbalanced_paren', 'division_by_zero', 'root_sum', 'root_form',
  'ambiguous_denominator', 'too_large', 'too_deep', 'too_long',
])

/** Один рядок учителя → умова контракту. Простий запис — як є; інакше — лінійна нерівність. */
export function parseLine(raw: string): ParsedLine {
  const line = normalizeInput(raw)
  if (!line.trim()) return { ok: false, error: { index: 0, code: 'empty' } }
  if (line.length > MAX_INPUT) return { ok: false, error: { index: MAX_INPUT, code: 'too_long', params: { max: String(MAX_INPUT) } } }
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
