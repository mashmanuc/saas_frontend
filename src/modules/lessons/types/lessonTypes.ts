export type LessonType =
  | 'PLANNED'
  | 'INSTANT'
  | 'TEMPLATE_BASED'
  | 'PRE_BUILT'
  | 'DYNAMIC'
  | 'PACKAGE'
  | 'PROGRAM'

export type LessonStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'DISPUTED'
  | 'ARCHIVED'

export type OwnershipType =
  | 'PLATFORM'
  | 'TUTOR'
  | 'CO_OWNED'
  | 'LICENSED'

export type ModerationStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'SUSPENDED'

export type HomeworkStatus =
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'REVIEWED'
  | 'RETURNED'

export interface LessonTemplateSummary {
  id: number
  title: string
  description: string
  subject: string
  lesson_type: LessonType
  materials_count: number
  has_homework: boolean
  version: number
  moderation_status: ModerationStatus
  is_published: boolean
  created_at: string
}

export interface LessonTemplateDetail extends LessonTemplateSummary {
  structure_json: Record<string, string>
  materials: Array<{ id: number; title: string; type: string }>
  homework_template: {
    instructions: string
    content_items: number[]
  }
  ownership_type: OwnershipType
  owner: number | null
  moderation_note: string
  price: number | null
  updated_at: string
}

export interface LessonTemplateCreatePayload {
  title: string
  description?: string
  subject?: string
  lesson_type?: LessonType
  structure_json?: Record<string, string>
  materials?: number[]
  homework_template?: {
    instructions: string
    content_items: number[]
  }
  // is_published — read-only (§G3: залежить від moderation_status === APPROVED)
}

export interface LessonHomework {
  id: number
  lesson: number
  instructions: string
  content_items: Array<{
    id: number
    title: string
    type: string
    thumbnail_url?: string | null
  }>
  due_date: string | null
  status: HomeworkStatus
  created_at: string
}

export interface LessonHomeworkCreatePayload {
  instructions: string
  content_items: number[]
  due_date?: string | null
}

// ── Marketplace ─────────────────────────────────────────────
export interface MarketplaceTemplateSummary {
  id: number
  title: string
  description: string
  subject: string
  lesson_type: LessonType
  materials_count: number
  has_homework: boolean
  version: number
  is_published: boolean
  price: number | null
  owner_display_name: string
  used_in_lessons_count: number
  created_at: string
}

export interface MarketplaceTemplateDetail extends LessonTemplateDetail {
  can_use: boolean
  requires_purchase: boolean
  owner_display_name: string
  used_in_lessons_count?: number
}

export type MarketplaceSortOption = 'newest' | 'popular' | 'price_asc' | 'price_desc'

export interface MarketplaceSearchParams {
  search?: string
  subject?: string
  min_price?: number
  max_price?: number
  free_only?: boolean
  sort?: MarketplaceSortOption
  page?: number
  page_size?: number
  lesson_type?: LessonType
}

export interface MarketplaceResponse {
  count: number
  page: number
  page_size: number
  total_pages: number
  results: MarketplaceTemplateSummary[]
}

// ── Template Purchase ───────────────────────────────────────
export interface TemplatePurchase {
  id: number
  template_id: number
  price: string
  platform_fee: string
  tutor_earnings: string
  created_at: string
}

export interface TemplatePurchaseResponse {
  success: boolean
  purchase: TemplatePurchase | null
  error?: string
}
