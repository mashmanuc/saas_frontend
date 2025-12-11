/**
 * WebRTC Signaling Client — v0.16.0
 * WebSocket-based signaling for WebRTC calls
 */

import { SIGNALING_EVENTS, MESSAGE_TYPE, CALL_STATE, ERROR_CODE } from './events'

/**
 * Default configuration
 */
const DEFAULT_CONFIG = {
  reconnectAttempts: 5,
  reconnectDelayMs: 1000,
  reconnectBackoffMultiplier: 1.5,
  pingIntervalMs: 30000,
  connectionTimeoutMs: 10000,
}

/**
 * WebRTC Signaling Client
 */
export class SignalingClient {
  constructor(options = {}) {
    this.config = { ...DEFAULT_CONFIG, ...options }
    this.ws = null
    this.url = options.url || null
    this.roomId = null
    this.userId = options.userId || null
    
    // State
    this.isConnected = false
    this.isReconnecting = false
    this.reconnectAttempt = 0
    this.callState = CALL_STATE.IDLE
    
    // Event handlers
    this.handlers = new Map()
    
    // Timers
    this.pingTimer = null
    this.reconnectTimer = null
    this.connectionTimeout = null
    
    // Pending ICE candidates (before remote description is set)
    this.pendingIceCandidates = []
  }

