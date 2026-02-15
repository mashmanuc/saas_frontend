/**
 * Negotiation Chat API Client v0.70 - Smart Polling Edition
 *
 * API методи для роботи з negotiation chat threads
 * Підтримує інкрементальне завантаження (smart polling)
 */

import apiClient from '@/utils/apiClient'
import type {
  NegotiationThreadDTO,
  NegotiationThreadResponse,
  ChatMessageDTO,
  MessagesListResponse,
  SendMessagePayload
} from '@/types/inquiries'

const BASE_URL = '/v1/chat'

/**
 * Створити або отримати negotiation thread для inquiry
 */
export async function ensureNegotiationThread(inquiryId: string): Promise<NegotiationThreadDTO> {
  const response: NegotiationThreadResponse = await apiClient.post(`${BASE_URL}/threads/negotiation/`, {
    inquiry_id: inquiryId
  })
  return response.thread
}

/**
 * Отримати список negotiation threads користувача
 */
export async function fetchThreads(): Promise<NegotiationThreadDTO[]> {
  const response: { threads: NegotiationThreadDTO[] } = await apiClient.get(`${BASE_URL}/threads/`)
  return response.threads
}

/**
 * Response для smart polling
 */
export interface SmartPollingResponse {
  messages: ChatMessageDTO[]
  count: number
  is_writable: boolean
  latest_ts: string | null
}

/**
 * ✅ SMART POLLING: Отримати повідомлення thread
 *
 * @param threadId - ID thread
 * @param afterTs - ISO timestamp для інкрементального завантаження (тільки нові)
 * @param limit - максимум повідомлень (default 50, max 100)
 * @returns список повідомлень + latest_ts для наступного запиту
 */
export async function fetchMessages(
  threadId: string,
  afterTs?: string,
  limit?: number,
  options?: { skipLoader?: boolean }
): Promise<SmartPollingResponse> {
  const params: Record<string, string | number> = {}
  if (afterTs) params.after_ts = afterTs
  if (limit) params.limit = limit

  return apiClient.get(`${BASE_URL}/threads/${threadId}/messages/`, {
    params,
    meta: { skipLoader: options?.skipLoader ?? false },
  } as any)
}

/**
 * @deprecated Use fetchMessages with afterTs for smart polling
 * Legacy function for backward compatibility with old cursor-based pagination
 */
export async function fetchMessagesLegacy(
  threadId: string,
  cursor?: string
): Promise<{ messages: ChatMessageDTO[]; hasMore: boolean; cursor?: string }> {
  const response = await fetchMessages(threadId, cursor)
  return {
    messages: response.messages,
    hasMore: response.count >= 50,
    cursor: response.latest_ts || undefined
  }
}

/**
 * Відправити повідомлення у thread
 */
export async function sendMessage(
  threadId: string,
  payload: SendMessagePayload
): Promise<ChatMessageDTO> {
  const response = await apiClient.post(`${BASE_URL}/threads/${threadId}/messages/`, payload)
  
  // Трансформуємо snake_case → camelCase
  return {
    id: response.message_id || response.id,
    threadId: response.thread_id || response.threadId,
    sender_id: response.sender_id,
    sender_name: response.sender_name,
    body: response.body,
    is_read: response.is_read,
    createdAt: response.created_at || response.createdAt,
    clientMessageId: response.client_message_id || response.clientMessageId,
    client_message_id: response.client_message_id,
    sender: response.sender
  }
}

/**
 * ✅ MARK AS READ: Позначити повідомлення прочитаними
 *
 * @param threadId - ID thread
 * @param messageIds - опціонально: конкретні ID повідомлень. Без цього - всі непрочитані.
 */
export async function markAsRead(
  threadId: string,
  messageIds?: string[]
): Promise<{ status: string; marked_count: number }> {
  const payload = messageIds?.length ? { message_ids: messageIds } : {}
  return apiClient.post(`${BASE_URL}/threads/${threadId}/mark-read/`, payload)
}

export default {
  ensureNegotiationThread,
  fetchThreads,
  fetchMessages,
  fetchMessagesLegacy,
  sendMessage,
  markAsRead
}
