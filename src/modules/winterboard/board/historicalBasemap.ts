/**
 * Фізична основа історичної карти (закон §9 v1.78): суша, річки, озера, міста, моря — закріплений версійний файл
 * Natural Earth 1:10 млн (збирач `scripts/borders/build_physical_east_europe.py`). У стані дошки її немає; вантажиться
 * лише разом із рушієм карти. Нова основа — новий файл і нова версія тут; набір кордонів від неї не залежить.
 */
import type { BasemapId } from './basemaps'

type Ring = Array<[number, number]>

export interface PhysicalBasemap {
  meta: { basemap: BasemapId; version: string; region: [number, number, number, number]; box: [number, number, number, number] }
  land: Ring[][]
  rivers: Array<{ rank: number; name_uk: string; name_en: string; lines: Array<Array<[number, number]>> }>
  lakes: Array<{ polygons: Ring[][] }>
  cities: Array<{ name_uk: string; name_en: string; lon: number; lat: number; major: boolean }>
  seas: Array<{ name_uk: string; name_en: string; lon: number; lat: number }>
}

const PHYSICAL: Readonly<Partial<Record<BasemapId, { version: string; load: () => Promise<unknown> }>>> = Object.freeze({
  east_europe: { version: 'v1-ab5baad944', load: () => import('./data/physical_east_europe_ne10m.json') },
})

const cache = new Map<string, Promise<PhysicalBasemap | null>>()

/** Основа для карти або null (немає для цього регіону, збій завантаження — тоді карта без річок і міст). */
export function loadPhysicalBasemap(basemap: BasemapId): Promise<PhysicalBasemap | null> {
  const entry = PHYSICAL[basemap]
  if (!entry) return Promise.resolve(null)
  let pending = cache.get(basemap)
  if (!pending) {
    pending = entry.load().then((mod) => {
      const data = ((mod as { default?: unknown }).default ?? mod) as PhysicalBasemap
      return data?.meta?.version === entry.version && Array.isArray(data.land) ? data : null
    }).catch((err) => {
      console.warn('[WB:borders] основа не завантажилась', basemap, err instanceof Error ? err.name : 'load_failed')
      cache.delete(basemap)
      return null
    })
    cache.set(basemap, pending)
  }
  return pending
}
