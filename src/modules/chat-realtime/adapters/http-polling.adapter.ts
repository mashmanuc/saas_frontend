/**
 * HTTP Polling Adapter
 *
 * Legacy-compatible polling transport.
 * Uses existing chat API without WebSocket.
 *
 * This adapter:
 * - Does NOT use WebSocket
 * - Uses HTTP polling for message retrieval
 * - Uses HTTP POST for message sending
 * - Compatible with legacy chat API
 */
import { ref, type Ref } from 'vue'
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
import {
  getThreadMessages,
  sendMessage as apiSendMessage,
} from '@/modules/chat/api/chatApi'

/** Polling delay when tab is active */
const DEFAULT_ACTIVE_DELAY = 5000
/** Polling delay when tab is inactive */
const DEFAULT_INACTIVE_DELAY = 15000

export class HttpPollingAdapter implements ChatTransport {
  readonly type: TransportType = 'polling'
  readonly state: Ref<TransportState>
  readonly isConnected: Ref<boolean>
  readonly pendingCount: Ref<number>

  private config: TransportConfig
  private callbacks: TransportCallbacks
  private pollTimeout: ReturnType<typeof setTimeout> | null = null
  private isPolling = false
  private latestTs: string | null = null

  constructor(config: TransportConfig, callbacks?: TransportCallbacks) {
    this.config = config
    this.callbacks = callbacks || {}
    this.state = ref('disconnected')
    this.isConnected = ref(false)
    this.pendingCount = ref(0)
  }

  async connect(): Promise<void> {
    this.state.value = 'connecting'

    try {
      // Load initial messages
      const response = await getThreadMessages(this.config.threadId)
      this.latestTs = response.messages[response.messages.length - 1]?.created_at || null

      this.state.value = 'connected'
      this.isConnected.value = true

      // Start polling
      this.startPolling()
    } catch (error) {
      this.state.value = 'disconnected'
      this.isConnected.value = false
      this.callbacks.onError?.(error as Error)
      throw error
    }
  }

  disconnect(): void {
    this.stopPolling()
    this.state.value = 'disconnected'
    this.isConnected.value = false
  }

  async sendMessage(payload: SendMessagePayload): Promise<SendResult> {
    try {
      this.pendingCount.value++

      const message = await apiSendMessage(this.config.threadId, {
        body: payload.body,
        client_message_id: payload.clientMessageId || crypto.randomUUID(),
      })

      // Convert API message to ChatMessage format
      const chatMessage: ChatMessage = {
        id: message.id,
        threadId: message.thread_id,
        senderId: message.sender_id,
        senderEmail: message.sender_email,
        senderName: message.sender_name,
        body: message.body,
        clientMessageId: message.client_message_id,
        createdAt: message.created_at,
      }

      this.callbacks.onMessage?.(chatMessage)

      return { success: true, message: chatMessage }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to send'
      return { success: false, error: errorMsg }
    } finally {
      this.pendingCount.value--
    }
  }

  async editMessage(payload: EditMessagePayload): Promise<SendResult> {
    // Legacy API may not support editing, return error
    return { success: false, error: 'Edit not supported in polling mode' }
  }

  async deleteMessage(payload: DeleteMessagePayload): Promise<SendResult> {
    // Legacy API may not support deleting, return error
    return { success: false, error: 'Delete not supported in polling mode' }
  }

  async markAsRead(messageId: string): Promise<void> {
    // Not directly supported in legacy API, ignore
  }

  startTyping(): void {
    // Typing indicators not supported in HTTP polling
  }

  stopTyping(): void {
    // Typing indicators not supported in HTTP polling
  }

  setCallbacks(callbacks: TransportCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks }
  }

  forceFallback(): void {
    // Already using polling, no fallback needed
  }

  /** Start polling for new messages */
  private startPolling(): void {
    if (this.isPolling) return
    this.isPolling = true
    this.schedulePoll()
  }

  /** Stop polling */
  private stopPolling(): void {
    this.isPolling = false
    if (this.pollTimeout) {
      clearTimeout(this.pollTimeout)
      this.pollTimeout = null
    }
  }

  /** Schedule next poll */
  private schedulePoll(): void {
    if (!this.isPolling) return

    const delay = document.hidden ? DEFAULT_INACTIVE_DELAY : DEFAULT_ACTIVE_DELAY

    this.pollTimeout = setTimeout(async () => {
      await this.pollMessages()
      this.schedulePoll()
    }, delay)
  }

  /** Poll for new messages */
  private async pollMessages(): Promise<void> {
    try {
      // Use after_ts parameter if supported by API
      const response = await getThreadMessages(this.config.threadId)

      // Process new messages
      const newMessages = response.messages.filter(
        m => !this.latestTs || new Date(m.created_at) > new Date(this.latestTs)
      )

      for (const msg of newMessages) {
        const chatMessage: ChatMessage = {
          id: msg.id,
          threadId: msg.thread_id,
          senderId: msg.sender_id,
          senderEmail: msg.sender_email,
          senderName: msg.sender_name,
          body: msg.body,
          clientMessageId: msg.client_message_id,
          createdAt: msg.created_at,
        }
        this.callbacks.onMessage?.(chatMessage)
      }

      // Update latest timestamp
      if (response.messages.length > 0) {
        this.latestTs = response.messages[response.messages.length - 1].created_at
      }
    } catch (error) {
      // Silent fail - don't break polling on error
      console.warn('[HttpPollingAdapter] Poll error:', error)
    }
  }
}
