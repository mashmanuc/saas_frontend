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
    authUnsubscribe: null,
  }),

  actions: {
    init(options = {}) {
      if (this.initialized) return
      this.initialized = true

      const auth = useAuthStore()

      realtimeService.init({
        tokenProvider: async () => {
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

    connect() {
      if (!useAuthStore().access) return
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
