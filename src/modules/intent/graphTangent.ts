/**
 * Дотична й перевірка виразу — тим самим рушієм, що малює графік.
 *
 * Власник 2026-09-25. Інтегралик поклав у графік `(2*x-2)'(2)*(x-2)+(2^2-2*2)`:
 * штрих похідної рушій не знає, крива не намалювалась, а в чаті стояло
 * «✓ Додаю криву». Звідси два правила, обидва — через рушій, не через словник:
 *
 *  1. `engineRejects` — перш ніж писати вираз у графік, питаємо САМ рушій, чи
 *     він його розуміє. Не розуміє — не пишемо й чесно кажемо чому.
 *  2. `tangentLine` — дотичну рахує дошка, а не модель: модель лише називає
 *     криву й точку. Похідна — центральна різниця з тим самим кроком, що в
 *     картці похідної (`vendor/calculus`), тож дві дотичні на дошці збігаються.
 */
import { GraphCalc } from '@/modules/winterboard/vendor/graph_calculator/graph-calculator.js'
import { GRAPH_RESERVED_TOKENS, extractParamsFromAll } from '@/modules/winterboard/utils/graphCalculatorUtils'

/** Крок чисельної похідної — як у картці похідної (`numDeriv`). */
const H = 1e-4
/** До скількох знаків після коми округлюємо коефіцієнти прямої. */
const DIGITS = 6

const stripY = (src: string): string => String(src ?? '').replace(/^\s*y\s*=\s*/i, '').trim()

/** Більше повзунків на одному графіку — нечитабельно. Та сама стеля, що в BE
 *  (`apps/intent/ai/parser.py`, `_MAX_GRAPH_PARAMS`). */
export const MAX_GRAPH_PARAMS = 4

/** Повзунок за замовчуванням — той самий, що створює сам рушій
 *  (`graph-calculator.js`, `setParamValue` / `addParameterFor`). */
const SLIDER_DEFAULT = { value: 1, min: -10, max: 10, step: 0.1 }

const SUPERSCRIPT: Record<string, string> = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
}

/**
 * Запис моделі → синтаксис рушія. Лише знаки, без словника функцій: модель
 * пише так, як у підручнику (`x²`, `2·x`, `x − 1`), а рушій знає `^`, `*`, `-`.
 */
