/**
 * WebSocket Adapter
 *
 * Real-time transport using WebSocket Engine.
 * Automatically falls back to polling on connection failure.
 *
 * Features:
 * - WebSocket connection with auto-reconnect
 * - Automatic fallback to HttpPollingAdapter on failure
 * - Echo suppression (client-side)
 * - Typing indicators, read receipts, edit/delete support
 */
import { ref, type Ref } from 'vue'
import { WebSocketClient } from '@/modules/websocket-engine/client'
import type {
  ChatTransport,
  ChatMessage,
  TransportState,
  TransportType,
  TransportConfig,
  TransportCallbacks,
  SendMessagePayload,
  EditMessagePayload,
  DeleteMessagePayload,
  SendResult,
} from '../types'
import { HttpPollingAdapter } from './http-polling.adapter'

const TYPING_TIMEOUT = 3000

interface WebSocketAdapterOptions {
  immediateFallback?: boolean
  wsUrl?: string
  onFallback?: () => void
}

export class WebSocketAdapter implements ChatTransport {
  readonly type: TransportType = 'websocket'
  readonly state: Ref<TransportState>
  readonly isConnected: Ref<boolean>
  readonly pendingCount: Ref<number>

  private config: TransportConfig
  private callbacks: TransportCallbacks
  private wsClient: WebSocketClient | null = null
  private fallbackAdapter: HttpPollingAdapter | null = null
  private isFallback = false
  private typingTimer: number | null = null
  private wsOptions: WebSocketAdapterOptions
  private sentMessageIds: Set<string> = new Set() // For echo suppression

  constructor(
    config: TransportConfig,
    callbacks?: TransportCallbacks,
    options: WebSocketAdapterOptions = {}
  ) {
    this.config = config
    this.callbacks = callbacks || {}
    this.wsOptions = options
    this.state = ref('disconnected')
    this.isConnected = ref(false)
    this.pendingCount = ref(0)
  }

  async connect(): Promise<void> {
    if (this.isFallback && this.fallbackAdapter) {
      return this.fallbackAdapter.connect()
    }

    this.state.value = 'connecting'

    try {
      this.wsClient = new WebSocketClient({
        roomId: this.config.threadId,
        token: this.config.token,
        baseUrl: this.wsOptions.wsUrl,
        onMessage: this.handleIncomingMessage.bind(this),
        onConnect: () => {
          this.state.value = 'connected'
          this.isConnected.value = true
          this.callbacks.onStateChange?.('connected')
        },
        onDisconnect: () => {
          this.state.value = 'disconnected'
          this.isConnected.value = false
          this.callbacks.onStateChange?.('disconnected')
        },
        onError: (error) => {
          this.callbacks.onError?.(error)
          if (this.config.fallbackOnError !== false) {
            this.triggerFallback()
          }
        },
      })

      await this.wsClient.connect()
    } catch (error) {
      this.callbacks.onError?.(error as Error)

      if (this.config.fallbackOnError !== false || this.wsOptions.immediateFallback) {
        this.triggerFallback()
      } else {
        this.state.value = 'disconnected'
        this.isConnected.value = false
        throw error
      }
    }
  }

  disconnect(): void {
    if (this.isFallback && this.fallbackAdapter) {
      this.fallbackAdapter.disconnect()
      return
    }

    if (this.typingTimer) {
      clearTimeout(this.typingTimer)
      this.typingTimer = null
    }

    if (this.wsClient) {
      this.wsClient.disconnect()
      this.wsClient = null
    }

    this.state.value = 'disconnected'
    this.isConnected.value = false
  }

  async sendMessage(payload: SendMessagePayload): Promise<SendResult> {
    if (this.isFallback && this.fallbackAdapter) {
      return this.fallbackAdapter.sendMessage(payload)
    }

    if (!this.wsClient || !this.isConnected.value) {
      return { success: false, error: 'Not connected' }
    }

    const clientMessageId = payload.clientMessageId || crypto.randomUUID()
    this.sentMessageIds.add(clientMessageId) // Track for echo suppression
    this.pendingCount.value++

    const sent = this.wsClient.send({
      type: 'message.send',
      body: payload.body,
      reply_to_id: payload.replyToId,
      client_message_id: clientMessageId,
    })

    if (!sent) {
      this.pendingCount.value--
      return { success: false, error: 'Failed to send' }
    }

    // Return optimistic result - actual confirmation comes via WebSocket
    return { success: true }
  }

