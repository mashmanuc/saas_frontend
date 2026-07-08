/**
 * insertRegistry — SSOT «що можна вставити на дошку з правого сайдбару».
 *
 * Фаза 0 (ТЗ: m4sh_graph/MASH_PANEL_ARCHITECTURE_TZ.md §4): цей модуль ЛИШЕ
 * агрегує вставні елементи, які СЬОГОДНІ пропонують 5 активних трей-компонентів
 * (`Nmt3dTray`, `Geometry2DTray`, `CalculusTray`, `QuadraticTray`, `TrigCircleTray`).
 * Нуль змін у презентації — трей рендеряться як раніше. Реєстр готує ґрунт, щоб
 * презентація (таб-секції → quick-insert палітра) читала з ОДНОГО джерела.
 *
 * Контракт вставки НЕ винаходиться: `dragMime` + `payload` — рівно те, що трей
 * кладе у `dataTransfer.setData()` / передає в `useAddToolToBoard()`. Резолвер —
 * `useContentDrop.addAtPosition(mime, payload, pos)` (useContentDrop.ts:1000).
 *
 * Інваріанти (enforced у insertRegistry.spec.ts):
 *   INV-REG-1 — реєстр дзеркалить джерела трейв (NMT3D_TEMPLATE_ORDER,
 *               CALCULUS_PRESETS, singletons) без розбіжностей.
 *   INV-REG-2 — кожен entry.dragMime має гілку-резолвер у addAtPosition.
 *   INV-REG-3 — searchInserts детермінований; порожній запит = всі enabled.
 *
 * ⚠️ geo (планіметрія) = РАНТАЙМ: `window.GEO_PRESETS` наповнюється лише після
 * завантаження vendor/geo2d-бандлу → geoInserts() читає його на момент виклику
 * (порожньо до завантаження — це нормально, не помилка).
 */
import { NMT3D_DRAG_MIME, NMT3D_TEMPLATE_ORDER, NMT3D_TEMPLATE_LABELS } from '../../constants/nmt3dDefaults'
import { CALCULUS_DRAG_MIME, CALCULUS_PRESETS } from '../../constants/calculusDefaults'
import { GRAPH_CALCULATOR_MIME } from '../../constants/graphCalculatorDefaults'
import { QUAD_DRAG_MIME } from '../../constants/quadDefaults'
import { GEOMETRY_2D_V2_DRAG_MIME } from '../../constants/geometry2dV2Defaults'
import { TRIG_CIRCLE_DRAG_MIME } from '../../constants/trigCircleDefaults'
import { HELIX_DRAG_MIME } from '../../constants/helixDefaults'
import { TRIG_SOLVER_DRAG_MIME } from '../../constants/trigSolverDefaults'
import { GRAPHMASH_3D_DRAG_MIME, GEOMASH_DRAG_MIME } from '../../constants/mashInsertDefaults'
import type { GeoPresetMeta } from '../../vendor/geo2d'

/** Родина інструмента (секція каталогу). '2d'/'3d'/'geomash' зарезервовані під
 *  майбутні воронкові apps, якщо колись стануть sidebar-вставними. */
export type MashFamily =
  | 'stereo'      // Стереометрія (nmt3d)
  | 'planimetry'  // Планіметрія (geometry_2d_v2) — рантайм
  | 'analysis'    // Аналіз функцій (graph_calculator + calculus_card)
  | 'quadratic'   // Квадратне рівняння
  | 'trig'        // Тригонометрія (trig_circle + helix + trig_solver)
  | '2d' | '3d' | 'geomash' | 'other'

export interface InsertEntry {
  /** Стабільний унікальний id (для тестів/аналітики/палітри). */
  id: string
  family: MashFamily
  /** Підкатегорія всередині родини (для секцій; коарс). */
  category: string
  /** MIME, який кладе трей у dataTransfer (= ключ резолвера addAtPosition). */
  dragMime: string
  /** Точний payload-рядок (як у трею). */
  payload: string
  /** i18n-ключ підпису, якщо стабільний існує (інакше undefined). */
  labelKey?: string
  /** Статичний UA-фолбек підпису (завжди присутній — для пошуку/палітри до i18n). */
  labelFallback: string
  /** Ключ іконки для <InsertIcon> (family+iconKey → SVG). */
  iconKey: string
  /** Короткий підпис-підказка (як сублейбл у трею), опц. */
  sublabel?: string
  /** Стартовий шаблон (для scene-tools з кількома entry одного asset.type). */
  starterKind?: string
  /** Індекс пошуку (укр+латинь токени; НЕ локалізувати). */
  keywords: string[]
}

