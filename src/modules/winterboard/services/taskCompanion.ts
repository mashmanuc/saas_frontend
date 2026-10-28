/** Тонкий адаптер даних задачі до чинних об’єктів. Без ops, мережі або стану дошки. */
import { buildNumberLineAsset } from '../constants/numberLineDefaults'
import { buildGraphCalculatorAsset } from '../constants/graphCalculatorDefaults'
import { buildDefaultCalculusData } from '../constants/calculusDefaults'
import { evaluate } from '../engine/numberLine/evaluate'
import { defaultNumberLineData, type NumberLineData } from '../engine/numberLine/types'
import { autofitExpressions, graphViewportFor } from '../utils/graphAutofit'
import type { CalculusData } from '../types/calculus'
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

// Наш контракт тіла (`solid_dims`, `solid_marks`) → параметри й допоміжні лінії чинних шаблонів 3D-об'єкта.
// Межі — з `TEMPLATES.*.params` рушія (тест звіряє); один множник на всі розміри, щоб пропорції не спотворились.
export const SOLID_PARAMS: Record<string, Record<string, [string, number, number]>> = {
  cuboid: { a: ['length', 0.6, 3], b: ['width', 0.6, 3], c: ['height', 0.6, 3] },
  prism4: { a: ['base_side', 0.6, 2.6], h: ['height', 0.6, 3.4] },
  pyramid4: { a: ['base_side', 0.6, 2.8], h: ['height', 0.4, 3.2] },
  cylinder: { r: ['radius', 0.4, 2], h: ['height', 0.6, 3.6] },
  cone: { r: ['radius', 0.4, 2], h: ['height', 0.6, 3.6] },
}
export const SOLID_OPTS: Record<string, Record<string, string>> = {
  cube: { diagonal: 'bodyDiag', face_diagonal: 'faceDiag' },
  cuboid: { diagonal: 'bodyDiag' },
  prism4: { diagonal: 'bodyDiag' },
  pyramid4: { height: 'height', apothem: 'apothem' },
  cylinder: { height: 'height', radius: 'radius', axial_section: 'axSect' },
  cone: { height: 'height', slant: 'slant' },
  sphere: { radius: 'radius' },
  cubeInscribedSphere: { radius: 'radius' },
}

/** Пропорції й лінії з умови для шаблону; null — дані пошкоджені (тіло не будуємо, а не малюємо навмання). */
export function taskSolid(templateKey: string, d: Record<string, unknown>):
  { params?: Record<string, number>; opts?: Record<string, boolean> } | null {
  const out: { params?: Record<string, number>; opts?: Record<string, boolean> } = {}
  const spec = SOLID_PARAMS[templateKey]
  if (d.solid_dims !== undefined) {
    const dims = d.solid_dims
    if (!object(dims) || !spec || !Object.values(spec).every(([k]) => finite(dims[k]) && (dims[k] as number) > 0)) return null
    let lo = 0, hi = Infinity
    for (const [key, min, max] of Object.values(spec)) {
      const v = dims[key] as number
      lo = Math.max(lo, min / v); hi = Math.min(hi, max / v)
    }
    // Пропорції, яких шаблон не вміщує (паралелепіпед 13 × 2,6 × 1,9): найбільший розмір — у межу, менші
    // притискаються до мінімуму. Тіло лишається видовженим, а не «типовим» (28.10: типовий вигляд збігався з
    // іншим паралелепіпедом сторінки, і кнопка виділяла чуже тіло).
    const k = lo <= hi ? Math.sqrt(lo * hi) : hi
    out.params = Object.fromEntries(Object.entries(spec).map(([p, [key, min, max]]) =>
      [p, Math.round(Math.min(max, Math.max(min, (dims[key] as number) * k)) * 1000) / 1000]))
  }
  if (d.solid_marks !== undefined) {
    const marks = d.solid_marks
    if (!Array.isArray(marks) || !marks.every(text)) return null
    const known = SOLID_OPTS[templateKey] ?? {}
    const opts = Object.fromEntries(marks.filter(m => m in known).map(m => [known[m], true]))
    if (Object.keys(opts).length) out.opts = opts
  }
  return out
}

