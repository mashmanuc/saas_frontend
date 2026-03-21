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

function getEnvWsUrl() {
  try {
    return import.meta.env?.VITE_WS_URL || null
  } catch {
    return null
  }
}

function normalizeWsUrl(wsHost) {
  if (!wsHost) {
    // Use VITE_WS_URL if available, otherwise fall back to origin
    const envUrl = getEnvWsUrl()
    if (envUrl) {
      // If env URL already starts with ws(s)://, use as-is
      if (envUrl.startsWith('ws://') || envUrl.startsWith('wss://')) {
        return envUrl
      }
      // If it's a path like /ws/gateway/, resolve against origin
      if (envUrl.startsWith('/')) {
        return buildWsUrlFromOrigin(envUrl)
      }
      // Otherwise treat as hostname
      return `wss://${envUrl.replace(/\/$/, '')}/ws/gateway/`
    }
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
    heartbeatUnsubscribe: null,
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
          // Wait for auth bootstrap (page reload: '__cookie__' → refreshAccess → real JWT).
          // _bootstrapPromise is set during bootstrap and nulled after — check both.
          if (auth._bootstrapPromise) {
            try { await auth._bootstrapPromise } catch { /* ignore */ }
          }
          // If refresh is in-flight (e.g. after auth_required), wait for it too
          if (auth.refreshPromise) {
            try { await auth.refreshPromise } catch { /* ignore */ }
          }
          // If bootstrap finished but access is still placeholder,
          // attempt one refresh to get a real JWT for WS.
          if (auth.access === '__cookie__') {
            try {
              await auth.refreshAccess()
            } catch { /* ignore — will return null below */ }
          }
          // Never send placeholder as token — backend can't decode it → 1006
          if (!auth.access || auth.access === '__cookie__') return null
          // Phase 2: Decrypt ciphertext → plaintext JWT for WS auth
          return await auth.getDecryptedAccess()
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

      // Track heartbeat events (pong responses)
      if (this.heartbeatUnsubscribe) {
        this.heartbeatUnsubscribe()
        this.heartbeatUnsubscribe = null
      }
      this.heartbeatUnsubscribe = realtimeService.on('heartbeat', (timestamp) => {
        this.lastHeartbeat = timestamp
      })

      this.bindAuthWatcher(auth)
    },

    bindAuthWatcher(auth) {
      if (this.authUnsubscribe) return

      // Guard: track last access to debounce rapid changes.
      // Track actual value (not just boolean) to detect '__cookie__' → real JWT transitions.
      let lastAccess = auth.access
      let connectDebounceTimer = null

      this.authUnsubscribe = auth.$subscribe(
        (_mutation, state) => {
          const currentAccess = state.access
          const hasRealToken = Boolean(currentAccess && currentAccess !== '__cookie__')
          const hadRealToken = Boolean(lastAccess && lastAccess !== '__cookie__')
          
          // Debounce rapid auth changes
          if (connectDebounceTimer) {
            clearTimeout(connectDebounceTimer)
          }
          
          connectDebounceTimer = setTimeout(() => {
            if (hasRealToken && !hadRealToken) {
              // Got a real JWT (login, or __cookie__ → real token after refresh)
              this.connect()
            } else if (!currentAccess && lastAccess) {
              // Logged out (access became null)
              this.disconnect()
            }
            lastAccess = currentAccess
          }, 100)
        },
        { detached: true }
      )

      // Only auto-connect if we have a real token (not placeholder)
      if (auth.access && auth.access !== '__cookie__') {
        this.connect()
      }
    },

    async refreshHealth() {
      // Не викликати health check без access token
      const auth = useAuthStore()
      if (!auth.access) {
        // Silent skip
        return
      }

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
      const auth = useAuthStore()
      if (!auth.access) {
        return
      }
      
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
      if (this.failoverUnsubscribe) {
        this.failoverUnsubscribe()
        this.failoverUnsubscribe = null
      }
      if (this.heartbeatUnsubscribe) {
        this.heartbeatUnsubscribe()
        this.heartbeatUnsubscribe = null
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
