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
  /** Світовий набір: держави, чий підпис — великими літерами (найбільші в кадрі); інакше — BIG_ENTITIES. */
  big?: string[]
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
  /** Роки набору (включно) — без завантаження файла: зв'язка зі шкалою подій (закон §9 v1.79). */
  years: readonly [number, number]
}

export const CLIOPATRIA_EAST_EUROPE = 'cliopatria-east-europe-1648-1687'
/** Світовий набір (власник 30.10: «універсальність, а не прив'язка до цієї теми»): уся Cliopatria від року 0,
 *  статичні шматки `public/maps/borders/<версія>/` (збирач `scripts/borders/build_cliopatria_world.py`). Регіон і
 *  роки — у `borders` картки (з подій шкали при вставці). */
export const CLIOPATRIA_WORLD = 'cliopatria-world'
export const CLIOPATRIA_WORLD_VERSION = 'w1-83a876a6a2'

/** Закріплені набори. Нова версія — новий файл і новий рядок; старий лишається для старих дошок. */
export const BORDER_DATASETS: Readonly<Record<string, DatasetEntry>> = Object.freeze({
  [CLIOPATRIA_EAST_EUROPE]: {
    version: 'v1-b38dff2ad6',
    basemap: 'east_europe',
    title: { uk: 'Східна Європа', en: 'Eastern Europe' },
    note: {
      uk: 'Гетьманщини в наборі немає — карта її не домальовує. Запорозькі козаки є з 1662 р.',
      en: 'The Cossack Hetmanate is not in the dataset — the map does not draw it. Zaporozhian Cossacks appear from 1662.',
    },
    load: () => import('./data/borders_cliopatria_east_europe_1648_1687.json'),
    years: [1648, 1687],
  },
  [CLIOPATRIA_WORLD]: {
    version: CLIOPATRIA_WORLD_VERSION,
    basemap: 'world',
    title: { uk: 'Історична карта', en: 'Historical map' },
    note: {
      uk: 'Межі держав схематичні. Не всі держави є в наборі: Гетьманщини немає — карта її не домальовує.',
      en: 'Borders are schematic. Not every state is in the dataset: the Cossack Hetmanate is missing.',
    },
    // Світовий набір не вантажиться цілим — лише шматки регіону й років (`loadBordersFor`)
    load: () => Promise.resolve(null),
    years: [0, 2024],
  },
})

/** Назва держави в Cliopatria → наша сутність (палітра дизайнера, короткі назви) для 11 держав макета. */
const KNOWN_ENTITIES: Readonly<Record<string, string>> = Object.freeze({
  'Polish-Lithuanian Commonwealth': 'commonwealth', 'Tsardom of Russia': 'muscovy', 'Ottoman Empire': 'ottoman',
  'Crimean Khanate': 'crimea', 'Zaporozhian Cossacks': 'zaporozhian_cossacks', 'Principality of Moldavia': 'moldavia',
  'Principality of Wallachia': 'wallachia', 'Principality of Transylvania': 'transylvania',
  'Habsburg Monarchy': 'habsburg', 'Swedish Empire': 'sweden', 'Brandenburg-Prussia': 'brandenburg_prussia',
})

/** Укр. назви 11 держав макета — коли у Вікіданих укр. назви немає (замір 30.10: «Habsburg Monarchy»). */
const KNOWN_UK: Readonly<Record<string, string>> = Object.freeze({
  commonwealth: 'Річ Посполита', muscovy: 'Московське царство', ottoman: 'Османська імперія', crimea: 'Кримське ханство',
  zaporozhian_cossacks: 'Запорозькі козаки', moldavia: 'Молдавське князівство', wallachia: 'Валахія',
  transylvania: 'Трансильванія', habsburg: 'Габсбурзька монархія', sweden: 'Шведська імперія',
  brandenburg_prussia: 'Бранденбург-Пруссія',
})

interface WorldIndexState {
  id: string; en: string; uk: string; wd: string; from: number; to: number
  bbox: [number, number, number, number]; label: Position | null; pack: string
}
interface WorldIndex { meta: { version: string; source: BordersDataset['meta']['source'] & { sha256?: string } }; states: WorldIndexState[] }

const worldIndex = new Map<string, Promise<WorldIndex | null>>()
const worldPacks = new Map<string, Promise<Record<string, Position[][][]> | null>>()

function fetchJson<T>(url: string): Promise<T | null> {
  return fetch(url).then((r) => (r.ok ? r.json() as Promise<T> : null)).catch((err) => {
    console.warn('[WB:borders] не завантажилось', url, err instanceof Error ? err.name : 'fetch_failed')
    return null
  })
}

function cached<T>(map: Map<string, Promise<T | null>>, key: string, load: () => Promise<T | null>): Promise<T | null> {
  let p = map.get(key)
  if (!p) {
    p = load().then((v) => { if (v === null) map.delete(key); return v })
    map.set(key, p)
  }
  return p
}

const overlaps = (b: number[], r: number[]) => !(b[2] < r[0] || b[0] > r[2] || b[3] < r[1] || b[1] > r[3])

