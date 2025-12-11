/**
 * Realtime Multiplexer — v0.16.0
 * Один WS, кілька каналів: chat, board, calls, presence
 */

import { encode, decode, MESSAGE_FORMAT } from './transport'

/**
 * Channel types
 */
export const CHANNEL = {
  CHAT: 'chat',
  BOARD: 'board',
  CALLS: 'calls',
  PRESENCE: 'presence',
  SYSTEM: 'system',
}

/**
 * Multiplexer message structure
 */
const MESSAGE_FIELDS = {
  CHANNEL: 'c',      // Channel name
  EVENT: 'e',        // Event type
  PAYLOAD: 'p',      // Event payload
  ID: 'i',           // Message ID
  TIMESTAMP: 't',    // Timestamp
  ACK: 'a',          // Acknowledgment ID
}

/**
 * Generate unique message ID
 */
function generateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 6)}`
}

/**
 * Channel subscription
 */
class ChannelSubscription {
  constructor(channel, multiplexer) {
    this.channel = channel
    this.multiplexer = multiplexer
    this.handlers = new Map()
    this.isSubscribed = false
  }

  /**
   * Subscribe to event
   */
  on(event, handler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, [])
    }
    this.handlers.get(event).push(handler)
    
    return () => this.off(event, handler)
  }

  /**
   * Unsubscribe from event
   */
  off(event, handler) {
    const handlers = this.handlers.get(event)
    if (handlers) {
      const index = handlers.indexOf(handler)
      if (index > -1) {
        handlers.splice(index, 1)
      }
    }
  }

  /**
   * Emit event to handlers
   */
  emit(event, payload, meta) {
    const handlers = this.handlers.get(event) || []
    const wildcardHandlers = this.handlers.get('*') || []
    
    for (const handler of [...handlers, ...wildcardHandlers]) {
      try {
        handler(payload, { event, channel: this.channel, ...meta })
      } catch (error) {
        console.error(`[multiplexer] handler error on ${this.channel}:${event}:`, error)
      }
    }
  }

  /**
   * Send message on this channel
   */
  send(event, payload, options = {}) {
    return this.multiplexer.send(this.channel, event, payload, options)
  }

  /**
   * Unsubscribe from channel
   */
  unsubscribe() {
    this.handlers.clear()
    this.isSubscribed = false
    this.multiplexer.unsubscribeChannel(this.channel)
  }
}

/**
 * WebSocket Multiplexer
 */
export class RealtimeMultiplexer {
  constructor(options = {}) {
    this.ws = null
    this.url = options.url || null
    this.channels = new Map()
    this.pendingAcks = new Map()
    this.messageQueue = []
    this.isConnected = false
    this.useBinary = options.useBinary !== false
    
    // Reconnection
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = options.maxReconnectAttempts || 5
    this.reconnectDelay = options.reconnectDelay || 1000
    this.reconnectTimer = null
    
    // Callbacks
    this.onConnect = options.onConnect || (() => {})
    this.onDisconnect = options.onDisconnect || (() => {})
    this.onError = options.onError || (() => {})
    this.onReconnecting = options.onReconnecting || (() => {})
    
    // Ack timeout
    this.ackTimeoutMs = options.ackTimeoutMs || 5000
  }

  /**
   * Connect to WebSocket server
   */
  connect(url) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return Promise.resolve()
    }
    
    this.url = url || this.url
    
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url)
        this.ws.binaryType = this.useBinary ? 'arraybuffer' : 'blob'
        
        this.ws.onopen = () => {
          this.isConnected = true
          this.reconnectAttempts = 0
          
          // Flush queued messages
          this.flushQueue()
          
          // Re-subscribe to channels
          this.resubscribeChannels()
          
          this.onConnect()
          resolve()
        }
        
        this.ws.onclose = (event) => {
          this.isConnected = false
          this.onDisconnect(event)
          
          if (!event.wasClean) {
            this.attemptReconnect()
          }
        }
        
        this.ws.onerror = (error) => {
          this.onError(error)
          reject(error)
        }
        
        this.ws.onmessage = (event) => {
          this.handleMessage(event.data)
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Disconnect from server
   */
  disconnect() {
    this.stopReconnect()
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect')
      this.ws = null
    }
    
    this.isConnected = false
    this.channels.clear()
    this.pendingAcks.clear()
    this.messageQueue = []
  }

  /**
   * Subscribe to channel
   */
  subscribe(channel) {
    if (this.channels.has(channel)) {
      return this.channels.get(channel)
    }
    
    const subscription = new ChannelSubscription(channel, this)
    this.channels.set(channel, subscription)
    
    // Send subscribe message
    if (this.isConnected) {
      this.sendRaw({
        [MESSAGE_FIELDS.CHANNEL]: CHANNEL.SYSTEM,
        [MESSAGE_FIELDS.EVENT]: 'subscribe',
        [MESSAGE_FIELDS.PAYLOAD]: { channel },
      })
    }
    
    subscription.isSubscribed = true
    return subscription
  }

  /**
   * Unsubscribe from channel
   */
  unsubscribeChannel(channel) {
    if (!this.channels.has(channel)) {
      return
    }
    
    this.channels.delete(channel)
    
    // Send unsubscribe message
    if (this.isConnected) {
      this.sendRaw({
        [MESSAGE_FIELDS.CHANNEL]: CHANNEL.SYSTEM,
        [MESSAGE_FIELDS.EVENT]: 'unsubscribe',
        [MESSAGE_FIELDS.PAYLOAD]: { channel },
      })
    }
  }

  /**
   * Send message on channel
   */
  send(channel, event, payload, options = {}) {
    const id = generateId()
    
    const message = {
      [MESSAGE_FIELDS.CHANNEL]: channel,
      [MESSAGE_FIELDS.EVENT]: event,
      [MESSAGE_FIELDS.PAYLOAD]: payload,
      [MESSAGE_FIELDS.ID]: id,
      [MESSAGE_FIELDS.TIMESTAMP]: Date.now(),
    }
    
    if (options.ack) {
      return this.sendWithAck(message, options.ackTimeout)
    }
    
    return this.sendRaw(message)
  }

  /**
   * Send message with acknowledgment
   */
  sendWithAck(message, timeout = this.ackTimeoutMs) {
    return new Promise((resolve, reject) => {
      const id = message[MESSAGE_FIELDS.ID]
      
      const timer = setTimeout(() => {
        this.pendingAcks.delete(id)
        reject(new Error('Ack timeout'))
      }, timeout)
      
      this.pendingAcks.set(id, {
        resolve: (data) => {
          clearTimeout(timer)
          this.pendingAcks.delete(id)
          resolve(data)
        },
        reject: (error) => {
          clearTimeout(timer)
          this.pendingAcks.delete(id)
          reject(error)
        },
        timer,
      })
      
      this.sendRaw(message)
    })
  }

  /**
   * Send raw message
   */
  sendRaw(message) {
    if (!this.isConnected) {
      // Queue message for later
      this.messageQueue.push(message)
      return false
    }
    
    try {
      const data = this.useBinary 
        ? encode(message, MESSAGE_FORMAT.MSGPACK)
        : JSON.stringify(message)
      
      this.ws.send(data)
      return true
    } catch (error) {
      console.error('[multiplexer] send error:', error)
      return false
    }
  }

  /**
   * Handle incoming message
   */
  handleMessage(data) {
    try {
      const message = this.useBinary && data instanceof ArrayBuffer
        ? decode(data, MESSAGE_FORMAT.MSGPACK)
        : JSON.parse(data)
      
      const channel = message[MESSAGE_FIELDS.CHANNEL]
      const event = message[MESSAGE_FIELDS.EVENT]
      const payload = message[MESSAGE_FIELDS.PAYLOAD]
      const id = message[MESSAGE_FIELDS.ID]
      const ackId = message[MESSAGE_FIELDS.ACK]
      
      // Handle acknowledgment
      if (ackId && this.pendingAcks.has(ackId)) {
        const pending = this.pendingAcks.get(ackId)
        pending.resolve(payload)
        return
      }
      
      // Handle system messages
      if (channel === CHANNEL.SYSTEM) {
        this.handleSystemMessage(event, payload)
        return
      }
      
      // Route to channel
      const subscription = this.channels.get(channel)
      if (subscription) {
        subscription.emit(event, payload, { id, timestamp: message[MESSAGE_FIELDS.TIMESTAMP] })
      }
    } catch (error) {
      console.error('[multiplexer] message parse error:', error)
    }
  }

  /**
   * Handle system messages
   */
  handleSystemMessage(event, payload) {
    switch (event) {
      case 'error':
        console.error('[multiplexer] server error:', payload)
        this.onError(payload)
        break
        
      case 'subscribed':
        console.log('[multiplexer] subscribed to:', payload.channel)
        break
        
      case 'unsubscribed':
        console.log('[multiplexer] unsubscribed from:', payload.channel)
        break
        
      case 'ping':
        this.sendRaw({
          [MESSAGE_FIELDS.CHANNEL]: CHANNEL.SYSTEM,
          [MESSAGE_FIELDS.EVENT]: 'pong',
        })
        break
    }
  }

  /**
   * Flush queued messages
   */
  flushQueue() {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()
      this.sendRaw(message)
    }
  }

  /**
   * Re-subscribe to all channels after reconnect
   */
  resubscribeChannels() {
    for (const [channel, subscription] of this.channels) {
      if (subscription.isSubscribed) {
        this.sendRaw({
          [MESSAGE_FIELDS.CHANNEL]: CHANNEL.SYSTEM,
          [MESSAGE_FIELDS.EVENT]: 'subscribe',
          [MESSAGE_FIELDS.PAYLOAD]: { channel },
        })
      }
    }
  }

  /**
   * Attempt reconnection
   */
  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.onError(new Error('Max reconnect attempts reached'))
      return
    }
    
    this.reconnectAttempts++
    const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1)
    
    this.onReconnecting({
      attempt: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts,
    })
    
    this.reconnectTimer = setTimeout(() => {
      this.connect(this.url).catch(() => {
        this.attemptReconnect()
      })
    }, delay)
  }

  /**
   * Stop reconnection attempts
   */
  stopReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  /**
   * Get connection state
   */
  getState() {
    return {
      isConnected: this.isConnected,
      channels: Array.from(this.channels.keys()),
      queuedMessages: this.messageQueue.length,
      pendingAcks: this.pendingAcks.size,
      reconnectAttempts: this.reconnectAttempts,
    }
  }

  /**
   * Destroy multiplexer
   */
  destroy() {
    this.disconnect()
    
    // Clear all pending acks
    for (const pending of this.pendingAcks.values()) {
      clearTimeout(pending.timer)
      pending.reject(new Error('Multiplexer destroyed'))
    }
    this.pendingAcks.clear()
  }
}

/**
 * Create multiplexer instance
 */
export function createMultiplexer(options = {}) {
  return new RealtimeMultiplexer(options)
}

/**
 * Singleton instance
 */
let globalMultiplexer = null

export function getGlobalMultiplexer() {
  if (!globalMultiplexer) {
    globalMultiplexer = createMultiplexer()
  }
  return globalMultiplexer
}

export default {
  RealtimeMultiplexer,
  createMultiplexer,
  getGlobalMultiplexer,
  CHANNEL,
}
