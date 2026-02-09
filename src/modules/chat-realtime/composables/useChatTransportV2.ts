/**
 * useChatTransportV2 Composable
 *
 * Unified interface for chat transport with automatic fallback.
 * Works with both WebSocket (realtime) and HTTP Polling (legacy-compatible).
 *
 * Usage:
 *   const chat = useChatTransportV2({
 *     threadId: 'thread-123',
 *     token: 'jwt',
 *     userId: 42,
 *   }, {
 *     realtimeChatEnabled: true  // Feature flag
 *   })
 *
 * Features:
 * - Transport selected via feature flag (explicit, no auto-detect)
 * - Automatic fallback to polling on WebSocket failure
 * - Reactive state (messages, isConnected, pendingCount)
 * - Event callbacks for UI updates
 */
import { ref, computed, onMounted, onUnmounted, watch, type Ref } from 'vue'
import { ChatTransportFactory } from '../adapters/factory'
import type {
  ChatTransport,
  ChatMessage,
  TransportState,
  TransportConfig,
  TransportCallbacks,
  RealtimeFeatureFlags,
  SendMessagePayload,
} from '../types'

export interface UseChatTransportV2Options {
  threadId: string
  token: string
  userId: number
  wsUrl?: string
  autoConnect?: boolean
}

export interface UseChatTransportV2Return {
  // Reactive state
  messages: Ref<ChatMessage[]>
  isConnected: Ref<boolean>
  isConnecting: Ref<boolean>
  transportState: Ref<TransportState>
  transportType: Ref<'websocket' | 'polling'>
  pendingCount: Ref<number>
  error: Ref<string | null>

  // Actions
  sendMessage: (body: string, replyToId?: string) => Promise<boolean>
  editMessage: (messageId: string, newBody: string) => Promise<boolean>
  deleteMessage: (messageId: string) => Promise<boolean>
  markAsRead: (messageId: string) => Promise<void>
  startTyping: () => void
  stopTyping: () => void
  reconnect: () => Promise<void>
  forcePolling: () => void
}

export function useChatTransportV2(
  options: UseChatTransportV2Options,
  flags: RealtimeFeatureFlags
): UseChatTransportV2Return {
  const { threadId, token, userId, wsUrl, autoConnect = true } = options

  // Reactive state
  const messages = ref<ChatMessage[]>([])
  const error = ref<string | null>(null)
  const isConnecting = ref(false)
  const transportType = ref<'websocket' | 'polling'>('polling')

  // Transport instance
  let transport: ChatTransport | null = null

  // Computed from transport state
  const isConnected = computed(() => transport?.isConnected.value ?? false)
  const transportState = computed(() => transport?.state.value ?? 'disconnected')
  const pendingCount = computed(() => transport?.pendingCount.value ?? 0)

  // Callbacks for transport events
  const callbacks: TransportCallbacks = {
    onMessage: (message: ChatMessage) => {
      messages.value.push(message)
    },
    onTyping: (userId: number, isTyping: boolean) => {
      // Typing handled by parent component
      console.log('[useChatTransportV2] Typing:', userId, isTyping)
    },
    onRead: (userId: number, messageId: string) => {
      // Read receipt handled by parent component
      console.log('[useChatTransportV2] Read:', userId, messageId)
    },
    onStateChange: (state: TransportState) => {
      isConnecting.value = state === 'connecting' || state === 'reconnecting'
      transportType.value = transport?.type ?? 'polling'
    },
    onError: (err: Error) => {
      error.value = err.message
      console.error('[useChatTransportV2] Transport error:', err)
    },
  }

  /**
   * Initialize transport based on feature flags
   */
  async function initTransport(): Promise<void> {
    if (transport) {
      transport.disconnect()
    }

    const factory = new ChatTransportFactory(flags)

    const config: TransportConfig = {
      threadId,
      token,
      userId,
      wsUrl,
      fallbackOnError: true, // Enable automatic fallback
    }

    transport = factory.createTransport(config, callbacks)
    transportType.value = transport.type

    if (autoConnect) {
      isConnecting.value = true
      try {
        await transport.connect()
      } catch (err) {
        // Fallback happens automatically in adapter
        error.value = err instanceof Error ? err.message : 'Connection failed'
      } finally {
        isConnecting.value = false
      }
    }
  }

  /**
   * Send message
   */
  async function sendMessage(body: string, replyToId?: string): Promise<boolean> {
    if (!transport) return false

    const payload: SendMessagePayload = {
      body,
      replyToId,
      clientMessageId: crypto.randomUUID(),
    }

    const result = await transport.sendMessage(payload)
    return result.success
  }

  /**
   * Edit message
   */
  async function editMessage(messageId: string, newBody: string): Promise<boolean> {
    if (!transport) return false

    const result = await transport.editMessage({ messageId, newBody })
    return result.success
  }

  /**
   * Delete message
   */
  async function deleteMessage(messageId: string): Promise<boolean> {
    if (!transport) return false

    const result = await transport.deleteMessage({ messageId })
    return result.success
  }

  /**
   * Mark message as read
   */
  async function markAsRead(messageId: string): Promise<void> {
    if (!transport) return

    await transport.markAsRead(messageId)
  }

  /**
   * Start typing indicator
   */
  function startTyping(): void {
    transport?.startTyping()
  }

  /**
   * Stop typing indicator
   */
  function stopTyping(): void {
    transport?.stopTyping()
  }

  /**
   * Manual reconnect
   */
  async function reconnect(): Promise<void> {
    await initTransport()
  }

  /**
   * Force fallback to polling
   */
  function forcePolling(): void {
    transport?.forceFallback()
    transportType.value = 'polling'
  }

  // Initialize on mount
  onMounted(() => {
    initTransport()
  })

  // Cleanup on unmount
  onUnmounted(() => {
    transport?.disconnect()
    transport = null
  })

  // Watch for flag changes
  watch(
    () => flags.realtimeChatEnabled,
    () => {
      initTransport()
    }
  )

  // Watch for token changes
  watch(
    () => token,
    () => {
      if (transport) {
        initTransport()
      }
    }
  )

  return {
    // State
    messages,
    isConnected,
    isConnecting,
    transportState,
    transportType,
    pendingCount,
    error,

    // Actions
    sendMessage,
    editMessage,
    deleteMessage,
    markAsRead,
    startTyping,
    stopTyping,
    reconnect,
    forcePolling,
  }
}
