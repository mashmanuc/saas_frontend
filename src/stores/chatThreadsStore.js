import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import apiClient from '@/utils/apiClient'
import { notifyError } from '@/utils/notify'

/**
 * Chat Threads Store для Contact→Chat інтеграції
 * 
 * ВАЖЛИВО:
 * - threadsByStudent = навігаційний кеш, НЕ SSOT
 * - Будь-яка операція готова до threadId === null
 * - unread-summary = view-only, не domain API
 */
export const useChatThreadsStore = defineStore('chatThreads', () => {
  // State
  const threadsByStudent = ref(new Map()) // studentId -> { threadId, kind, lastSync }
  const unreadSummary = ref({ threads: [], total: 0 })
  const loading = ref(false)
  const error = ref(null)

  // Getters
  const getThreadIdByStudent = computed(() => (studentId) => {
    const cached = threadsByStudent.value.get(studentId)
    return cached?.threadId || null
  })

  const getUnreadCount = computed(() => (studentId) => {
    const thread = unreadSummary.value.threads.find(
      t => t.other_user_id === studentId
    )
    return thread?.unread_count || 0
  })

  const totalUnread = computed(() => unreadSummary.value.total)

  // Actions
  async function ensureThread(studentId, relationId) {
    /**
     * Створює або отримує thread для relation.
     * ВАЖЛИВО: викликається тільки при першій спробі відкрити чат,
     * НЕ автоматично після unlock.
     */
    loading.value = true
    error.value = null

    try {
      // Перевіряємо кеш (але не довіряємо йому повністю)
      const cached = threadsByStudent.value.get(studentId)
      if (cached?.threadId) {
        // Верифікуємо через backend
        try {
          await apiClient.get(`/api/v1/chat/threads/${cached.threadId}/messages/`)
          return cached.threadId
        } catch (err) {
          // Кеш застарів, створюємо новий
          threadsByStudent.value.delete(studentId)
        }
      }

      // Створюємо або отримуємо thread через backend
      const response = await apiClient.post('/api/v1/chat/threads/negotiation/', {
        relation_id: relationId
      })

      // apiClient повертає data напряму, тому response = { thread_id, kind, ... }
      const threadId = response?.thread_id
      if (!threadId) {
        throw new Error('THREAD_ID_NOT_RETURNED')
      }

      // Оновлюємо кеш
      threadsByStudent.value.set(studentId, {
        threadId,
        kind: response.kind,
        lastSync: new Date().toISOString()
      })

      return threadId
    } catch (err) {
      error.value = err.response?.data?.error?.message || 'Failed to create thread'
      notifyError(error.value)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function fetchUnreadSummary() {
    /**
     * Отримує unread summary з backend.
     * ВАЖЛИВО: це view-only endpoint, не використовується для створення threads.
     */
    try {
      const response = await apiClient.get('/api/v1/chat/unread-summary/')
      
      // Phase 1 v0.87.1: Перевірка на undefined після 401 Unauthorized
      if (!response) {
        // Пустий response - нормально для нового користувача без чату
        return
      }
      
      unreadSummary.value = response

      // Оновлюємо кеш threadsByStudent з unread summary (якщо потрібно)
      if (response.threads && Array.isArray(response.threads)) {
        response.threads.forEach(thread => {
          const existing = threadsByStudent.value.get(thread.other_user_id)
          if (!existing || existing.threadId !== thread.thread_id) {
            threadsByStudent.value.set(thread.other_user_id, {
              threadId: thread.thread_id,
              kind: thread.kind,
              lastSync: new Date().toISOString()
            })
          }
        })
      }
    } catch (err) {
      // Не логуємо для 401 - це нормально при logout
      if (err?.response?.status !== 401) {
        console.error('[chatThreadsStore] Failed to fetch unread summary:', err)
      }
    }
  }

  async function markThreadRead(threadId) {
    /**
     * Позначає всі повідомлення в thread як прочитані.
     */
    try {
      await apiClient.post(`/api/v1/chat/threads/${threadId}/mark-read/`, {})

      // Оновлюємо локальний unread count
      unreadSummary.value.threads = unreadSummary.value.threads.filter(
        t => t.thread_id !== threadId
      )
      unreadSummary.value.total = unreadSummary.value.threads.reduce(
        (sum, t) => sum + t.unread_count,
        0
      )
    } catch (err) {
      console.error('[chatThreadsStore] Failed to mark thread as read:', err)
    }
  }

  function clearCache() {
    /**
     * Очищає кеш (наприклад, при logout).
     */
    threadsByStudent.value.clear()
    unreadSummary.value = { threads: [], total: 0 }
    error.value = null
  }

  function removeThread(studentId) {
    /**
     * Видаляє thread з кешу (наприклад, після revoke).
     */
    threadsByStudent.value.delete(studentId)
    unreadSummary.value.threads = unreadSummary.value.threads.filter(
      t => t.other_user_id !== studentId
    )
    unreadSummary.value.total = unreadSummary.value.threads.reduce(
      (sum, t) => sum + t.unread_count,
      0
    )
  }

  return {
    // State
    loading,
    error,
    threadsByStudent,
    unreadSummary,

    // Getters
    getThreadIdByStudent,
    getUnreadCount,
    totalUnread,

    // Actions
    ensureThread,
    fetchUnreadSummary,
    markThreadRead,
    clearCache,
    removeThread,
  }
})
