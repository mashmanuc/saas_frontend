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
 * Статус inquiry між tutor і student (v0.69)
 */
export type InquiryStatus = 'sent' | 'accepted' | 'declined' | 'cancelled' | 'expired'

/**
 * Inquiry DTO v0.69 - запит на встановлення контакту
 */
export interface InquiryDTO {
  id: string
  student: UserSummary
  tutor: UserSummary
  message: string
  status: InquiryStatus
  createdAt: string
  updatedAt: string
}

/**
 * Relation DTO v0.69
 */
export interface RelationDTO {
  id: string
  student: UserSummary
  tutor: UserSummary
  status: string // v0.69 не стандартизує значення
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
 * Payload для accept/decline inquiry v0.69
 */
export interface InquiryActionPayload {
  clientRequestId: string
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
 * Error codes для inquiry операцій v0.69
 */
export type InquiryErrorCode =
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
