const isSupportedChannel = (channel) => {
  if (!channel) return false
  const [root] = String(channel).split(':')
  return SUPPORTED_CHANNELS.has(root)
}

const SUPPORTED_CHANNELS = new Set(['chat', 'board', 'presence', 'notifications'])
const DEFAULT_HEARTBEAT_MS = 25_000
const MAX_BACKOFF_MS = 15_000
const INITIAL_BACKOFF_MS = 1_000

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
    this.heartbeatTimer = null
    this.reconnectTimer = null
    this.tokenRefreshCallback = null
    this.lastToken = null

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
   * Reconnects with new token if currently connected
   */
  handleTokenRefresh() {
    if (this.status === READY_STATES.OPEN || this.status === READY_STATES.CONNECTING) {
      this.options.logger?.info?.('[realtime] Token refreshed, reconnecting...')
      this.disconnect()
      this.connect()
    }
  }

  init(options = {}) {
    this.options = {
      ...this.options,
      ...options,
    }
    if (!this.options.url) {
      const protocol = window?.location?.protocol === 'https:' ? 'wss' : 'ws'
      const host = window?.location?.host || 'localhost'
      this.options.url = `${protocol}://${host}/ws`
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
    this.shouldReconnect = true
    this.status = READY_STATES.CONNECTING
    this.emitter.emit('status', this.status)

    try {
      const token = (await this.options.tokenProvider?.()) || null
      const url = new URL(this.options.url)
      if (token) {
        url.searchParams.set('token', token)
      }

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
    this.backoff = INITIAL_BACKOFF_MS
  }

  handleMessage(event) {
    try {
      const data = JSON.parse(event.data)
      if (data?.type === 'pong') {
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
    this.status = READY_STATES.CLOSED
    this.emitter.emit('status', this.status)
    this.clearHeartbeat()

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
      if (!this.socket) {
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
    this.heartbeatTimer = setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }))
      }
    }, this.options.heartbeatInterval)
  }

  clearHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  scheduleReconnect() {
    if (!this.shouldReconnect) return
    const delay = Math.min(this.backoff, MAX_BACKOFF_MS)
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
