/**
 * asciiMathToLatex — ascii-вираз (`3x^2-4x+1`) → LaTeX для KaTeX-рендера.
 *
 * Порт AST→LaTeX конвертера з standalone GraphMASH
 * (`public/mash/grapher/mq-adapter.js` → `toLatex`), адаптований під
 * CORE-ARITH AST winterboard-vendor (7 вузлів: num/ident/unary/binop/call/
 * tuple/eq — без list/deriv/sum/integral/%/! standalone-донора).
 *
 * ІНВАРІАНТИ (ТЗ 2026-07-21, display-only):
 *   - ЧИСТА конверсія: parse через vendor `GraphCalc.parse` (без MathQuill/
 *     jQuery/DOM). Формат зберігання `expr` НЕ міняється — LaTeX лише view.
 *   - Невалідний вираз → THROW (жодного silent suppression, LAW §12);
 *     fallback на plain text — відповідальність caller-а (MathExpr.vue).
 */
import { GraphCalc } from '../vendor/graph_calculator/graph-calculator.js'

/** CORE-ARITH AST (структурно; vendor — untyped JS). */
interface GcNode {
  kind: 'num' | 'ident' | 'unary' | 'binop' | 'call' | 'tuple' | 'eq'
  v?: number
  name?: string
  op?: string
  arg?: GcNode
  left?: GcNode
  right?: GcNode
  args?: GcNode[]
  items?: GcNode[]
  lhs?: GcNode
  rhs?: GcNode
}

// Мапи 1:1 з mq-adapter.js (GREEK/TRIG)
const GREEK: Record<string, string> = {
  pi: '\\pi ', theta: '\\theta ', tau: '\\tau ', alpha: '\\alpha ',
  beta: '\\beta ', phi: '\\phi ', rho: '\\rho ', omega: '\\omega ',
  lambda: '\\lambda ', mu: '\\mu ', sigma: '\\sigma ',
}
const TRIG = new Set([
  'sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'sinh', 'cosh', 'tanh',
  'ln', 'log', 'exp', 'min', 'max', 'arcsin', 'arccos', 'arctan',
])

const isAdd = (n: GcNode): boolean => n.kind === 'binop' && (n.op === '+' || n.op === '-')
const par = (n: GcNode): string => '\\left(' + toLatex(n) + '\\right)'
const wrapT = (n: GcNode): string =>
  (n.kind === 'num' || n.kind === 'ident' || n.kind === 'call') ? toLatex(n) : par(n)
const mulSide = (n: GcNode): string => (isAdd(n) ? par(n) : toLatex(n))
const powBase = (n: GcNode): string =>
  (n.kind === 'num' || n.kind === 'ident') ? toLatex(n) : par(n)

function toLatex(n: GcNode): string {
  switch (n.kind) {
    case 'num':
      return Number.isFinite(n.v)
        ? String(parseFloat((n.v as number).toPrecision(10)))
        : String(n.v)
    case 'ident':
      return GREEK[n.name as string] || (n.name as string)
    case 'unary':
      return '-' + wrapT(n.arg as GcNode)
    case 'binop': {
      const a = n.left as GcNode
      const b = n.right as GcNode
      switch (n.op) {
        case '+': return toLatex(a) + '+' + toLatex(b)
        case '-': return toLatex(a) + '-' + (isAdd(b) ? par(b) : toLatex(b))
        case '*': return mulSide(a) + '\\cdot ' + mulSide(b)
        case '/': return '\\frac{' + toLatex(a) + '}{' + toLatex(b) + '}'
        case '^': return powBase(a) + '^{' + toLatex(b) + '}'
      }
      throw new Error('asciiMathToLatex: unknown binop ' + n.op)
    }
    case 'call': {
      const name = n.name as string
      const args = n.args as GcNode[]
      if (name === 'log' && args.length === 2) {
        // K-2: log(x, a) → \log_{a}x
        return '\\log_{' + toLatex(args[1]) + '}' + toLatex(args[0])
      }
      if (name === 'sqrt') return '\\sqrt{' + toLatex(args[0]) + '}'
      if (name === 'cbrt') return '\\sqrt[3]{' + toLatex(args[0]) + '}'
      if (name === 'abs') return '\\left|' + toLatex(args[0]) + '\\right|'
      const map: Record<string, string> = { asin: 'arcsin', acos: 'arccos', atan: 'arctan' }
      const ln = map[name] || name
      const body = args.map(toLatex).join(',')
      if (TRIG.has(ln)) return '\\' + ln + '\\left(' + body + '\\right)'
      return '\\operatorname{' + ln + '}\\left(' + body + '\\right)'
    }
    case 'tuple':
      return '\\left(' + (n.items as GcNode[]).map(toLatex).join(',') + '\\right)'
    case 'eq':
      return toLatex(n.lhs as GcNode) + '=' + toLatex(n.rhs as GcNode)
  }
  throw new Error('asciiMathToLatex: unknown node kind ' + (n as { kind: string }).kind)
}

/**
 * ascii-вираз → LaTeX. Приймає і голі вирази (`x^2`), і рівняння (`y = x^2`).
 * THROWS на невалідному вводі — caller робить явний fallback.
 */
export function asciiMathToLatex(src: string): string {
  const ast = GraphCalc.parse(src) as GcNode
  return toLatex(ast)
}

/**
 * Чи вираз конвертований у LaTeX (аналог canWysiwyg з mq-adapter):
 * true → можна монтувати MathQuill-поле/KaTeX; false → plain input/text.
 * false у catch — ВИЗНАЧЕНИЙ результат перевірки, не suppression.
 */
export function isRenderableAscii(src: string): boolean {
  try {
    asciiMathToLatex(src)
    return true
  } catch {
    return false
  }
}