// Шаблони, які справді відкриває 3D-об'єкт дошки (`NMT3D.TEMPLATES` у nmt-3d.js; звірено 2026-10-28,
// тест nmt3dCompanionTemplates). Ключі nmt-templates.js (`sphere_in_cube`, `truncCone`, `prism3`) — лише
// SVG-мініатюри: Workspace їх не знає, і «Побудувати» давало порожню картку. Ключ поза списком = відмова.
export const NMT3D_TEMPLATE_KEYS = new Set([
  'cone', 'cube', 'cuboid', 'cylinder', 'prism4', 'prism6',
  'pyramid3', 'pyramid4', 'sphere', 'tetrahedron', 'frustumCone',
  // Композитні сцени «вписано/описано» (A-T3) — одна параметрична фігура,
  // а не дві поруч: розмір внутрішнього тіла випливає із зовнішнього.
  'cubeInscribedSphere', 'cubeCircumSphere',
])

/** Дані 3D-тіла з extracted_data задачі; null = чесно не будуємо (немає шаблона чи дані пошкоджені). */
export function taskSolidData(d: Record<string, unknown>): Record<string, unknown> | null {
  // Map extracted_data.shape → Nmt3dData.templateKey (version 1 format).
  // extracted_data comes from enrich_fingerprints (e.g. {shape:"pyramid"}).
  //
  // ⛔ БЕЗ ФОЛБЕКА. Раніше тут стояло `?? 'cube'` — і 50 задач банку, де
  // екстрактор не розпізнав тіло (shape=None), отримували КУБА-САМОЗВАНЦЯ:
  // «об'єм правильного тетраедра» → куб, «перпендикуляр і похила» → куб.
  // Будь-який фолбек-об'єкт бреше учневі, тому shape відсутній → companion
  // не створюється (ТЗ D-4 крок 1, п.1.1).
  const solidShape = d.shape as string | undefined
  const baseShape  = (d.base_shape as string | undefined)
  if (!solidShape) {
    console.warn('[WB] nmt3d companion skipped — екстрактор не розпізнав тіло', { d })
    return null
  }
  const SHAPE_TO_TEMPLATE: Record<string, string | null> = {
    // hexagon-піраміди шаблона НЕМАЄ (pyramid6 не існує в nmt-templates) —
    // чесний null: краще без 3D, ніж каркас із хибною основою.
    pyramid:  baseShape === 'triangle' ? 'pyramid3'
      : baseShape === 'hexagon' ? null : 'pyramid4',
    // Явно інша основа (трикутник, п'ятикутник) — не чотирикутна призма: такої картинки не малюємо.
    prism:    baseShape === 'hexagon' ? 'prism6'
      : !baseShape || ['square', 'rectangle', 'rhombus', 'parallelogram'].includes(baseShape) ? 'prism4' : null,
    cylinder: 'cylinder',
    cone:     'cone',
    sphere:   'sphere',
    cube:     'cube',
    cuboid:   'cuboid',
    // 2026-08-04 (власник): точний шаблон замість generic pyramid3.
    tetrahedron: 'tetrahedron',
    // A-T3: shape для композитів приходить із BE вже як пара «X_in_Y».
    // Без цих рядків companion мовчки не рендериться (грабля тетраедра, D-4).
    sphere_in_cube: 'cubeInscribedSphere',
    cube_in_sphere: 'cubeCircumSphere',
    // Прогін №4 (2026-08-04): 52 задачі банку мають shape='parallelepiped',
    // якого не було в мапі — фолбек «як є» створював ПОРОЖНЮ картку
    // (Workspace не знає такого шаблона) і пустушка їхала аж у колоду.
    parallelepiped: 'cuboid',
    rectangular_parallelepiped: 'cuboid',
    // 3D-об'єкт знає зрізаний конус як frustumCone (truncCone — лише SVG-мініатюра).
    frustum_cone: 'frustumCone',
    // Шаблона зрізаної ПІРАМІДИ немає взагалі → чесний null (14 задач).
    frustum_pyramid: null,
  }
  // Невідомий shape НЕ пропускається «як є»: templateKey поза реальним
  // списком шаблонів = порожній об'єкт на дошці й у презентації.
  const templateKey = SHAPE_TO_TEMPLATE[solidShape] ?? null
  if (!templateKey || !NMT3D_TEMPLATE_KEYS.has(templateKey)) {
    console.warn('[WB] nmt3d companion skipped — немає шаблона', { solidShape, baseShape })
    return null
  }
  // Пропорції й допоміжні лінії — лише з умови (extracted_data.solid_dims / solid_marks);
  // без них — типовий вигляд шаблону, як і раніше. Пошкоджені дані → тіла не будуємо.
  const solid = taskSolid(templateKey, d)
  if (solid === null) {
    console.warn('[WB] nmt3d companion skipped — пошкоджені розміри тіла', { d })
    return null
  }
  return {
    version:     1,
    templateKey,
    mode:        'adapt' as const,
    ...solid,
  }
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

export type TaskCalculusInput =
  | { mode: 'derivative'; expr: string; x0: number }
  | { mode: 'integral'; expr: string; a: number; b: number }

/** Абсциса й межі саме з умови: не типовий x₀=1, не межі «для прикладу» і не відповідь задачі. */
export function taskCalculusInput(data: Record<string, unknown>): TaskCalculusInput | null {
  const raw = data.calculus
  const sources = taskGraphSources(data)
  if (!object(raw) || sources.length !== 1) return null
  const expr = sources[0].replace(/^y\s*=\s*/, '')
  if (raw.mode === 'derivative' && finite(raw.x0)) return { mode: 'derivative', expr, x0: raw.x0 }
  if (raw.mode === 'integral' && finite(raw.a) && finite(raw.b) && raw.a < raw.b)
    return { mode: 'integral', expr, a: raw.a, b: raw.b }
  return null
}

export function taskCalculusData(data: Record<string, unknown>): CalculusData | null {
  const input = taskCalculusInput(data)
  if (!input) return null
  const must = input.mode === 'derivative' ? [input.x0] : [input.a, input.b]
  const fit = autofitExpressions([`y=${input.expr}`], {}, must)
  const viewport = fit ? { cx: (fit.xMin + fit.xMax) / 2, cy: (fit.yMin + fit.yMax) / 2, scale: 50, fit }
    : { cx: must[0], cy: 0, scale: 50 }
  return input.mode === 'derivative'
    ? { ...buildDefaultCalculusData('derivative'), expr: input.expr, x0: input.x0, viewport }
    : { ...buildDefaultCalculusData('integral'), expr: input.expr, a: input.a, b: input.b, viewport }
}

// ── «Побудувати» для векторів (власник 28.10: «Побудувати — так») ─────────────────────────────────────────
// Точки, вектори й відрізки з умови (BE `num_vec_bank_figures`) → сцена наявної «Геометрії» (geomash_scene). Об'єкти —
// у тому самому форматі, що дає її конструктор (GeoEngine.construct: base_ + point/vector/segment; звірено тестом).
// На дошці «Геометрія» ставить початок координат у центр полотна й бере лише масштаб `cs.sc` — тому масштаб
// підбираємо так, щоб усі точки вмістились у рамку картки.
export const TASK_GEOMASH_SIZE = { w: 520, h: 400 }
const GEO_POINT_COLOR = '#1a5c38'
const GEO_VECTOR_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#d97706']
const GEO_NAME = /^[A-Za-z][A-Za-z_0-9]{0,7}$/

interface TaskGeoPoint { name: string; x: number; y: number; hidden?: boolean }
interface TaskGeoLink { name?: string; from: string; to: string }

export function taskGeomashData(d: Record<string, unknown>): Record<string, unknown> | null {
  const points = d.geo_points, vectors = d.geo_vectors ?? [], segments = d.geo_segments ?? []
  if (!Array.isArray(points) || !Array.isArray(vectors) || !Array.isArray(segments)) return null
  if (!points.length || points.length > 12 || vectors.length + segments.length === 0) return null
  const byName = new Map<string, TaskGeoPoint>()
  for (const p of points as TaskGeoPoint[]) {
    if (!p || typeof p.name !== 'string' || !GEO_NAME.test(p.name) || byName.has(p.name)
        || !Number.isFinite(p.x) || !Number.isFinite(p.y) || Math.abs(p.x) > 1000 || Math.abs(p.y) > 1000) return null
    byName.set(p.name, p)
  }
  const links = [...(vectors as TaskGeoLink[]).map(v => ({ ...v, type: 'vector' as const })),
    ...(segments as TaskGeoLink[]).map(s => ({ ...s, type: 'segment' as const }))]
  for (const l of links) {
    if (!l || !byName.has(l.from) || !byName.has(l.to) || l.from === l.to) return null
    if (l.type === 'vector' && (typeof l.name !== 'string' || !GEO_NAME.test(l.name) || byName.has(l.name))) return null
  }
  const base = (id: string, type: string, labelMode: string, color: string) =>
    ({ id, type, labelMode, visible: true, locked: false, color, lw: 2 })
  const objects: Array<Record<string, unknown>> = (points as TaskGeoPoint[]).map(p =>
    ({ ...base(p.name, 'point', p.hidden ? 'none' : 'name', GEO_POINT_COLOR), wx: p.x, wy: p.y, deps: [] }))
  let k = 0
  for (const l of links) {
    const id = l.type === 'vector' ? l.name! : `s_${l.from}${l.to}`
    objects.push({ ...base(id, l.type, l.type === 'vector' ? 'name' : 'none',
      l.type === 'vector' ? GEO_VECTOR_COLORS[k++ % GEO_VECTOR_COLORS.length] : GEO_POINT_COLOR),
    p1: l.from, p2: l.to, deps: [l.from, l.to] })
  }
  // Початок координат — у центрі полотна: масштаб за найдальшою від нього точкою, з полем 36 px.
  const ax = Math.max(1, ...(points as TaskGeoPoint[]).map(p => Math.abs(p.x)))
  const ay = Math.max(1, ...(points as TaskGeoPoint[]).map(p => Math.abs(p.y)))
  const sc = Math.max(2, Math.min(60, (TASK_GEOMASH_SIZE.w / 2 - 36) / ax, (TASK_GEOMASH_SIZE.h / 2 - 36) / ay))
  return { version: 1, scene: { format: 'geomash-scene', version: 1, objects,
    cs: { ox: TASK_GEOMASH_SIZE.w / 2, oy: TASK_GEOMASH_SIZE.h / 2, sc: Math.floor(sc * 100) / 100 } } }
}

/** Ті самі canonical factories, що для вставлення з панелі інструментів. */
export function buildTaskCompanion(resolution: CompanionResolution, x: number, y: number, id: string): WBAsset | null {
  const d = resolution.data
  if (resolution.rendererType === 'calculus_card') {
    const data = taskCalculusData(d)
    if (!data) return null
    return { id, type: 'calculus_card', src: '', x, y, w: 480, h: 360,
      rotation: 0, locked: false, data } as WBAsset
  }
  if (resolution.rendererType === 'nmt3d') {
    const data = taskSolidData(d)
    if (!data) return null
    return { id, type: 'nmt3d', src: '', x, y, w: 680, h: 500, rotation: 0, locked: false, data } as unknown as WBAsset
  }
  if (resolution.rendererType === 'geomash_scene') {
    const data = taskGeomashData(d)
    if (!data) return null
    return { id, type: 'geomash_scene', src: '', x, y, ...TASK_GEOMASH_SIZE, rotation: 0, locked: false,
      data } as unknown as WBAsset
  }
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
  if (asset.type === 'calculus_card') {
    const wanted = taskCalculusInput(resolution.data)
    const actual = asset.data as unknown as CalculusData
    if (!wanted || actual?.mode !== wanted.mode || actual.expr !== wanted.expr) return false
    return wanted.mode === 'derivative' ? actual.x0 === wanted.x0 : actual.a === wanted.a && actual.b === wanted.b
  }
  if (asset.type === 'nmt3d') {
    // Своє тіло — той самий шаблон і ті самі пропорції з умови. Лінії й камеру вчитель міняє сам,
    // а шаблон без пропорцій 3D-об'єкт доповнює типовими — тоді досить шаблону.
    const wanted = taskSolidData(resolution.data) as { templateKey: string; params?: Record<string, number> } | null
    const actual = asset.data as unknown as { templateKey?: string; params?: Record<string, number> }
    if (!wanted || actual?.templateKey !== wanted.templateKey) return false
    return !wanted.params || stable(actual.params ?? null) === stable(wanted.params)
  }
  if (asset.type === 'geomash_scene') {
    // Своя сцена — ті самі точки й вектори з умови (стиль, підписи й масштаб учитель міняє сам).
    const key = (objects: unknown) => stable((Array.isArray(objects) ? objects : []).map((o: Record<string, unknown>) =>
      [o.id, o.type, o.wx ?? null, o.wy ?? null, o.p1 ?? null, o.p2 ?? null]))
    const wanted = taskGeomashData(resolution.data) as { scene: { objects: unknown } } | null
    const actual = asset.data as unknown as { scene?: { objects?: unknown } }
    return !!wanted && key(actual?.scene?.objects) === key(wanted.scene.objects)
  }
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
