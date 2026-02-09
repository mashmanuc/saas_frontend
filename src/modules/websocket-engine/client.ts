/**
 * WebSocket Engine Client
 *
 * Platform-agnostic WebSocket client for real-time communication.
 * Used by Chat, Notifications, and other domains.
 *
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Heartbeat ping/pong (25s interval)
 * - Message queuing when disconnected
 * - Echo suppression via sender_channel
 *
 * Architecture:
 * - Engine client is domain-agnostic
 * - Domains (Chat) wrap this client and parse payloads
 * - No business logic in this file
 *
 * Usage:
 *   import { WebSocketClient } from '@/modules/websocket-engine/client'
 *
 *   const client = new WebSocketClient({
 *     roomId: 'thread-123',
 *     token: 'jwt-token',
 *     onMessage: (payload) => console.log('Received:', payload)
 *   })
 *
 *   await client.connect()
 *   client.send({ type: 'message.new', body: 'Hello' })
 */

export interface EngineClientConfig {
  /** Room ID for group subscriptions */
  roomId?: string
  /** JWT access token for authentication */
  token: string
  /** WebSocket base URL (defaults to env VITE_WS_URL) */
  baseUrl?: string
  /** Callback when message received from server */
  onMessage?: (payload: any) => void
  /** Callback when connection established */
  onConnect?: () => void
  /** Callback when connection closed */
  onDisconnect?: (code: number, reason: string) => void
  /** Callback on errors */
  onError?: (error: Error) => void
  /** Maximum reconnection attempts (default: 5) */
  maxReconnectAttempts?: number
  /** Initial reconnect delay in ms (default: 1000) */
  reconnectDelay?: number
}

export interface EngineMessage {
  type: 'room.message' | 'user.message' | 'system.connected' | 'system.error' | 'pong'
  sender_id?: number
  sender_channel?: string
  payload?: any
  error?: string
  code?: string
  timestamp?: number
}

export class WebSocketClient {
  private ws: WebSocket | null = null
  private config: Required<EngineClientConfig>
  private reconnectAttempts = 0
  private reconnectTimer: number | null = null
  private heartbeatInterval: number | null = null
  private pendingMessages: Array<{ roomId?: string; payload: any }> = []
  private isConnecting = false
  private lastPingTimestamp = 0
  private myChannelName: string | null = null

  // Default configuration
  private static readonly DEFAULT_MAX_RECONNECT = 5
  private static readonly DEFAULT_RECONNECT_DELAY = 1000
  private static readonly HEARTBEAT_INTERVAL = 25000 // 25 seconds
  private static readonly PONG_TIMEOUT = 5000 // 5 seconds to wait for pong

  constructor(config: EngineClientConfig) {
    function getWebSocketUrl(): string {
      // Vite environment
      if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
        return ((import.meta as any).env.VITE_WS_URL as string) || 'ws://localhost:8000'
      }
      // Node/process environment (for tests)
      if (typeof process !== 'undefined' && process.env) {
        return process.env.VITE_WS_URL || 'ws://localhost:8000'
      }
      return 'ws://localhost:8000'
    }

