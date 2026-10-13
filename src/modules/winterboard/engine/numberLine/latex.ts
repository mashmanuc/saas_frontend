/**
 * Формули числової прямої в LaTeX (ТЗ «Числова пряма — один рядок + KaTeX», 2026-10-13, §4.2).
 *
 * LaTeX будується з РОЗБОРУ, а не ремонтом рядка регексом: той самий набір лексем і граматика,
 * що й `expr.ts` (вираз := доданок (± доданок)*, доданок := степінь (· | / | неявне множення …),
 * степінь := атом (^ ціле | ² | ³)?, атом := число | змінна | ( вираз ) | √атом), у тому порядку,
 * як написав учитель: `√(x−1)` → `\sqrt{x-1}`, `2,5` лишається з комою, `²` → `^{2}`, дріб → `\frac`.
 *
 * Окремий лексер, бо `expr.ts` для формул не годиться: корінь зі змінної (`√(x−1)`) він
 * відхиляє (це робота сервера), а число зберігає вже як значення (запис `2,5` губиться).
 * Рядок, який розбір не прийняв, — null: показується звичайним текстом, формули ніхто не вгадує.
 */

type Tok =
  | { k: 'num'; text: string }
  | { k: 'var'; name: string }
  | { k: 'op'; tex: string }
  | { k: 'sym'; ch: '+' | '-' | '*' | '/' | '(' | ')' | '^' }
  | { k: 'root' }
  | { k: 'approx' }

/** Знаки нерівностей (довші — першими). */
const OPS: Array<[string, string]> = [
  ['<=', '\\le'], ['=<', '\\le'], ['>=', '\\ge'], ['=>', '\\ge'], ['!=', '\\ne'], ['<>', '\\ne'],
  ['≤', '\\le'], ['⩽', '\\le'], ['≥', '\\ge'], ['⩾', '\\ge'], ['≠', '\\ne'],
  ['<', '<'], ['>', '>'], ['=', '='],
]
const SUPERSCRIPT: Record<string, string> = { '²': '2', '³': '3', '⁴': '4' }
const MAX_LEN = 400

function lex(src: string): Tok[] | null {
  if (!src || src.length > MAX_LEN) return null
  const out: Tok[] = []
  let i = 0
  while (i < src.length) {
    const ch = src[i]
    if (/\s/.test(ch)) { i++; continue }
    const op = OPS.find(([p]) => src.startsWith(p, i))
    if (op) { out.push({ k: 'op', tex: op[1] }); i += op[0].length; continue }
    if (ch === '√') { out.push({ k: 'root' }); i++; continue }
    if (/^sqrt/i.test(src.slice(i))) { out.push({ k: 'root' }); i += 4; continue }
    if (ch === '≈') { out.push({ k: 'approx' }); i++; continue }
    if (/[0-9]/.test(ch)) {
      const text = (/^\d+(?:[.,]\d+)?/.exec(src.slice(i)) as RegExpExecArray)[0]
      out.push({ k: 'num', text })
      i += text.length
      continue
    }
    // Кирилична «х» з української розкладки — це x (як у рушіях).
    if (ch === 'х' || ch === 'Х') { out.push({ k: 'var', name: 'x' }); i++; continue }
    if (/[a-zA-Z]/.test(ch)) { out.push({ k: 'var', name: ch }); i++; continue }
    if (SUPERSCRIPT[ch]) {
      out.push({ k: 'sym', ch: '^' })
      out.push({ k: 'num', text: SUPERSCRIPT[ch] })
      i++
      continue
    }
    if (/[−–—]/.test(ch)) { out.push({ k: 'sym', ch: '-' }); i++; continue }
    if ('·×'.includes(ch)) { out.push({ k: 'sym', ch: '*' }); i++; continue }
    if (ch === ':') { out.push({ k: 'sym', ch: '/' }); i++; continue }
    if ('+-*/()^'.includes(ch)) { out.push({ k: 'sym', ch: ch as '+' }); i++; continue }
    return null
  }
  return out
}

/** Вузол: LaTeX + чи це група в дужках (для дробу й кореня дужки знімаємо). */
interface Node {
  tex: string
  /** Уміст без зовнішніх дужок, якщо вузол — `( … )`. */
  inner?: string
  /** Починається з цифри (між двома числами — явне `\cdot`). */
  num?: boolean
}

class Parser {
  private i = 0
  constructor(private readonly t: Tok[]) {}

  done(): boolean { return this.i >= this.t.length }
  private peek(): Tok | undefined { return this.t[this.i] }
  private sym(ch: string): boolean {
    const p = this.peek()
    if (p && p.k === 'sym' && p.ch === ch) { this.i++; return true }
    return false
  }

  /** рядок := вираз (знак вираз)* — проста, подвійна нерівність, `=`, `≠`. */
  line(): string | null {
    const parts: string[] = []
    const first = this.expr()
    if (!first) return null
    parts.push(first.tex)
    while (!this.done()) {
      const p = this.peek()!
      if (p.k !== 'op') return null
      this.i++
      const rhs = this.expr()
      if (!rhs) return null
      parts.push(p.tex, rhs.tex)
    }
    return parts.join(' ')
  }

  expr(): Node | null {
    let tex = ''
    if (this.sym('-')) tex = '-'
    else this.sym('+')
    const first = this.term()
    if (!first) return null
    tex += first.tex
    let single = tex === first.tex ? first : null
    for (;;) {
      if (this.sym('+')) tex += ' + '
      else if (this.sym('-')) tex += ' - '
      else break
      const next = this.term()
      if (!next) return null
      tex += next.tex
      single = null
    }
    return single ?? { tex }
  }

