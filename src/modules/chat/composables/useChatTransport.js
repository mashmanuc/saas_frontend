/**
 * useChatTransport - Smart Transport Selection v1.0
 * 
 * Автоматичний вибір між WebSocket та Polling:
 * - Починає з WebSocket
 * - При 3 невдалих спробах переключається на Polling
 * - Періодично перевіряє можливість повернення до WebSocket
 * - Прозорий для компонентів - один інтерфейс, дві реалізації
 */

import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useChatStore } from '@/stores/chatStore'
import { useChatPolling } from '@/composables/useChatPolling'

const WS_RECONNECT_THRESHOLD = 3  // Скільки невдалих спроб до fallback
const WS_RECOVERY_INTERVAL_MS = 60000  // Як часто пробувати повернутися до WS (1 хв)

export function useChatTransport(lessonId, options = {}) {
  const chatStore = useChatStore()
  
  // Transport state
  const transport = ref('websocket') // 'websocket' | 'polling'
  const wsFailureCount = ref(0)
  const isRecovering = ref(false)
  const recoveryTimer = ref(null)
  
  // Polling composable (lazy init)
  const polling = ref(null)
  
  // Computed: current messages based on transport
  const messages = computed(() => {
    if (transport.value === 'polling' && polling.value) {
      return polling.value.messages.value
    }
    return chatStore.sortedMessages
  })
  
  // Computed: connection status
  const connectionStatus = computed(() => {
    if (transport.value === 'websocket') {
      return chatStore.chatStatus === 'offline' ? 'reconnecting' : 'connected'
    }
    return 'polling'
  })
  
  // Watch WebSocket failures
  watch(() => chatStore.chatStatus, (status) => {
    if (status === 'offline') {
      wsFailureCount.value++
      
      if (wsFailureCount.value >= WS_RECONNECT_THRESHOLD && transport.value === 'websocket') {
        console.log('[useChatTransport] Fallback to polling after', wsFailureCount.value, 'failures')
        fallbackToPolling()
      }
    } else if (status === 'connected') {
      wsFailureCount.value = 0
    }
  })
  
  function fallbackToPolling() {
    if (transport.value === 'polling') return
    
    transport.value = 'polling'
    
    // Initialize polling
    const threadId = ref(lessonId)
    const currentUserId = ref(null) // Will be set from auth store
    
    polling.value = useChatPolling(threadId, currentUserId, {
      autoStart: true,
      activeDelay: 5000, // More aggressive polling when in fallback mode
      inactiveDelay: 15000
    })
    
    // Start recovery attempts
    startRecoveryAttempts()
  }
  
  function startRecoveryAttempts() {
    if (recoveryTimer.value) {
      clearInterval(recoveryTimer.value)
    }
    
    recoveryTimer.value = setInterval(() => {
      if (transport.value === 'polling') {
        attemptWebSocketRecovery()
      }
    }, WS_RECOVERY_INTERVAL_MS)
  }
  
  async function attemptWebSocketRecovery() {
    if (isRecovering.value) return
    
    isRecovering.value = true
    console.log('[useChatTransport] Attempting WebSocket recovery...')
    
    try {
      // Try to reconnect WebSocket
      await chatStore.subscribeToRealtime()
      
      // Check if connection successful
      if (chatStore.chatStatus !== 'offline') {
        console.log('[useChatTransport] WebSocket recovery successful!')
        transport.value = 'websocket'
        wsFailureCount.value = 0
        
        // Stop polling
        if (polling.value) {
          polling.value.stopPolling()
        }
        
        // Stop recovery attempts
        if (recoveryTimer.value) {
          clearInterval(recoveryTimer.value)
          recoveryTimer.value = null
        }
      }
    } catch (error) {
      console.log('[useChatTransport] WebSocket recovery failed:', error.message)
    } finally {
      isRecovering.value = false
    }
  }
  
  // Unified send message
  async function sendMessage(text) {
    if (transport.value === 'polling' && polling.value) {
      return await polling.value.sendMessage(text)
    }
    return await chatStore.sendMessage({ text })
  }
  
  // Unified load more
  async function loadMore() {
    if (transport.value === 'polling') {
      // Polling loads incrementally, no explicit "load more"
      return
    }
    return await chatStore.fetchHistory()
  }
  
  // Manual transport switch (for user control)
  function forcePolling() {
    fallbackToPolling()
  }
  
  function forceWebSocket() {
    transport.value = 'websocket'
    wsFailureCount.value = 0
    chatStore.subscribeToRealtime()
  }
  
  onMounted(() => {
    // Start with WebSocket
    if (lessonId) {
      chatStore.initLesson(lessonId)
    }
  })
  
  onUnmounted(() => {
    if (recoveryTimer.value) {
      clearInterval(recoveryTimer.value)
    }
    if (polling.value) {
      polling.value.stopPolling()
    }
  })
  
  return {
    // State
    transport,
    connectionStatus,
    isRecovering,
    wsFailureCount,
    
    // Data
    messages,
    
    // Methods
    sendMessage,
    loadMore,
    forcePolling,
    forceWebSocket,
    attemptWebSocketRecovery
  }
}

export default useChatTransport
