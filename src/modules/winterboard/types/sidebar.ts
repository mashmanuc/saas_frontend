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
  // Phase 3B: PDF pages (from content_json.pages after processing)
  pages?: Record<string, { thumbnail_url: string }>
  page_count?: number
  // Phase 3B: Presentation slides (from content_json.slides after processing)
  slides?: Record<string, { image_url: string }>
  slide_count?: number
}

export interface SidebarDragPayload {
  content_item_id: number
  asset_category: string
  content_type: string
}

export type AssetCategoryGroup = 'problem' | 'image' | 'pdf' | 'audio' | 'video' | 'presentation'
