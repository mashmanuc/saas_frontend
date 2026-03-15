/**
 * Board drop types for Phase 3A D&D extension.
 *
 * SIDEBAR_DRAG_MIME — used by ContentSidebarItem (Agent B).
 * CONTENT_DRAG_MIME — used by ContentItemCard (Phase 2 library drag).
 */

export const SIDEBAR_DRAG_MIME = 'application/vnd.m4sh.content'
export const CONTENT_DRAG_MIME = 'application/learning-content'

export interface SidebarDragPayload {
  content_item_id: number | null  // null для старих LibraryAsset без ContentItem FK
  asset_category: string
  content_type: string
  /** Phase 9 fallback: пряма URL для старих активів без ContentItem */
  cdn_url?: string | null
  /** Назва для audio/video player title */
  title?: string
  extra?: {
    page_number?: number
    slide_index?: number
  }
}

export interface ResolveDropResponse {
  board_object: {
    content_ref: {
      content_id: number
      content_version: number
      content_type: string
    }
    type: string
    render_mode?: string
    src?: string | null
    title?: string
    duration?: number
    thumbnail?: string | null
    /** Phase 10 P3: YouTube embed URL (present when type='youtube_player') */
    youtubeUrl?: string
  }
  drop_mode: string
}

/** Default sizes for board objects by type (content-aware proportions) */
export const DEFAULT_BOARD_SIZES: Record<string, { w: number; h: number }> = {
  image:          { w: 400, h: 300 },    // fallback; images use dynamic sizing
  pdf:            { w: 420, h: 594 },    // A4 ratio (1:√2)
  audio_player:   { w: 360, h: 80 },    // horizontal player widget
  video_player:   { w: 640, h: 360 },   // 16:9
  youtube_player: { w: 640, h: 360 },   // 16:9
  presentation:   { w: 640, h: 480 },   // 4:3
}
