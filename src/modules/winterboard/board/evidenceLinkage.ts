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
