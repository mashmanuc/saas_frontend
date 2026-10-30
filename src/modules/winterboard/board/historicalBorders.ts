/**
 * Кордони держав у часі для `map_card` (ТЗ `saas_docs/plans/TZ_HISTORICAL_BORDERS_MAP_2026-10-30.md`).
 *
 * ЛИШЕ ДАНІ. Власник 2026-10-30: «об'єкт не має залежати від ChatGPT… Він залежить від даних, які до нього
 * надходять… Не треба вплітати туди всередину інтегралика». Межі беруться з закріпленого набору певної версії;
 * картка зберігає лише `{dataset, version, year}`. Невідомий набір чи інша версія — меж немає (чесно), а не
 * «найближча» версія: стара дошка й Replay мусять малюватись так, як їх провели.
 *
 * Набір лежить окремим файлом і вантажиться лише тоді, коли на дошці є така карта.
 * Звідки: Cliopatria (Seshat Global History Databank), CC BY 4.0 — збирач
 * `scripts/borders/build_cliopatria_east_europe.py`; що змінено — у `meta.changes_by_m4sh` набору.
 */
import type { BasemapId } from './basemaps'
import type { MapBorders } from '../types/winterboard'

type Position = [number, number]

export interface BorderState {
  /** `сутність:від-до` — одна версія меж однієї держави. */
  id: string
  /** Стабільна сутність (держава) — однакова в усіх її версіях; за нею колір. */
  entity: string
  name_uk: string
  name_en: string
  from: number
  to: number
  /** Точка підпису [lon, lat] або null — видимої частини замало для підпису. */
  label: Position | null
  wikidata: string | null
  polygons: Position[][][]
}

export interface BordersDataset {
  meta: {
    dataset: string
    version: string
    region: [number, number, number, number]
    years: [number, number]
    change_years: number[]
    source: { title: string; url: string; license: string; license_url: string }
    changes_by_m4sh: string
    years_inclusive: boolean
    verified_by_historian: boolean
  }
  states: BorderState[]
}

interface DatasetEntry {
  version: string
  basemap: BasemapId
  title: { uk: string; en: string }
  /** Чесна примітка набору: чого в ньому немає (показується під легендою). */
  note: { uk: string; en: string }
  load: () => Promise<unknown>
}

export const CLIOPATRIA_EAST_EUROPE = 'cliopatria-east-europe-1648-1687'

/** Закріплені набори. Нова версія — новий файл і новий рядок; старий лишається для старих дошок. */
export const BORDER_DATASETS: Readonly<Record<string, DatasetEntry>> = Object.freeze({
  [CLIOPATRIA_EAST_EUROPE]: {
    version: 'v1-c78ce622b1',
    basemap: 'east_europe',
    title: { uk: 'Східна Європа', en: 'Eastern Europe' },
    note: {
      uk: 'Гетьманщини в наборі немає — карта її не домальовує. Запорозькі козаки є з 1662 р.',
      en: 'The Cossack Hetmanate is not in the dataset — the map does not draw it. Zaporozhian Cossacks appear from 1662.',
    },
    load: () => import('./data/borders_cliopatria_east_europe_1648_1687.json'),
  },
})

const cache = new Map<string, Promise<BordersDataset | null>>()

/** Набір рівно цієї версії або null (невідомий набір, інша версія, збій завантаження). */
export function loadBorders(dataset: unknown, version: unknown): Promise<BordersDataset | null> {
  const entry = typeof dataset === 'string' ? BORDER_DATASETS[dataset] : undefined
  if (!entry || version !== entry.version) return Promise.resolve(null)
  const key = `${dataset}@${version}`
  let pending = cache.get(key)
  if (!pending) {
    pending = entry.load().then((mod) => {
      const data = ((mod as { default?: unknown }).default ?? mod) as BordersDataset
      return data?.meta?.version === version && Array.isArray(data.states) ? data : null
    }).catch((err) => {
      console.warn('[WB:borders] набір не завантажився', key, err instanceof Error ? err.name : 'load_failed')
      cache.delete(key)
      return null
    })
    cache.set(key, pending)
  }
  return pending
}

/** Держави, чиї межі діють цього року (`from ≤ year ≤ to`, роки набору включні). */
/** Кордони карти з дошки — {dataset, version, year} або null (немає / зіпсовано). Лише наші id, без координат. */
export function mapBordersOf(asset: { type?: string | null; data?: unknown }): MapBorders | null {
  if (asset.type !== 'map_card') return null
  const b = (asset.data as { borders?: Partial<MapBorders> } | null | undefined)?.borders
  if (!b || typeof b.dataset !== 'string' || typeof b.version !== 'string' || !Number.isInteger(b.year)) return null
  return { dataset: b.dataset, version: b.version, year: b.year as number }
}

