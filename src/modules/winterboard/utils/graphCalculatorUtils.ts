/**
 * Phase G utility — auto-detect параметрів у graph_calculator expression.
 *
 * Per OPS_SYNC_SSOT.md INV-21 + PARSER-INV (2026-05-06):
 *   - **AST-based** parsing via vendor `GraphCalc.parse + freeVars` (Pratt
 *     parser, full grammar). NO regex tokenization.
 *   - Detection runs on commit (blur/Enter), NOT on every keystroke.
 *   - Detection is pure (no side effects).
 *   - Invalid expression → returns [] (UX-INV-5: no crash, no false params).
 */
import { GraphCalc } from '../vendor/graph_calculator/graph-calculator.js'

/**
 * Reserved tokens (case-sensitive) that MUST NOT be treated as parameters.
 * Includes: coordinate vars, math functions (engine `FUNCS`), constants.
 * Sync with vendor `graph-calculator.js` parser.
 */
export const GRAPH_RESERVED_TOKENS: ReadonlySet<string> = new Set([
  // Coordinate axes / parameter binding
  'x', 'y', 't',
  // Trigonometry
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2',
  'sinh', 'cosh', 'tanh',
  // Logarithms / exponents
  'log', 'ln', 'log2', 'log10', 'exp',
  // Roots / absolute / rounding
  'sqrt', 'cbrt', 'abs', 'sign', 'floor', 'ceil', 'round',
  // Aggregates
  'min', 'max', 'pow',
  // Constants
  'pi', 'e', 'tau', 'phi',
])

const PARAM_NAME_REGEX = /^[a-zA-Z][a-zA-Z0-9_]{0,31}$/

/**
 * Walk AST та collect free identifiers. Vendor `GraphCalc.freeVars` walks
 * `ident/unary/binop/call/tuple` nodes (filters CONSTS automatically).
 * Equation node `kind: 'eq'` not handled by vanilla freeVars — collect
 * from both sides.
 */
function _collectFree(ast: unknown): Set<string> {
  if (!ast || typeof ast !== 'object') return new Set()
  const node = ast as { kind?: string; lhs?: unknown; rhs?: unknown }
  if (node.kind === 'eq' && node.lhs && node.rhs) {
    const a = (GraphCalc as any).freeVars(node.lhs) as Set<string>
    const b = (GraphCalc as any).freeVars(node.rhs) as Set<string>
    return new Set([...a, ...b])
  }
  return (GraphCalc as any).freeVars(node) as Set<string>
}

/** Lightweight check — does src parse successfully? Used by renderer для skip-flicker. */
export function isParseValid(src: string): boolean {
  if (!src || typeof src !== 'string') return false
  try { (GraphCalc as any).parse(src); return true } catch { return false }
}

/**
 * Phase G review #3 (2026-05-06): heuristic detect of multi-letter
 * identifiers що ймовірно intended as implicit-multiply. Returns suggestions
 * для UI hint.
 *
 * Trigger: identifier length 2-3 letters AND NOT у RESERVED (functions /
 * constants) AND NOT current param name. Suggests split: `ax` → `a*x`,
 * `abc` → `a*b*c`. User decides — НЕ автоматично замінюємо.
 *
 * Returns: array of {token, suggestion} or [] if no suspicious tokens.
 * Empty for valid expressions без multi-letter unknowns.
 */
export interface ImplicitMultiplyHint {
  /** Original token, e.g. 'ax' */
  token: string
  /** Suggested split, e.g. 'a*x' */
  suggestion: string
}

export function detectAmbiguousImplicitMultiply(
  src: string,
  knownParams: ReadonlyArray<string> = [],
): ImplicitMultiplyHint[] {
  if (!src || typeof src !== 'string') return []
  const knownSet = new Set(knownParams)
  // Tokenize via simple regex (just for hint detection — not for AST).
  const tokens = src.match(/[a-zA-Z][a-zA-Z0-9_]*/g) || []
  const out: ImplicitMultiplyHint[] = []
  const seen = new Set<string>()
  for (const t of tokens) {
    if (seen.has(t)) continue
    seen.add(t)
    if (t.length < 2 || t.length > 3) continue           // suggest only short combos
    if (GRAPH_RESERVED_TOKENS.has(t)) continue           // sin, cos, tan, log...
    if (knownSet.has(t)) continue                         // existing param like "alpha"
    if (!/^[a-zA-Z]+$/.test(t)) continue                  // skip if has digits/underscore
    // Suggest split into single letters
    out.push({ token: t, suggestion: t.split('').join('*') })
  }
  return out
}

/**
 * Extract parameter names з expression source.
 * Per PARSER-INV (2026-05-06): AST-based via vendor parser. Implicit-multiply
 * (`2x` → `2*x`), function calls (`sin(a*x)`), nested expressions handled
 * correctly by vendor Pratt parser. Invalid expression → [] (no crash).
 *
 * Examples:
 *   'y = a*x'           → ['a']
 *   'y = a*sin(b*x)+c'  → ['a', 'b', 'c']
 *   '2x + a'            → ['a']         // implicit multiply (regex would miss)
 *   '(x-2)^2 + y^2 = 9' → []           // all reserved
 *   'r = 5'             → ['r']
 *   'y = sin('          → []           // invalid → no params (UX-INV-5)
 */
export function extractParams(src: string): string[] {
  if (!src || typeof src !== 'string') return []
  let ast: unknown
  try { ast = (GraphCalc as any).parse(src) } catch { return [] }
  const free = _collectFree(ast)
  const seen = new Set<string>()
  const out: string[] = []
  for (const t of free) {
    if (typeof t !== 'string') continue
    if (GRAPH_RESERVED_TOKENS.has(t)) continue
    if (!PARAM_NAME_REGEX.test(t)) continue
    if (seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out
}

/**
 * Extract used params з ALL expressions sources combined.
 * Returns deduplicated list — use as canonical "currently used params" список.
 *
 * Per Phase G review #3 (2026-05-06) — ANTI-FLICKER guarantee:
 * - Returns `null` ЯКЩО хоч одна expression parse-fails (incomplete typing).
 * - Caller MUST treat `null` as "skip sync" (preserve current state.params).
 * - Returns `[]` (empty array) ТІЛЬКИ якщо ALL expressions parse OK і
 *   жодного param не виявлено (тоді sync to clear params is intended).
 *
 * Without this distinction:
 *   user types `y = a*x`     → ['a']        → param appears
 *   user types `y = a*x +`   → []  (parse fail) → param REMOVED ❌
 *   user finishes `y = a*x + b` → ['a','b']    → params re-added ❌
 * Result: flicker. Anti-flicker: return null on parse-fail → no sync → params remain.
 */
export function extractParamsFromAll(srcs: ReadonlyArray<string>): string[] | null {
  const seen = new Set<string>()
  const out: string[] = []
  for (const s of srcs) {
    if (!s || typeof s !== 'string') continue
    let ast: unknown
    try { ast = (GraphCalc as any).parse(s) } catch {
      // Parse fail на ЛЮБІЙ expression → skip whole sync.
      return null
    }
    const free = _collectFree(ast)
    for (const t of free) {
      if (typeof t !== 'string') continue
      if (GRAPH_RESERVED_TOKENS.has(t)) continue
      if (!PARAM_NAME_REGEX.test(t)) continue
      if (!seen.has(t)) { seen.add(t); out.push(t) }
    }
  }
  return out
}