/** Токенізатор для keywords: lowercase, розбиття по не-літерах/цифрах. */
function kw(...parts: string[]): string[] {
  const set = new Set<string>()
  for (const p of parts) {
    for (const tok of String(p).toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
      if (tok) set.add(tok)
    }
  }
  return [...set]
}

// ── stereo (nmt3d) ────────────────────────────────────────────────────────────
/** Коарс-категорія стереометрії за типом тіла (стандартна матем. класифікація). */
const STEREO_CATEGORY: Readonly<Record<string, string>> = {
  cube: 'polyhedra', cuboid: 'polyhedra', prism4: 'polyhedra', prism6: 'polyhedra',
  obliquePrism4: 'polyhedra', pyramid4: 'polyhedra', pyramid3: 'polyhedra', pyramid6: 'polyhedra',
  tetrahedron: 'polyhedra', trapPyramid: 'polyhedra', frustumPyramid4: 'polyhedra',
  ngonPyramid: 'polyhedra', ngonPrism: 'polyhedra',
  cylinder: 'revolution', cone: 'revolution', frustumCone: 'revolution', sphere: 'revolution',
  cubeInscribedSphere: 'combined', cubeCircumSphere: 'combined', cylinderInscribedSphere: 'combined',
  sphereInscribedCone: 'combined', coneInscribedCylinder: 'combined',
  cubeSection3: 'sections', pyramid4Section3: 'sections', prism4Section3: 'sections',
}

const STEREO_INSERTS: InsertEntry[] = NMT3D_TEMPLATE_ORDER.map((key) => {
  const label = NMT3D_TEMPLATE_LABELS[key] ?? key
  return {
    id: `stereo.${key}`,
    family: 'stereo' as const,
    category: STEREO_CATEGORY[key] ?? 'other',
    dragMime: NMT3D_DRAG_MIME,
    payload: JSON.stringify({ templateKey: key }),
    // stereo-підписи runtime (window.NMT3D.TEMPLATES[key].name) → стабільного i18n-ключа немає
    labelFallback: label,
    iconKey: key,
    keywords: kw(key, label),
  }
})

// ── analysis (graph_calculator + calculus_card) ───────────────────────────────
const ANALYSIS_INSERTS: InsertEntry[] = [
  {
    id: 'analysis.graphCalc',
    family: 'analysis',
    category: 'functions',
    dragMime: GRAPH_CALCULATOR_MIME,
    payload: '{}',
    labelKey: 'winterboard.contentSidebar.graphCalcLabel',
    labelFallback: 'Графічний калькулятор',
    iconKey: 'graphCalc',
    sublabel: 'y = f(x) · графік · функції',
    keywords: kw('графічний калькулятор', 'graph', 'function', 'y f x', 'функції'),
  },
  ...CALCULUS_PRESETS.map((p) => {
    const label = p.mode === 'derivative' ? 'Похідна' : 'Первісна'
    return {
      id: `analysis.calculus.${p.mode}`,
      family: 'analysis' as const,
      category: 'functions',
      dragMime: CALCULUS_DRAG_MIME,
      payload: JSON.stringify({ mode: p.mode }),
      labelKey: `winterboard.calculus.mode.${p.mode}.full`,
      labelFallback: label,
      iconKey: p.mode,
      sublabel: p.short,
      keywords: kw(p.mode, label, p.short),
    }
  }),
]

// ── quadratic ─────────────────────────────────────────────────────────────────
const QUADRATIC_INSERTS: InsertEntry[] = [
  {
    id: 'quadratic.card',
    family: 'quadratic',
    category: 'quadratic',
    dragMime: QUAD_DRAG_MIME,
    payload: '{}',
    labelFallback: 'ax² + bx + c = 0',
    iconKey: 'card',
    sublabel: 'D · корені · парабола',
    keywords: kw('квадратне рівняння', 'quadratic', 'парабола', 'дискримінант', 'корені', 'ax2 bx c'),
  },
]