export function statesAt(data: BordersDataset, year: number): BorderState[] {
  return data.states.filter((s) => s.from <= year && year <= s.to)
}

/** Роки, коли в наборі змінюються межі (з самих даних). */
export function changeYears(data: BordersDataset): number[] {
  return data.meta.change_years
}

/** Наступний (dir=1) чи попередній (dir=-1) рік зміни меж відносно `year`; на краю — той самий рік. */
export function stepYear(data: BordersDataset, year: number, dir: 1 | -1): number {
  const years = changeYears(data)
  if (dir > 0) return years.find((y) => y > year) ?? year
  return [...years].reverse().find((y) => y < year) ?? year
}

/** Рік у межах набору (поза ним — найближчий край). */
export function clampYear(data: BordersDataset, year: unknown): number {
  const [from, to] = data.meta.years
  const y = typeof year === 'number' && Number.isFinite(year) ? Math.round(year) : from
  return Math.min(to, Math.max(from, y))
}

/** Різниця двох знімків: межі змінилися (інша версія), з'явилася, зникла — за сутністю. */
export interface BordersDiff { changed: string[]; added: string[]; gone: string[] }

/** Знімок — останній рік зміни меж ≤ року; попередній знімок — рік зміни перед ним (або null). */
export function snapshotYears(data: BordersDataset, year: number): { snapshot: number; previous: number | null } {
  const years = changeYears(data)
  const snapshot = [...years].reverse().find((y) => y <= year) ?? years[0]
  const i = years.indexOf(snapshot)
  return { snapshot, previous: i > 0 ? years[i - 1] : null }
}

export function bordersDiff(data: BordersDataset, year: number): BordersDiff {
  const { snapshot, previous } = snapshotYears(data, year)
  if (previous === null) return { changed: [], added: [], gone: [] }
  const before = new Map(statesAt(data, previous).map((s) => [s.entity, s.id]))
  const now = new Map(statesAt(data, snapshot).map((s) => [s.entity, s.id]))
  return {
    changed: [...now].filter(([e, id]) => before.has(e) && before.get(e) !== id).map(([e]) => e),
    added: [...now.keys()].filter((e) => !before.has(e)),
    gone: [...before.keys()].filter((e) => !now.has(e)),
  }
}

/** Палітра держав — макет дизайнера 30.10 («Палітра і стилі»): непрозорі заливки середньої світлоти, сусіди
 *  розрізняються відтінком; колір закріплений за державою й не змінюється між роками. */
export const ENTITY_COLORS: Readonly<Record<string, string>> = Object.freeze({
  commonwealth: '#e07a5f',
  muscovy: '#7d9fd0',
  ottoman: '#4fb3a1',
  sweden: '#a88fcf',
  brandenburg_prussia: '#8eaab8',
  habsburg: '#cdb48f',
  transylvania: '#8cc084',
  moldavia: '#e3a857',
  wallachia: '#dba2c0',
  crimea: '#f0cf62',
  zaporozhian_cossacks: '#b56fb0',
})

/** Нова держава в даних без кольору — відтінок за назвою (золотий кут), карта не ламається. */
export function entityColor(entity: string): string {
  const known = ENTITY_COLORS[entity]
  if (known) return known
  let h = 0
  for (const ch of entity) h = (h * 31 + (ch.codePointAt(0) ?? 0)) >>> 0
  return `hsl(${Math.round((h * 137.508) % 360)} 45% 66%)`
}

/** Короткі назви для картки на дошці (макет: «На картці — короткі назви»); на весь екран — повні. */
export const ENTITY_SHORT_UK: Readonly<Record<string, string>> = Object.freeze({
  muscovy: 'Московія',
  ottoman: 'Османська імп.',
  sweden: 'Швеція',
  brandenburg_prussia: 'Бранденбург',
  habsburg: 'Габсбурги',
  moldavia: 'Молдавія',
  crimea: 'Крим. ханство',
  zaporozhian_cossacks: 'Запорожжя',
})

/** Імперії — підпис великими літерами з розрядкою й першими за пріоритетом. */
export const BIG_ENTITIES: ReadonlySet<string> = new Set(['commonwealth', 'muscovy', 'ottoman'])
