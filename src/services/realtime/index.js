const isSupportedChannel = (channel) => {
  if (!channel) return false
  const channelStr = String(channel)
  // Support both colon-based (notifications:12) and underscore-based (notifications_user_12) formats
  const [root] = channelStr.split(':')
  if (SUPPORTED_CHANNELS.has(root)) return true
  // Support underscore-based format like notifications_user_12
  const underscoreRoot = channelStr.split('_')[0]
  return SUPPORTED_CHANNELS.has(underscoreRoot)
}

const SUPPORTED_CHANNELS = new Set(['chat', 'board', 'presence', 'notifications', 'tutor', 'student', 'match', 'availability', 'room', 'inquiries', 'calendar'])
const DEFAULT_HEARTBEAT_MS = 25_000
const HEARTBEAT_TIMEOUT_MS = 60_000  // Increased from 30s for stable connections
const MAX_BACKOFF_MS = 30_000        // Increased: 15s → 30s to reduce load on struggling server
const INITIAL_BACKOFF_MS = 1_000
const MAX_RECONNECT_ATTEMPTS = 10    // Stop reconnecting after 10 failures to prevent server overload

const READY_STATES = {
  CONNECTING: 'connecting',
  OPEN: 'open',
  CLOSING: 'closing',
  CLOSED: 'closed',
}

function createEmitter() {
  const listeners = new Map()

  return {
    on(event, handler) {
      const set = listeners.get(event) || new Set()
      set.add(handler)
      listeners.set(event, set)
      return () => this.off(event, handler)
    },
    off(event, handler) {
      const set = listeners.get(event)
      if (!set) return
      set.delete(handler)
      if (!set.size) {
        listeners.delete(event)
      }
    },
    emit(event, payload) {
      const set = listeners.get(event)
      if (!set) return
      set.forEach((handler) => {
        try {
          handler(payload)
        } catch (error) {
          console.error('[realtime][listener]', event, error)
        }
      })
    },
  }
}

