/**
 * Parameter Focus — під час Shift+Drag параметра графкалькулятора показати
 * причинний зв'язок «тягну `a` → ось ці вирази від нього залежать → ось його
 * значення». Рішення власника 2026-09-21 (MVP, живий урок).
 *
 * ЛИШЕ UI живого уроку: не persisted, не ops, не Replay. Replay бачить потік
 * `graph_param_set` без begin/end — вгадувати drag з частоти ops заборонено
 * (рішення власника), тож у Replay фокусу немає свідомо.
 */
import { extractParams } from './graphCalculatorUtils'

export type ParamFocusPhase = 'active' | 'fading'

export interface ParamFocus {
  name: string
  value: number
  /** Вираз, за криву якого тягнуть. */
  targetExprId: string | null
  phase: ParamFocusPhase
}

/** target — крива під курсором; dependent — інші видимі вирази з тим самим параметром. */
export type ParamFocusRole = 'target' | 'dependent'

/** Тривалість згасання після drag end; мусить збігатися з CSS-переходами. */
export const PARAM_FOCUS_FADE_MS = 400

// Розбір src на кожен тік drag (~30/с × N рядків) — кешуємо за текстом.
const _paramsBySrc = new Map<string, string[]>()
const _CACHE_CAP = 500

function paramsOf(src: string): string[] {
  let hit = _paramsBySrc.get(src)
  if (!hit) {
    if (_paramsBySrc.size >= _CACHE_CAP) _paramsBySrc.clear()
    hit = extractParams(src)
    _paramsBySrc.set(src, hit)
  }
  return hit
}

export function paramFocusRole(
  focus: ParamFocus | null,
  expr: { id: string; src: string; hidden: boolean },
): ParamFocusRole | null {
  if (!focus || expr.hidden) return null
  if (!paramsOf(expr.src).includes(focus.name)) return null
  return expr.id === focus.targetExprId ? 'target' : 'dependent'
}

/** `−0.44` зі справжнім мінусом (U+2212), без `−0.00`. */
export function formatParamValue(v: number): string {
  const s = v.toFixed(2)
  if (Number(s) === 0) return (0).toFixed(2)
  return s.startsWith('-') ? '−' + s.slice(1) : s
}
