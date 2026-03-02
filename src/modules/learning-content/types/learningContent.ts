export type ContentItemType =
  | 'problem'
  | 'test'
  | 'theory'
  | 'video'
  | 'presentation'
  | 'link'

// Phase 2: Ownership & Access (§G8)
export type OwnershipType =
  | 'PLATFORM'
  | 'TUTOR'
  | 'CO_OWNED'
  | 'LICENSED'
  | 'THIRD_PARTY'
  | 'USER_GENERATED'

export type AccessType =
  | 'PUBLIC'
  | 'PREVIEW'
  | 'PAID'
  | 'LESSON_BOUND'
  | 'COURSE_BOUND'
  | 'SUBSCRIPTION'
  | 'RESTRICTED'
  | 'ARCHIVED'

export interface Subject {
  id: number
  slug: string
  name: string
  icon?: string
}

export interface Collection {
  id: number
  subject: number
  title: string
  description: string
  topic_count: number
  is_public: boolean
  version: string
}

export interface UnitSummary {
  id: number
  title: string
  order_index: number
  level: number
  item_count: number
}

export interface Topic {
  id: number
  title: string
  order_index: number
  difficulty_level: number
  units: UnitSummary[]
}

export interface Unit {
  id: number
  title: string
  order_index: number
  level: number
  items: ContentItemSummary[]
}

export interface ContentItemSummary {
  id: number
  type: ContentItemType
  title: string
  difficulty: number
  version: number
  thumbnail_url?: string | null
  ownership_type?: OwnershipType
  access_type?: AccessType
  owner?: number | null
}

export interface ContentItemDetail extends ContentItemSummary {
  content_json: ProblemContent | TheoryContent | TestContent | VideoContent | PresentationContent | LinkContent
  estimated_time: number
  tags: string[]
  is_latest: boolean
  parent_id: number | null
  owner_display_name?: string | null
  is_active?: boolean
  created_at?: string
  updated_at?: string
}

export interface LessonMaterial {
  id: number
  session_uuid: string
  content_item: number
  placed_at: string
  board_page_index: number
  resolved: boolean
  tutor_notes: string
}

export interface ContentDragPayload {
  itemId: number
  type: ContentItemType
  title: string
  contentJson: ContentItemDetail['content_json']
}

export interface SearchParams {
  q?: string
  subject?: string
  difficulty?: number
  tags?: string
  collection?: number
  page?: number
  ownership_type?: OwnershipType | ''
  owner?: 'me' | ''
}

export interface SearchResult {
  items: ContentItemSummary[]
  total: number
  filters_applied: Record<string, unknown>
}

export interface CreateLessonMaterialPayload {
  session_uuid: string
  content_item: number
  board_page_index?: number
  position_json?: { x: number; y: number }
  tutor_notes?: string
}

// Re-export content schemas for convenience
import type {
  ProblemContent,
  TheoryContent,
  TestContent,
  VideoContent,
  PresentationContent,
  LinkContent,
} from '../schemas/contentSchemas'

export type {
  ProblemContent,
  TheoryContent,
  TestContent,
  VideoContent,
  PresentationContent,
  LinkContent,
}