    this.config = {
      roomId: config.roomId,
      token: config.token,
      baseUrl: config.baseUrl || getWebSocketUrl(),
      onMessage: config.onMessage || (() => {}),
      onConnect: config.onConnect || (() => {}),
      onDisconnect: config.onDisconnect || (() => {}),
      onError: config.onError || (() => {}),
      maxReconnectAttempts: config.maxReconnectAttempts || WebSocketClient.DEFAULT_MAX_RECONNECT,
      reconnectDelay: config.reconnectDelay || WebSocketClient.DEFAULT_RECONNECT_DELAY,
    }
  }

  /**
   * Establish WebSocket connection
   *
   * Returns:
   *   true if connected successfully
   *   false if connection failed
   */
  async connect(): Promise<boolean> {
    if (this.isConnecting || this.ws?.readyState === WebSocket.OPEN) {
      return true
    }

    this.isConnecting = true

    try {
      const url = this.buildUrl()
      this.ws = new WebSocket(url)

      return new Promise((resolve) => {
        if (!this.ws) {
          this.isConnecting = false
          return resolve(false)
        }

        this.ws.onopen = () => {
          this.reconnectAttempts = 0
          this.isConnecting = false
          this.startHeartbeat()
          this.flushPendingMessages()
          this.config.onConnect()
        }

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data)
        }

        this.ws.onclose = (event) => {
          this.isConnecting = false
          this.stopHeartbeat()
          this.myChannelName = null
          this.config.onDisconnect(event.code, event.reason)

          // Attempt reconnect unless intentionally closed
          if (event.code !== 1000 && event.code !== 1001) {
            this.scheduleReconnect()
          }
        }

        this.ws.onerror = (error) => {
          this.isConnecting = false
          this.config.onError(new Error('WebSocket connection error'))
          resolve(false)
        }

        // Wait for system.connected to confirm
        const checkConnected = setInterval(() => {
          if (this.myChannelName) {
            clearInterval(checkConnected)
            resolve(true)
          }
        }, 100)

        // Timeout after 5 seconds
        setTimeout(() => {
          clearInterval(checkConnected)
          if (!this.myChannelName) {
            resolve(false)
          }
        }, 5000)
      })
    } catch (error) {
      this.isConnecting = false
      this.config.onError(error instanceof Error ? error : new Error(String(error)))
      return false
    }
  }

  /**
   * Close WebSocket connection
   *
   * @param code Close code (default: 1000 - normal closure)
   * @param reason Close reason
   */
  disconnect(code = 1000, reason = 'Client disconnect'): void {
    this.stopHeartbeat()
    this.clearReconnectTimer()
    this.reconnectAttempts = this.config.maxReconnectAttempts // Prevent auto-reconnect

    if (this.ws) {
      this.ws.close(code, reason)
      this.ws = null
    }

    this.myChannelName = null
  }

  /**
   * Send message to server
   *
   * @param payload Message payload (domain-specific)
   * @param roomId Optional room ID (defaults to config.roomId)
   * @returns true if sent immediately, false if queued for later
   */
  send(payload: any, roomId?: string): boolean {
    const targetRoom = roomId || this.config.roomId

    const message = {
      room_id: targetRoom,
      payload,
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
      return true
    } else {
      // Queue for later delivery
      this.pendingMessages.push({ roomId: targetRoom, payload })

      // Trigger connection if not connecting
      if (!this.isConnecting && !this.ws) {
        this.connect()
      }

      return false
    }
  }

  /**
   * Send heartbeat ping
   */
  private sendPing(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.lastPingTimestamp = Date.now()
      this.ws.send(JSON.stringify({ type: 'ping', timestamp: this.lastPingTimestamp }))
    }
  }

  /**
   * Handle incoming message from server
   */
  private handleMessage(data: string): void {
    try {
      const message: EngineMessage = JSON.parse(data)

      switch (message.type) {
        case 'system.connected':
          // Store our channel name for echo suppression
          this.myChannelName = message.sender_channel || null
          break

        case 'room.message':
          // Echo suppression: don't process our own messages
          if (message.sender_channel === this.myChannelName) {
            return
          }
          this.config.onMessage(message.payload)
          break

        case 'user.message':
          // Direct messages always processed
          this.config.onMessage(message.payload)
          break

        case 'pong':
          // Heartbeat response received
          break

        case 'system.error':
          console.error('[WebSocketEngine] Server error:', message.error, message.code)
          break

        default:
          // Unknown message type - pass to handler anyway
          this.config.onMessage(message.payload)
      }
    } catch (e) {
      console.error('[WebSocketEngine] Failed to parse message:', e)
    }
  }

  /**
   * Start heartbeat interval
   */
  private startHeartbeat(): void {
    this.stopHeartbeat()
    this.heartbeatInterval = window.setInterval(() => {
      this.sendPing()
    }, WebSocketClient.HEARTBEAT_INTERVAL)
  }

  /**
   * Stop heartbeat interval
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error('[WebSocketEngine] Max reconnect attempts reached')
      return
    }

    this.clearReconnectTimer()

    const delay = this.config.reconnectDelay * Math.pow(2, this.reconnectAttempts)

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectAttempts++
      console.log(`[WebSocketEngine] Reconnect attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts}`)
      this.connect()
    }, delay)
  }

  /**
   * Clear reconnect timer
   */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  /**
   * Flush pending messages after connection
   */
  private flushPendingMessages(): void {
    while (this.pendingMessages.length > 0 && this.ws && this.ws.readyState === WebSocket.OPEN) {
      const msg = this.pendingMessages.shift()
      if (msg) {
        this.ws.send(JSON.stringify({
          room_id: msg.roomId,
          payload: msg.payload,
        }))
      }
    }
  }

  /**
   * Build WebSocket URL with authentication
   */
  private buildUrl(): string {
    const base = this.config.baseUrl.replace(/\/$/, '')
    const roomPath = this.config.roomId ? `/room/${this.config.roomId}/` : '/'
    return `${base}/ws${roomPath}?token=${encodeURIComponent(this.config.token)}`
  }

  /**
   * Check if currently connected
   */
  get isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }

  /**
   * Get current room ID
   */
  get roomId(): string | undefined {
    return this.config.roomId
  }

  /**
   * Get count of pending messages
   */
  get pendingCount(): number {
    return this.pendingMessages.length
  }
}

/**
 * Factory function to create configured WebSocket client
 *
 * @param roomId Room identifier
 * @param token JWT token
 * @param onMessage Message handler callback
 * @returns Configured WebSocketClient instance
 */
export function createEngineClient(
  roomId: string,
  token: string,
  onMessage: (payload: any) => void
): WebSocketClient {
  return new WebSocketClient({ roomId, token, onMessage })
}
