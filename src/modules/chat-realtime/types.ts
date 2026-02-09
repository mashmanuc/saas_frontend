/**
 * Chat Transport Types
 *
 * Core interface for all chat transport implementations.
 * Both HttpPollingAdapter and WebSocketAdapter implement this.
 */
import type { Ref } from 'vue'

/** Chat message structure (canonical, transport-agnostic) */
export interface ChatMessage {
  id: string
  threadId: string
  senderId: number
  senderName?: string
  senderEmail?: string
  body: string
  clientMessageId?: string
  createdAt: string
  updatedAt?: string
  isRead?: boolean
  isEdited?: boolean
  isDeleted?: boolean
  replyToId?: string
}

/** Transport connection state */
export type TransportState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'fallback'

/** Transport type identifier */
export type TransportType = 'polling' | 'websocket'

/** Callbacks for transport events */
export interface TransportCallbacks {
  onMessage?: (message: ChatMessage) => void
  onTyping?: (userId: number, isTyping: boolean) => void
  onRead?: (userId: number, messageId: string) => void
  onEdit?: (messageId: string, newBody: string, editorId: number) => void
  onDelete?: (messageId: string, deleterId: number) => void
  onStateChange?: (state: TransportState) => void
  onError?: (error: Error) => void
}

/** Configuration for transport initialization */
export interface TransportConfig {
  threadId: string
  token: string
  userId: number
  baseUrl?: string
  wsUrl?: string
  fallbackOnError?: boolean
}

/** Payload for sending message */
export interface SendMessagePayload {
  body: string
  replyToId?: string
  clientMessageId?: string
}

/** Payload for editing message */
export interface EditMessagePayload {
  messageId: string
  newBody: string
}

/** Payload for deleting message */
export interface DeleteMessagePayload {
  messageId: string
}

/** Return type from send operations */
export interface SendResult {
  success: boolean
  message?: ChatMessage
  error?: string
}

/**
 * Chat Transport Interface
 *
 * Abstract interface implemented by both:
 * - HttpPollingAdapter (legacy-compatible)
 * - WebSocketAdapter (realtime)
 */
export interface ChatTransport {
  /** Transport type identifier */
  readonly type: TransportType

  /** Current connection state */
  readonly state: Ref<TransportState>

  /** Whether transport is currently connected */
  readonly isConnected: Ref<boolean>

  /** Message buffer/pending messages */
  readonly pendingCount: Ref<number>

  /**
   * Initialize transport connection
   */
  connect(): Promise<void>

  /**
   * Disconnect and cleanup
   */
  disconnect(): void

  /**
   * Send message
   */
  sendMessage(payload: SendMessagePayload): Promise<SendResult>

  /**
   * Edit existing message
   */
  editMessage(payload: EditMessagePayload): Promise<SendResult>

  /**
   * Delete message
   */
  deleteMessage(payload: DeleteMessagePayload): Promise<SendResult>

  /**
   * Mark message as read
   */
  markAsRead(messageId: string): Promise<void>

  /**
   * Start typing indicator
   */
  startTyping(): void

  /**
   * Stop typing indicator
   */
  stopTyping(): void

  /**
   * Register callbacks for transport events
   */
  setCallbacks(callbacks: TransportCallbacks): void

  /**
   * Force fallback to polling (for recovery)
   */
  forceFallback(): void
}

/** Feature flags for realtime configuration */
export interface RealtimeFeatureFlags {
  /** Enable WebSocket transport */
  realtimeChatEnabled: boolean

  /** WebSocket URL override */
  wsUrl?: string

  /** Fallback immediately on any error */
  immediateFallback?: boolean
}
