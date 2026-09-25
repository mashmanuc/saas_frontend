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

/** Крок чисельної похідної — як у картці похідної (`numDeriv`). */
const H = 1e-4
/** До скількох знаків після коми округлюємо коефіцієнти прямої. */
const DIGITS = 6

const stripY = (src: string): string => String(src ?? '').replace(/^\s*y\s*=\s*/i, '').trim()

/**
 * Причина, з якої рушій графіка НЕ зможе намалювати вираз, або `null`.
 *
 * Лише `invalid` (синтаксис, невідома функція). Вільна мала літера — це
 * задокументований повзунок (`needsParam`), а не помилка, тож її не чіпаємо.
 */
export function engineRejects(src: string, paramNames: string[] = []): string | null {
  const clean = stripY(src)
  if (!clean) return 'порожній вираз'
  const res = GraphCalc.classify(clean, paramNames) as { kind: string; error?: string }
  return res.kind === 'invalid' ? (res.error || 'невідомий запис') : null
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
