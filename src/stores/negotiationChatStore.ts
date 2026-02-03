/**
 * Negotiation Chat Store v0.69
 * Based on FRONTEND_IMPLEMENTATION_PLAN_v069.md
 * 
 * Управління negotiation chat threads та повідомленнями
 * 
 * Принципи v0.69:
 * - Single Source of Truth: refetch після мутацій
 * - Idempotency: clientMessageId для всіх повідомлень
 * - Read-only enforcement: перевірка thread.readOnly
 * - Без unread аналітики (v0.70)
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  NegotiationThreadDTO,
  ChatMessageDTO,
  MessagesListResponse
} from '@/types/inquiries'
import {
  ensureNegotiationThread,
  fetchThreads as apiFetchThreads,
  fetchMessagesLegacy as apiFetchMessages,
  sendMessage as apiSendMessage
} from '@/api/negotiationChat'
import { rethrowAsDomainError } from '@/utils/rethrowAsDomainError'

export const useNegotiationChatStore = defineStore('negotiationChat', () => {
  // State v0.69
  const threads = ref<NegotiationThreadDTO[]>([])
  const messagesByThread = ref<Record<string, ChatMessageDTO[]>>({})
  const activeThreadId = ref<string | null>(null)
  
  // Loading states
  const isLoading = ref(false)
  const isSending = ref(false)
  const error = ref<string | null>(null)
  
  /**
   * Створити або отримати thread для inquiry v0.69
   * 
   * @param inquiryId - ID inquiry
   * @returns thread з threadId
   */
  async function ensureThread(inquiryId: string): Promise<NegotiationThreadDTO> {
    isLoading.value = true
    error.value = null
    
    try {
      const thread = await ensureNegotiationThread(inquiryId)
      
      // Додати до списку якщо новий
      const existingIndex = threads.value.findIndex(t => t.id === thread.id)
      if (existingIndex === -1) {
        threads.value.push(thread)
      } else {
        threads.value[existingIndex] = thread
      }
      
      return thread
    } catch (err) {
      rethrowAsDomainError(err)
      throw err
    } finally {
      isLoading.value = false
    }
  }
  
  /**
   * Завантажити список threads користувача v0.69
   * 
   * @returns список threads
   */
  async function fetchThreads(): Promise<NegotiationThreadDTO[]> {
    isLoading.value = true
    error.value = null
    
    try {
      const fetchedThreads = await apiFetchThreads()
      threads.value = fetchedThreads
      return fetchedThreads
    } catch (err) {
      rethrowAsDomainError(err)
      throw err
    } finally {
      isLoading.value = false
    }
  }
  
  /**
   * Завантажити повідомлення thread v0.69
   * 
   * @param threadId - ID thread
   * @param cursor - опціональний cursor для пагінації
   * @returns список повідомлень
   */
  async function fetchMessages(
    threadId: string,
    cursor?: string
  ): Promise<MessagesListResponse> {
    isLoading.value = true
    error.value = null
    
    try {
      const response = await apiFetchMessages(threadId, cursor)
      
      // Оновити або додати повідомлення
      if (!messagesByThread.value[threadId]) {
        messagesByThread.value[threadId] = []
      }
      
      if (cursor) {
        // Append для пагінації
        messagesByThread.value[threadId].push(...response.messages)
      } else {
        // Replace для initial load
        messagesByThread.value[threadId] = response.messages
      }
      
      return response
    } catch (err) {
      rethrowAsDomainError(err)
      throw err
    } finally {
      isLoading.value = false
    }
  }
  
  /**
   * Відправити повідомлення v0.69
   * 
   * @param threadId - ID thread
   * @param body - текст повідомлення
   * @returns створене повідомлення
   */
  async function sendMessage(threadId: string, body: string): Promise<ChatMessageDTO> {
    const clientMessageId = generateMessageId()
    
    // Перевірка read-only
    const thread = threads.value.find(t => t.id === threadId)
    if (thread?.readOnly) {
      throw new Error('Thread is read-only')
    }
    
    isSending.value = true
    error.value = null
    
    // Optimistic update
    const optimisticMessage: ChatMessageDTO = {
      id: clientMessageId,
      threadId,
      sender: { id: 'current', firstName: '', lastName: '', role: 'student' }, // Буде замінено
      body,
      createdAt: new Date().toISOString(),
      clientMessageId
    }
    
    if (!messagesByThread.value[threadId]) {
      messagesByThread.value[threadId] = []
    }
    messagesByThread.value[threadId].push(optimisticMessage)
    
    try {
      const message = await apiSendMessage(threadId, { body, clientMessageId })
      
      // Замінити optimistic на реальне
      const index = messagesByThread.value[threadId].findIndex(
        m => m.clientMessageId === clientMessageId
      )
      if (index !== -1) {
        messagesByThread.value[threadId][index] = message
      }
      
      return message
    } catch (err) {
      // Видалити optimistic при помилці
      const index = messagesByThread.value[threadId].findIndex(
        m => m.clientMessageId === clientMessageId
      )
      if (index !== -1) {
        messagesByThread.value[threadId].splice(index, 1)
      }
      
      rethrowAsDomainError(err)
      throw err
    } finally {
      isSending.value = false
    }
  }
  
  /**
   * Генерувати clientMessageId для idempotency
   */
  function generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
  
  /**
   * Computed: активний thread
   */
  const activeThread = computed(() => {
    if (!activeThreadId.value) return null
    return threads.value.find(t => t.id === activeThreadId.value) || null
  })
  
  /**
   * Встановити активний thread
   */
  function setActiveThread(threadId: string | null) {
    activeThreadId.value = threadId
  }
  
  return {
    // State
    threads,
    messagesByThread,
    activeThreadId,
    isLoading,
    isSending,
    error,
    
    // Computed
    activeThread,
    
    // Actions
    ensureThread,
    fetchThreads,
    fetchMessages,
    sendMessage,
    setActiveThread
  }
})