export function toEngineSyntax(src: string): string {
  return stripY(src)
    .replace(/(⁻?)([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g, (_m, minus: string, digits: string) => {
      const n = [...digits].map((d) => SUPERSCRIPT[d]).join('')
      return minus ? `^(-${n})` : `^${n}`
    })
    .replace(/[·⋅∙×]/g, '*')
    .replace(/[−–]/g, '-')
    .replace(/÷/g, '/')
    // З пробілами: рушій множить сусідні імена (` pi x` = π·x, `2 pi` = 2π), а
    // «pix» чи `x(pi)` (виклик функції x) він не розбере.
    .replace(/π/g, ' pi ')
}

/** Невідоме «літера + змінна» — коефіцієнт, злитий зі змінною (`Ax`, `kx`). */
const GLUED = /^([A-Za-z])([xy])$/
/** Однолітерне невідоме — повзунок (якщо рушій не тримає цю літеру для себе). */
const SLIDER = /^[A-Za-z]$/

/**
 * `Ax` → `A*x` у тексті виразу. Межа слова задана явно, бо цифра перед іменем
 * (`2ax`) для `\b` — не межа. Після `^` чи `/` злите ім'я — одне ціле:
 * `e^kx` = e^(k·x), `1/kx` = 1/(k·x); деінде степінь — лише на змінну:
 * `Ax^2` = A·x². Без цього розрізнення крива будувалась би ХИБНО, а не порожньо.
 */
function splitGlued(src: string, name: string): string {
  const re = new RegExp(`(?<![A-Za-z_])${name}(?![A-Za-z0-9_])`, 'g')
  return src.replace(re, (_match: string, offset: number, whole: string) => {
    const before = whole.slice(0, offset).trimEnd().slice(-1)
    return before === '^' || before === '/' ? `(${name[0]}*${name[1]})` : `${name[0]}*${name[1]}`
  })
}

export interface GraphSrcPlan {
  /** Вираз у синтаксисі рушія — саме його пишемо в графік. */
  src: string
  /** Нові повзунки: однолітерні невідомі, яких ще немає серед параметрів. */
  sliders: string[]
  /** Людська причина відмови або `null`. */
  reject: string | null
}

/**
 * Що писати в графік і які повзунки додати — питаючи сам рушій (Б-14).
 *
 * Живий урок 2026-09-06: на «графік квадратного рівняння» модель шле
 * `Ax² + Bx + C` без значень — дія проходила, картка з'являлась порожньою, у
 * чаті «✓». Власник 2026-09-27: такий вираз — крива з повзунками. Рушій читає
 * імена жадібно (`Ax` — одне невідоме, не A·x), тож: злите «літера + змінна»
 * розбиваємо (`splitGlued`), однолітерні невідомі стають повзунками. Відмова —
 * для літер, які рушій тримає для себе (`t`: param-sync її не вважає параметром
 * і прибрав би повзунок разом із кривою), і для будь-якого іншого невідомого
 * (`sinx`, `abx`, `alpha`): чесна відмова краща за хибну криву.
 */
export function planGraphSrc(src: string, paramNames: string[] = []): GraphSrcPlan {
  let clean = toEngineSyntax(src)
  if (!clean) return { src: clean, sliders: [], reject: 'порожній вираз' }
  for (let pass = 0; pass < 3; pass++) {
    const res = GraphCalc.classify(clean, paramNames) as { kind: string; error?: string; unknown?: string[] }
    if (res.kind === 'invalid') return { src: clean, sliders: [], reject: res.error || 'невідомий запис' }
    if (res.kind !== 'needsParam') return { src: clean, sliders: [], reject: null }
    const unknown = res.unknown || []
    const glued = unknown.filter((name) => GLUED.test(name) && !GRAPH_RESERVED_TOKENS.has(name[0]))
    if (glued.length) {
      for (const name of glued) clean = splitGlued(clean, name)
      continue
    }
    const reserved = unknown.filter((name) => GRAPH_RESERVED_TOKENS.has(name))
    if (reserved.length) {
      return { src: clean, sliders: [], reject: `«${reserved.join('», «')}» рушій повзунком не робить — візьміть іншу літеру` }
    }
    const odd = unknown.filter((name) => !SLIDER.test(name))
    if (odd.length) return { src: clean, sliders: [], reject: `невідоме позначення «${odd.join('», «')}»` }
    return { src: clean, sliders: unknown, reject: null }
  }
  return { src: clean, sliders: [], reject: 'невідомий запис' }
}

/** Повзунки за замовчуванням для нових імен. */
export function sliderParams(names: string[]): Record<string, typeof SLIDER_DEFAULT> {
  return Object.fromEntries(names.map((name) => [name, { ...SLIDER_DEFAULT }]))
}

/** Відмова, коли повзунків стало б більше за стелю. */
export function tooManyParamsMessage(names: string[]): string {
  return `На одному графіку щонайбільше ${MAX_GRAPH_PARAMS} повзунки, а тут потрібні: ${names.join(', ')} — криву не додано.`
}

/**
 * Вирази одного графіка + його параметри → що писати. Одне правило для всіх
 * шляхів запису (новий графік, заміна кривої, додавання кривої): кожен вираз
 * через `planGraphSrc`, повзунки накопичуються, стеля — на весь графік.
 * Не намалюється → кидає людську відмову, нічого не пишемо.
 *
 * `siblings` — вирази, що лишаються на графіку (заміна кривої): параметри, яких
 * не згадує вже жодна крива, прибираємо — як param-sync після правки вчителя
 * (`extractParamsFromAll`), — інакше повзунки старої кривої з'їли б стелю.
 */
export function withSliders(
  srcs: string[],
  params: Record<string, unknown> = {},
  { siblings }: { siblings?: string[] } = {},
): { srcs: string[]; params: Record<string, unknown> } {
  let merged: Record<string, unknown> = { ...params }
  let added = false
  const out = srcs.map((src) => {
    const plan = planGraphSrc(src, Object.keys(merged))
    if (plan.reject) throw new Error(rejectMessage(src, plan.reject))
    Object.assign(merged, sliderParams(plan.sliders))
    added = added || plan.sliders.length > 0
    return plan.src
  })
  if (siblings) {
    const used = extractParamsFromAll([...out, ...siblings])
    if (used) merged = Object.fromEntries(Object.entries(merged).filter(([name]) => used.includes(name)))
  }
  const names = Object.keys(merged)
  if (added && names.length > MAX_GRAPH_PARAMS) throw new Error(tooManyParamsMessage(names))
  return { srcs: out, params: merged }
}

/**
 * Причина, з якої рушій графіка НЕ зможе намалювати вираз, або `null`.
 *
 * Синтаксис чи невідома функція — відмова. Однолітерна вільна змінна — це
 * повзунок (`needsParam`), а не помилка. Правило одне — `planGraphSrc`.
 */
export function engineRejects(src: string, paramNames: string[] = []): string | null {
  return planGraphSrc(src, paramNames).reject
}

/** Людське повідомлення для відмови рушія — однакове на всіх шляхах запису. */
export function rejectMessage(src: string, reason: string): string {
  return `Рушій графіка не розуміє запис «${stripY(src)}» (${reason}) — криву не додано.`
}

function round(v: number): number {
  const r = Number(v.toFixed(DIGITS))
  return Object.is(r, -0) ? 0 : r
}

function fmt(v: number): string {
  return String(round(v))
}

/** `k*x + b` у записі калькулятора, без «1*x», «+-», «+0». */
export function lineSrc(k: number, b: number): string {
  const kr = round(k)
  const br = round(b)
  let head = ''
  if (kr !== 0) head = kr === 1 ? 'x' : kr === -1 ? '-x' : `${fmt(kr)}*x`
  if (!head) return fmt(br)
  if (br === 0) return head
  return br > 0 ? `${head}+${fmt(br)}` : `${head}-${fmt(Math.abs(br))}`
}

export interface Tangent {
  src: string
  k: number
  b: number
  y0: number
}

/**
 * Дотична до кривої `src` у точці `x0`.
 *
 * @param params поточні значення повзунків графіка (`a`, `k`…) — крива може
 *               від них залежати, і дотична має бути до ТІЄЇ кривої, яку видно.
 * @throws Error з людським текстом, якщо в точці функція не визначена або
 *               похідної немає (злам, розрив) — дотичної тоді теж немає.
 */
export function tangentLine(src: string, x0: number, params: Record<string, number> = {}): Tangent {
  const clean = stripY(src)
  let ast: unknown
  try {
    ast = GraphCalc.parse(clean)
  } catch (e) {
    throw new Error(rejectMessage(clean, (e as Error).message))
  }
  const f = (x: number): number => {
    try {
      return GraphCalc.evalAst(ast, { ...GraphCalc.CONSTS, ...params, x }) as number
    } catch {
      return Number.NaN
    }
  }
  const y0 = f(x0)
  if (!Number.isFinite(y0)) {
    throw new Error(`У точці x = ${x0} функція «${clean}» не визначена — дотичної там немає.`)
  }
  const left = f(x0 - H)
  const right = f(x0 + H)
  if (!Number.isFinite(left) || !Number.isFinite(right)) {
    throw new Error(`Біля точки x = ${x0} функція «${clean}» не визначена з обох боків — дотичної там немає.`)
  }
  // Злам (|x| у нулі): однобічні нахили різні — похідної, а отже й дотичної, немає.
  const leftSlope = (y0 - left) / H
  const rightSlope = (right - y0) / H
  if (Math.abs(leftSlope - rightSlope) > 1e-2 * Math.max(1, Math.abs(leftSlope), Math.abs(rightSlope))) {
    throw new Error(`У точці x = ${x0} крива «${clean}» має злам — дотичної там немає.`)
  }
  const k = (right - left) / (2 * H)
  const b = y0 - k * x0
  return { src: lineSrc(k, b), k: round(k), b: round(b), y0: round(y0) }
}
