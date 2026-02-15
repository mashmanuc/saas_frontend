/**
 * useChatPolling - Smart Polling Composable v0.70
 *
 * ✅ КАНОН: Інкрементальне завантаження БЕЗ "дьоргання"
 *
 * Ключові принципи:
 * 1. API повертає тільки нові повідомлення (after_ts)
 * 2. messages.push(...newMessages) - ДОДАЄМО, не перезаписуємо
 * 3. Стабільні :key="message.message_id" у Vue компонентах
 * 4. Adaptive polling (3s active / 15s inactive)
 */

import { ref, computed, onMounted, onUnmounted, watch, type Ref, shallowRef } from 'vue'
import negotiationChatApi, { type SmartPollingResponse } from '@/api/negotiationChat'
import type { ChatMessageDTO } from '@/types/inquiries'

export interface UseChatPollingOptions {
  /** Polling delay when tab is active (ms) */
  activeDelay?: number
  /** Polling delay when tab is inactive (ms) */
  inactiveDelay?: number
  /** Initial messages limit */
  initialLimit?: number
  /** Auto-start polling on mount */
  autoStart?: boolean
}

export interface UseChatPollingReturn {
  messages: Ref<ChatMessageDTO[]>
  isLoading: Ref<boolean>
  isSending: Ref<boolean>
  isWritable: Ref<boolean>
  error: Ref<string | null>
  unreadCount: Ref<number>

  // Methods
  sendMessage: (body: string) => Promise<ChatMessageDTO | null>
  markAllAsRead: () => Promise<void>
  startPolling: () => void
  stopPolling: () => void
  refresh: () => Promise<void>
}

const DEFAULT_ACTIVE_DELAY = 15000
const DEFAULT_INACTIVE_DELAY = 60000
const DEFAULT_INITIAL_LIMIT = 50

