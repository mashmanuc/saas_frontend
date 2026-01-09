/**
 * Types for Tutor↔Student Relations API v2.1
 * Based on FRONTEND_TASKS_v2.1.md specification
 */

export interface TutorSubjectLabel {
  value: string
  label: string
}

export interface Relation {
  id: string
  tutor: {
    id: string
    name: string
    avatar_url: string
    subjects: TutorSubjectLabel[]
    hourly_rate?: number
    currency?: string
  }
  student: {
    id: string
    name: string
    avatar_url?: string
  }
  status: 'invited' | 'active' | 'paused' | 'archived'
  created_at: string
  activated_at: string | null
  last_activity_at: string | null
  lesson_count: number
  has_upcoming_lessons: boolean
  has_current_lesson: boolean
  active_lesson_id: string | null
  can_chat: boolean
  // v0.62: Inquiry fields
  inquiry_status?: 'OPEN' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | null
  can_request_contact?: boolean
  can_view_contact?: boolean
  contact_locked_reason?: string | null
}

export interface RelationsResponse {
  relations: Relation[]
}

export interface RequestTutorPayload {
  tutor_id: string
  message?: string
}

export interface RequestTutorResponse {
  relation: Relation
}

export interface AcceptRequestPayload {
  relation_id: string
}

export interface AcceptRequestResponse {
  relation: Relation
}

export interface LimitExceededResponse {
  code: 'limit_exceeded'
  meta: {
    limit_type: 'student_request' | 'tutor_accept'
    used: number
    max: number
    reset_at: string
  }
}

export interface ContactLimit {
  limit_type: 'student_request' | 'tutor_accept'
  max_count: number
  current_count: number
  remaining: number
  reset_at: string
  period_days: number
}

export interface LimitsResponse {
  limits: ContactLimit[]
}

export interface TutorSearchParams {
  subjects?: string
  min_rate?: number
  max_rate?: number
  min_rating?: number
  country?: string
  sort_by?: 'rating_desc' | 'rate_asc' | 'rate_desc' | 'newest'
  cursor?: string
}

export interface TutorPublic {
  id: string
  name: string
  avatar_url: string
  subjects: string[]
  hourly_rate: number
  currency: string
  rating: number
  review_count: number
  country: string
  bio: string
  has_relation: boolean
}

export interface TutorPublicListResponse {
  results: TutorPublic[]
  next: string | null
  previous: string | null
  filters_applied: {
    subjects?: string[]
    min_rate?: number
    max_rate?: number
    min_rating?: number
    country?: string
    sort_by?: string
  }
}

export interface LessonsParams {
  start_date?: string
  end_date?: string
}

export interface Lesson {
  id: string
  tutor: {
    id: string
    name: string
  }
  student: {
    id: string
    name: string
  }
  subject: string
  start: string
  end: string
  status: 'scheduled' | 'completed' | 'cancelled'
  chat_room_id: string
}

export interface LessonsResponse {
  lessons: Lesson[]
}

export interface SendMessagePayload {
  content: string
}

export interface ChatMessage {
  id: string
  sender: {
    id: string
    name: string
  }
  content: string
  created_at: string
}