  term(): Node | null {
    let acc = this.power()
    if (!acc) return null
    for (;;) {
      const p = this.peek()
      if (!p) break
      if (p.k === 'sym' && p.ch === '/') {
        this.i++
        const den = this.power()
        if (!den) return null
        acc = { tex: `\\frac{${acc.inner ?? acc.tex}}{${den.inner ?? den.tex}}` }
        continue
      }
      const explicit = p.k === 'sym' && p.ch === '*'
      const implicit = p.k === 'num' || p.k === 'var' || p.k === 'root' || (p.k === 'sym' && p.ch === '(')
      if (!explicit && !implicit) break
      if (explicit) this.i++
      const next = this.power()
      if (!next) return null
      const dot = explicit || (acc.num && next.num) ? ' \\cdot ' : ''
      acc = { tex: `${acc.tex}${dot}${next.tex}`, num: acc.num }
    }
    return acc
  }

  power(): Node | null {
    const base = this.atom()
    if (!base) return null
    if (!this.sym('^')) return base
    const p = this.peek()
    if (!p || p.k !== 'num') return null
    this.i++
    return { tex: `${base.tex}^{${p.text}}`, num: base.num }
  }

  atom(): Node | null {
    const p = this.peek()
    if (!p) return null
    if (p.k === 'num') {
      this.i++
      // Десяткова кома — як записав учитель; `{,}` — щоб KaTeX не ставив пробіл після коми.
      return { tex: p.text.replace(',', '{,}'), num: true }
    }
    if (p.k === 'var') { this.i++; return { tex: p.name } }
    if (p.k === 'root') {
      this.i++
      const arg = this.power()
      if (!arg) return null
      return { tex: `\\sqrt{${arg.inner ?? arg.tex}}` }
    }
    if (p.k === 'approx') {
      this.i++
      const rest = this.expr()
      return rest ? { tex: `\\approx ${rest.tex}` } : null
    }
    if (p.k === 'sym' && p.ch === '(') {
      this.i++
      const inner = this.expr()
      if (!inner || !this.sym(')')) return null
      return { tex: `\\left(${inner.tex}\\right)`, inner: inner.tex }
    }
    return null
  }
}

/** Нерівність (чи кілька частин із `=`, `≠`) як записав учитель → LaTeX; не розібрав — null. */
export function inequalityLatex(line: string): string | null {
  const toks = lex(String(line ?? '').trim())
  // Без знака нерівності це не нерівність — показуємо як є, не вгадуємо.
  if (!toks || !toks.some((x) => x.k === 'op')) return null
  const p = new Parser(toks)
  const out = p.line()
  return out && p.done() ? out : null
}

/** Число в нашому записі (`−3`, `√3/2`, `2,5`, `1 − √2`, `≈1,32`) → LaTeX; не розібрав — null. */
export function numberLatex(label: string): string | null {
  const toks = lex(String(label ?? '').trim())
  if (!toks || !toks.length || toks.some((x) => x.k === 'op' || x.k === 'var')) return null
  const p = new Parser(toks)
  const n = p.expr()
  return n && p.done() ? n.tex : null
}

/** Межа проміжку: `−∞` / `+∞` або число. */
function boundLatex(s: string): string | null {
  const t = s.trim()
  if (t === '−∞' || t === '-∞') return '-\\infty'
  if (t === '+∞' || t === '∞') return '+\\infty'
  return numberLatex(t)
}

/**
 * Множина в нашому записі (`(−∞; 2) ∪ {3} ∪ [4; +∞)`) → LaTeX. Це розбір нашого ж
 * формату відповіді / ОДЗ (тих самих форматерів), а не вгадування; не розібрав — null.
 */
export function setLatex(text: string): string | null {
  const parts = text.split('∪').map((x) => x.trim())
  const out: string[] = []
  for (const part of parts) {
    const pt = /^\{(.+)\}$/.exec(part)
    if (pt) {
      const n = numberLatex(pt[1])
      if (n === null) return null
      out.push(`\\{${n}\\}`)
      continue
    }
    const iv = /^([[(])(.+);(.+)([\])])$/.exec(part)
    if (!iv) return null
    const lo = boundLatex(iv[2])
    const hi = boundLatex(iv[3])
    if (lo === null || hi === null) return null
    out.push(`${iv[1]}${lo}; ${hi}${iv[4]}`)
  }
  return out.join(' \\cup ')
}

/**
 * Рядок відповіді / ОДЗ у нашому записі (`x ∈ [−1; 3)`, `x = 3`, `x ≥ −1`, `x ≠ 2, x ≠ −3`) → LaTeX.
 * `∅` — порожня множина. Не розібрав — null (показується звичайним текстом).
 */
export function statementLatex(text: string): string | null {
  const t = String(text ?? '').trim()
  if (!t) return null
  if (t === '∅') return '\\varnothing'
  const pieces = t.split(/,\s+(?=[a-zA-Zх]\s*[≠<>≤≥=∈])/)
  const out: string[] = []
  for (const piece of pieces) {
    const m = /^([a-zA-Zх])\s*∈\s*(.+)$/.exec(piece)
    if (m) {
      const s = setLatex(m[2])
      if (s === null) return null
      out.push(`${m[1] === 'х' ? 'x' : m[1]} \\in ${s}`)
      continue
    }
    const ineq = inequalityLatex(piece)
    if (ineq === null) return null
    out.push(ineq)
  }
  return out.join(',\\; ')
}