  /**
   * Connect to signaling server
   */
  connect(url, roomId) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.warn('[signaling] already connected')
      return Promise.resolve()
    }
    
    this.url = url || this.url
    this.roomId = roomId
    
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = `${this.url}?room=${roomId}&user=${this.userId}`
        this.ws = new WebSocket(wsUrl)
        
        // Connection timeout
        this.connectionTimeout = setTimeout(() => {
          if (!this.isConnected) {
            this.ws?.close()
            reject(new Error('Connection timeout'))
          }
        }, this.config.connectionTimeoutMs)
        
        this.ws.onopen = () => {
          clearTimeout(this.connectionTimeout)
          this.isConnected = true
          this.isReconnecting = false
          this.reconnectAttempt = 0
          
          this.startPing()
          this.emit(SIGNALING_EVENTS.CONNECTED, { roomId })
          
          // Send join message
          this.send(MESSAGE_TYPE.JOIN, { roomId, userId: this.userId })
          
          resolve()
        }
        
        this.ws.onclose = (event) => {
          this.isConnected = false
          this.stopPing()
          
          if (!event.wasClean && !this.isReconnecting) {
            this.emit(SIGNALING_EVENTS.DISCONNECTED, { code: event.code })
            this.attemptReconnect()
          }
        }
        
        this.ws.onerror = (error) => {
          console.error('[signaling] WebSocket error:', error)
          this.emit(SIGNALING_EVENTS.ERROR, { 
            code: ERROR_CODE.NETWORK_ERROR,
            message: 'WebSocket connection error',
          })
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
   * Disconnect from signaling server
   */
  disconnect() {
    this.stopPing()
    this.stopReconnect()
    
    if (this.ws) {
      this.send(MESSAGE_TYPE.LEAVE, { roomId: this.roomId })
      this.ws.close(1000, 'Client disconnect')
      this.ws = null
    }
    
    this.isConnected = false
    this.callState = CALL_STATE.IDLE
    this.pendingIceCandidates = []
  }

  /**
   * Send message to signaling server
   */
  send(type, payload = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[signaling] cannot send, not connected')
      return false
    }
    
    const message = {
      type,
      payload,
      timestamp: Date.now(),
      userId: this.userId,
    }
    
    try {
      this.ws.send(JSON.stringify(message))
      return true
    } catch (error) {
      console.error('[signaling] send error:', error)
      return false
    }
  }

  /**
   * Handle incoming message
   */
  handleMessage(data) {
    try {
      const message = JSON.parse(data)
      const { type, payload, userId } = message
      
      // Ignore own messages
      if (userId === this.userId) return
      
      switch (type) {
        case MESSAGE_TYPE.OFFER:
          this.emit(SIGNALING_EVENTS.OFFER, payload)
          break
          
        case MESSAGE_TYPE.ANSWER:
          this.emit(SIGNALING_EVENTS.ANSWER, payload)
          break
          
        case MESSAGE_TYPE.ICE:
          this.emit(SIGNALING_EVENTS.ICE_CANDIDATE, payload)
          break
          
        case MESSAGE_TYPE.JOIN:
          this.emit(SIGNALING_EVENTS.PEER_JOINED, payload)
          break
          
        case MESSAGE_TYPE.LEAVE:
          this.emit(SIGNALING_EVENTS.PEER_LEFT, payload)
          break
          
        case MESSAGE_TYPE.PONG:
          // Ping/pong for keepalive
          break
          
        default:
          console.warn('[signaling] unknown message type:', type)
      }
    } catch (error) {
      console.error('[signaling] message parse error:', error)
    }
  }

  /**
   * Send WebRTC offer
   */
  sendOffer(offer, targetUserId) {
    return this.send(MESSAGE_TYPE.OFFER, {
      sdp: offer.sdp,
      type: offer.type,
      targetUserId,
      roomId: this.roomId,
    })
  }

  /**
   * Send WebRTC answer
   */
  sendAnswer(answer, targetUserId) {
    return this.send(MESSAGE_TYPE.ANSWER, {
      sdp: answer.sdp,
      type: answer.type,
      targetUserId,
      roomId: this.roomId,
    })
  }

  /**
   * Send ICE candidate
   */
  sendIceCandidate(candidate, targetUserId) {
    return this.send(MESSAGE_TYPE.ICE, {
      candidate: candidate.candidate,
      sdpMid: candidate.sdpMid,
      sdpMLineIndex: candidate.sdpMLineIndex,
      targetUserId,
      roomId: this.roomId,
    })
  }

  /**
   * Register event handler
   */
  on(event, handler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, [])
    }
    this.handlers.get(event).push(handler)
    
    return () => this.off(event, handler)
  }

  /**
   * Remove event handler
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
   * Emit event
   */
  emit(event, data) {
    const handlers = this.handlers.get(event) || []
    for (const handler of handlers) {
      try {
        handler(data)
      } catch (error) {
        console.error('[signaling] handler error:', error)
      }
    }
  }

  /**
   * Start ping interval
   */
  startPing() {
    this.stopPing()
    this.pingTimer = setInterval(() => {
      this.send(MESSAGE_TYPE.PING, {})
    }, this.config.pingIntervalMs)
  }

  /**
   * Stop ping interval
   */
  stopPing() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }
  }

  /**
   * Attempt reconnection
   */
  attemptReconnect() {
    if (this.reconnectAttempt >= this.config.reconnectAttempts) {
      this.emit(SIGNALING_EVENTS.ERROR, {
        code: ERROR_CODE.NETWORK_ERROR,
        message: 'Max reconnect attempts reached',
      })
      return
    }
    
    this.isReconnecting = true
    this.reconnectAttempt++
    
    const delay = this.config.reconnectDelayMs * 
      Math.pow(this.config.reconnectBackoffMultiplier, this.reconnectAttempt - 1)
    
    this.emit(SIGNALING_EVENTS.RECONNECTING, {
      attempt: this.reconnectAttempt,
      maxAttempts: this.config.reconnectAttempts,
    })
    
    this.reconnectTimer = setTimeout(() => {
      this.connect(this.url, this.roomId).catch(() => {
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
    this.isReconnecting = false
  }

  /**
   * Set call state
   */
  setCallState(state) {
    this.callState = state
  }

  /**
   * Get current state
   */
  getState() {
    return {
      isConnected: this.isConnected,
      isReconnecting: this.isReconnecting,
      callState: this.callState,
      roomId: this.roomId,
      reconnectAttempt: this.reconnectAttempt,
    }
  }

  /**
   * Destroy client
   */
  destroy() {
    this.disconnect()
    this.handlers.clear()
    clearTimeout(this.connectionTimeout)
  }
}

/**
 * Create signaling client
 */
export function createSignalingClient(options = {}) {
  return new SignalingClient(options)
}

export default {
  SignalingClient,
  createSignalingClient,
}
