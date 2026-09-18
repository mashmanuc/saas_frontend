import { BASEMAP_VERSION } from '../board/basemaps'
import type { MapCardData, TimelineCardData, WBAsset } from '../types/winterboard'

export const TIMELINE_CARD_DRAG_MIME = 'application/x-m4sh-timeline-card'
export const MAP_CARD_DRAG_MIME = 'application/x-m4sh-map-card'

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
