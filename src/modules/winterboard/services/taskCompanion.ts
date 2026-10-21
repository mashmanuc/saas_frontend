/** Тонкий адаптер даних задачі до чинних об’єктів. Без ops, мережі або стану дошки. */
import { buildNumberLineAsset } from '../constants/numberLineDefaults'
import { buildGraphCalculatorAsset } from '../constants/graphCalculatorDefaults'
import { evaluate } from '../engine/numberLine/evaluate'
import { defaultNumberLineData, type NumberLineData } from '../engine/numberLine/types'
import { graphViewportFor } from '../utils/graphAutofit'
import type { WBAsset } from '../types/winterboard'
import type { CompanionResolution } from './capabilityRegistry'

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const text = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 2000
const bound = (v: unknown): boolean => object(v) && text(v.latex) && finite(v.approx)
  && typeof v.exact === 'boolean' && typeof v.closed === 'boolean' && (v.text === null || text(v.text))

// JSONB може переставити ключі. Порядок ключів і вигляд відповіді — не нова задача.
function stable(value: unknown): string {
  return JSON.stringify(value, (_key, v) => object(v)
    ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v)
}

function numberLineInput(data: NumberLineData): unknown {
  const { mode, variable, conditions, combine, inequality, result } = data
  return { mode, variable, conditions, combine, inequality, result }
}

/** Відмова до показу кнопки: пошкоджені дані не перетворюємо на порожню пряму. */
export function taskNumberLine(raw: unknown): NumberLineData | null {
  if (!object(raw) || raw.version !== 1 || raw.variable !== 'x'
    || !['and', 'or'].includes(String(raw.combine)) || !Array.isArray(raw.conditions)
    || typeof raw.showAnswer !== 'boolean' || typeof raw.showHatching !== 'boolean') return null
  if (raw.mode === 'set') {
    if (!raw.conditions.length || raw.conditions.length > 6 || !raw.conditions.every(c => object(c) && (
      ('holds' in c && typeof c.holds === 'boolean' && text(c.reduced) && text(c.source))
      || ('from' in c && text(c.from) && text(c.to) && typeof c.fromIncluded === 'boolean' && typeof c.toIncluded === 'boolean')
      || (['<', '<=', '>', '>=', '=', '!='].includes(String(c.op)) && text(c.value))
    ))) return null
  } else if (raw.mode === 'solved') {
    const r = raw.result
    if (!text(raw.inequality) || !object(r) || r.ok !== true || !Array.isArray(r.intervals)
      || !Array.isArray(r.points) || r.intervals.length > 12 || r.points.length > 12
      || !(r.domain === null || text(r.domain)) || !text(r.answer)
      || !r.points.every(bound) || !r.intervals.every(iv => object(iv)
        && (iv.from === null || bound(iv.from)) && (iv.to === null || bound(iv.to))
        && (!iv.from || !iv.to || (iv.from as { approx: number }).approx < (iv.to as { approx: number }).approx))) return null
  } else return null
  const data = { ...defaultNumberLineData(), ...raw } as unknown as NumberLineData
  return evaluate(data).ok ? JSON.parse(JSON.stringify(data)) as NumberLineData : null
}

export function taskGraphPoints(data: Record<string, unknown>): Array<{ x: number; y: number }> {
  const points = data.graph_points
  return Array.isArray(points) && points.length > 0 && points.length <= 32
    && points.every(p => object(p) && finite(p.x) && finite(p.y)) ? points as Array<{ x: number; y: number }> : []
}

export function taskGraphSources(data: Record<string, unknown>): string[] {
  return Array.isArray(data.equations) && data.equations.every(text)
    ? data.equations.map(s => /^[a-zA-Z]\s*=/.test(s.trim()) ? s.trim() : `y=${s.trim()}`) : []
}

/** Ті самі canonical factories, що для вставлення з панелі інструментів. */
export function buildTaskCompanion(resolution: CompanionResolution, x: number, y: number, id: string): WBAsset | null {
  const d = resolution.data
  if (resolution.rendererType === 'number_line') {
    const data = taskNumberLine(d.number_line)
    if (!data) return null
    return buildNumberLineAsset({ x: x + 300, y: y + 150 }, data, id) as unknown as WBAsset
  }
  if (resolution.rendererType !== 'graph_calculator') return null
  const sources = taskGraphSources(d), points = taskGraphPoints(d)
  if (!sources.length && !points.length) return null
  const colors = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed']
  const asset = buildGraphCalculatorAsset({ x: x + 240, y: y + 180 }, {
    expressions: sources.map((src, i) => ({ src, color: colors[i % colors.length] })),
    viewport: graphViewportFor(sources, {}),
  })
  asset.id = id; asset.w = 640; asset.h = 520
  const state = (asset.data as unknown as { state: Record<string, unknown> }).state
  if (points.length) {
    state.points = Object.fromEntries(points.map((p, i) => [`task-p${i + 1}`, { ...p, mode: 'free' }]))
    // Пари задані самі по собі: не домислюємо криву, вписуємо всі задані точки.
    if (!sources.length) {
      const xs = points.map(p => p.x), ys = points.map(p => p.y)
      const dx = Math.max(1, Math.max(...xs) - Math.min(...xs)), dy = Math.max(1, Math.max(...ys) - Math.min(...ys))
      state.viewport = { cx: (Math.max(...xs) + Math.min(...xs)) / 2, cy: (Math.max(...ys) + Math.min(...ys)) / 2,
        fit: { xMin: Math.min(...xs) - dx / 4, xMax: Math.max(...xs) + dx / 4,
          yMin: Math.min(...ys) - dy / 4, yMax: Math.max(...ys) + dy / 4 } }
    }
  }
  return asset
}

/** Після reload зв’язок відновлюється за змістом, не лише за типом об’єкта. */
export function matchesTaskCompanion(asset: WBAsset, resolution: CompanionResolution): boolean {
  if (asset.type !== resolution.rendererType) return false
  if (asset.type === 'number_line') {
    const actual = taskNumberLine(asset.data), wanted = taskNumberLine(resolution.data.number_line)
    return !!actual && !!wanted && stable(numberLineInput(actual)) === stable(numberLineInput(wanted))
  }
  if (asset.type !== 'graph_calculator') return false
  const state = (asset.data as unknown as { state?: { expressions?: Array<{ src: string }>; points?: Record<string, { x: number; y: number }> } })?.state
  if (!state?.expressions) return false
  const wanted = taskGraphPoints(resolution.data)
  const actual = Object.values(state.points ?? {}).map(p => ({ x: p.x, y: p.y }))
  return JSON.stringify(state.expressions.map(e => e.src)) === JSON.stringify(taskGraphSources(resolution.data))
    && JSON.stringify(actual) === JSON.stringify(wanted)
}
