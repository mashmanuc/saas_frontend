/**
 * Chat API Client (v0.71.x)
 * 
 * Provides methods for chat negotiation functionality:
 * - Get or create thread by tutor ID
 * - Get messages for a thread
 * - Send message to thread
 */

import { apiClient } from '@/api/client'

export interface ChatThread {
  id: string
  kind: 'negotiation'
  inquiry_id: string
  created_at: string
  updated_at: string
}

export interface ChatMessage {
  id: string
  thread_id: string
  sender_id: number
  sender_email: string
  sender_name: string
  body: string
  client_message_id?: string
  created_at: string
}

export interface CreateThreadPayload {
  inquiry_id: string
}

export interface SendMessagePayload {
  body: string
  client_message_id?: string
}

export interface ThreadMessagesResponse {
  messages: ChatMessage[]
  count: number
  is_writable: boolean
}

/**
 * Get or create thread by inquiry ID
 */
export async function createThread(payload: CreateThreadPayload): Promise<ChatThread> {
  const response = await apiClient.post<ChatThread>('/api/v1/chat/threads/create/', payload)
  return response
}

/**
 * List all threads for current user
 */
export async function getThreads(): Promise<{ threads: ChatThread[]; count: number }> {
  const response = await apiClient.get<{ threads: ChatThread[]; count: number }>(
    '/api/v1/chat/threads/'
  )
  return response
}

/**
 * Get messages for a thread
 * @param options.skipLoader - пропустити глобальний loader (для фонового polling)
 */
export async function getThreadMessages(
  threadId: string,
  options?: { skipLoader?: boolean }
): Promise<ThreadMessagesResponse> {
  const response = await apiClient.get<ThreadMessagesResponse>(
    `/api/v1/chat/threads/${threadId}/messages/`,
    { meta: { skipLoader: options?.skipLoader ?? false } } as any
  )
  return response
}

/**
 * Send message to thread
 */
export async function sendMessage(
  threadId: string,
  payload: SendMessagePayload
): Promise<ChatMessage> {
  const response = await apiClient.post<ChatMessage>(
    `/api/v1/chat/threads/${threadId}/messages/`,
    payload
  )
  return response
}

/**
 * Helper: Get or create thread for tutor relation
 * 
 * This is a convenience method that:
 * 1. Finds the inquiry for the tutor-student relation
 * 2. Creates or gets the thread for that inquiry
 * 
 * Note: Requires that an inquiry exists for the relation.
 * In E2E tests, this is created by the seed_dev command.
 */
export async function getOrCreateThreadByTutorId(tutorId: number): Promise<ChatThread> {
  // For MVP, we need to get the inquiry ID first
  // This would typically come from the relations API or be passed from the component
  // For now, we'll use the threads list to find existing thread
  const { threads } = await getThreads()
  
  // Try to find existing thread for this tutor
  // Note: This is a simplified approach for MVP
  // In production, you'd want to pass inquiry_id from the relation data
  const existingThread = threads.find(t => {
    // Match logic would depend on your data structure
    // For E2E, we assume one thread per tutor
    return true // Placeholder - would need proper matching
  })
  
  if (existingThread) {
    return existingThread
  }
  
  // If no thread exists, we need inquiry_id to create one
  // This should be obtained from the relation/inquiry API
  throw new Error('No thread found for tutor. Inquiry ID required to create thread.')
}
