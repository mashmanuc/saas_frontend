import { BASEMAP_VERSION } from '../board/basemaps'
import { BORDER_DATASETS, CLIOPATRIA_EAST_EUROPE, CLIOPATRIA_WORLD } from '../board/historicalBorders'
import type { MapCardData, TimelineCardData, WBAsset } from '../types/winterboard'

export const TIMELINE_CARD_DRAG_MIME = 'application/x-m4sh-timeline-card'
export const MAP_CARD_DRAG_MIME = 'application/x-m4sh-map-card'
/** 2026-10-30: карта з кордонами держав у часі (пілот `historical_borders`). */
export const HISTORICAL_MAP_DRAG_MIME = 'application/x-m4sh-historical-map'

/** v1.82: шкала поруч з історичною картою — смуга згори на всю ширину аркуша 1920 (висота — у масштабі дошки). */
export const TIMELINE_STRIP_W = 1840
export const TIMELINE_STRIP_H = 360

type ContentLanguage = 'uk' | 'en'

export function buildBlankTimelineAsset(
  pos: { x: number; y: number },
  language: ContentLanguage = 'uk',
): WBAsset {
  const data: TimelineCardData = {
    version: 1,
    title: '',
    layout: 'ordinal',
    orientation: 'horizontal',
    events: [],
    active_event_id: null,
    sources: [],
    content_language: language,
  }
  return {
    id: `timeline-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'timeline_card', src: '', x: pos.x - 380, y: pos.y - 220,
    w: 760, h: 440, rotation: 0, locked: false, data,
  }
}

export function buildBlankMapAsset(
  pos: { x: number; y: number },
  language: ContentLanguage = 'uk',
): WBAsset {
  const data: MapCardData = {
    version: 1,
    title: '',
    basemap: 'europe',
    basemap_version: BASEMAP_VERSION,
    projection: 'mercator',
    historical_boundary_mode: 'none',
    markers: [], routes: [], regions: [], active_marker_id: null, sources: [],
    content_language: language,
  }
  return {
    id: `map-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'map_card', src: '', x: pos.x - 340, y: pos.y - 260,
    w: 680, h: 520, rotation: 0, locked: false, data,
  }
}

/** Карта з кордонами в часі (ТЗ TZ_HISTORICAL_BORDERS_MAP_2026-10-30): лише посилання на набір і перший рік. */
/** Тема зі шкали сторінки: регіон (місця подій), роки й назва — для світової карти. */
export interface HistoricalMapTopic {
  title: string
  places: Array<{ lat: number; lon: number }>
  years: [number, number]
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
}

/**
 * Основна група місць: далекі поодинокі точки не розтягують карту (замір 30.10: «Французько-російська війна 1812»
 * у джерелі — центр Росії, 70° сх. д.; у «Другій світовій» — Тихий океан). Тримаємо точки ближче за
 * max(20°, 3 × медіанна відстань) до медіанного центру, якщо їх щонайменше 60 %; інакше — усі.
 */
export function mainPlaces(places: HistoricalMapTopic['places']): HistoricalMapTopic['places'] {
  if (places.length < 4) return places
  const c = { lon: median(places.map((p) => p.lon)), lat: median(places.map((p) => p.lat)) }
  const dist = (p: { lon: number; lat: number }) => Math.hypot(p.lon - c.lon, p.lat - c.lat)
  const limit = Math.max(20, 3 * median(places.map(dist)))
  const kept = places.filter((p) => dist(p) <= limit)
  return kept.length >= places.length * 0.6 ? kept : places
}

/** Регіон карти з місць подій: основна група, запас ¼ розмаху (не менше 3°), не менше 14° × 9°, у межах світу. */
export function topicRegion(all: HistoricalMapTopic['places']): [number, number, number, number] {
  const places = mainPlaces(all)
  const lons = places.map((p) => p.lon)
  const lats = places.map((p) => p.lat)
  let [w, e, s, n] = [Math.min(...lons), Math.max(...lons), Math.min(...lats), Math.max(...lats)]
  const padX = Math.max(3, (e - w) / 4)
  const padY = Math.max(3, (n - s) / 4)
  ;[w, e, s, n] = [w - padX, e + padX, s - padY, n + padY]
  const grow = (lo: number, hi: number, min: number): [number, number] => {
    const d = Math.max(0, min - (hi - lo)) / 2
    return [lo - d, hi + d]
  }
  ;[w, e] = grow(w, e, 14)
  ;[s, n] = grow(s, n, 9)
  const r = (x: number) => Math.round(x * 10) / 10
  return [r(Math.max(-180, w)), r(Math.max(-80, s)), r(Math.min(180, e)), r(Math.min(84, n))]
}

export function buildHistoricalMapAsset(
  pos: { x: number; y: number },
  language: ContentLanguage = 'uk',
  dataset: string = CLIOPATRIA_EAST_EUROPE,
  topic: HistoricalMapTopic | null = null,
): WBAsset {
  // Власник 30.10 — універсальність: є шкала теми з місцями подій — світовий набір під її регіон і роки
  const world = !!topic && topic.places.length > 0
  const entry = BORDER_DATASETS[world ? CLIOPATRIA_WORLD : dataset]
  const borders: MapCardData['borders'] = world
    ? { dataset: CLIOPATRIA_WORLD, version: entry.version, year: topic.years[0], region: topicRegion(topic.places), years: topic.years }
    : { dataset, version: entry.version, year: 1648 }
  const data: MapCardData = {
    version: 1,
    title: world && topic.title ? topic.title : entry.title[language],
    basemap: entry.basemap as MapCardData['basemap'],
    basemap_version: BASEMAP_VERSION,
    projection: 'mercator',
    historical_boundary_mode: 'dataset',
    borders,
    markers: [], routes: [], regions: [], active_marker_id: null, sources: [],
    content_language: language,
  }
  return {
    id: `map-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    // Макет дизайнера 30.10: картка 960×600 — карта зліва, рік і легенда справа
    type: 'map_card', src: '', x: pos.x - 480, y: pos.y - 300,
    w: 960, h: 600, rotation: 0, locked: false, data,
  }
}
