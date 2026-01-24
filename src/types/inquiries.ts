/**
 * Inquiry & Negotiation Chat Types v0.69
 * Based on FRONTEND_IMPLEMENTATION_PLAN_v069.md
 * 
 * Типи для системи переговорів (Inquiry) та negotiation chat
 */

/**
 * User summary для відображення в inquiry/chat
 */
export interface UserSummary {
  id: string
  firstName: string
  lastName: string
  avatar?: string
  role: 'student' | 'tutor'
}

/**
 * Статус inquiry між tutor і student (Phase 1 v0.86)
 */
export type InquiryStatus = 'OPEN' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED'

/**
 * Rejection reason enum (Phase 1 v0.86)
 */
export type RejectionReason = 'BUSY' | 'BUDGET_LOW' | 'LEVEL_MISMATCH' | 'SUBJECT_MISMATCH' | 'OTHER'

/**
 * Match quality enum (Phase 1 v0.86)
 */
export type MatchQuality = 'RECOMMENDED' | 'NEUTRAL' | 'NOT_SUITABLE'

/**
 * Inquiry DTO (Phase 1 v0.86) - запит на встановлення контакту
 */
export interface InquiryDTO {
  id: number
  student: UserSummary
  tutor: UserSummary
  message: string
  status: InquiryStatus
  subjects?: string[]
  budget?: number
  student_level?: string
  match_quality?: MatchQuality
  rejection_reason?: RejectionReason
  rejection_comment?: string
  created_at: string
  accepted_at?: string
  rejected_at?: string
  cancelled_at?: string
  expired_at?: string
}

/**
 * Relation DTO (Phase 1 v0.86)
 */
export interface RelationDTO {
  id: number
  chat_unlocked: boolean
  contact_unlocked: boolean
  contact_unlocked_at?: string
}

/**
 * Contacts DTO (Phase 1 v0.86)
 */
export interface ContactsDTO {
  phone: string
  telegram: string
  email: string
}

/**
 * Negotiation Thread DTO v0.69
 */
export interface NegotiationThreadDTO {
  id: string
  inquiryId: string
  readOnly: boolean
  participants: UserSummary[]
  lastMessagePreview: string
}

/**
 * Chat Message DTO v0.69
 */
export interface ChatMessageDTO {
  id: string
  threadId: string
  sender: UserSummary
  body: string
  createdAt: string
  clientMessageId?: string
}

/**
 * Payload для створення inquiry v0.69
 */
export interface CreateInquiryPayload {
  tutorId: string
  message: string
  clientRequestId: string
}

/**
 * Payload для cancel inquiry v0.69
 */
export interface CancelInquiryPayload {
  clientRequestId: string
}

/**
 * Payload для accept inquiry (Phase 1 v0.86)
 */
export interface AcceptInquiryPayload {
  // Empty body
}

/**
 * Payload для reject inquiry (Phase 1 v0.86)
 */
export interface RejectInquiryPayload {
  reason: RejectionReason
  comment?: string
}

/**
 * Payload для відправки повідомлення v0.69
 */
export interface SendMessagePayload {
  body: string
  clientMessageId: string
}

/**
 * Response при створенні inquiry
 */
export interface CreateInquiryResponse {
  inquiry: InquiryDTO
}

/**
 * Response при accept inquiry (Phase 1 v0.86)
 */
export interface AcceptInquiryResponse {
  inquiry: InquiryDTO
  relation: RelationDTO
  thread_id: number
  contacts: ContactsDTO
  was_already_unlocked: boolean
  message: string
}

/**
 * Response при reject inquiry (Phase 1 v0.86)
 */
export interface RejectInquiryResponse {
  inquiry: InquiryDTO
  message: string
}

/**
 * Response при cancel inquiry (Phase 1 v0.86)
 */
export interface CancelInquiryResponse {
  inquiry: InquiryDTO
  message: string
}

/**
 * Response при отриманні списку inquiries
 */
export interface InquiriesListResponse {
  inquiries: InquiryDTO[]
}

/**
 * Response при створенні/отриманні thread
 */
export interface NegotiationThreadResponse {
  thread: NegotiationThreadDTO
}

/**
 * Response при отриманні повідомлень
 */
export interface MessagesListResponse {
  messages: ChatMessageDTO[]
  hasMore: boolean
  cursor?: string
}

/**
 * Inquiry filters для API запитів
 */
export interface InquiryFilters {
  role?: 'student' | 'tutor'
  status?: InquiryStatus
  page?: number
  pageSize?: number
}

/**
 * Error codes для inquiry операцій (Phase 1 v0.86)
 */
export type InquiryErrorCode =
  | 'INQUIRY_NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'INQUIRY_ALREADY_PROCESSED'
  | 'VALIDATION_ERROR'
  | 'CANNOT_CANCEL_PROCESSED'
  | 'inquiry_already_exists'
  | 'inquiry_not_allowed'
  | 'invalid_transition'
  | 'limit_exceeded'
  | 'relation_already_active'
  | 'forbidden'

/**
 * Limit exceeded error payload
 */
export interface LimitExceededError {
  code: 'limit_exceeded'
  resetAt: string
  limitType: string
}