export function useChatPolling(
  threadId: Ref<string | null> | string,
  currentUserId: Ref<number | null> | number,
  options: UseChatPollingOptions = {}
): UseChatPollingReturn {
  const {
    activeDelay = DEFAULT_ACTIVE_DELAY,
    inactiveDelay = DEFAULT_INACTIVE_DELAY,
    initialLimit = DEFAULT_INITIAL_LIMIT,
    autoStart = true
  } = options

  // State
  const messages = shallowRef<ChatMessageDTO[]>([])
  const isLoading = ref(false)
  const isSending = ref(false)
  const isWritable = ref(true)
  const error = ref<string | null>(null)
  const latestTs = ref<string | null>(null)

  let pollTimeout: ReturnType<typeof setTimeout> | null = null
  let isPolling = false

  // Computed
  const resolvedThreadId = computed(() =>
    typeof threadId === 'string' ? threadId : threadId.value
  )

  const resolvedUserId = computed(() =>
    typeof currentUserId === 'number' ? currentUserId : currentUserId.value
  )

  const unreadCount = computed(() => {
    if (!resolvedUserId.value) return 0
    // ⚠️ Оптимізація: кешуємо результат для однакових messages
    return messages.value.filter((m) => {
      const senderId = m.sender_id ?? m.sender?.id
      const isRead = m.is_read ?? false
      return !isRead && senderId !== resolvedUserId.value
    }).length
  })

  // ✅ ІНКРЕМЕНТАЛЬНЕ ЗАВАНТАЖЕННЯ - без "дьоргання"
  async function loadNewMessages(): Promise<void> {
    const tid = resolvedThreadId.value
    if (!tid) return

    try {
      const response: SmartPollingResponse = await negotiationChatApi.fetchMessages(
        tid,
        latestTs.value || undefined,
        undefined,
        { skipLoader: true }
      )

      // ✅ Оптимізація: додаємо тільки якщо є нові повідомлення
      // Використовуємо повне присвоєння для shallowRef реактивності
      if (response.messages.length > 0) {
        messages.value = [...messages.value, ...response.messages]
      }

      // ⚠️ Оптимізація: оновлюємо latest_ts тільки якщо змінилося
      if (response.latest_ts && response.latest_ts !== latestTs.value) {
        latestTs.value = response.latest_ts
      }

      // ⚠️ Оптимізація: оновлюємо isWritable тільки якщо змінилося
      if (response.is_writable !== isWritable.value) {
        isWritable.value = response.is_writable
      }

      // ⚠️ Оптимізація: очищаємо error тільки якщо він був
      if (error.value !== null) {
        error.value = null
      }
    } catch (err: any) {
      // Silent fail для уникнення засмічення консолі
      const newError = err.message || 'Failed to load messages'
      if (error.value !== newError) {
        error.value = newError
      }
    }
  }

  // ✅ ПОЧАТКОВЕ ЗАВАНТАЖЕННЯ
  async function loadInitialMessages(): Promise<void> {
    const tid = resolvedThreadId.value
    if (!tid) return

    isLoading.value = true
    error.value = null

    try {
      const response: SmartPollingResponse = await negotiationChatApi.fetchMessages(
        tid,
        undefined,
        initialLimit
      )

      messages.value = response.messages
      latestTs.value = response.latest_ts
      isWritable.value = response.is_writable
    } catch (err: any) {
      // Silent fail
      error.value = err.message || 'Failed to load messages'
    } finally {
      isLoading.value = false
    }
  }

  // ✅ ADAPTIVE POLLING
  function getPollingDelay(): number {
    return document.hidden ? inactiveDelay : activeDelay
  }

  function schedulePoll(): void {
    if (!isPolling) return
    pollTimeout = setTimeout(async () => {
      await loadNewMessages()
      schedulePoll()
    }, getPollingDelay())
  }

  function startPolling(): void {
    if (isPolling) return
    isPolling = true
    schedulePoll()
  }

  function stopPolling(): void {
    isPolling = false
    if (pollTimeout) {
      clearTimeout(pollTimeout)
      pollTimeout = null
    }
  }

  // Visibility change handler
  function handleVisibilityChange(): void {
    if (pollTimeout && isPolling) {
      clearTimeout(pollTimeout)
      schedulePoll() // Restart with new delay
    }
  }

  // ✅ ВІДПРАВКА ПОВІДОМЛЕННЯ
  async function sendMessage(body: string): Promise<ChatMessageDTO | null> {
    const tid = resolvedThreadId.value
    if (!tid || !body.trim()) return null

    isSending.value = true
    error.value = null

    try {
      const clientMessageId = crypto.randomUUID()
      const newMessage = await negotiationChatApi.sendMessage(tid, {
        body: body.trim(),
        clientMessageId
      })

      // ✅ Optimistic update - додаємо одразу через повне присвоєння
      messages.value = [...messages.value, newMessage]

      // Оновлюємо latest_ts
      if (newMessage.created_at) {
        latestTs.value = newMessage.created_at
      }

      return newMessage
    } catch (err: any) {
      // Silent fail
      error.value = err.message || 'Failed to send message'
      return null
    } finally {
      isSending.value = false
    }
  }

// ✅ MARK AS READ - без мутацій, створюємо нові об'єкти
  async function markAllAsRead(): Promise<void> {
    const tid = resolvedThreadId.value
    if (!tid) return

    try {
      await negotiationChatApi.markAsRead(tid)
      
      // ⚠️ Оптимізація: не мутуємо об'єкти, а створюємо нові тільки для змінених
      const hasUnread = messages.value.some(m => {
        const senderId = m.sender_id ?? m.sender?.id
        return !m.is_read && senderId !== resolvedUserId.value
      })
      
      // Оновлюємо тільки якщо є непрочитані
      if (hasUnread) {
        messages.value = messages.value.map((m) => {
          const senderId = m.sender_id ?? m.sender?.id
          if (!m.is_read && senderId !== resolvedUserId.value) {
            return { ...m, is_read: true }
          }
          return m
        })
      }
    } catch (err: any) {
      // Silent fail
    }
  }

  // Refresh (reload all)
  async function refresh(): Promise<void> {
    messages.value = []
    latestTs.value = null
    await loadInitialMessages()
  }

  // Watch threadId changes
  watch(
    () => resolvedThreadId.value,
    async (newId, oldId) => {
      if (newId && newId !== oldId) {
        stopPolling()
        messages.value = []
        latestTs.value = null
        error.value = null
        await loadInitialMessages()
        if (autoStart) startPolling()
      }
    }
  )

  // Lifecycle
  onMounted(async () => {
    document.addEventListener('visibilitychange', handleVisibilityChange)

    if (resolvedThreadId.value) {
      await loadInitialMessages()
      if (autoStart) startPolling()
    }
  })

  onUnmounted(() => {
    stopPolling()
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  })

  return {
    messages,
    isLoading,
    isSending,
    isWritable,
    error,
    unreadCount,
    sendMessage,
    markAllAsRead,
    startPolling,
    stopPolling,
    refresh
  }
}

export default useChatPolling
