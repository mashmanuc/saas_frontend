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
  /** `from` — рік заснування (світова основа): місто на карті лише з цього року. Немає — показується завжди. */
  cities: Array<{ name_uk: string; name_en: string; lon: number; lat: number; major: boolean; from?: number }>
  seas: Array<{ name_uk: string; name_en: string; lon: number; lat: number }>
}

const PHYSICAL: Readonly<Partial<Record<BasemapId, { version: string; load: () => Promise<unknown> }>>> = Object.freeze({
  east_europe: { version: 'v1-ab5baad944', load: () => import('./data/physical_east_europe_ne10m.json') },
})

const cache = new Map<string, Promise<PhysicalBasemap | null>>()

/** Основа на весь світ (власник 30.10 — універсальність): шматки 30° `public/maps/physical/<версія>/`. */
export const PHYSICAL_WORLD_VERSION = 'pw1-a4557e521b'
const TILE = 30
type WorldTile = {
  land: Ring[][]; rivers: Array<{ rank: number; name_uk: string; lines: Array<Array<[number, number]>> }>
  lakes: Ring[][]; cities: PhysicalBasemap['cities']
}
const tiles = new Map<string, Promise<WorldTile | null>>()

function loadTile(key: string): Promise<WorldTile | null> {
  let p = tiles.get(key)
  if (!p) {
    p = fetch(`/maps/physical/${PHYSICAL_WORLD_VERSION}/${key}.json`)
      .then((r) => (r.ok ? r.json() as Promise<WorldTile> : null))
      .catch((err) => {
        // Шматка немає чи мережа — карта без суші в цій клітинці, межі держав лишаються
        console.warn('[WB:borders] основа не завантажилась', key, err instanceof Error ? err.name : 'fetch_failed')
        return null
      })
    tiles.set(key, p)
  }
  return p
}

/** Основа для регіону світової карти — шматки, що його перетинають (із запасом: при нахилі видно далі). */
export async function loadPhysicalFor(region: [number, number, number, number]): Promise<PhysicalBasemap | null> {
  const [w, s, e, n] = [region[0] - 8, region[1] - 6, region[2] + 8, region[3] + 6]
  const keys: string[] = []
  for (let tx = Math.floor((Math.max(w, -180) + 180) / TILE); tx <= Math.floor((Math.min(e, 179.999) + 180) / TILE); tx++) {
    for (let ty = Math.floor((Math.max(s, -90) + 90) / TILE); ty <= Math.floor((Math.min(n, 89.999) + 90) / TILE); ty++) {
      keys.push(`${tx}-${ty}`)
    }
  }
  const got = (await Promise.all(keys.map(loadTile))).filter((t): t is WorldTile => !!t)
  if (!got.length) return null
  return {
    meta: { basemap: 'world', version: PHYSICAL_WORLD_VERSION, region, box: [w, s, e, n] },
    land: got.flatMap((t) => t.land),
    rivers: got.flatMap((t) => t.rivers.map((r) => ({ ...r, name_en: '' }))),
    lakes: got.flatMap((t) => t.lakes.map((rings) => ({ polygons: [rings] }))),
    cities: got.flatMap((t) => t.cities),
    seas: [],
  }
}

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
