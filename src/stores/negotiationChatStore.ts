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
import { useAuthStore } from '@/modules/auth/store/authStore'
import { wsConnect, wsDisconnect, wsSend } from '@/composables/useChatWebSocket'

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
  async function sendMessage(threadId: string, body: string): Promise<boolean> {
    const clientMessageId = generateMessageId()
    
    const thread = threads.value.find(t => t.id === threadId)
    if (thread?.readOnly) {
      throw new Error('Thread is read-only')
    }
    
    isSending.value = true
    error.value = null
    
    try {
      const message = await apiSendMessage(threadId, { body, clientMessageId })
      
      const currentMessages = messagesByThread.value[threadId] || []
      const exists = currentMessages.some(m => m.id === message.id)
      
      if (!exists) {
        if (!messagesByThread.value[threadId]) {
          messagesByThread.value[threadId] = []
        }
        messagesByThread.value[threadId] = [...messagesByThread.value[threadId], message]
      }
      
      isSending.value = false
      return true
    } catch (err) {
      error.value = 'Failed to send'
      isSending.value = false
      return false
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
  function setActiveThread(threadId: string | null) {
    if (activeThreadId.value === threadId) return
    
    if (threadId) {
      wsConnect(threadId)
    } else {
      wsDisconnect()
    }
    
    activeThreadId.value = threadId
  }
  
  /**
   * Computed: активний thread
   */
  const activeThread = computed(() => {
    if (!activeThreadId.value) return null
    return threads.value.find(t => t.id === activeThreadId.value) || null
  })
  
  // Actions для WebSocket
  function appendMessage(threadId: string, message: ChatMessageDTO, currentUserId?: number) {
    if (!messagesByThread.value[threadId]) {
      messagesByThread.value[threadId] = []
    }
    
    // Перевірка на дублікат
    const exists = messagesByThread.value[threadId].some(m => m.id === message.id)
    if (exists) return
    
    messagesByThread.value[threadId] = [...messagesByThread.value[threadId], message]
  }
  
  function updateMessage(threadId: string, message: ChatMessageDTO) {
    const messages = messagesByThread.value[threadId] || []
    const index = messages.findIndex(m => m.id === message.id)
    if (index !== -1) {
      messagesByThread.value[threadId] = [
        ...messages.slice(0, index),
        message,
        ...messages.slice(index + 1)
      ]
    }
  }
  
  function deleteMessage(threadId: string, messageId: string) {
    const messages = messagesByThread.value[threadId] || []
    messagesByThread.value[threadId] = messages.filter(m => m.id !== messageId)
  }
  
  function markMessageRead(threadId: string, messageId: string) {
    const messages = messagesByThread.value[threadId] || []
    messagesByThread.value[threadId] = messages.map(m => 
      m.id === messageId ? { ...m, is_read: true } : m
    )
  }
  
  const currentMessages = computed(() => {
    if (!activeThreadId.value) return []
    return messagesByThread.value[activeThreadId.value] || []
  })
  
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
    setActiveThread,
    appendMessage,
    updateMessage,
    deleteMessage,
    markMessageRead,
    currentMessages,
  }
})
