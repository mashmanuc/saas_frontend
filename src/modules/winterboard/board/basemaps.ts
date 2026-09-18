import naturalEarthLand from './data/ne_110m_land.json'

/**
 * Локально закріплені картографічні основи для `map_card` (H3).
 *
 * ЧОМУ НЕ ЖИВІ TILES. ТЗ §7.2 прямо забороняє: рендерер не має ходити в
 * мережу, бо картка мусить однаково малюватись у класі без інтернету, у
 * реплеї через рік і в PDF. Публічний `tile.openstreetmap.org` як
 * production-SLA заборонений окремо.
 *
 * ЩО ТУТ Є. Рамки трьох основ, проєкція і локально закріплена геометрія суші
 * Natural Earth. Це НЕ політичні кордони: v1 малює фізичну основу, точки,
 * підписи, маршрути й прості області.
 *
 * ⚠️ ПРО КОРДОНИ УКРАЇНИ. Natural Earth НЕ є авторитетним джерелом політичних
 * кордонів України (рішення власника, ТЗ §3.2-bis). Тому жоден набір кордонів
 * сюди не вкладено: доки немає затвердженого українського overlay із
 * provenance і ліцензією, карта показує фізичну сушу без державних меж.
 */
export type BasemapId = 'world' | 'europe' | 'ukraine'

export interface BasemapSpec {
  id: BasemapId
  /** Межі у градусах: [захід, південь, схід, північ]. */
  bounds: [number, number, number, number]
  /** Крок сітки меридіанів/паралелей у градусах — лише орієнтир для ока. */
  grid: number
}

/**
 * Версія набору. Піднімати, коли міняються межі чи сітка: картка зберігає
 * `basemap_version` у своїх даних, тож стара дошка має лишатись такою, якою її
 * створили, а не поповзти після оновлення коду.
 */
export const BASEMAP_VERSION = 'natural-earth-110m-ca96624a'

/** Закріплений фізичний шар без державних кордонів. Natural Earth — public
 * domain; commit і SHA потрібні, щоб replay через роки малював ту саму землю. */
export const NATURAL_EARTH_MANIFEST = Object.freeze({
  dataset: 'Natural Earth 1:110m Land',
  source: 'https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_110m_land.geojson',
  commit: 'ca96624a56bd078437bca8184e78163e5039ad19',
  sha256: '9e0729ee253ca7d7a5c4ae9395fb1902264c5377c52e224d13dd85010e2835d9',
  license: 'Public Domain',
})

export const BASEMAPS: Readonly<Record<BasemapId, BasemapSpec>> = Object.freeze({
  world: { id: 'world', bounds: [-180, -60, 180, 85], grid: 30 },
  europe: { id: 'europe', bounds: [-25, 34, 45, 71], grid: 10 },
  ukraine: { id: 'ukraine', bounds: [21, 44, 41, 53], grid: 2 },
})

export function basemapSpec(id: unknown): BasemapSpec {
  return BASEMAPS[(id as BasemapId)] ?? BASEMAPS.europe
}

/**
 * Географічні координати → частки [0..1] усередині основи (Mercator).
 *
 * Повертає `null`, якщо точка поза межами основи або координата непридатна.
 * Це навмисно: marker, притиснутий до краю, виглядав би як факт про місце, яке
 * насправді деінде. Краще чесно не показати.
 */
function projectRaw(lat: number, lon: number, spec: BasemapSpec): { x: number; y: number } {
  const [west, south, east, north] = spec.bounds
  const mercator = (deg: number) => {
    const clamped = Math.max(-85, Math.min(85, deg))
    return Math.log(Math.tan(Math.PI / 4 + (clamped * Math.PI) / 360))
  }
  const yTop = mercator(north)
  const yBottom = mercator(south)
  return {
    x: (lon - west) / (east - west),
    y: (yTop - mercator(lat)) / (yTop - yBottom),
  }
}

export function project(lat: unknown, lon: unknown, spec: BasemapSpec): { x: number; y: number } | null {
  const la = typeof lat === 'number' ? lat : Number.NaN
  const lo = typeof lon === 'number' ? lon : Number.NaN
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return null
  if (la < -90 || la > 90 || lo < -180 || lo > 180) return null

  const [west, south, east, north] = spec.bounds
  if (lo < west || lo > east || la < south || la > north) return null

  return projectRaw(la, lo, spec)
}

type Position = [number, number]
type PolygonCoordinates = Position[][]
type MultiPolygonCoordinates = Position[][][]
type LandGeometry = {
  type?: 'Polygon' | 'MultiPolygon'
  coordinates?: PolygonCoordinates | MultiPolygonCoordinates
}
type LandCollection = { features?: Array<{ geometry?: LandGeometry }> }

/** SVG paths фізичної суші для заданої основи. Координати поза viewport не
 * відкидаємо: SVG clip обрізає їх коректно, без фальшивих ліній по краях. */
export function landPaths(spec: BasemapSpec, viewBox = 1000): string[] {
  const collection = naturalEarthLand as unknown as LandCollection
  const out: string[] = []
  const ringPath = (ring: Position[]): string => ring.flatMap((point, index) => {
    const [lon, lat] = point
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return []
    const p = projectRaw(lat, lon, spec)
    const command = index === 0 ? 'M' : 'L'
    return [`${command}${(p.x * viewBox).toFixed(2)},${(p.y * viewBox).toFixed(2)}`]
  }).join(' ') + ' Z'

  for (const feature of collection.features ?? []) {
    const geometry = feature.geometry
    if (!geometry?.coordinates) continue
    const polygons = geometry.type === 'Polygon'
      ? [geometry.coordinates as PolygonCoordinates]
      : geometry.coordinates as MultiPolygonCoordinates
    for (const polygon of polygons) {
      const d = polygon.map(ringPath).filter(path => path !== ' Z').join(' ')
      if (d) out.push(d)
    }
  }
  return out
}
