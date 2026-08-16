/**
 * Phase G HARD SPEC tests (2026-05-06).
 *
 * Schema: state.params is Record<name, {value, min, max, step}>.
 * Architecture: params = derived from expressions ONLY (sync, full replace).
 *
 * Includes DoD CASE-1..5 (HARD SPEC §11):
 *   1. y = a*x        → slider 'a' з'являється
 *   2. y = x          → slider зникає
 *   3. y = a*x + b    → 2 sliders
 *   4. value preserved через subsequent expression edit
 *   5. range change persisted
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import {
  extractParams,
  extractParamsFromAll,
  detectAmbiguousImplicitMultiply,
  isParseValid,
} from '../utils/graphCalculatorUtils'
import { useWBStore } from '../board/state/boardStore'
import { flushPendingUpdates } from '../board/state/assetUpdateBatcher'
import { GraphCalc } from '../vendor/graph_calculator/graph-calculator.js'
import type { WBAsset } from '../types/winterboard'

describe('extractParams (AST-based, PARSER-INV)', () => {
  it('detects single param', () => {
    expect(extractParams('y = a*x').sort()).toEqual(['a'])
  })
  it('detects multiple', () => {
    expect(extractParams('y = a*sin(b*x) + c').sort()).toEqual(['a', 'b', 'c'])
  })
  it('skips reserved (functions + axes + constants)', () => {
    expect(extractParams('y = sin(x) + cos(x)')).toEqual([])
    expect(extractParams('(x-2)^2 + y^2 = 9')).toEqual([])
    expect(extractParams('y = pi*x + e')).toEqual([])
    expect(extractParams('y = sqrt(x) + abs(x) + log(x)')).toEqual([])
  })
  it('LHS param assignment', () => {
    expect(extractParams('r = 5').sort()).toEqual(['r'])
  })
  it('empty / invalid input', () => {
    expect(extractParams('')).toEqual([])
    expect(extractParams(null as any)).toEqual([])
    expect(extractParams('123 + 456')).toEqual([])
  })
  it('dedupe', () => {
    expect(extractParams('y = a*a + a*x').sort()).toEqual(['a'])
  })
  it('multi-letter params', () => {
    expect(extractParams('y = alpha*x').sort()).toEqual(['alpha'])
    expect(extractParams('y = k1*x + k2').sort()).toEqual(['k1', 'k2'])
  })

  // PARSER-INV regression: regex-based detection бракувало цих cases.
  it('handles implicit multiply: 2a → 2*a', () => {
    expect(extractParams('y = 2a*x').sort()).toEqual(['a'])
    expect(extractParams('y = 3*x + 2a').sort()).toEqual(['a'])
  })
  it('handles nested function calls', () => {
    expect(extractParams('y = sin(cos(a*x))').sort()).toEqual(['a'])
  })
  it('handles complex expressions', () => {
    // 'e' RESERVED (Euler constant) — using 'k' instead.
    expect(extractParams('y = a*sin(b*x + c) + d*cos(k*x)').sort()).toEqual(['a', 'b', 'c', 'd', 'k'])
  })

  // Phase G review #3 (2026-05-06): named functions з digit (log10, atan2)
  it('preserves log10/atan2/log2 — НЕ ламає (\\d)(\\() через lookbehind', () => {
    // log10(x): freeVars → x reserved → []. Critical: parser MUST treat
    // "log10" як ОДИН identifier і call. Якщо normalizeImplicit зробить
    // "log*10(x)" — engine створить param "log" → bug. Lookbehind fix.
    expect(extractParams('y = log10(x)')).toEqual([])
    expect(extractParams('y = log2(x)')).toEqual([])
    // atan2 теж reserved функція з digit
    expect(extractParams('y = atan2(x, 1)')).toEqual([])
    // Custom-named param ending у digit (k1) — accepted as param
    expect(extractParams('y = k1*x')).toEqual(['k1'])
    expect(extractParams('y = k1(x)')).toEqual([])  // k1 used as function call → not free var? actually 'k1' would be "ident" without args; engine treats as function-call with 'x' arg → unknown function, treated as ident. Skip — covered by other tests.
  })
  it('UX-INV-5: invalid expressions return [] (no crash)', () => {
    expect(extractParams('y = sin(')).toEqual([])
    expect(extractParams('(((')).toEqual([])
    expect(extractParams('y = a +')).toEqual([])
    expect(extractParams('= = =')).toEqual([])
  })
  it('does NOT detect identifiers in invalid syntax', () => {
    // Regex would catch 'a' here; AST refuses to parse → empty.
    expect(extractParams('y = a +')).toEqual([])
  })

  // Phase G review #2: normalizeImplicit (number-letter boundary)
  it('normalizes 2a → 2*a (number-letter boundary)', () => {
    expect(extractParams('y = 2a').sort()).toEqual(['a'])
    expect(extractParams('y = 3a*x').sort()).toEqual(['a'])
    expect(extractParams('y = 5x + 2a').sort()).toEqual(['a'])
  })
  it('normalizes 2(x+a) → 2*(x+a)', () => {
    expect(extractParams('y = 2(x+a)').sort()).toEqual(['a'])
  })
  it('normalizes (a+1)(b+1) → (a+1)*(b+1)', () => {
    expect(extractParams('y = (a+1)(b+1)').sort()).toEqual(['a', 'b'])
  })
  it('normalizes 2sin(x) — number before function call', () => {
    // 2sin → 2*sin → graph-calc engine treats 'sin' як function. detect=[].
    expect(extractParams('y = 2sin(x)')).toEqual([])
  })

  // Documented limitation: greedy identifier tokenization (multi-letter not split).
  it('documented limitation: 2ax → 2*ax (single param "ax", multi-letter not split)', () => {
    // Normalizer fixes number-letter boundary (2 → 2*) but not letter-letter.
    expect(extractParams('y = 2ax').sort()).toEqual(['ax'])
    expect(extractParams('y = 2*a*x').sort()).toEqual(['a'])  // explicit
    expect(extractParams('y = 2 a x').sort()).toEqual(['a'])  // space-separated
  })

  // RUNTIME-INV-1: detect and classify consume same vendor AST → no drift.
  it('RUNTIME-INV-1: parse-fail sources return [] (matches classify invalid)', () => {
    // Examples where parse throws: detect returns [], engine classify will
    // also return kind='invalid'. Drift would be detect:['a'] + classify:'invalid'.
    expect(extractParams('y =')).toEqual([])           // hanging eq
    expect(extractParams(') a + (')).toEqual([])       // unmatched parens
    expect(extractParams('a *')).toEqual([])           // dangling op
  })
})

describe('extractParamsFromAll', () => {
  it('combines + dedupe', () => {
    expect(extractParamsFromAll(['y = a*x', 'y = a + b']).sort()).toEqual(['a', 'b'])
  })
  it('empty array', () => expect(extractParamsFromAll([])).toEqual([]))

  // Multi-expression consistency (Phase G review #2):
  it('shared param survives якщо хоч одна expression використовує', () => {
    // Two expressions both use 'a'; sync after deletion of one must keep 'a'.
    expect(extractParamsFromAll(['y = a*x', 'y = a + b']).sort()).toEqual(['a', 'b'])
    // After removing first expression — 'a' все ще використовується у second.
    expect(extractParamsFromAll(['y = a + b']).sort()).toEqual(['a', 'b'])
  })
  it('param dropped only коли НЕ використовується у JEDNой expression', () => {
    // 'a' was в обох; видалити обидві — params={}
    expect(extractParamsFromAll(['y = x'])).toEqual([])
  })
  it('disjoint expressions: extract union', () => {
    expect(extractParamsFromAll(['y = a*x', 'y = b*x']).sort()).toEqual(['a', 'b'])
  })
  it('chains complex multi-expr', () => {
    expect(extractParamsFromAll([
      'y = a*sin(x)',
      'y = b*cos(x)',
      'y = c*x^2',
      'y = a + b',  // shared 'a','b'
    ]).sort()).toEqual(['a', 'b', 'c'])
  })

  // Phase G review #3: ANTI-FLICKER — null on parse fail
  it('returns NULL якщо хоч одна expression parse-fails', () => {
    expect(extractParamsFromAll(['y = a*x', 'y = a +'])).toBeNull()
    expect(extractParamsFromAll(['y = sin('])).toBeNull()
    expect(extractParamsFromAll(['(((', 'y = a*x'])).toBeNull()
  })
  it('returns [] (empty) ТІЛЬКИ якщо ALL parse OK з нуль params', () => {
    expect(extractParamsFromAll(['y = x'])).toEqual([])
    expect(extractParamsFromAll(['y = sin(x) + cos(x)'])).toEqual([])
  })
})

describe('isParseValid', () => {
  it('valid expressions', () => {
    expect(isParseValid('y = a*x')).toBe(true)
    expect(isParseValid('y = sin(x)')).toBe(true)
    expect(isParseValid('(2,3)')).toBe(true)
  })
  it('invalid expressions', () => {
    expect(isParseValid('y =')).toBe(false)
    expect(isParseValid('(((')).toBe(false)
    expect(isParseValid('y = a +')).toBe(false)
    expect(isParseValid('')).toBe(false)
  })
})

describe('detectAmbiguousImplicitMultiply (Phase G review #3 hints)', () => {
  it('flags multi-letter unknown tokens of length 2-3', () => {
    const hints = detectAmbiguousImplicitMultiply('y = 2ax')
    expect(hints).toContainEqual({ token: 'ax', suggestion: 'a*x' })
  })
  it('flags 3-letter combo', () => {
    const hints = detectAmbiguousImplicitMultiply('y = abc')
    expect(hints).toContainEqual({ token: 'abc', suggestion: 'a*b*c' })
  })
  it('does NOT flag reserved functions/constants', () => {
    expect(detectAmbiguousImplicitMultiply('y = sin(x)')).toEqual([])
    expect(detectAmbiguousImplicitMultiply('y = pi*x')).toEqual([])
    expect(detectAmbiguousImplicitMultiply('y = log(x)')).toEqual([])
  })
  it('does NOT flag known params (multi-letter intentional like alpha)', () => {
    expect(detectAmbiguousImplicitMultiply('y = alpha*x', ['alpha'])).toEqual([])
    expect(detectAmbiguousImplicitMultiply('y = beta + gamma', ['beta', 'gamma'])).toEqual([])
  })
  it('does NOT flag length 1 or 4+', () => {
    expect(detectAmbiguousImplicitMultiply('y = a')).toEqual([])
    expect(detectAmbiguousImplicitMultiply('y = abcd')).toEqual([])  // user explicit name
  })
  it('does NOT flag identifiers with digits/underscore', () => {
    expect(detectAmbiguousImplicitMultiply('y = k1*x')).toEqual([])  // k1 valid param
  })
})

// ─── Engine classify regression ─────────────────────────────────────────

// ─── Phase G3 — engine snap & intersections ─────────────────────────────

function makeEngine() {
  return import('../vendor/graph_calculator/graph-calculator.js').then(({ GraphCalculator }) => {
    const container = document.createElement('div')
    Object.defineProperty(container, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 600, height: 400, x: 0, y: 0 }),
    })
    document.body.appendChild(container)
    const calc = new GraphCalculator(container, { disableAnimation: true })
    return { calc, container }
  })
}

describe('Engine _snapToCurve (Phase G3 UX)', () => {
  it('snaps cursor near y=x curve', async () => {
    const { calc, container } = await makeEngine()
    calc.setState({
      expressions: [{ id: 'e1', src: 'y = x', color: '#abc', hidden: false }],
      params: {},
      viewport: { cx: 0, cy: 0, scale: 38 },
    })
    // Cursor at (1, 1.05) — близько до y=x curve at x=1 (y=1)
    const snap = (calc as any)._snapToCurve(1, 1.05, 8)
    expect(snap).not.toBeNull()
    expect(snap.curveId).toBe('e1')
    expect(snap.x).toBeCloseTo(1, 1)
    expect(snap.y).toBeCloseTo(1, 1)
    calc.destroy()
    container.remove()
  })

  it('returns null коли курсор далеко від кривих', async () => {
    const { calc, container } = await makeEngine()
    calc.setState({
      expressions: [{ id: 'e1', src: 'y = x', color: '#abc', hidden: false }],
      params: {},
      viewport: { cx: 0, cy: 0, scale: 38 },
    })
    // Cursor at (1, 5) — далеко від y=x at x=1 (y=1)
    const snap = (calc as any)._snapToCurve(1, 5, 8)
    expect(snap).toBeNull()
    calc.destroy()
    container.remove()
  })

  it('skip hidden / non-explicit curves', async () => {
    const { calc, container } = await makeEngine()
    calc.setState({
      expressions: [{ id: 'e1', src: 'y = x', color: '#abc', hidden: true }],
      params: {},
      viewport: { cx: 0, cy: 0, scale: 38 },
    })
    const snap = (calc as any)._snapToCurve(1, 1, 8)
    expect(snap).toBeNull()
    calc.destroy()
    container.remove()
  })

  // Phase G3 review (2026-05-06): magnetic lerp + dynamic threshold
  it('returns strength у [0..1]: closer = stronger', async () => {
    const { calc, container } = await makeEngine()
    calc.setState({
      expressions: [{ id: 'e1', src: 'y = x', color: '#abc', hidden: false }],
      params: {},
      viewport: { cx: 0, cy: 0, scale: 38 },
    })
    // Cursor exactly on curve at (2, 2): strength close to 1
    const onCurve = (calc as any)._snapToCurve(2, 2.0001)
    expect(onCurve).not.toBeNull()
    expect(onCurve.strength).toBeGreaterThan(0.9)
    // Cursor near edge of threshold: strength close to 0
    // y=x perp distance from (2, 2.3) → ~8px @ scale=38, threshold ≈ 9.9px
    const nearEdge = (calc as any)._snapToCurve(2, 2.3)
    if (nearEdge) {
      expect(nearEdge.strength).toBeLessThan(0.5)
    }
    calc.destroy()
    container.remove()
  })

  it('lerp moves cursor toward curve proportional to strength', async () => {
    const { calc, container } = await makeEngine()
    calc.setState({
      expressions: [{ id: 'e1', src: 'y = x', color: '#abc', hidden: false }],
      params: {},
      viewport: { cx: 0, cy: 0, scale: 38 },
    })
    // Off-curve: cursor at (1, 1.1) — curve at (1, 1). Lerp pulls toward (1, 1).
    const snap = (calc as any)._snapToCurve(1, 1.1)
    expect(snap).not.toBeNull()
    // y should be у [1.0, 1.1] — between cursor and curve, closer to curve
    expect(snap.y).toBeGreaterThan(1.0)
    expect(snap.y).toBeLessThan(1.1)
    calc.destroy()
    container.remove()
  })
})

describe('Engine drag-param v1 (Phase G3 v1)', () => {
  it('_solveParam: y = a*x at (2, 4) with initial a=1 → a≈2', async () => {
    const { calc, container } = await makeEngine()
    calc.setState({
      expressions: [{ id: 'e1', src: 'y = a*x', color: '#abc', hidden: false }],
      params: { a: { value: 1, min: -10, max: 10, step: 0.1 } },
      viewport: { cx: 0, cy: 0, scale: 38 },
    })
    const ast = (calc as any).expressions[0].classified.ast
    const a = (calc as any)._solveParam(ast, 'a', 2, 4, 1)
    expect(a).toBeCloseTo(2, 3)
    calc.destroy()
    container.remove()
  })

  it('dp_inv_1: |mathX|<1e-6 → returns NaN (skip solve у unstable zone)', async () => {
    const { calc, container } = await makeEngine()
    calc.setState({
      expressions: [{ id: 'e1', src: 'y = a*x', color: '#abc', hidden: false }],
      params: { a: { value: 1, min: -10, max: 10, step: 0.1 } },
      viewport: { cx: 0, cy: 0, scale: 38 },
    })
    const ast = (calc as any).expressions[0].classified.ast
    // Strict NaN per dp_inv_1 (unstable X-zone)
    expect((calc as any)._solveParam(ast, 'a', 0, 4, 1)).toBeNaN()
    expect((calc as any)._solveParam(ast, 'a', 1e-7, 4, 1)).toBeNaN()
    // Outside unstable zone — solve works
    expect((calc as any)._solveParam(ast, 'a', 1, 4, 1)).toBeCloseTo(4, 3)
    calc.destroy()
    container.remove()
  })

  it('dp_inv_2: low derivative → returns NaN', async () => {
    const { calc, container } = await makeEngine()
    calc.setState({
      // y = sin(a)/a — derivative wrt a → 0 при a → 0 у деяких точках
      expressions: [{ id: 'e1', src: 'y = a*sin(x)', color: '#abc', hidden: false }],
      params: { a: { value: 1, min: -10, max: 10, step: 0.1 } },
      viewport: { cx: 0, cy: 0, scale: 38 },
    })
    const ast = (calc as any).expressions[0].classified.ast
    // sin(π) ≈ 0 → df/da = sin(x) ≈ 0 → low derivative → NaN
    const result = (calc as any)._solveParam(ast, 'a', Math.PI, 0, 1)
    expect(result).toBeNaN()
    calc.destroy()
    container.remove()
  })

  it('dp_inv_6: non-smooth function (abs) returns sane result OR NaN', async () => {
    const { calc, container } = await makeEngine()
    calc.setState({
      // y = a*abs(x): smooth для x>0, але derivative=abs(x) → finite. Newton OK.
      // Test: at x=2 (smooth zone), solve a from y=4 → a=2.
      expressions: [{ id: 'e1', src: 'y = a*abs(x)', color: '#abc', hidden: false }],
      params: { a: { value: 1, min: -10, max: 10, step: 0.1 } },
      viewport: { cx: 0, cy: 0, scale: 38 },
    })
    const ast = (calc as any).expressions[0].classified.ast
    // Smooth zone (x=2): solve works
    const a = (calc as any)._solveParam(ast, 'a', 2, 4, 1)
    expect(a).toBeCloseTo(2, 3)
    // Discontinuity zone (x=0): refused per dp_inv_1
    expect((calc as any)._solveParam(ast, 'a', 0, 0, 1)).toBeNaN()
    calc.destroy()
    container.remove()
  })

  it('dp_inv_6: divergence guard — huge Newton step → NaN', async () => {
    const { calc, container } = await makeEngine()
    calc.setState({
      // y = a (param-only, no x dependence — derivative=1 stable)
      // Test: extremely far target. Newton converges in 1 iter — NOT divergent.
      // To trigger divergence: synthetic test with tiny derivative + finite f.
      expressions: [{ id: 'e1', src: 'y = a*sin(x)', color: '#abc', hidden: false }],
      params: { a: { value: 1, min: -10, max: 10, step: 0.1 } },
      viewport: { cx: 0, cy: 0, scale: 38 },
    })
    const ast = (calc as any).expressions[0].classified.ast
    // sin(0.0001) ≈ 0.0001 → derivative tiny but не нижче threshold;
    // target y=10 → step = 10/0.0001 = 100000 (within 1e6 ok)
    // target y=1e9 → step = 1e9/0.0001 = 1e13 (above 1e6) → NaN
    const result = (calc as any)._solveParam(ast, 'a', 0.0001, 1e9, 1)
    expect(result).toBeNaN()
    calc.destroy()
    container.remove()
  })

  it('dp_inv_5: NaN/Infinity inputs → NaN (no emit)', async () => {
    const { calc, container } = await makeEngine()
    calc.setState({
      expressions: [{ id: 'e1', src: 'y = a*x', color: '#abc', hidden: false }],
      params: { a: { value: 1, min: -10, max: 10, step: 0.1 } },
      viewport: { cx: 0, cy: 0, scale: 38 },
    })
    const ast = (calc as any).expressions[0].classified.ast
    expect((calc as any)._solveParam(ast, 'a', NaN, 4, 1)).toBeNaN()
    expect((calc as any)._solveParam(ast, 'a', 2, NaN, 1)).toBeNaN()
    expect((calc as any)._solveParam(ast, 'a', Infinity, 4, 1)).toBeNaN()
    calc.destroy()
    container.remove()
  })

  it('_findParamDragCandidate: null коли КРИВА залежить від ≥2 параметрів (y=a*x+b)', async () => {
    // 2026-08-16: назву уточнено. Раніше — «null коли params != 1», і тест
    // проходив через заглушку на лічильнику повзунків. Тепер правило інше
    // (однозначність вирішує крива), а тест проходить із ПРАВИЛЬНОЇ причини:
    // ця крива має два параметри — яку тягнути, невідомо. Два повзунки на
    // дошці самі по собі більше нічого не глушать (див. describe нижче).
    const { calc, container } = await makeEngine()
    calc.setState({
      expressions: [{ id: 'e1', src: 'y = a*x + b', color: '#abc', hidden: false }],
      params: {
        a: { value: 1, min: -10, max: 10, step: 0.1 },
        b: { value: 0, min: -10, max: 10, step: 0.1 },
      },
      viewport: { cx: 0, cy: 0, scale: 38 },
    })
    expect((calc as any)._findParamDragCandidate()).toBeNull()
    calc.destroy()
    container.remove()
  })

  it('_findParamDragCandidate: returns candidate коли 1 param + uses it', async () => {
    const { calc, container } = await makeEngine()
    calc.setState({
      expressions: [{ id: 'e1', src: 'y = a*x', color: '#abc', hidden: false }],
      params: { a: { value: 1, min: -10, max: 10, step: 0.1 } },
      viewport: { cx: 0, cy: 0, scale: 38 },
    })
    const candidate = (calc as any)._findParamDragCandidate()
    expect(candidate).not.toBeNull()
    expect(candidate.paramName).toBe('a')
    expect(candidate.exprId).toBe('e1')
    calc.destroy()
    container.remove()
  })

  // Phase G3 v1.1 polish — activation zone + closest-curve picker
  it('_findParamDragCandidate (cursor-aware): picks closest curve коли декілька', async () => {
    const { calc, container } = await makeEngine()
    calc.setState({
      expressions: [
        { id: 'e1', src: 'y = a*x', color: '#abc', hidden: false },     // y=2x at a=2: at x=1 y=2
        { id: 'e2', src: 'y = a*x^2', color: '#bcd', hidden: false },   // y=2x^2 at a=2: at x=1 y=2 (same!), at x=2 y=8
      ],
      params: { a: { value: 2, min: -10, max: 10, step: 0.1 } },
      viewport: { cx: 0, cy: 0, scale: 38 },
    })
    // Cursor at (2, 4) — closer to e1 (y=2x → 4) ніж e2 (y=2x²=8)
    const c1 = (calc as any)._findParamDragCandidate(2, 4)
    expect(c1).not.toBeNull()
    expect(c1.exprId).toBe('e1')
    // Cursor at (2, 7) — closer to e2 (y=8) ніж e1 (y=4)
    const c2 = (calc as any)._findParamDragCandidate(2, 7)
    expect(c2).not.toBeNull()
    expect(c2.exprId).toBe('e2')
    calc.destroy()
    container.remove()
  })

  it('_findParamDragCandidate: returns null коли cursor поза activation zone', async () => {
    const { calc, container } = await makeEngine()
    calc.setState({
      expressions: [{ id: 'e1', src: 'y = a*x', color: '#abc', hidden: false }],
      params: { a: { value: 1, min: -10, max: 10, step: 0.1 } },
      viewport: { cx: 0, cy: 0, scale: 38 },
    })
    // Far away from y=x curve at x=2 (curve y=2). Cursor y=20 → ~684px distance
    // > activation threshold ~50px @ scale=38.
    const result = (calc as any)._findParamDragCandidate(2, 20)
    expect(result).toBeNull()
    calc.destroy()
    container.remove()
  })

  it('_findParamDragCandidate: works without cursor (legacy fallback)', async () => {
    const { calc, container } = await makeEngine()
    calc.setState({
      expressions: [{ id: 'e1', src: 'y = a*x', color: '#abc', hidden: false }],
      params: { a: { value: 1, min: -10, max: 10, step: 0.1 } },
      viewport: { cx: 0, cy: 0, scale: 38 },
    })
    // No cursor passed → first-match (deterministic)
    const c = (calc as any)._findParamDragCandidate()
    expect(c).not.toBeNull()
    expect(c.exprId).toBe('e1')
    calc.destroy()
    container.remove()
  })

  it('_findParamDragCandidate: skip implicit / hidden / non-using-param expr', async () => {
    const { calc, container } = await makeEngine()
    calc.setState({
      expressions: [
        // Implicit (not explicit-Y) — skip
        { id: 'e1', src: 'x^2 + y^2 = 1', color: '#abc', hidden: false },
      ],
      params: { a: { value: 1, min: -10, max: 10, step: 0.1 } },
      viewport: { cx: 0, cy: 0, scale: 38 },
    })
    expect((calc as any)._findParamDragCandidate()).toBeNull()
    calc.destroy()
    container.remove()
  })

  it('_solveParam clamps via Newton converges within 5 iters for y=a*sin(x)', async () => {
    const { calc, container } = await makeEngine()
    calc.setState({
      expressions: [{ id: 'e1', src: 'y = a*sin(x)', color: '#abc', hidden: false }],
      params: { a: { value: 1, min: -10, max: 10, step: 0.1 } },
      viewport: { cx: 0, cy: 0, scale: 38 },
    })
    const ast = (calc as any).expressions[0].classified.ast
    // sin(π/2) = 1, target y=3 → a should be 3
    const a = (calc as any)._solveParam(ast, 'a', Math.PI / 2, 3, 1)
    expect(a).toBeCloseTo(3, 2)
    calc.destroy()
    container.remove()
  })
})

describe('Engine intersections cache + dedup (Phase G3 review)', () => {
  it('caches intersections by signature (no recompute on same scene)', async () => {
    const { calc, container } = await makeEngine()
    calc.setState({
      expressions: [
        { id: 'e1', src: 'y = x', color: '#abc', hidden: false },
        { id: 'e2', src: 'y = -x', color: '#bcd', hidden: false },
      ],
      params: {},
      viewport: { cx: 0, cy: 0, scale: 38 },
    })
    const env = (calc as any)._buildEnv()
    const sig1 = (calc as any)._intersectionsSignature(env)
    const sig2 = (calc as any)._intersectionsSignature(env)
    expect(sig1).toBe(sig2)  // same signature for unchanged scene
    calc.destroy()
    container.remove()
  })

  it('signature CHANGES коли params change', async () => {
    const { calc, container } = await makeEngine()
    calc.setState({
      expressions: [
        { id: 'e1', src: 'y = a*x', color: '#abc', hidden: false },
        { id: 'e2', src: 'y = -x', color: '#bcd', hidden: false },
      ],
      params: { a: { value: 1, min: -10, max: 10, step: 0.1 } },
      viewport: { cx: 0, cy: 0, scale: 38 },
    })
    const env1 = (calc as any)._buildEnv()
    const sig1 = (calc as any)._intersectionsSignature(env1)
    // Change param a value
    ;(calc as any).params.a.value = 2
    const env2 = (calc as any)._buildEnv()
    const sig2 = (calc as any)._intersectionsSignature(env2)
    expect(sig1).not.toBe(sig2)
    calc.destroy()
    container.remove()
  })

  it('root dedup: epsilon=1e-3 prevents duplicates near boundary', async () => {
    const { calc, container } = await makeEngine()
    calc.setState({
      expressions: [
        { id: 'e1', src: 'y = x^2', color: '#abc', hidden: false },
        { id: 'e2', src: 'y = 0', color: '#bcd', hidden: false },
      ],
      params: {},
      viewport: { cx: 0, cy: 0, scale: 38 },
    })
    const env = (calc as any)._buildEnv()
    const roots = (calc as any)._computeIntersections(env)
    // y=x^2 ∩ y=0 has ONE root at x=0 (tangent). Dedup epsilon should prevent
    // boundary-scan from yielding multiple near-zero roots.
    const xs = roots.map((r: any) => r.x).filter((x: number) => Math.abs(x) < 0.5)
    // At most 1-2 roots near 0 (allow some leeway for numeric scan)
    expect(xs.length).toBeLessThanOrEqual(2)
    calc.destroy()
    container.remove()
  })
})

describe('Engine intersections (Phase G3 derived render)', () => {
  it('finds intersection of y=x and y=-x at (0, 0)', async () => {
    const { calc, container } = await makeEngine()
    calc.setState({
      expressions: [
        { id: 'e1', src: 'y = x', color: '#abc', hidden: false },
        { id: 'e2', src: 'y = -x', color: '#bcd', hidden: false },
      ],
      params: {},
      viewport: { cx: 0, cy: 0, scale: 38 },
    })
    // _bisectIntersection accessible
    const ast1 = (calc as any).expressions[0].classified.ast
    const ast2 = (calc as any).expressions[1].classified.ast
    const env = (calc as any)._buildEnv()
    // Lazy import evalAst через GraphCalc namespace
    const { GraphCalc } = await import('../vendor/graph_calculator/graph-calculator.js')
    const f = (x: number) => (GraphCalc as any).evalAst(ast1, { ...env, x })
    const g = (x: number) => (GraphCalc as any).evalAst(ast2, { ...env, x })
    const root = (calc as any)._bisectIntersection(f, g, -1, 1)
    expect(root).toBeCloseTo(0, 4)
    calc.destroy()
    container.remove()
  })

  it('bisection: y=x^2-4 finds root at x=2', async () => {
    const { calc, container } = await makeEngine()
    calc.setState({
      expressions: [
        { id: 'e1', src: 'y = x^2', color: '#abc', hidden: false },
        { id: 'e2', src: 'y = 4', color: '#bcd', hidden: false },
      ],
      params: {},
      viewport: { cx: 0, cy: 0, scale: 38 },
    })
    const ast1 = (calc as any).expressions[0].classified.ast
    const ast2 = (calc as any).expressions[1].classified.ast
    const env = (calc as any)._buildEnv()
    const { GraphCalc } = await import('../vendor/graph_calculator/graph-calculator.js')
    const f = (x: number) => (GraphCalc as any).evalAst(ast1, { ...env, x })
    const g = (x: number) => (GraphCalc as any).evalAst(ast2, { ...env, x })
    // Roots are at x=2 and x=-2; test x>0 range
    const root = (calc as any)._bisectIntersection(f, g, 1, 3)
    expect(root).toBeCloseTo(2, 4)
    calc.destroy()
    container.remove()
  })
})

describe('Engine classify with HARD SPEC params={value,min,max,step}', () => {
  it('classifies y=a*x as explicitY коли params.a={value:1,...}', async () => {
    const { GraphCalculator } = await import('../vendor/graph_calculator/graph-calculator.js')
    const container = document.createElement('div')
    Object.defineProperty(container, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 600, height: 400, x: 0, y: 0 }),
    })
    document.body.appendChild(container)
    const calc = new GraphCalculator(container, { disableAnimation: true })
    calc.setState({
      expressions: [{ id: 'e1', src: 'y = a*x', color: '#abc', hidden: false }],
      params: { a: { value: 1, min: -10, max: 10, step: 0.1 } },
      viewport: { cx: 0, cy: 0, scale: 38 },
    })
    const expr = calc.expressions.find((e: any) => e.id === 'e1')
    expect(expr.classified.kind).toBe('explicitY')
    calc.destroy()
    container.remove()
  })

  it('extracts value from {value,...} structure for env', async () => {
    const { GraphCalculator } = await import('../vendor/graph_calculator/graph-calculator.js')
    const container = document.createElement('div')
    Object.defineProperty(container, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 600, height: 400, x: 0, y: 0 }),
    })
    document.body.appendChild(container)
    const calc = new GraphCalculator(container, { disableAnimation: true })
    calc.setState({
      expressions: [{ id: 'e1', src: 'y = a*x', color: '#abc', hidden: false }],
      params: { a: { value: 5, min: -10, max: 10, step: 0.1 } },
      viewport: { cx: 0, cy: 0, scale: 38 },
    })
    // engine internal: this.params['a'].value === 5
    expect(calc.params.a.value).toBe(5)
    calc.destroy()
    container.remove()
  })
})

// ─── Store actions: graphSyncParams ─────────────────────────────────────

function makeGraphAsset(id = 'gc-1', params: Record<string, any> = {}): WBAsset {
  return {
    id, type: 'graph_calculator', src: '',
    x: 0, y: 0, w: 480, h: 360, rotation: 0, locked: false,
    data: {
      version: 1,
      state: { expressions: [], params, viewport: { cx: 0, cy: 0, scale: 38 } },
    } as any,
  } as unknown as WBAsset
}

function setupStore(asset: WBAsset, mode: 'edit' | 'replay' = 'edit') {
  const store = useWBStore()
  store.pages = [{ id: 'p1', name: 'P', strokes: [], shapes: [], texts: [], assets: [asset] } as any]
  store.currentPageIndex = 0
  ;(store as any).mode = mode
  return store
}

describe('boardStore.graphSyncParams (HARD SPEC §3 sync algorithm)', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('CASE-1 (DoD): y=a*x → param "a" з default {value:1, min:-10, max:10, step:0.1}', () => {
    const store = setupStore(makeGraphAsset())
    store.graphSyncParams('gc-1', ['a'])
    flushPendingUpdates()
    const params = (store.pages[0].assets[0].data as any).state.params
    expect(params).toEqual({ a: { value: 1, min: -10, max: 10, step: 0.1 } })
  })

  it('CASE-2 (DoD): y=x → params={} (всі removed)', () => {
    const start = makeGraphAsset('gc-1', { a: { value: 5, min: -1, max: 1, step: 0.01 } })
    const store = setupStore(start)
    store.graphSyncParams('gc-1', [])
    flushPendingUpdates()
    expect((store.pages[0].assets[0].data as any).state.params).toEqual({})
  })

  it('CASE-3 (DoD): y=a*x + b → sliders {a, b}', () => {
    const store = setupStore(makeGraphAsset())
    store.graphSyncParams('gc-1', ['a', 'b'])
    flushPendingUpdates()
    const params = (store.pages[0].assets[0].data as any).state.params
    expect(Object.keys(params).sort()).toEqual(['a', 'b'])
    expect(params.a.value).toBe(1)
    expect(params.b.value).toBe(1)
  })

  it('CASE-4 (DoD): value PRESERVED через edit іншої expression', () => {
    const start = makeGraphAsset('gc-1', { a: { value: 7.5, min: -10, max: 10, step: 0.1 } })
    const store = setupStore(start)
    // User edits expression to add 'b' — sync includes both
    store.graphSyncParams('gc-1', ['a', 'b'])
    flushPendingUpdates()
    const params = (store.pages[0].assets[0].data as any).state.params
    expect(params.a.value).toBe(7.5) // preserved!
    expect(params.b.value).toBe(1)   // new with default
  })

  it('CASE-5 (DoD): range PRESERVED через sync', () => {
    const start = makeGraphAsset('gc-1', { a: { value: 3, min: -100, max: 100, step: 5 } })
    const store = setupStore(start)
    store.graphSyncParams('gc-1', ['a', 'b'])
    flushPendingUpdates()
    const params = (store.pages[0].assets[0].data as any).state.params
    expect(params.a).toEqual({ value: 3, min: -100, max: 100, step: 5 }) // preserved
  })

  it('FULL REPLACE (HARD SPEC INV-2): drop unused, no merge', () => {
    const start = makeGraphAsset('gc-1', {
      a: { value: 5, min: -1, max: 1, step: 0.01 },
      b: { value: 9, min: -1, max: 1, step: 0.01 },
    })
    const store = setupStore(start)
    store.graphSyncParams('gc-1', ['a'])  // 'b' must drop
    flushPendingUpdates()
    expect((store.pages[0].assets[0].data as any).state.params).toEqual({
      a: { value: 5, min: -1, max: 1, step: 0.01 },
    })
  })

  it('no-op if state already in sync', () => {
    const start = makeGraphAsset('gc-1', { a: { value: 1, min: -10, max: 10, step: 0.1 } })
    const store = setupStore(start)
    const ops: any[] = []
    store.onOperation((op: any) => ops.push(op))
    store.graphSyncParams('gc-1', ['a'])
    flushPendingUpdates()
    expect(ops.length).toBe(0)
  })

  it('emits asset_update on changes', () => {
    const store = setupStore(makeGraphAsset())
    const ops: any[] = []
    store.onOperation((op: any) => ops.push(op))
    store.graphSyncParams('gc-1', ['a'])
    flushPendingUpdates()
    expect(ops.filter((o) => o.op_type === 'asset_update').length).toBe(1)
  })
})

// ─── Store actions: graphParamSet (HARD SPEC value-only) ────────────────

describe('boardStore.graphParamSet (HARD SPEC: ONLY .value)', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('mutates ONLY params[name].value', () => {
    const start = makeGraphAsset('gc-1', { a: { value: 1, min: -100, max: 100, step: 5 } })
    const store = setupStore(start)
    store.graphParamSet('gc-1', 'a', 7.5)
    flushPendingUpdates()
    const params = (store.pages[0].assets[0].data as any).state.params
    expect(params.a.value).toBe(7.5)
    // Range must be preserved
    expect(params.a.min).toBe(-100)
    expect(params.a.max).toBe(100)
    expect(params.a.step).toBe(5)
  })

  it('emits graph_param_set op (granular per HARD SPEC §5)', () => {
    const start = makeGraphAsset('gc-1', { a: { value: 1, min: -10, max: 10, step: 0.1 } })
    ;(start.data as any).meta = { last_snapshot_seq: 42 }
    const store = setupStore(start)
    const ops: any[] = []
    store.onOperation((op: any) => ops.push(op))
    store.graphParamSet('gc-1', 'a', 3)
    flushPendingUpdates()
    const psets = ops.filter((o) => o.op_type === 'graph_param_set')
    expect(psets.length).toBe(1)
    expect(psets[0].payload).toMatchObject({
      asset_id: 'gc-1', name: 'a', value: 3, base_seq: 42,
    })
  })

  it('replay path: defensive-create entry якщо missing', () => {
    const store = setupStore(makeGraphAsset())
    store.graphParamSet('gc-1', 'a', 5, { skipEmit: true })
    const params = (store.pages[0].assets[0].data as any).state.params
    expect(params.a).toEqual({ value: 5, min: -10, max: 10, step: 0.1 })
  })
})

// ─── Store actions: graphSetParamRange ──────────────────────────────────

describe('boardStore.graphSetParamRange (HARD SPEC: range_set is snapshot)', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('updates min/max/step + preserves .value', () => {
    const start = makeGraphAsset('gc-1', { a: { value: 7.5, min: -10, max: 10, step: 0.1 } })
    const store = setupStore(start)
    store.graphSetParamRange('gc-1', 'a', { min: -50, max: 50, step: 1 })
    flushPendingUpdates()
    expect((store.pages[0].assets[0].data as any).state.params.a)
      .toEqual({ value: 7.5, min: -50, max: 50, step: 1 })
  })

  it('clamps value if outside new range', () => {
    const start = makeGraphAsset('gc-1', { a: { value: 50, min: -100, max: 100, step: 1 } })
    const store = setupStore(start)
    store.graphSetParamRange('gc-1', 'a', { min: 0, max: 10, step: 0.1 })
    flushPendingUpdates()
    const a = (store.pages[0].assets[0].data as any).state.params.a
    expect(a.value).toBe(10) // clamped to new max
    expect(a.min).toBe(0)
    expect(a.max).toBe(10)
  })

  it('rejects min >= max / step <= 0 / non-finite', () => {
    const start = makeGraphAsset('gc-1', { a: { value: 1, min: -10, max: 10, step: 0.1 } })
    const store = setupStore(start)
    store.graphSetParamRange('gc-1', 'a', { min: 5, max: 3, step: 1 })
    store.graphSetParamRange('gc-1', 'a', { min: -1, max: 1, step: 0 })
    store.graphSetParamRange('gc-1', 'a', { min: NaN, max: 1, step: 0.1 })
    flushPendingUpdates()
    expect((store.pages[0].assets[0].data as any).state.params.a)
      .toEqual({ value: 1, min: -10, max: 10, step: 0.1 }) // unchanged
  })

  it('skips якщо param does not exist', () => {
    const store = setupStore(makeGraphAsset())
    store.graphSetParamRange('gc-1', 'b', { min: -1, max: 1, step: 0.01 })
    flushPendingUpdates()
    expect((store.pages[0].assets[0].data as any).state.params).toEqual({})
  })

  it('emits asset_update snapshot (HARD SPEC: range = snapshot trigger)', () => {
    const start = makeGraphAsset('gc-1', { a: { value: 1, min: -10, max: 10, step: 0.1 } })
    const store = setupStore(start)
    const ops: any[] = []
    store.onOperation((op: any) => ops.push(op))
    store.graphSetParamRange('gc-1', 'a', { min: -1, max: 1, step: 0.01 })
    flushPendingUpdates()
    expect(ops.filter((o) => o.op_type === 'asset_update').length).toBe(1)
  })
})

// ─── Bare expression → explicitY (classify, 2026-07-15) ─────────────────
// Голий вираз без '=' (`x^2`) класифікується як y = <вираз> (Desmos-style).
// src НЕ переписується — класифікація derived, replay-детермінована.
describe('GraphCalc.classify — bare expression as y = f(x)', () => {
  it('x^2 → explicitY (крива малюється без явного y=)', () => {
    const r = GraphCalc.classify('x^2', [])
    expect(r.kind).toBe('explicitY')
    expect(r.src).toBe('x^2') // src користувача не переписано
  })

  it('sin(x), 2x+1, константа → explicitY', () => {
    expect(GraphCalc.classify('sin(x)', []).kind).toBe('explicitY')
    expect(GraphCalc.classify('2x + 1', []).kind).toBe('explicitY')
    expect(GraphCalc.classify('5', []).kind).toBe('explicitY') // горизонтальна лінія
  })

  it('bare-вираз еквівалентний y = <вираз> при обчисленні', () => {
    const bare = GraphCalc.classify('x^2 + 1', [])
    const eq = GraphCalc.classify('y = x^2 + 1', [])
    expect(bare.kind).toBe('explicitY')
    expect(eq.kind).toBe('explicitY')
    for (const x of [-2, 0, 3.5]) {
      expect(GraphCalc.evalAst(bare.ast, { x })).toBe(GraphCalc.evalAst(eq.ast, { x }))
    }
  })

  it('невідомий ідентифікатор → needsParam (шлях слайдера)', () => {
    const r = GraphCalc.classify('a*x^2', [])
    expect(r.kind).toBe('needsParam')
    expect(r.unknown).toEqual(['a'])
    // з відомим параметром → explicitY
    expect(GraphCalc.classify('a*x^2', ['a']).kind).toBe('explicitY')
  })

  it('вираз із y без "=" лишається invalid (немає що розвʼязувати)', () => {
    expect(GraphCalc.classify('y^2', []).kind).toBe('invalid')
    expect(GraphCalc.classify('x^2 + y^2', []).kind).toBe('invalid')
  })

  it('регрес: рівняння/точки класифікуються як раніше', () => {
    expect(GraphCalc.classify('y = x^2', []).kind).toBe('explicitY')
    expect(GraphCalc.classify('x = y^2', []).kind).toBe('explicitX')
    expect(GraphCalc.classify('a = 3', []).kind).toBe('param')
    expect(GraphCalc.classify('(x)^2 + (y)^2 = 4', []).kind).toBe('implicit')
    expect(GraphCalc.classify('(1, 2)', []).kind).toBe('point')
    expect(GraphCalc.classify('x^^2', []).kind).toBe('invalid') // парсер-помилка
  })
})

// ── Shift+drag для НЕЯВНИХ кривих (2026-08-16) ────────────────────────────────
//
// Регресія, і вона моя: після того, як Інтегралик перестав розбивати рівняння на
// функції (07e2c1f), коло й парабола на дошці власника стали неявними
// (`(x-1)^2+y^2=9`, `y+(x-1)^2=a+3`), а `_findParamDragCandidate` брав ЛИШЕ
// `explicitY` → кандидатів нуль → Shift+drag мовчки ставав паном.
// «Недавно працювало» — бо недавно вирази були явні.
describe('Engine drag-param: implicit curves (2026-08-16)', () => {
  const OWNER_BOARD = {
    // Дослівно з дошки власника.
    expressions: [
      { id: 'circle',   src: '(x-1)^2 + y^2 = 9',    color: '#e11', hidden: false },
      { id: 'parabola', src: 'y + (x-1)^2 = a + 3',  color: '#11e', hidden: false },
    ],
    params: { a: { value: -2, min: -10, max: 10, step: 0.1 } },
    viewport: { cx: 0, cy: 0, scale: 38 },
  }

  it('живий кейс власника: параболу-неявну знаходить як кандидата (раніше — null)', async () => {
    const { calc, container } = await makeEngine()
    calc.setState(OWNER_BOARD)
    // Вершина параболи при a=-2: y = a+3-(x-1)^2 → (1; 1). Курсор поруч.
    const c = (calc as any)._findParamDragCandidate(1, 1)
    expect(c, 'кандидата немає — регресія на місці').not.toBeNull()
    expect(c.exprId).toBe('parabola')          // коло без параметра — не кандидат
    expect(typeof c.residual).toBe('function')
    calc.destroy(); container.remove()
  })

  it('коло без параметра ніколи не стає кандидатом', async () => {
    const { calc, container } = await makeEngine()
    calc.setState(OWNER_BOARD)
    // Курсор точно на колі, далеко від параболи: (4; 0) лежить на (x-1)^2+y^2=9
    const c = (calc as any)._findParamDragCandidate(4, 0)
    expect(c === null || c.exprId !== 'circle').toBe(true)
    calc.destroy(); container.remove()
  })

  it('_solveParam на неявній нев\'язці: тягнемо вершину параболи вгору → a росте', async () => {
    const { calc, container } = await makeEngine()
    calc.setState(OWNER_BOARD)
    const c = (calc as any)._findParamDragCandidate(1, 1)
    // Хочемо, щоб крива пройшла через (1; 3): y+(x-1)^2 = a+3 → 3 = a+3 → a = 0
    const a = (calc as any)._solveParam(c.residual, 'a', 1, 3, -2, 5, { explicit: false })
    expect(a).toBeCloseTo(0, 3)
    calc.destroy(); container.remove()
  })

  it('неявна крива при x=0 розв\'язується (dp_inv_1 — лише для явних)', async () => {
    const { calc, container } = await makeEngine()
    calc.setState(OWNER_BOARD)
    const c = (calc as any)._findParamDragCandidate(1, 1)
    // (0; y): y + 1 = a + 3 → при y=2: a=0. Для явних x=0 давав би NaN.
    const a = (calc as any)._solveParam(c.residual, 'a', 0, 2, -2, 5, { explicit: false })
    expect(a).toBeCloseTo(0, 3)
    calc.destroy(); container.remove()
  })

  it('явна крива через нев\'язку кандидата зберігає dp_inv_1 (x≈0 → NaN)', async () => {
    const { calc, container } = await makeEngine()
    calc.setState({
      expressions: [{ id: 'e1', src: 'y = a*x', color: '#abc', hidden: false }],
      params: { a: { value: 1, min: -10, max: 10, step: 0.1 } },
      viewport: { cx: 0, cy: 0, scale: 38 },
    })
    const c = (calc as any)._findParamDragCandidate(2, 2)
    expect(c).not.toBeNull()
    expect((calc as any)._solveParam(c.residual, 'a', 0, 4, 1, 5, { explicit: !!c.yAt })).toBeNaN()
    calc.destroy(); container.remove()
  })

  it('activation-зона діє і для неявних: курсор далеко від кривої → null', async () => {
    const { calc, container } = await makeEngine()
    calc.setState(OWNER_BOARD)
    // (1; -8) — за 9 math-одиниць від вершини (1;1) → ~340px при scale 38
    expect((calc as any)._findParamDragCandidate(1, -8)).toBeNull()
    calc.destroy(); container.remove()
  })

  it('старий контракт _solveParam(ast, …) для явних досі працює', async () => {
    const { calc, container } = await makeEngine()
    calc.setState({
      expressions: [{ id: 'e1', src: 'y = a*x', color: '#abc', hidden: false }],
      params: { a: { value: 1, min: -10, max: 10, step: 0.1 } },
      viewport: { cx: 0, cy: 0, scale: 38 },
    })
    const ast = (calc as any).expressions[0].classified.ast
    expect((calc as any)._solveParam(ast, 'a', 2, 4, 1)).toBeCloseTo(2, 3)
    calc.destroy(); container.remove()
  })
})

// ── Shift+drag при ДВОХ і більше параметрах (2026-08-16) ──────────────────────
//
// Живий прогін власника: «працює, але коли два і більше параметрів — ні».
// Стояло `if (params.length !== 1) return null` — запобіжник від двозначності,
// який гасив і всі ОДНОЗНАЧНІ випадки. Однозначність вирішує КРИВА, не
// лічильник повзунків.
describe('Engine drag-param: several params on the board (2026-08-16)', () => {
  const OWNER_TWO_PARAMS = {
    // Дослівно з дошки власника: коло без параметра, парабола лише від a,
    // на панелі ще й b (від іншого виразу або лишився).
    expressions: [
      { id: 'circle',   src: '(x-1)^2 + y^2 = 9',    color: '#e11', hidden: false },
      { id: 'parabola', src: 'y + (x-1)^2 = a + 3',  color: '#11e', hidden: false },
    ],
    params: {
      a: { value: -1, min: -10, max: 10, step: 0.1 },
      b: { value: 5.1, min: -10, max: 10, step: 0.1 },
    },
    viewport: { cx: 0, cy: 0, scale: 38 },
  }

  it('живий кейс: два повзунки, парабола від одного → тягнеться (раніше null)', async () => {
    const { calc, container } = await makeEngine()
    calc.setState(OWNER_TWO_PARAMS)
    // Вершина при a=-1: (1; 2). Курсор поруч.
    const c = (calc as any)._findParamDragCandidate(1, 2)
    expect(c, 'два повзунки на дошці глушили однозначну криву').not.toBeNull()
    expect(c.exprId).toBe('parabola')
    expect(c.paramName).toBe('a')          // саме той параметр, від якого залежить крива
    calc.destroy(); container.remove()
  })

  it('дві криві з РІЗНИМИ параметрами — кожна тягне свій', async () => {
    const { calc, container } = await makeEngine()
    calc.setState({
      expressions: [
        { id: 'p1', src: 'y = a*x^2', color: '#e11', hidden: false },   // від a
        { id: 'p2', src: 'y = b*x',   color: '#11e', hidden: false },   // від b
      ],
      params: {
        a: { value: 1, min: -10, max: 10, step: 0.1 },
        b: { value: -1, min: -10, max: 10, step: 0.1 },
      },
      viewport: { cx: 0, cy: 0, scale: 38 },
    })
    // (2; 4) — на параболі y=x^2, далеко від прямої y=-x (там y=-2)
    const near1 = (calc as any)._findParamDragCandidate(2, 4)
    expect(near1?.exprId).toBe('p1'); expect(near1?.paramName).toBe('a')
    // (2; -2) — на прямій y=-x, далеко від параболи (там y=4)
    const near2 = (calc as any)._findParamDragCandidate(2, -2)
    expect(near2?.exprId).toBe('p2'); expect(near2?.paramName).toBe('b')
    calc.destroy(); container.remove()
  })

  it('крива від ДВОХ параметрів (y = a*x + b) — кандидатом не стає: двозначність справжня', async () => {
    const { calc, container } = await makeEngine()
    calc.setState({
      expressions: [{ id: 'line', src: 'y = a*x + b', color: '#e11', hidden: false }],
      params: {
        a: { value: 1, min: -10, max: 10, step: 0.1 },
        b: { value: 0, min: -10, max: 10, step: 0.1 },
      },
      viewport: { cx: 0, cy: 0, scale: 38 },
    })
    expect((calc as any)._findParamDragCandidate(2, 2)).toBeNull()
    calc.destroy(); container.remove()
  })

  it('без жодного параметра — null, як і було', async () => {
    const { calc, container } = await makeEngine()
    calc.setState({
      expressions: [{ id: 'c', src: 'x^2 + y^2 = 4', color: '#e11', hidden: false }],
      params: {},
      viewport: { cx: 0, cy: 0, scale: 38 },
    })
    expect((calc as any)._findParamDragCandidate(2, 0)).toBeNull()
    calc.destroy(); container.remove()
  })
})

// ── Перетини пар із НЕЯВНОЮ кривою (2026-08-16) ───────────────────────────────
//
// Живий прогін власника: після 07e2c1f коло й парабола на дошці стали
// неявними — і маркери перетину ЗНИКЛИ, хоча задача («система має єдиний
// розв'язок») — рівно про точку дотику. 1D-скан по x для таких пар не
// годиться (у кола дві y на кожен x) → 2D-сітка + Ньютон 2×2, а для дотику
// (вироджений якобіан) — крок Гауса–Ньютона з регуляризацією.
describe('Engine intersections: implicit pairs (2026-08-16)', () => {
  const board = (a: number) => ({
    expressions: [
      { id: 'circle',   src: '(x-1)^2 + y^2 = 9',    color: '#e11', hidden: false },
      { id: 'parabola', src: 'y + (x-1)^2 = a + 3',  color: '#11e', hidden: false },
    ],
    params: { a: { value: a, min: -10, max: 10, step: 0.1 } },
    // scale=18: у jsdom канва 300×150 → видиме y ∈ [−4.2; 4.2] — коло радіуса 3
    // з центром (1;0) влазить ЦІЛКОМ. При scale=38 видиме y ∈ [−1.97; 1.97], і
    // перетини (y≈−2.37) та дотик (1;−3) були б ПОЗА екраном — рушій їх чесно
    // не рахує (як і для явних: поза вьюпортом маркерів немає). Перший прогін
    // цього тесту впав саме через це, а не через алгоритм.
    viewport: { cx: 1, cy: 0, scale: 18 },
  })
  const pts = (calc: any) => calc._computeIntersections(calc._buildEnv()) as Array<{x:number;y:number}>
  const onBoth = (p: {x:number;y:number}, a: number) =>
    Math.abs((p.x-1)**2 + p.y**2 - 9) < 1e-3 && Math.abs(p.y + (p.x-1)**2 - (a+3)) < 1e-3

  it('живий кейс власника, a=-2: два перетини, обидва лежать на ОБОХ кривих', async () => {
    const { calc, container } = await makeEngine()
    calc.setState(board(-2))
    const p = pts(calc)
    expect(p.length, 'перетинів неявних кривих не знайдено — регресія на місці').toBe(2)
    for (const q of p) expect(onBoth(q, -2), JSON.stringify(q)).toBe(true)
    // симетричні відносно x=1
    expect(Math.abs((p[0].x - 1) + (p[1].x - 1))).toBeLessThan(1e-3)
    calc.destroy(); container.remove()
  })

  it('a=-6: ДОТИК — рівно одна точка (1; -3), суть задачі', async () => {
    const { calc, container } = await makeEngine()
    calc.setState(board(-6))
    const p = pts(calc)
    expect(p.length, 'дотик не знайдено — вироджений якобіан без фолбека').toBeGreaterThanOrEqual(1)
    // Усі знайдені — це одна й та сама точка дотику (дедуп міг лишити 1–2 сусідні).
    for (const q of p) {
      expect(q.x).toBeCloseTo(1, 1)
      expect(q.y).toBeCloseTo(-3, 1)
    }
    calc.destroy(); container.remove()
  })

  it('a=-7: кривих не торкаються — нуль перетинів (немає фальшивих коренів)', async () => {
    const { calc, container } = await makeEngine()
    calc.setState(board(-7))
    expect(pts(calc)).toEqual([])
    calc.destroy(); container.remove()
  })

  it('явна + неявна: y=x і коло x^2+y^2=2 → (1;1) і (-1;-1)', async () => {
    const { calc, container } = await makeEngine()
    calc.setState({
      expressions: [
        { id: 'l', src: 'y = x',          color: '#e11', hidden: false },
        { id: 'c', src: 'x^2 + y^2 = 2',  color: '#11e', hidden: false },
      ],
      params: {},
      viewport: { cx: 0, cy: 0, scale: 38 },
    })
    const p = pts(calc).sort((u, v) => u.x - v.x)
    expect(p.length).toBe(2)
    expect(p[0].x).toBeCloseTo(-1, 2); expect(p[0].y).toBeCloseTo(-1, 2)
    expect(p[1].x).toBeCloseTo(1, 2);  expect(p[1].y).toBeCloseTo(1, 2)
    calc.destroy(); container.remove()
  })

  it('явна+явна пара досі йде старим 1D-шляхом і не дублюється 2D-шляхом', async () => {
    const { calc, container } = await makeEngine()
    calc.setState({
      expressions: [
        { id: 'a', src: 'y = x^2', color: '#e11', hidden: false },
        { id: 'b', src: 'y = 1',   color: '#11e', hidden: false },
      ],
      params: {},
      viewport: { cx: 0, cy: 0, scale: 38 },
    })
    const p = pts(calc)
    expect(p.length).toBe(2)     // (-1;1) і (1;1) — рівно два, без дублів від 2D
    calc.destroy(); container.remove()
  })

  it('кеш-підпис бачить неявні криві і y-діапазон', async () => {
    const { calc, container } = await makeEngine()
    calc.setState(board(-2))
    const s1 = (calc as any)._intersectionsSignature((calc as any)._buildEnv())
    expect(s1).toContain('circle')          // неявна крива в підписі
    ;(calc as any).viewport.cy += 5          // вертикальний пан
    const s2 = (calc as any)._intersectionsSignature((calc as any)._buildEnv())
    expect(s2).not.toBe(s1)                 // інакше маркери лишались би старі
    calc.destroy(); container.remove()
  })
})

// ── Точки onCurve + snap на НЕЯВНИХ кривих (2026-08-16) ───────────────────────
//
// Правило власника: «точка тримається гілки, не стрибає». Один x не визначає
// точку на колі (дві гілки), тому для неявних стейт несе опорну (x, y), а
// рушій ПРОЄКТУЄ її на криву; проєкція стартує з опорної точки → найближча
// гілка → перескочити можна лише фізично перетягнувши курсор через край.
describe('Engine onCurve/snap: implicit curves (2026-08-16)', () => {
  const CIRCLE = {
    expressions: [{ id: 'c', src: '(x-1)^2 + y^2 = 9', color: '#e11', hidden: false }],
    params: {},
    viewport: { cx: 1, cy: 0, scale: 18 },
  }
  const onCircle = (p: {x:number;y:number}) => Math.abs((p.x-1)**2 + p.y**2 - 9) < 1e-4

  it('_projectToCurve: точка над колом → верхня дуга; під колом → нижня (гілка за старту)', async () => {
    const { calc, container } = await makeEngine()
    calc.setState(CIRCLE)
    const e = (calc as any).expressions[0]
    const up = (calc as any)._projectToCurve(e, 1, 5)     // старт вище кола
    const dn = (calc as any)._projectToCurve(e, 1, -5)    // старт нижче
    expect(up && onCircle(up)).toBe(true); expect(up.y).toBeCloseTo(3, 4)
    expect(dn && onCircle(dn)).toBe(true); expect(dn.y).toBeCloseTo(-3, 4)
    calc.destroy(); container.remove()
  })

  it('«тримається гілки»: старт трохи вище центру → верх, трохи нижче → низ', async () => {
    const { calc, container } = await makeEngine()
    calc.setState(CIRCLE)
    const e = (calc as any).expressions[0]
    // Обидва старти на x=1, майже в центрі — різняться лише знаком y.
    expect((calc as any)._projectToCurve(e, 1, 0.3).y).toBeGreaterThan(0)
    expect((calc as any)._projectToCurve(e, 1, -0.3).y).toBeLessThan(0)
    calc.destroy(); container.remove()
  })

  it('«той самий кут» при рості кола: точка на 2 годинах лишається на 2 годинах', async () => {
    const { calc, container } = await makeEngine()
    calc.setState({
      expressions: [{ id: 'c', src: '(x-1)^2 + y^2 = r^2', color: '#e11', hidden: false }],
      params: { r: { value: 3, min: 0.5, max: 10, step: 0.1 } },
      viewport: { cx: 1, cy: 0, scale: 18 },
    })
    const e = (calc as any).expressions[0]
    // Точка на колі r=3 під кутом 60° від центру (1;0): (1+1.5; 2.598)
    const p0 = { x: 1 + 3 * Math.cos(Math.PI / 3), y: 3 * Math.sin(Math.PI / 3) }
    // Коло виросло до r=5 — куди проєктується та сама опорна точка?
    const env5 = { ...(calc as any)._buildEnv(), r: 5 }
    const p5 = (calc as any)._projectToCurve(e, p0.x, p0.y, env5)
    const angle = Math.atan2(p5.y, p5.x - 1)
    expect(angle).toBeCloseTo(Math.PI / 3, 3)                       // той самий кут
    expect(Math.hypot(p5.x - 1, p5.y)).toBeCloseTo(5, 3)             // на новому колі
    calc.destroy(); container.remove()
  })

  it('_snapToCurve магнітить до кола (раніше — ігнорувало неявні)', async () => {
    const { calc, container } = await makeEngine()
    calc.setState(CIRCLE)
    // Курсор трохи ззовні верхньої дуги: (1; 3.2) — 0.2 math ≈ 3.6px при scale 18
    const s = (calc as any)._snapToCurve(1, 3.2)
    expect(s, 'коло не магнітить').not.toBeNull()
    expect(s.curveId).toBe('c')
    expect(s.y).toBeGreaterThan(2.9)          // притягнуло до ВЕРХНЬОЇ дуги
    calc.destroy(); container.remove()
  })

  it('_pointPosition: onCurve-точка на колі рендериться на кривій, а не на опорі', async () => {
    const { calc, container } = await makeEngine()
    calc.setState(CIRCLE)
    const env = (calc as any)._buildEnv()
    // Опорна точка трохи ЗЗОВНІ кола (як після округлень) — позиція мусить лягти НА коло
    const pos = (calc as any)._pointPosition({ x: 1, y: 3.4, mode: 'onCurve', curveExprId: 'c' }, env)
    expect(pos && onCircle(pos)).toBe(true)
    expect(pos.y).toBeCloseTo(3, 4)
    calc.destroy(); container.remove()
  })

  it('_pointPosition: рендер і hit-test дивляться в одне місце', async () => {
    const { calc, container } = await makeEngine()
    calc.setState(CIRCLE)
    ;(calc as any).points = { P: { x: 1, y: 3.4, mode: 'onCurve', curveExprId: 'c' } }
    const env = (calc as any)._buildEnv()
    const pos = (calc as any)._pointPosition((calc as any).points.P, env)
    const px = (calc as any)._mathToPx(pos.x, pos.y)
    // Клік рівно туди, де точка НАМАЛЬОВАНА → має влучити
    expect((calc as any)._hitTestPoint(px.x, px.y)).toBe('P')
    calc.destroy(); container.remove()
  })

  it('явна крива onCurve — без змін: y виводиться з x, стейт y не потрібен', async () => {
    const { calc, container } = await makeEngine()
    calc.setState({
      expressions: [{ id: 'p', src: 'y = x^2', color: '#e11', hidden: false }],
      params: {}, viewport: { cx: 0, cy: 0, scale: 38 },
    })
    const env = (calc as any)._buildEnv()
    const pos = (calc as any)._pointPosition({ x: 2, mode: 'onCurve', curveExprId: 'p' }, env)
    expect(pos).toEqual({ x: 2, y: 4 })
    calc.destroy(); container.remove()
  })
})
