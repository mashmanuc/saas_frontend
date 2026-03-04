/**
 * Content item as returned by GET /lessons/{id}/allowed-content/ (Phase 3A).
 * Extends Phase 2 response with asset_category, thumbnail_url, processing_status.
 */
export interface AllowedContentItem {
  id: number
  content_item_id: number
  content_type: string
  title: string
  asset_category: string    // problem | image | pdf | audio | video | presentation | link
  thumbnail_url: string | null
  processing_status: string // pending | processing | ready | failed
}

export interface SidebarDragPayload {
  content_item_id: number
  asset_category: string
  content_type: string
}

export type AssetCategoryGroup = 'problem' | 'image' | 'pdf' | 'audio' | 'video' | 'presentation'