/**
 * Світовий набір під тему: з покажчика — держави, що перетинають регіон у роки теми; з шматків — лише їхня геометрія.
 * Роки змін — з `from` держав у межах років теми. «Великі» підписи — держави, що займають ≥ 12 % регіону.
 */
async function loadWorld(b: MapBorders): Promise<BordersDataset | null> {
  const region = b.region
  const years = b.years
  if (!region || !years) return null
  const base = `/maps/borders/${b.version}`
  const index = await cached(worldIndex, b.version, () => fetchJson<WorldIndex>(`${base}/index.json`))
  if (!index || index.meta?.version !== b.version) return null
  const picked = index.states.filter((s) => s.to >= years[0] && s.from <= years[1] && overlaps(s.bbox, region))
  const packs = await Promise.all([...new Set(picked.map((s) => s.pack))].map((p) =>
    cached(worldPacks, `${b.version}/${p}`, () => fetchJson<Record<string, Position[][][]>>(`${base}/p/${p}.json`))
      .then((body) => [p, body] as const)))
  const geo = new Map(packs)
  if (packs.some(([, body]) => !body)) return null
  const states: BorderState[] = picked.map((s) => {
    const entity = KNOWN_ENTITIES[s.en] ?? (s.wd ? `wd:${s.wd}` : `en:${s.en}`)
    return { id: s.id, entity, name_uk: s.uk || KNOWN_UK[entity] || s.en, name_en: s.en, from: s.from, to: s.to, label: s.label,
      wikidata: s.wd || null, polygons: geo.get(s.pack)?.[s.id] ?? [] }
  }).filter((s) => s.polygons.length)
  const regionArea = Math.max(1e-6, (region[2] - region[0]) * (region[3] - region[1]))
  const big = [...new Set(picked.filter((s) => {
    const w = Math.min(s.bbox[2], region[2]) - Math.max(s.bbox[0], region[0])
    const h = Math.min(s.bbox[3], region[3]) - Math.max(s.bbox[1], region[1])
    return w > 0 && h > 0 && (w * h) / regionArea >= 0.12
  }).map((s) => KNOWN_ENTITIES[s.en] ?? (s.wd ? `wd:${s.wd}` : `en:${s.en}`)))]
  const change = [...new Set(states.map((s) => Math.max(s.from, years[0])).filter((y) => y <= years[1]))].sort((a, z) => a - z)
  if (!change.length || change[0] !== years[0]) change.unshift(years[0])
  return {
    big,
    meta: {
      dataset: CLIOPATRIA_WORLD, version: b.version, region, years, change_years: change,
      source: { title: index.meta.source.title, url: index.meta.source.url, license: index.meta.source.license,
        license_url: index.meta.source.license_url },
      changes_by_m4sh: 'роки від 0; без об\'єднань у дужках; спрощено 0,02°; укр. назви — з Вікіданих',
      years_inclusive: true, verified_by_historian: false,
    },
    states,
  }
}

const worldCache = new Map<string, Promise<BordersDataset | null>>()

/** Набір меж для карти: «Східна Європа 1648–1687» — файлом версії; світовий — шматками регіону й років. */
export function loadBordersFor(b: MapBorders | null | undefined): Promise<BordersDataset | null> {
  if (!b) return Promise.resolve(null)
  if (b.dataset !== CLIOPATRIA_WORLD) return loadBorders(b.dataset, b.version)
  if (b.version !== CLIOPATRIA_WORLD_VERSION) return Promise.resolve(null)
  return cached(worldCache, `${b.version}|${(b.region ?? []).join(',')}|${(b.years ?? []).join(',')}`, () => loadWorld(b))
}

/** Підпис держави великими літерами: у світовому наборі — найбільші в регіоні, у «Східній Європі» — три імперії. */
export function isBigEntity(data: BordersDataset | null | undefined, entity: string): boolean {
  return data?.big ? data.big.includes(entity) : BIG_ENTITIES.has(entity)
}

/** Роки, у межах яких карта йде за подіями шкали: світовий набір — роки теми, інакше — роки файла набору. */
export function bordersYears(b: MapBorders): readonly [number, number] | null {
  if (b.dataset === CLIOPATRIA_WORLD) return b.years && b.version === CLIOPATRIA_WORLD_VERSION ? b.years : null
  return datasetYears(b.dataset, b.version)
}

/** Роки набору рівно цієї версії або null (невідомий набір чи інша версія). */
export function datasetYears(dataset: string, version: string): readonly [number, number] | null {
  const entry = BORDER_DATASETS[dataset]
  return entry && entry.version === version ? entry.years : null
}

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
  const region = Array.isArray(b.region) && b.region.length === 4 && b.region.every(Number.isFinite) ? b.region : undefined
  const years = Array.isArray(b.years) && b.years.length === 2 && b.years.every(Number.isInteger) ? b.years : undefined
  return { dataset: b.dataset, version: b.version, year: b.year as number, ...(region ? { region } : {}), ...(years ? { years } : {}) }
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
