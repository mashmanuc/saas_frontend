/**
 * Локально закріплені картографічні основи для `map_card` (H3).
 *
 * ЧОМУ НЕ ЖИВІ TILES. ТЗ §7.2 прямо забороняє: рендерер не має ходити в
 * мережу, бо картка мусить однаково малюватись у класі без інтернету, у
 * реплеї через рік і в PDF. Публічний `tile.openstreetmap.org` як
 * production-SLA заборонений окремо.
 *
 * ЩО ТУТ Є. Рамки (bounding box) трьох основ і проєкція. Це НЕ намальовані
 * кордони: v1 малює точки, підписи, маршрути й прості області, а не політичну
 * карту.
 *
 * ⚠️ ПРО КОРДОНИ УКРАЇНИ. Natural Earth НЕ є авторитетним джерелом політичних
 * кордонів України (рішення власника, ТЗ §3.2-bis). Тому жоден набір кордонів
 * сюди поки не вкладено: доки немає затвердженого українського overlay із
 * provenance і ліцензією, карта показує МІСЦЯ на нейтральній сітці й чесно
 * підписується «Сучасна картографічна основа». Намалювати межі «приблизно»
 * було б гірше за їх відсутність.
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
export const BASEMAP_VERSION = 'neutral-grid-1'

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
export function project(lat: unknown, lon: unknown, spec: BasemapSpec): { x: number; y: number } | null {
  const la = typeof lat === 'number' ? lat : Number.NaN
  const lo = typeof lon === 'number' ? lon : Number.NaN
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return null
  if (la < -90 || la > 90 || lo < -180 || lo > 180) return null

  const [west, south, east, north] = spec.bounds
  if (lo < west || lo > east || la < south || la > north) return null

  const mercator = (deg: number) => {
    const clamped = Math.max(-85, Math.min(85, deg))
    return Math.log(Math.tan(Math.PI / 4 + (clamped * Math.PI) / 360))
  }
  const yTop = mercator(north)
  const yBottom = mercator(south)
  const y = (yTop - mercator(la)) / (yTop - yBottom)
  const x = (lo - west) / (east - west)
  return { x, y }
}
