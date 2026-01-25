/**
 * Negotiation Chat API Client v0.69
 * Based on FRONTEND_IMPLEMENTATION_PLAN_v069.md
 * 
 * API методи для роботи з negotiation chat threads
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
 * Створити або отримати negotiation thread для inquiry v0.69
 * 
 * @param inquiryId - ID inquiry
 * @returns thread DTO з threadId
 */
export async function ensureNegotiationThread(inquiryId: string): Promise<NegotiationThreadDTO> {
  const response: NegotiationThreadResponse = await apiClient.post(`${BASE_URL}/threads/negotiation/`, {
    inquiryId
  })
  return response.thread
}

/**
 * Отримати список negotiation threads користувача v0.69
 * 
 * @returns список threads
 */
export async function fetchThreads(): Promise<NegotiationThreadDTO[]> {
  const response: { threads: NegotiationThreadDTO[] } = await apiClient.get(`${BASE_URL}/threads/`)
  return response.threads
}

/**
 * Отримати повідомлення thread з пагінацією v0.69
 * 
 * @param threadId - ID thread
 * @param cursor - опціональний cursor для пагінації
 * @returns список повідомлень
 */
export async function fetchMessages(
  threadId: string,
  cursor?: string
): Promise<MessagesListResponse> {
  return apiClient.get(`${BASE_URL}/threads/${threadId}/messages/`, {
    params: cursor ? { cursor } : {}
  })
}

/**
 * Відправити повідомлення у thread v0.69
 * 
 * @param threadId - ID thread
 * @param payload - body та clientMessageId (idempotency)
 * @returns створене повідомлення
 */
export async function sendMessage(
  threadId: string,
  payload: SendMessagePayload
): Promise<ChatMessageDTO> {
  const response: { message: ChatMessageDTO } = await apiClient.post(
    `${BASE_URL}/threads/${threadId}/messages/`,
    payload
  )
  return response.message
}

export default {
  ensureNegotiationThread,
  fetchThreads,
  fetchMessages,
  sendMessage
}