// ── trig (trig_circle + helix + trig_solver) ──────────────────────────────────
const TRIG_INSERTS: InsertEntry[] = [
  {
    id: 'trig.circle',
    family: 'trig',
    category: 'trig',
    dragMime: TRIG_CIRCLE_DRAG_MIME,
    payload: JSON.stringify({ type: 'trig_circle' }),
    labelKey: 'winterboard.trigCircle.btnLabel',
    labelFallback: 'Тригонометрія',
    iconKey: 'circle',
    sublabel: 'sin · cos · tg · ctg',
    keywords: kw('тригонометрія', 'коло', 'sin cos tg ctg', 'trig circle'),
  },
  {
    id: 'trig.helix',
    family: 'trig',
    category: 'trig',
    dragMime: HELIX_DRAG_MIME,
    payload: JSON.stringify({ type: 'helix' }),
    labelKey: 'winterboard.helix.btnLabel',
    labelFallback: 'Гелікс',
    iconKey: 'helix',
    sublabel: 'P = (θ, sin θ, cos θ)',
    keywords: kw('гелікс', 'helix', 'спіраль', 'theta sin cos'),
  },
  {
    id: 'trig.solver',
    family: 'trig',
    category: 'trig',
    dragMime: TRIG_SOLVER_DRAG_MIME,
    payload: JSON.stringify({ type: 'sin' }),
    // trig_solver підписи у трею hardcoded (без i18n) — дзеркалимо як fallback
    labelFallback: 'рівняння / нерівності',
    iconKey: 'solver',
    sublabel: 'sin · cos · tg · ctg · =/>/<',
    keywords: kw('рівняння', 'нерівності', 'тригонометричне', 'solver', 'sin cos tg ctg'),
  },
]

// ── 3D (graphmash_3d) — BoardMASH Ф3.1: стартовий НАБІР (один asset.type, різний src) ──
const GRAPHMASH3D_INSERTS: InsertEntry[] = [
  { id: '3d.blank', family: '3d', category: '3d', dragMime: GRAPHMASH_3D_DRAG_MIME,
    payload: JSON.stringify({ starterKind: 'blank' }), starterKind: 'blank',
    labelFallback: 'Порожня 3D-сцена', iconKey: 'blank', sublabel: 'GraphMASH 3D',
    keywords: kw('3d', 'порожня', 'сцена', 'graphmash', 'blank') },
  { id: '3d.surface', family: '3d', category: '3d', dragMime: GRAPHMASH_3D_DRAG_MIME,
    payload: JSON.stringify({ starterKind: 'surface' }), starterKind: 'surface',
    labelFallback: 'Поверхня z=f(x,y)', iconKey: 'surface', sublabel: 'z = sin(x)·cos(y)',
    keywords: kw('поверхня', 'surface', '3d', 'z f x y', 'графік') },
  { id: '3d.curve', family: '3d', category: '3d', dragMime: GRAPHMASH_3D_DRAG_MIME,
    payload: JSON.stringify({ starterKind: 'curve' }), starterKind: 'curve',
    labelFallback: 'Параметрична крива', iconKey: 'curve', sublabel: '(cos t, sin t, t)',
    keywords: kw('крива', 'curve', 'параметрична', '3d') },
  { id: '3d.vectorField', family: '3d', category: '3d', dragMime: GRAPHMASH_3D_DRAG_MIME,
    payload: JSON.stringify({ starterKind: 'vectorField' }), starterKind: 'vectorField',
    labelFallback: 'Векторне поле', iconKey: 'vectorField', sublabel: '(y, −x, z)',
    keywords: kw('векторне поле', 'vector field', '3d', 'поле') },
]

// ── Geometry / GeoMASH (geomash_scene) — Ф3.1: один вхід (редагування через воронку) ──
const GEOMASH_INSERTS: InsertEntry[] = [
  { id: 'geomash.scene', family: 'geomash', category: 'geomash', dragMime: GEOMASH_DRAG_MIME,
    payload: JSON.stringify({ starterKind: 'blank' }), starterKind: 'blank',
    labelFallback: 'GeoMASH-сцена', iconKey: 'scene', sublabel: 'жива геометрія',
    keywords: kw('geomash', 'гео', 'сцена', 'геометрія', 'geometry') },
]

