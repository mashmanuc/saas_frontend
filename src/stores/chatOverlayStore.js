import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * Global chat overlay — дозволяє відкрити робочу ChatModal з будь-якого місця
 * (notification bell-клік, toast-кнопка) по thread_id, БЕЗ роуту.
 *
 * Ref: CHAT_NOTIFICATION_FIX_PLAN — навігація з нотифікації відкриває working modal
 * (ChatView route /tutor/messages/:id порожній для CONTACT threads; модалка = canonical).
 * Notification payload має data.thread_id + data.sender_id → відкриваємо напряму по threadId.
 */
export const useChatOverlayStore = defineStore('chatOverlay', () => {
  const isOpen = ref(false)
  const threadId = ref(null)
  const otherUserName = ref('')

  /** Відкрити чат напряму по thread_id (з нотифікації). */
  function openByThread(tid, name = '') {
    if (!tid) return
    threadId.value = String(tid)
    otherUserName.value = name || ''
    isOpen.value = true
  }

  function close() {
    isOpen.value = false
    threadId.value = null
    otherUserName.value = ''
  }

  return { isOpen, threadId, otherUserName, openByThread, close }
})