  async editMessage(payload: EditMessagePayload): Promise<SendResult> {
    if (this.isFallback && this.fallbackAdapter) {
      return this.fallbackAdapter.editMessage(payload)
    }

    if (!this.wsClient || !this.isConnected.value) {
      return { success: false, error: 'Not connected' }
    }

    const sent = this.wsClient.send({
      type: 'message.edit',
      message_id: payload.messageId,
      body: payload.newBody,
    })

    return { success: sent }
  }

  async deleteMessage(payload: DeleteMessagePayload): Promise<SendResult> {
    if (this.isFallback && this.fallbackAdapter) {
      return this.fallbackAdapter.deleteMessage(payload)
    }

    if (!this.wsClient || !this.isConnected.value) {
      return { success: false, error: 'Not connected' }
    }

    const sent = this.wsClient.send({
      type: 'message.delete',
      message_id: payload.messageId,
    })

    return { success: sent }
  }

  async markAsRead(messageId: string): Promise<void> {
    if (this.isFallback && this.fallbackAdapter) {
      return this.fallbackAdapter.markAsRead(messageId)
    }

    if (!this.wsClient || !this.isConnected.value) return

    this.wsClient.send({
      type: 'message.read',
      message_id: messageId,
    })
  }

  startTyping(): void {
    if (this.isFallback) return // Not supported in fallback

    if (!this.wsClient || !this.isConnected.value) return

    this.wsClient.send({ type: 'typing.start' })

    // Auto-stop after timeout
    if (this.typingTimer) {
      clearTimeout(this.typingTimer)
    }
    this.typingTimer = window.setTimeout(() => {
      this.stopTyping()
    }, TYPING_TIMEOUT)
  }

  stopTyping(): void {
    if (this.isFallback) return

    if (this.typingTimer) {
      clearTimeout(this.typingTimer)
      this.typingTimer = null
    }

    if (!this.wsClient || !this.isConnected.value) return

    this.wsClient.send({ type: 'typing.stop' })
  }

  setCallbacks(callbacks: TransportCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks }
    this.fallbackAdapter?.setCallbacks(callbacks)
  }

  forceFallback(): void {
    this.triggerFallback()
  }

  /** Handle incoming WebSocket message */
  private handleIncomingMessage(payload: any): void {
    switch (payload.type) {
      case 'message.new': {
        const msg = payload.message
        const clientMessageId = msg.client_message_id

        // Echo suppression: skip messages we sent ourselves
        if (clientMessageId && this.sentMessageIds.has(clientMessageId)) {
          this.sentMessageIds.delete(clientMessageId)
          this.pendingCount.value--
          return
        }

        const chatMessage: ChatMessage = {
          id: msg.id,
          threadId: msg.thread_id,
          senderId: msg.sender_id,
          body: msg.body,
          createdAt: msg.created_at,
          replyToId: msg.reply_to_id,
          clientMessageId: clientMessageId,
        }
        this.callbacks.onMessage?.(chatMessage)
        break
      }

      case 'message.edited': {
        this.callbacks.onEdit?.(payload.message_id, payload.new_body, payload.editor_id)
        break
      }

      case 'message.deleted': {
        this.callbacks.onDelete?.(payload.message_id, payload.deleter_id)
        break
      }

      case 'typing.indicator': {
        this.callbacks.onTyping?.(payload.user_id, payload.is_typing)
        break
      }

      case 'message.read': {
        this.callbacks.onRead?.(payload.user_id, payload.message_id)
        break
      }

      case 'message.sent': {
        // Confirmation of our message being sent
        this.pendingCount.value--
        break
      }
    }
  }

  /** Trigger fallback to polling */
  private triggerFallback(): void {
    if (this.isFallback) return

    console.log('[WebSocketAdapter] Falling back to polling')
    this.isFallback = true
    this.state.value = 'fallback'
    this.callbacks.onStateChange?.('fallback')

    // Disconnect WebSocket
    if (this.wsClient) {
      this.wsClient.disconnect()
      this.wsClient = null
    }

    // Initialize fallback adapter
    this.fallbackAdapter = new HttpPollingAdapter(this.config, this.callbacks)
    this.wsOptions.onFallback?.()

    // Connect fallback
    this.fallbackAdapter.connect().catch(() => {
      // If fallback also fails, stay in fallback state but disconnected
      this.state.value = 'disconnected'
    })
  }
}
