import type { MapCardData, TimelineCardData, WBAsset } from '../types/winterboard'

/** Побудувати стандартний asset_update для парної карти/шкали.
 * Ніякої локальної мутації: caller віддає результат штатному ops-шляху. */
export function linkedEvidenceUpdate(
  assets: WBAsset[],
  source: WBAsset,
  linkedIds: string[],
): WBAsset | null {
  const sourceData = (source.data ?? {}) as TimelineCardData | MapCardData
  const setId = sourceData.knowledge_set_id
  if (!setId || !Array.isArray(linkedIds) || !linkedIds.length) return null

  if (source.type === 'timeline_card') {
    const target = assets.find((asset) =>
      asset.type === 'map_card' && (asset.data as MapCardData)?.knowledge_set_id === setId)
    if (!target) return null
    const data = target.data as MapCardData
    const id = linkedIds.find(candidate => data.markers?.some(marker => marker.id === candidate))
    if (!id || data.active_marker_id === id) return null
    return { ...target, data: { ...data, active_marker_id: id } } as WBAsset
  }

  if (source.type === 'map_card') {
    const target = assets.find((asset) =>
      asset.type === 'timeline_card' && (asset.data as TimelineCardData)?.knowledge_set_id === setId)
    if (!target) return null
    const data = target.data as TimelineCardData
    const id = linkedIds.find(candidate => data.events?.some(event => event.id === candidate))
    if (!id || data.active_event_id === id) return null
    return { ...target, data: { ...data, active_event_id: id } } as WBAsset
  }

  return null
}

// ── Історична карта й шкала теми на одній сторінці (закон §9 v1.79) ────────────────────────────────────────

/** Подія шкали з місцем для історичної карти: номер — порядок на шкалі; лише наші значення, без id джерела. */
export interface MapEventPin {
  key: string
  n: number
  label: string
  year: number
  lat: number
  lon: number
  active: boolean
  /** v1.80: пояснення події (вступ статті з джерела) — у віконці на карті. */
  text: string
  /** v1.80: люди цієї події в порядку шкали (перший — основний герой); `via` — війна, через яку зв'язок. */
  people: Array<{ key: string; name: string; image: string | null; attribution: string; via: string }>
}

function timelineEventsOf(asset: WBAsset) {
  const events = (asset.data as TimelineCardData | undefined)?.events
  return Array.isArray(events) ? events : []
}

/** Усі події шкал сторінки, що мають місце з джерела (`place`), — для номерів на історичній карті. */
export function timelineMapPins(assets: readonly WBAsset[]): MapEventPin[] {
  const out: MapEventPin[] = []
  for (const asset of assets) {
    if (asset?.type !== 'timeline_card') continue
    const data = asset.data as TimelineCardData | undefined
    const active = data?.active_event_id ?? null
    const people = Array.isArray(data?.people) ? data.people : []
    timelineEventsOf(asset).forEach((event, i) => {
      const p = event?.place
      const year = event?.date_start?.year
      if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lon) || typeof year !== 'number') return
      out.push({
        key: `${asset.id}:${event.id}`, n: i + 1, label: event.label, year, lat: p.lat, lon: p.lon, active: event.id === active,
        text: event.description || '',
        people: people.filter((x) => x?.event_ids?.includes(event.id)).map((x) => ({
          key: `${x.ref.provider}:${x.ref.id}`, name: x.name, image: x.image?.url ?? null,
          attribution: x.image?.attribution ?? '', via: x.via?.[event.id] ?? '',
        })),
      })
    })
  }
  return out
}

/**
 * Відкрили подію шкали — рік історичних карт сторінки стає роком події, коли він у роках набору й інший (одна модель
 * часу — `borders.year`). Повертає штатні `asset_update` карт; нічого не мутує. Подія без року чи поза набором — [].
 */
export function linkedHistoricalMapUpdates(
  assets: readonly WBAsset[],
  timeline: WBAsset,
  yearsOf: (dataset: string, version: string) => readonly [number, number] | null,
): WBAsset[] {
  if (timeline.type !== 'timeline_card') return []
  const data = timeline.data as TimelineCardData | undefined
  const event = timelineEventsOf(timeline).find((e) => e?.id === data?.active_event_id)
  const year = event?.date_start?.year
  if (typeof year !== 'number') return []
  const out: WBAsset[] = []
  for (const asset of assets) {
    if (asset?.type !== 'map_card') continue
    const map = asset.data as MapCardData
    const b = map?.borders
    const years = b ? yearsOf(b.dataset, b.version) : null
    if (!b || !years || year < years[0] || year > years[1] || b.year === year) continue
    out.push({ ...asset, data: { ...map, borders: { ...b, year } } } as WBAsset)
  }
  return out
}
