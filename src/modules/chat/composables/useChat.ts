/**
 * Chat Composable
 *
 * Vue composable for real-time chat functionality.
 * Wraps WebSocket Engine client with chat-specific features.
 *
 * Features:
 * - Connect to chat thread via WebSocket
 * - Send/receive messages
 * - Typing indicators
 * - Read receipts
 * - Message history synchronization
 * - Auto-reconnect with message recovery
 *
 * Usage:
 *   const {
 *     messages,
 *     isConnected,
 *     sendMessage,
 *     startTyping,
 *     stopTyping,
 *     markAsRead,
 *   } = useChat({
 *     threadId: 'thread-123',
 *     token: 'jwt-token',
 *   })
 */
import { ref, computed, onMounted, onUnmounted, watch, type Ref, type ComputedRef } from 'vue'
import { WebSocketClient } from '@/modules/websocket-engine/client'

export interface ChatMessage {
  id: string
  threadId: string
  senderId: number
  body: string
  createdAt: string
  replyToId?: string
  isEdited?: boolean
  isDeleted?: boolean
}

export interface UseChatOptions {
  threadId: string
  token: string
  onMessage?: (message: ChatMessage) => void
  onTyping?: (userId: number, isTyping: boolean) => void
  onRead?: (userId: number, messageId: string) => void
}

export interface UseChatReturn {
  // State (readonly refs)
  messages: Ref<ChatMessage[]>
  isConnected: Ref<boolean>
  isConnecting: Ref<boolean>
  pendingCount: Ref<number>
  typingUsers: Ref<Set<number>>
  
  // Actions
  sendMessage: (body: string, replyToId?: string) => boolean
  startTyping: () => void
  stopTyping: () => void
  markAsRead: (messageId: string) => void
  editMessage: (messageId: string, newBody: string) => void
  deleteMessage: (messageId: string) => void
  reconnect: () => Promise<void>
  disconnect: () => void
}

export function useChat(options: UseChatOptions): UseChatReturn {
  const { threadId, token, onMessage, onTyping, onRead } = options
  
  // Reactive state
  const messages = ref<ChatMessage[]>([])
  const isConnected = ref(false)
  const isConnecting = ref(false)
  const pendingCount = ref(0)
  const typingUsers = ref<Set<number>>(new Set())
  
  // WebSocket client instance
  let wsClient: WebSocketClient | null = null
  let typingTimer: number | null = null
  
  // Typing indicator timeout (3 seconds)
  const TYPING_TIMEOUT = 3000
  
  /**
   * Initialize WebSocket connection
   */
  const connect = async () => {
    if (isConnecting.value || isConnected.value) return
    
    isConnecting.value = true
    
    wsClient = new WebSocketClient({
      roomId: threadId,
      token,
      onMessage: handleIncomingMessage,
      onConnect: () => {
        isConnected.value = true
        isConnecting.value = false
      },
      onDisconnect: () => {
        isConnected.value = false
        isConnecting.value = false
      },
      onError: (error) => {
        console.error('[useChat] WebSocket error:', error)
        isConnecting.value = false
      },
    })
    
    await wsClient.connect()
  }
  
  /**
   * Handle incoming WebSocket message
   */
  const handleIncomingMessage = (payload: any) => {
    switch (payload.type) {
      case 'message.new':
        const newMessage: ChatMessage = {
          id: payload.message.id,
          threadId: payload.message.thread_id,
          senderId: payload.message.sender_id,
          body: payload.message.body,
          createdAt: payload.message.created_at,
          replyToId: payload.message.reply_to_id,
        }
        messages.value.push(newMessage)
        onMessage?.(newMessage)
        break
        
      case 'message.edited':
        const editedMsg = messages.value.find(m => m.id === payload.message_id)
        if (editedMsg) {
          editedMsg.body = payload.new_body
          editedMsg.isEdited = true
        }
        break
        
      case 'message.deleted':
        const deletedMsg = messages.value.find(m => m.id === payload.message_id)
        if (deletedMsg) {
          deletedMsg.isDeleted = true
          deletedMsg.body = '[deleted]'
        }
        break
        
      case 'typing.indicator':
        if (payload.is_typing) {
          typingUsers.value.add(payload.user_id)
        } else {
          typingUsers.value.delete(payload.user_id)
        }
        onTyping?.(payload.user_id, payload.is_typing)
        break
        
      case 'message.read':
        onRead?.(payload.user_id, payload.message_id)
        break
        
      case 'chat.error':
        console.error('[useChat] Server error:', payload.error, payload.code)
        break
    }
  }
  
  /**
   * Send chat message
   */
  const sendMessage = (body: string, replyToId?: string): boolean => {
    if (!wsClient || !isConnected.value) {
      console.warn('[useChat] Cannot send message - not connected')
      return false
    }
    
    return wsClient.send({
      type: 'message.send',
      body,
      reply_to_id: replyToId,
    })
  }
  
  /**
   * Start typing indicator
   */
  const startTyping = () => {
    if (!wsClient || !isConnected.value) return
    
    wsClient.send({ type: 'typing.start' })
    
    // Auto-stop typing after timeout
    if (typingTimer) {
      clearTimeout(typingTimer)
    }
    typingTimer = window.setTimeout(() => {
      stopTyping()
    }, TYPING_TIMEOUT)
  }
  
  /**
   * Stop typing indicator
   */
  const stopTyping = () => {
    if (!wsClient || !isConnected.value) return
    
    if (typingTimer) {
      clearTimeout(typingTimer)
      typingTimer = null
    }
    
    wsClient.send({ type: 'typing.stop' })
  }
  
  /**
   * Mark message as read
   */
  const markAsRead = (messageId: string) => {
    if (!wsClient || !isConnected.value) return
    
    wsClient.send({
      type: 'message.read',
      message_id: messageId,
    })
  }
  
  /**
   * Edit existing message
   */
  const editMessage = (messageId: string, newBody: string) => {
    if (!wsClient || !isConnected.value) return
    
    wsClient.send({
      type: 'message.edit',
      message_id: messageId,
      body: newBody,
    })
  }
  
  /**
   * Delete message
   */
  const deleteMessage = (messageId: string) => {
    if (!wsClient || !isConnected.value) return
    
    wsClient.send({
      type: 'message.delete',
      message_id: messageId,
    })
  }
  
  /**
   * Manual reconnect
   */
  const reconnect = async () => {
    disconnect()
    await connect()
  }
  
  /**
   * Disconnect and cleanup
   */
  const disconnect = () => {
    if (typingTimer) {
      clearTimeout(typingTimer)
      typingTimer = null
    }
    
    if (wsClient) {
      wsClient.disconnect()
      wsClient = null
    }
    
    isConnected.value = false
    isConnecting.value = false
  }
  
  // Auto-connect on mount
  onMounted(() => {
    connect()
  })
  
  // Disconnect on unmount
  onUnmounted(() => {
    disconnect()
  })
  
  // Watch for token changes and reconnect
  watch(() => token, () => {
    if (isConnected.value) {
      reconnect()
    }
  })
  
  return {
    // State (readonly refs)
    messages,
    isConnected,
    isConnecting,
    pendingCount: computed(() => wsClient?.pendingCount ?? 0),
    typingUsers,
    
    // Actions
    sendMessage,
    startTyping,
    stopTyping,
    markAsRead,
    editMessage,
    deleteMessage,
    reconnect,
    disconnect,
  }
}