/** Усі build-time вставки (без рантайм-geo). Для тестів + швидких шляхів. */
export const STATIC_INSERTS: readonly InsertEntry[] = [
  ...STEREO_INSERTS,
  ...ANALYSIS_INSERTS,
  ...QUADRATIC_INSERTS,
  ...TRIG_INSERTS,
  ...GRAPHMASH3D_INSERTS,
  ...GEOMASH_INSERTS,
]

// ── planimetry (geometry_2d_v2) — РАНТАЙМ ──────────────────────────────────────
/** window.GEO_PRESETS наповнюється vendor/geo2d-бандлом; порожньо до завантаження. */
function geoPresets(): GeoPresetMeta[] {
  const w = (typeof window !== 'undefined' ? window : {}) as { GEO_PRESETS?: GeoPresetMeta[] }
  return Array.isArray(w.GEO_PRESETS) ? w.GEO_PRESETS : []
}

/** Вставки планіметрії — читаються з window.GEO_PRESETS НА МОМЕНТ ВИКЛИКУ. */
export function geoInserts(): InsertEntry[] {
  return geoPresets().map((p) => ({
    id: `planimetry.${p.type}`,
    family: 'planimetry' as const,
    category: 'planimetry',
    dragMime: GEOMETRY_2D_V2_DRAG_MIME,
    payload: JSON.stringify({ preset: p.type }),
    labelKey: `winterboard.geo2dV2.preset.${p.type}.full`,
    labelFallback: p.full || p.type,
    iconKey: p.type,
    sublabel: p.short || undefined,
    keywords: kw(p.type, p.full, p.short, p.desc),
  }))
}

// ── Accessors ──────────────────────────────────────────────────────────────────
/** Усі вставки (статичні + рантайм-geo). Викликати на момент запиту. */
export function allInserts(): InsertEntry[] {
  return [...STATIC_INSERTS, ...geoInserts()]
}

/** Пошук за labelFallback / id / keywords (case-insensitive). Порожній q = всі. */
export function searchInserts(q: string, entries: InsertEntry[] = allInserts()): InsertEntry[] {
  const needle = q.trim().toLowerCase()
  if (!needle) return entries
  return entries.filter((e) =>
    e.labelFallback.toLowerCase().includes(needle) ||
    e.id.toLowerCase().includes(needle) ||
    e.keywords.some((k) => k.includes(needle)),
  )
}

/** Групування по родині (для секцій каталогу). */
export function insertsByFamily(entries: InsertEntry[] = allInserts()): Record<string, InsertEntry[]> {
  const out: Record<string, InsertEntry[]> = {}
  for (const e of entries) {
    ;(out[e.family] ??= []).push(e)
  }
  return out
}

// ── mashApp — 4 картки верхнього рівня (BoardMASH Ф3.2) ─────────────────────────
export type MashApp = '2d' | '3d' | 'geometry' | 'stereo'

/** family → 4-картка (analysis+quadratic+trig→2d; planimetry+geomash→geometry). */
const FAMILY_TO_APP: Readonly<Record<string, MashApp>> = {
  analysis: '2d', quadratic: '2d', trig: '2d',
  '3d': '3d',
  planimetry: 'geometry', geomash: 'geometry',
  stereo: 'stereo',
}

export function appOf(entry: InsertEntry): MashApp {
  return FAMILY_TO_APP[entry.family] ?? '2d'
}

/** Метадані 4 карток (id, підпис, family-іконка через InsertIcon). */
export const MASH_APPS: ReadonlyArray<{ app: MashApp; labelKey: string; labelFallback: string; iconFamily: string; iconKey: string }> = [
  { app: '2d', labelKey: '', labelFallback: 'GraphMASH 2D', iconFamily: 'analysis', iconKey: 'graphCalc' },
  { app: '3d', labelKey: '', labelFallback: 'GraphMASH 3D', iconFamily: '3d', iconKey: 'surface' },
  { app: 'geometry', labelKey: '', labelFallback: 'Geometry', iconFamily: 'geomash', iconKey: 'scene' },
  { app: 'stereo', labelKey: '', labelFallback: 'StereoMASH', iconFamily: 'stereo', iconKey: 'cube' },
]

/** Групування по 4 картках (для root-каталогу). */
export function insertsByApp(entries: InsertEntry[] = allInserts()): Record<MashApp, InsertEntry[]> {
  const out = { '2d': [], '3d': [], geometry: [], stereo: [] } as Record<MashApp, InsertEntry[]>
  for (const e of entries) out[appOf(e)].push(e)
  return out
}
