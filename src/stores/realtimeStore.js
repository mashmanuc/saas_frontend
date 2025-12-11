import { defineStore } from 'pinia'
import { realtimeService } from '../services/realtime'
import { useAuthStore } from '../modules/auth/store/authStore'

export const useRealtimeStore = defineStore('realtime', {
  state: () => ({
    status: 'disconnected',
    initialized: false,
    lastError: null,
    lastHeartbeat: null,
    offline: false,
    subscriptions: new Map(),
  }),

  actions: {
    init(options = {}) {
      if (this.initialized) return
      this.initialized = true

      realtimeService.init({
        tokenProvider: async () => {
          const auth = useAuthStore()
          if (!auth.access) {
            await auth.refreshAccess?.().catch(() => {})
          }
          return auth.access
        },
        ...options,
      })

      realtimeService.on('status', (status) => {
        if (status === 'offline') {
          this.offline = true
        } else {
          this.offline = false
          this.status = status
        }
      })

      realtimeService.on('error', (error) => {
        this.lastError = error
      })

      realtimeService.on('message', (payload) => {
        if (payload?.type === 'pong') {
          this.lastHeartbeat = Date.now()
        }
      })

      this.connect()
    },

    connect() {
      realtimeService.connect()
    },

    disconnect() {
      realtimeService.disconnect()
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
