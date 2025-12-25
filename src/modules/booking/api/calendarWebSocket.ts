/**
 * Calendar WebSocket Client v0.49.3
 * Realtime updates for calendar events
 */

type MessageHandler = (data: any) => void

interface WebSocketMessage {
  type: string
  data?: any
  timestamp?: string
}

export class CalendarWebSocket {
  private ws: WebSocket | null = null
  private handlers: Map<string, MessageHandler[]> = new Map()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private pingInterval: number | null = null
  private token: string

  constructor(token: string) {
    this.token = token
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const host = window.location.host
      const url = `${protocol}//${host}/ws/calendar/`

      console.log('[CalendarWebSocket] Connecting to:', url)

      const protocols: string[] = ['access_token', this.token]
      this.ws = new WebSocket(url, protocols)

      this.ws.onopen = () => {
        console.log('[CalendarWebSocket] Connected')
        this.reconnectAttempts = 0
        this.startPing()
        resolve()
      }

      this.ws.onerror = (error) => {
        console.error('[CalendarWebSocket] Error:', error)
        reject(error)
      }

      this.ws.onclose = (event) => {
        console.log('[CalendarWebSocket] Disconnected:', event.code, event.reason)
        this.stopPing()
        this.handleReconnect()
      }

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          this.handleMessage(message)
        } catch (error) {
          console.error('[CalendarWebSocket] Failed to parse message:', error)
        }
      }
    })
  }

  disconnect(): void {
    this.stopPing()
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  on(type: string, handler: MessageHandler): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, [])
    }
    this.handlers.get(type)!.push(handler)
  }

  off(type: string, handler: MessageHandler): void {
    const handlers = this.handlers.get(type)
    if (handlers) {
      const index = handlers.indexOf(handler)
      if (index > -1) {
        handlers.splice(index, 1)
      }
    }
  }

  private handleMessage(message: WebSocketMessage): void {
    console.log('[CalendarWebSocket] Message received:', message.type)

    const handlers = this.handlers.get(message.type)
    if (handlers) {
      handlers.forEach(handler => handler(message.data))
    }
  }

  private startPing(): void {
    this.pingInterval = window.setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }))
      }
    }, 30000) // ping every 30 seconds
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)
      
      console.log(`[CalendarWebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`)
      
      setTimeout(() => {
        this.connect().catch(error => {
          console.error('[CalendarWebSocket] Reconnect failed:', error)
        })
      }, delay)
    } else {
      console.error('[CalendarWebSocket] Max reconnect attempts reached')
    }
  }
}
