/**
 * GeoMASH на дошці — жести, підказка й копіювання (власник 2026-10-08 після уроку «Вектори»:
 * «так, роби всі три»). Чисті функції (рушій передається параметром), щоб їх ловили тести:
 * картки в тестах не монтуються, а рушій — чистий JS.
 *
 *   Б-169: «Вектор» та інші інструменти з точок будуються й протягуванням пером від точки до
 *          кінця, а після першого дотику підказка каже, що далі («Клікніть кінець»).
 *   Б-168: виділений об'єкт копіюється разом зі своїми точками (рушій: `cloneClosure`) поруч;
 *          вектор/відрізок/промінь/пряму з вільними кінцями можна тягнути цілком.
 */
import type { GeoEngineApi, GeoObject, GeoToolSpecEntry } from '../vendor/geomash'

type Objs = Map<string, GeoObject>

/** Скільки пікселів має пройти перо, щоб дотик став протягуванням (а не другим дотиком). */
export const DRAG_FINISH_PX = 8

/** Інструменти, де друга точка — «кінець». */
const END_TOOLS = new Set(['vector', 'segment', 'ray'])
/** Лінії, які тягнуться цілком за саму лінію. */
const TRANSLATABLE = new Set(['vector', 'segment', 'ray', 'line'])

export interface GeomashHintState {
  activeEntry: GeoToolSpecEntry | null
  selectMode: boolean
  selectedGeoId: string | null
  picks: Record<string, string>
  poly: string[]
}

/** Підказка внизу полотна. `selectedIsLine` — виділено лінію, яку можна тягнути цілком. */
export function geomashHint(ts: GeomashHintState, selectedIsLine = false): string {
  const e = ts.activeEntry
  if (!e) {
    if (!ts.selectMode) return ''
    if (!ts.selectedGeoId) return 'Клікніть об\'єкт щоб виділити'
    return selectedIsLine
      ? 'Обрано · тягніть лінію, щоб посунути цілком · Ctrl+C, Ctrl+V — копія'
      : 'Обрано · тягніть точку щоб посунути · Ctrl+C, Ctrl+V — копія'
  }
  const multi = e.inputs.find((i) => i.multi)
  if (multi) return `Клікайте точки (${ts.poly.length}) · подвійний клік — завершити`
  if (e.inputs.length === 0) return e.op === 'point' ? 'Клікніть — нова точка' : e.op === 'slider' ? 'Клікніть — повзунок' : ''
  const next = e.inputs.filter((i) => !i.multi).find((i) => !ts.picks[i.role])
  if (!next) return 'Готово'
  const acc = next.accepts
  const hasPt = acc.includes('point')
  const pickedPoint = e.inputs.some((i) => !i.multi && i.accepts.includes('point') && ts.picks[i.role])
  if (hasPt && pickedPoint) return END_TOOLS.has(e.op) ? 'Клікніть кінець' : 'Клікніть наступну точку'
  const hasLine = acc.some((t) => ['line', 'segment', 'ray', 'vector', 'dline'].includes(t))
  const hasCirc = acc.some((t) => ['circle', 'circle3'].includes(t))
  const target = hasPt ? 'точку (або порожнє місце)'
    : hasLine && hasCirc ? 'лінію або коло'
    : hasCirc ? 'коло' : hasLine ? 'пряму/відрізок' : 'об\'єкт'
  if (hasPt) return `Клікніть ${target}`
  const nth = Object.keys(ts.picks).length ? 'наступну' : 'першу'
  return `Клікніть ${nth} ${target}`
}

/** Наступна роль інструмента приймає точку — тоді протягування від першої точки її заповнить. */
export function nextRoleTakesPoint(entry: GeoToolSpecEntry, picks: Record<string, string>): boolean {
  const next = entry.inputs.find((i) => !i.multi && !picks[i.role])
  return !!next && next.accepts.includes('point')
}

function isFreePoint(o: GeoObject | undefined): boolean {
  return !!o && o.type === 'point' && typeof o.wx === 'number' && !o.midOf && !o.regOf && !o.intOf && !o.onObj
}

/** Кінці лінії, яку можна тягнути цілком (обидва — вільні точки); інакше null. */
export function lineEndpoints(objects: Objs, id: string | null): [string, string] | null {
  const o = id ? objects.get(id) : undefined
  if (!o || !TRANSLATABLE.has(o.type)) return null
  const p1 = o.p1 as string | undefined
  const p2 = o.p2 as string | undefined
  if (!p1 || !p2 || !isFreePoint(objects.get(p1)) || !isFreePoint(objects.get(p2))) return null
  return [p1, p2]
}

/**
 * Посунути лінію цілком: обидва кінці на той самий зсув (напрям і довжина ті самі).
 * `start` — координати кінців на початку перетягування. Помилка рушія → null (нічого не міняємо).
 */
export function translateLine(
  eng: Pick<GeoEngineApi, 'move'>, objects: Objs, cs: unknown,
  ends: [string, string], start: Record<string, { wx: number; wy: number }>, dx: number, dy: number,
): Objs | null {
  let m = objects
  for (const id of ends) {
    const p = start[id]
    const r = eng.move(m, cs, id, p.wx + dx, p.wy + dy)
    if ('error' in r) return null
    m = r.objects
  }
  return m
}

/** Зсув, прив'язаний до кроку сітки: кінці, що стояли на вузлах, і лишаються на вузлах. */
export function snapDelta(d: number, step: number): number {
  return step > 0 ? Math.round(d / step) * step : d
}

/**
 * Копія об'єктів разом із їхніми точками поруч (`n`-та копія — далі, щоб копії не лягали одна
 * на одну). Повертає нову сцену й id копії першого об'єкта (щоб одразу її виділити).
 */
export function duplicateObjects(
  eng: Pick<GeoEngineApi, 'cloneClosure'>, objects: Objs, ids: string[], n = 1,
): { objects: Objs; firstId: string | null } | null {
  const live = ids.filter((id) => objects.has(id))
  if (!live.length) return null
  const { entries, map } = eng.cloneClosure(objects, live, { dx: n, dy: -n })
  if (!entries.length) return null
  const m = new Map(objects)
  for (const [nid, obj] of entries) m.set(nid, obj)
  return { objects: m, firstId: map[live[0]] ?? null }
}
