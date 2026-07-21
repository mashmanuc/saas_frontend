/**
 * latexToSrc — LaTeX (з MathQuill-поля) → ascii-src для двигуна/store.
 *
 * Порт `latexToSrc` з `public/mash/grapher/mq-adapter.js` (рядки 96-168) —
 * функція там чиста й самодостатня (без DOM/jQuery/GraphCalc), тому це
 * прямий copy+типізація, НЕ переписування. Логіка 1:1 з донором, щоб
 * поведінка на дошці збігалась зі standalone `/mash/grapher/`.
 *
 * Використання: MathQuill edit-handler → latexToSrc(mq.latex()) →
 * onSrcInput/store (формат зберігання лишається ascii — ТЗ §0.1).
 * Невідомі команди деградують у текст — двигун сам відхилить невалідне
 * (жодного throw тут; помилки парсингу — відповідальність двигуна).
 */

const GREEK_R: Record<string, string> = {
  pi: 'pi', theta: 'theta', tau: 'tau', alpha: 'alpha', beta: 'beta',
  phi: 'phi', rho: 'rho', omega: 'omega', lambda: 'lambda', mu: 'mu', sigma: 'sigma',
}

const FN_R = new Set([
  'sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'sinh', 'cosh', 'tanh',
  'ln', 'log', 'exp', 'min', 'max', 'arcsin', 'arccos', 'arctan', 'arg', 'abs',
])

export function latexToSrc(lx: string): string {
  let i = 0
  const skipSp = (): void => { while (lx[i] === ' ') i++ }

  function readCmd(): string {
    i++
    let c = ''
    while (i < lx.length && /[a-zA-Z]/.test(lx[i])) c += lx[i++]
    if (!c) c = lx[i++]
    return c
  }

  function group(): string {
    skipSp()
    if (lx[i] === '{') { i++; const s = level('}'); i++; return s }
    if (lx[i] === '\\') return cmdToSrc(readCmd())
    return lx[i++]
  }

  function cmdToSrc(c: string): string {
    switch (c) {
      case 'frac': { const a = group(); const b = group(); return '((' + a + ')/(' + b + '))' }
      case 'sqrt': {
        skipSp()
        let n2: string | null = null
        if (lx[i] === '[') { i++; n2 = level(']'); i++ }
        const a = group()
        return n2 ? '((' + a + ')^(1/(' + n2 + ')))' : 'sqrt(' + a + ')'
      }
      case 'cdot': case 'times': return '*'
      case 'left': {
        skipSp()
        if (lx[i] === '\\') { const d = readCmd(); if (d === '|') return 'abs('; return '(' }
        const d = lx[i++]
        if (d === '|') return 'abs('
        return d === '[' ? '[' : '('
      }
      case 'right': {
        skipSp()
        if (lx[i] === '\\') { readCmd(); return ')' }
        const d = lx[i++]
        return d === ']' ? ']' : ')'
      }
      case 'operatorname': return group()
      case 'le': return '<='
      case 'ge': return '>='
      case 'ne': return '!='
      case 'sim': return '~'
      case 'sum': case 'prod': {
        skipSp()
        let lo = ''
        let hi = ''
        if (lx[i] === '_') { i++; lo = group() }
        skipSp()
        if (lx[i] === '^') { i++; hi = group() }
        const body = level(null)
        const m = lo.match(/^\s*([a-zA-Zα-ω]\w*)\s*=\s*([\s\S]*)$/)
        const v = m ? m[1] : 'n'
        const l = m ? m[2] : lo
        return (c === 'sum' ? 'sum(' : 'product(') + v + ',' + l + ',' + hi + ',' + body + ')'
      }
      default:
        if (GREEK_R[c]) return GREEK_R[c]
        if (FN_R.has(c)) {
          return c === 'arcsin' ? 'asin' : c === 'arccos' ? 'acos' : c === 'arctan' ? 'atan' : c
        }
        if (c === ' ' || c === ',') return c
        return c // невідома команда — як текст (двигун відхилить, якщо невалідно)
    }
  }

  function level(closer: string | null): string {
    let s = ''
    while (i < lx.length) {
      const ch = lx[i]
      if (closer && ch === closer) break
      if (ch === '}') break
      if (ch === '\\') { s += cmdToSrc(readCmd()); continue }
      if (ch === '^') { i++; s += '^(' + group() + ')'; continue }
      if (ch === '_') { i++; s += '_' + group(); continue }
      if (ch === '~') { i++; s += ' '; continue }
      i++; s += ch
    }
    return s
  }

  return level(null).trim()
}