class RealtimeService {
  constructor() {
    this.socket = null
    this.status = READY_STATES.CLOSED
    this.channelSubscriptions = new Map()
    this.pendingMessages = []
    this.emitter = createEmitter()
    this.backoff = INITIAL_BACKOFF_MS
    this.shouldReconnect = false
    this.wsUnavailable = false
    this.heartbeatTimer = null
    this.heartbeatTimeoutTimer = null
    this.lastPongTime = null
    this.reconnectTimer = null
    this.reconnectAttempts = 0          // Track reconnect attempts for circuit breaker
    this.tokenRefreshCallback = null
    this.lastToken = null
    this._lastConnectAttempt = 0
    this._openedAt = 0

    this.handleOnlineEvent = () => this.handleNetworkChange(true)
    this.handleOfflineEvent = () => this.handleNetworkChange(false)
    this.options = {
      url: null,
      tokenProvider: null,
      heartbeatInterval: DEFAULT_HEARTBEAT_MS,
      logger: console,
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnlineEvent)
      window.addEventListener('offline', this.handleOfflineEvent)
    }
  }

  destroy() {
    this.disconnect()
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnlineEvent)
      window.removeEventListener('offline', this.handleOfflineEvent)
    }
  }

  /**
   * Register callback for token refresh events from auth store
   * @param {Function} callback - Called when token is refreshed
   */
  onTokenRefresh(callback) {
    this.tokenRefreshCallback = callback
  }

  /**
   * Called by auth store when token is refreshed
   * Reconnects with new token if currently connected or was closed due to auth_required
   */
  handleTokenRefresh() {
    // БАГ №5 FIX: після auth_required стан = CLOSED і shouldReconnect = false
    // Тому перевіряємо CLOSED окремо — WS треба перепідключити після успішного рефрешу
    if (this.status === READY_STATES.OPEN || this.status === READY_STATES.CONNECTING) {
      this.options.logger?.info?.('[realtime] Token refreshed, reconnecting...')
      this.disconnect()
      this.connect()
    } else if (this.status === READY_STATES.CLOSED) {
      // Був закритий через auth_required — тепер маємо новий токен, підключаємось знову
      this.options.logger?.info?.('[realtime] Token refreshed after auth_required, reconnecting from CLOSED...')
      this.shouldReconnect = true
      this.reconnectAttempts = 0          // Fresh start with new token
      this.backoff = INITIAL_BACKOFF_MS
      this.connect()
    }
  }

  init(options = {}) {
    this.options = {
      ...this.options,
      ...options,
    }
    // Use VITE_WS_URL from environment, fallback to window.location or localhost
    if (!this.options.url) {
      const envUrl = typeof import.meta !== 'undefined' && import.meta.env?.VITE_WS_URL
      if (envUrl) {
        this.options.url = envUrl
      } else {
        const protocol = window?.location?.protocol === 'https:' ? 'wss' : 'ws'
        const host = window?.location?.host || 'localhost'
        this.options.url = `${protocol}://${host}/ws`
      }
    }
  }

  getState() {
    return this.status
  }

  on(event, handler) {
    return this.emitter.on(event, handler)
  }

  off(event, handler) {
    this.emitter.off(event, handler)
  }

  async connect() {
    if (this.socket && (this.status === READY_STATES.OPEN || this.status === READY_STATES.CONNECTING)) {
      return
    }
    // Burst guard: prevent rapid-fire connect() during page load / component mount storm.
    // If last connect attempt was < 1s ago, defer to existing scheduleReconnect backoff.
    const now = Date.now()
    if (this._lastConnectAttempt && (now - this._lastConnectAttempt) < 1000) {
      if (!this.reconnectTimer) {
        this.scheduleReconnect()
      }
      return
    }
    this._lastConnectAttempt = now

    this.shouldReconnect = true
    this.status = READY_STATES.CONNECTING
    this.emitter.emit('status', this.status)

    try {
      const token = (await this.options.tokenProvider?.()) || null
      if (!token) {
        this.options.logger?.warn?.('[realtime] No auth token available, deferring connect')
        this.status = READY_STATES.CLOSED
        this.emitter.emit('status', this.status)
        // Do NOT scheduleReconnect here — without a token, retrying is pointless
        // and creates an infinite loop. realtimeStore.bindAuthWatcher() will call
        // connect() when auth.access becomes available.
        this.shouldReconnect = false
        return
      }
      const url = new URL(this.options.url)
      url.searchParams.set('token', token)

      this.socket = new WebSocket(url.toString())
      this.socket.addEventListener('open', () => this.handleOpen())
      this.socket.addEventListener('message', (event) => this.handleMessage(event))
      this.socket.addEventListener('error', (event) => this.handleError(event))
      this.socket.addEventListener('close', (event) => this.handleClose(event))
    } catch (error) {
      this.emitter.emit('error', error)
      this.scheduleReconnect()
    }
  }

  disconnect() {
    this.shouldReconnect = false
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.clearHeartbeat()
    if (this.socket) {
      this.socket.close()
      this.socket = null
    }
  }

  subscribe(channel, handler) {
    if (!isSupportedChannel(channel)) {
      throw new Error(`[realtime] Unsupported channel ${channel}`)
    }
    const subscribers = this.channelSubscriptions.get(channel) || new Set()
    subscribers.add(handler)
    this.channelSubscriptions.set(channel, subscribers)
    this.send({
      type: 'subscribe',
      channel,
    })
    return () => this.unsubscribe(channel, handler)
  }

  unsubscribe(channel, handler) {
    const subscribers = this.channelSubscriptions.get(channel)
    if (!subscribers) return
    subscribers.delete(handler)
    if (!subscribers.size) {
      this.channelSubscriptions.delete(channel)
      this.send({
        type: 'unsubscribe',
        channel,
      })
    }
  }

  publish(channel, payload) {
    if (!isSupportedChannel(channel)) {
      throw new Error(`[realtime] Unsupported channel ${channel}`)
    }
    this.send({
      channel,
      ...payload,
    })
  }

  handleOpen() {
    this.status = READY_STATES.OPEN
    this.emitter.emit('status', this.status)
    this.options.logger?.info?.('[realtime] connected')
    this.flushPending()
    this.resubscribeAll()
    this.startHeartbeat()
    // Only reset backoff if previous connection was stable (>5s).
    // Prevents burst loop: open → 1006 close → backoff reset → immediate reconnect → repeat.
    const prevOpened = this._openedAt || 0
    this._openedAt = Date.now()
    if (!prevOpened || (this._openedAt - prevOpened) > 5000) {
      this.backoff = INITIAL_BACKOFF_MS
      this.reconnectAttempts = 0   // Reset on stable connection
    }
  }

  handleMessage(event) {
    try {
      const data = JSON.parse(event.data)
      if (data?.type === 'pong') {
        this.lastPongTime = Date.now()
        this.resetHeartbeatTimeout()
        this.emitter.emit('heartbeat', this.lastPongTime)
        return
      }
      // Backend надсилає auth_required коли JWT токен протух під час revalidation.
      // Емітуємо auth_required — websocket.ts перехопить і зробить refresh + reconnect.
      if (data?.type === 'auth_required') {
        this.options.logger?.warn?.('[realtime] Backend sent auth_required, emitting event...')
        this.shouldReconnect = false // зупиняємо авторекконект — reconnect зробить handleTokenRefresh
        this.emitter.emit('auth_required', { reason: data?.reason || 'token_expired' })
        return
      }
      // Gateway protocol acks (subscribe/unsubscribe confirmations) must NOT
      // be forwarded to channel handlers — they are not domain events.
      const msgType = data?.type || ''
      if (
        msgType === 'subscription.confirmed' ||
        msgType === 'subscription.released' ||
        msgType === 'connection.established' ||
        msgType === 'connection.timeout'
      ) {
        this.emitter.emit('protocol', data)
        return
      }

      if (data?.channel && this.channelSubscriptions.has(data.channel)) {
        this.channelSubscriptions.get(data.channel).forEach((handler) => {
          try {
            handler(data.payload || data)
          } catch (error) {
            console.error('[realtime][channel-handler]', data.channel, error)
          }
        })
      } else {
        this.emitter.emit('message', data)
      }
    } catch (error) {
      this.emitter.emit('error', error)
    }
  }

  handleError(event) {
    this.emitter.emit('error', event)
  }

  handleClose(event) {
    this.socket = null
    this.status = READY_STATES.CLOSED
    this.emitter.emit('status', this.status)
    this.clearHeartbeat()

    if (event?.code === 1006) {
      this.options.logger?.warn?.('[realtime] abnormal closure (1006), scheduling reconnect with backoff')
      if (this.shouldReconnect) {
        this.scheduleReconnect()
      }
      return
    }

    // Handle 401 Unauthorized - emit auth_required event
    if (event?.code === 4001 || event?.code === 4003 || event?.reason?.includes('401')) {
      this.options.logger?.warn?.('[realtime] Auth required, emitting auth_required')
      this.emitter.emit('auth_required', { code: event?.code, reason: event?.reason })
      this.shouldReconnect = false
      return
    }

    if (this.shouldReconnect) {
      this.scheduleReconnect()
    }
    this.options.logger?.warn?.('[realtime] disconnected', event?.code, event?.reason)
  }

  handleNetworkChange(isOnline) {
    if (isOnline) {
      this.wsUnavailable = false
      this.shouldReconnect = true
      this.backoff = INITIAL_BACKOFF_MS
      this.reconnectAttempts = 0          // Fresh start on network recovery
      this.connect()
    } else {
      this.emitter.emit('status', 'offline')
      this.disconnect()
    }
  }

  send(message) {
    const payload = typeof message === 'string' ? message : JSON.stringify(message)
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.pendingMessages.push(payload)
      if (!this.socket && this.shouldReconnect) {
        this.connect()
      }
      return
    }
    this.socket.send(payload)
  }

  flushPending() {
    while (this.pendingMessages.length && this.socket?.readyState === WebSocket.OPEN) {
      const payload = this.pendingMessages.shift()
      this.socket.send(payload)
    }
  }

  resubscribeAll() {
    this.channelSubscriptions.forEach((subscribers, channel) => {
      if (subscribers.size) {
        this.send({
          type: 'subscribe',
          channel,
        })
      }
    })
  }

  startHeartbeat() {
    this.clearHeartbeat()
    if (!this.options.heartbeatInterval) return
    
    this.lastPongTime = Date.now()
    
    this.heartbeatTimer = setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        // Phase RS WS-fix forensic: log ping send timestamp.
        // Pairs з backend `PING RECEIVED user=...` log → 3 cases:
        //   FE log + no BE log = transport/proxy drop
        //   no FE log = setInterval throttled (background tab) or heartbeat не стартував
        //   FE log + BE log + 4008 = backend ping_timeout логіка bug
        console.log('[WS] ping send', Date.now())
        this.socket.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }))
        this.startHeartbeatTimeout()
      }
    }, this.options.heartbeatInterval)
  }

  startHeartbeatTimeout() {
    this.clearHeartbeatTimeout()
    this.heartbeatTimeoutTimer = setTimeout(() => {
      const timeSinceLastPong = Date.now() - (this.lastPongTime || 0)
      if (timeSinceLastPong > HEARTBEAT_TIMEOUT_MS) {
        this.options.logger?.warn?.('[realtime] Heartbeat timeout, reconnecting...')
        this.socket?.close()
        this.scheduleReconnect()
      }
    }, HEARTBEAT_TIMEOUT_MS)
  }

  resetHeartbeatTimeout() {
    this.clearHeartbeatTimeout()
  }

  clearHeartbeatTimeout() {
    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer)
      this.heartbeatTimeoutTimer = null
    }
  }

  clearHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
    this.clearHeartbeatTimeout()
  }

  scheduleReconnect() {
    if (!this.shouldReconnect) return

    // Circuit breaker: stop after MAX_RECONNECT_ATTEMPTS to prevent server overload
    this.reconnectAttempts++
    if (this.reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
      this.options.logger?.warn?.(
        `[realtime] Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached, giving up. ` +
        'Will retry on network change or token refresh.',
      )
      this.shouldReconnect = false
      this.emitter.emit('status', 'unavailable')
      return
    }

    const delay = Math.min(this.backoff, MAX_BACKOFF_MS)
    this.options.logger?.info?.(`[realtime] Reconnect attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms`)
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (!this.shouldReconnect) return
      this.backoff = Math.min(this.backoff * 2, MAX_BACKOFF_MS)
      this.connect()
    }, delay)
  }
}

export const realtimeService = new RealtimeService()
