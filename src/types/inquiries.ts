/**
 * Inquiry & Contact Types v0.62
 * Based on FRONTEND — Технічне завдання v0.62.0.md
 * 
 * Типи для системи переговорів (Inquiry) та контрольованого доступу до контактів
 */

/**
 * Статус inquiry між tutor і student
 */
export type InquiryStatus = 'OPEN' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED'

/**
 * Роль ініціатора inquiry
 */
export type InitiatorRole = 'student' | 'tutor'

/**
 * Inquiry DTO - запит на доступ до контактів
 */
export interface InquiryDTO {
  id: string
  relation_id: string
  initiator_role: InitiatorRole
  status: InquiryStatus
  message: string
  created_at: string
  resolved_at: string | null
  expires_at: string | null
}

/**
 * Payload для створення inquiry
 */
export interface CreateInquiryPayload {
  relation_id: string
  message: string
}

/**
 * Response при створенні inquiry
 */
export interface CreateInquiryResponse {
  inquiry: InquiryDTO
}

/**
 * Response при отриманні списку inquiries
 */
export interface InquiriesListResponse {
  inquiries: InquiryDTO[]
}

/**
 * Причини блокування контактів (locked_reason)
 * Стабільний контракт для FE згідно специфікації
 * v0.66: додано user_blocked, blocked_by_user, user_banned
 */
export type ContactLockedReason =
  | 'no_relation'
  | 'inquiry_required'
  | 'inquiry_pending'
  | 'inquiry_rejected'
  | 'inquiry_expired'
  | 'no_active_lesson'
  | 'subscription_required'
  | 'forbidden'
  | 'user_blocked'
  | 'blocked_by_user'
  | 'user_banned'
  | null

/**
 * Contact payload - контактні дані користувача
 * Завжди повертає структуру з null + locked_reason якщо доступ заборонено
 */
export interface ContactPayload {
  email: string | null
  phone: string | null
  telegram: string | null
  locked_reason: ContactLockedReason
}

/**
 * Розширення Relation для підтримки inquiry полів
 * Додається до існуючого типу Relation з types/relations.ts
 */
export interface RelationWithInquiry {
  inquiry_status: InquiryStatus | null
  can_request_contact: boolean
  can_view_contact: boolean
  contact_locked_reason: ContactLockedReason
}

/**
 * Domain error для inquiry операцій
 */
export interface InquiryErrorMeta {
  relation_id?: string
  inquiry_id?: string
  locked_reason?: ContactLockedReason
  [key: string]: unknown
}

/**
 * Domain error codes для inquiry
 */
export type InquiryErrorCode =
  | 'inquiry_already_exists'
  | 'inquiry_not_allowed'
  | 'inquiry_invalid_state'
  | 'contact_locked'
