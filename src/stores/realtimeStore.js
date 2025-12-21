import { defineStore } from 'pinia'
import { realtimeService } from '../services/realtime'
import { useAuthStore } from '../modules/auth/store/authStore'
import api from '../utils/apiClient'

function buildWsUrlFromOrigin(path) {
  const origin = globalThis?.location?.origin || ''
  const wsOrigin = origin.startsWith('https:')
    ? origin.replace(/^https:/, 'wss:')
    : origin.replace(/^http:/, 'ws:')
  return `${wsOrigin}${path}`
}

function normalizeWsUrl(wsHost) {
  if (!wsHost) {
    return buildWsUrlFromOrigin('/ws/gateway/')
  }

  const value = String(wsHost)

  if (value.startsWith('ws://') || value.startsWith('wss://')) {
    return value
  }

  if (value.startsWith('/')) {
    return buildWsUrlFromOrigin(value)
  }

  // Assume hostname
  return `wss://${value.replace(/\/$/, '')}/ws/gateway/`
}

export const useRealtimeStore = defineStore('realtime', {
  state: () => ({
    status: 'disconnected',
    initialized: false,
    lastError: null,
    lastHeartbeat: null,
    offline: false,
    wsUrl: null,
    healthPromise: null,
    subscriptions: new Map(),
    authUnsubscribe: null,
    statusUnsubscribe: null,
    errorUnsubscribe: null,
    messageUnsubscribe: null,
    failoverUnsubscribe: null,
  }),

  actions: {
    init(options = {}) {
      if (this.initialized) return
      this.initialized = true

      const auth = useAuthStore()

      this.healthPromise = this.refreshHealth().catch(() => {})

      realtimeService.init({
        url: this.wsUrl || normalizeWsUrl(null),
        tokenProvider: async () => {
          return auth.access
        },
        ...options,
      })

      if (this.statusUnsubscribe) {
        this.statusUnsubscribe()
        this.statusUnsubscribe = null
      }
      this.statusUnsubscribe = realtimeService.on('status', (status) => {
        if (status === 'offline') {
          this.offline = true
        } else {
          this.offline = false
          this.status = status
        }
      })

      if (this.errorUnsubscribe) {
        this.errorUnsubscribe()
        this.errorUnsubscribe = null
      }
      this.errorUnsubscribe = realtimeService.on('error', (error) => {
        this.lastError = error
      })

      if (this.messageUnsubscribe) {
        this.messageUnsubscribe()
        this.messageUnsubscribe = null
      }
      this.messageUnsubscribe = realtimeService.on('message', (payload) => {
        if (payload?.type === 'pong') {
          this.lastHeartbeat = Date.now()
        }
      })

      // Track failover events
      this.failoverUnsubscribe = realtimeService.on('failover', (data) => {
        import('../utils/telemetryAgent').then(({ trackEvent }) => {
          trackEvent('ws.failover', {
            host_from: data.from,
            host_to: data.to,
            latency: data.latency,
            reason: data.reason,
          })
        })
      })

      this.bindAuthWatcher(auth)
    },

    bindAuthWatcher(auth) {
      if (this.authUnsubscribe) return

      this.authUnsubscribe = auth.$subscribe(
        (_mutation, state) => {
          if (state.access) {
            this.connect()
          } else {
            this.disconnect()
          }
        },
        { detached: true }
      )

      if (auth.access) {
        this.connect()
      }
    },

    async refreshHealth() {
      try {
        const res = await api.get('/v1/realtime/health')
        const wsHost = res?.ws_host
        this.wsUrl = normalizeWsUrl(wsHost)
        // Update service config for the next connect attempt
        realtimeService.init({ url: this.wsUrl })
      } catch (_err) {
        // keep default url
        this.wsUrl = this.wsUrl || normalizeWsUrl(null)
      }
    },

    async connect() {
      if (!useAuthStore().access) return
      if (this.healthPromise) {
        try {
          await this.healthPromise
        } catch {
          // ignore
        }
      }
      realtimeService.connect()
    },

    disconnect() {
      realtimeService.disconnect()
    },

    dispose() {
      this.disconnect()

      if (this.authUnsubscribe) {
        this.authUnsubscribe()
        this.authUnsubscribe = null
      }

      if (this.statusUnsubscribe) {
        this.statusUnsubscribe()
        this.statusUnsubscribe = null
      }
      if (this.errorUnsubscribe) {
        this.errorUnsubscribe()
        this.errorUnsubscribe = null
      }
      if (this.messageUnsubscribe) {
        this.messageUnsubscribe()
        this.messageUnsubscribe = null
      }

      this.subscriptions = new Map()
      this.status = 'disconnected'
      this.offline = false
      this.lastError = null
      this.lastHeartbeat = null
      this.initialized = false
    },

    subscribe(channel, handler) {
      const unsubscribe = realtimeService.subscribe(channel, handler)
      const handlers = this.subscriptions.get(channel) || new Set()
      handlers.add(unsubscribe)
      this.subscriptions.set(channel, handlers)
      return () => {
        unsubscribe()
        handlers.delete(unsubscribe)
        if (!handlers.size) {
          this.subscriptions.delete(channel)
        }
      }
    },

    publish(channel, payload) {
      realtimeService.publish(channel, payload)
    },
  },
})
