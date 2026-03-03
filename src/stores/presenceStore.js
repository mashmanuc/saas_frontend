import { defineStore } from 'pinia'
import { presenceApi } from '../api/presence'
import { realtimeService } from '../services/realtime'
import { presenceBroadcast } from '../services/presenceBroadcast'
import { notifyError } from '../utils/notify'
import { useAuthStore } from '../modules/auth/store/authStore'

const TTL_SECONDS = 90
const TTL_MS = TTL_SECONDS * 1000
const REFRESH_INTERVAL = 90_000
const FETCH_DEBOUNCE_MS = 500

export const usePresenceStore = defineStore('presence', {
  state: () => ({
    statuses: {},
    lastUpdated: null,
    timer: null,
    initialized: false,
    trackedIds: [],
    subscription: null,
    isLeaderTab: false,
  }),

  getters: {
    isOnline: (state) => (userId) => {
      const entry = state.statuses[String(userId)]
      if (!entry) return false
      return entry.online
    },
    list(state) {
      return Object.entries(state.statuses).map(([id, data]) => ({
        id,
        ...data,
      }))
    },
  },

  actions: {
    init() {
      const authStore = useAuthStore()
      if (this.initialized || !authStore?.access) return
      this.initialized = true
      this.subscribeRealtime()
      this._initBroadcast()
    },

    async fetch(ids = []) {
      const authStore = useAuthStore()
      if (!ids.length || !authStore?.access) return
      try {
        const response = await presenceApi.getStatuses(ids)
        const results = response?.results ?? (Array.isArray(response) ? response : [])
        const statusMap = {}
        results.forEach((entry) => {
          this.setStatus(entry.user_id, entry.online)
          statusMap[String(entry.user_id)] = entry.online
        })
        this.lastUpdated = new Date().toISOString()
        // Broadcast fetched statuses to other tabs
        if (Object.keys(statusMap).length) {
          presenceBroadcast.broadcastStatuses(statusMap)
        }
      } catch (error) {
        if (error?.response?.status === 401) {
          this.dispose()
          return
        }
        notifyError(error?.response?.data?.detail || 'Не вдалося оновити статус онлайн')
      }
    },

    track(ids = []) {
      const authStore = useAuthStore()
      if (!authStore?.access) return
      const normalized = ids.map((id) => String(id)).filter(Boolean)
      if (!normalized.length) return
      const current = new Set(this.trackedIds)
      let changed = false
      normalized.forEach((id) => {
        if (!current.has(id)) {
          current.add(id)
          changed = true
        }
      })
      if (changed) {
        this.trackedIds = Array.from(current)
        const newIds = normalized.filter((id) => !this.statuses[id])
        if (newIds.length) {
          this.fetch(newIds)
        }
      }
    },

    setStatus(userId, online) {
      if (!userId) return
      const key = String(userId)
      const current = this.statuses[key]
      if (current && current.online === online) {
        current.timestamp = new Date().toISOString()
        return
      }
      this.statuses[key] = {
        online,
        timestamp: new Date().toISOString(),
      }
    },

    subscribeRealtime() {
      const authStore = useAuthStore()
      if (!authStore?.access) return
      if (this.subscription) {
        this.subscription()
        this.subscription = null
      }
      if (this.timer) {
        clearInterval(this.timer)
        this.timer = null
      }
      this.subscription = realtimeService.subscribe('presence', (payload) => {
        if (payload?.type === 'user.online') {
          this.setStatus(payload.user_id, true)
        }
        if (payload?.type === 'user.offline') {
          this.setStatus(payload.user_id, false)
        }
      })

      this.timer = setInterval(() => {
        this.prune()
        const wsState = realtimeService.getState()
        if (wsState === 'open' || wsState === 'connecting') return
        // Only leader tab does HTTP fallback polling
        if (!this.isLeaderTab && presenceBroadcast.isSupported()) return
        if (this.trackedIds.length) {
          this._debouncedFetch()
        }
      }, REFRESH_INTERVAL)
    },

    _debouncedFetch() {
      if (this._fetchTimer) return
      this._fetchTimer = setTimeout(() => {
        this._fetchTimer = null
        if (this.trackedIds.length) {
          this.fetch(this.trackedIds)
        }
      }, FETCH_DEBOUNCE_MS)
    },

    prune() {
      const cutoff = Date.now() - TTL_MS
      const keys = Object.keys(this.statuses)
      for (const key of keys) {
        const entry = this.statuses[key]
        if (entry && new Date(entry.timestamp).getTime() < cutoff) {
          delete this.statuses[key]
        }
      }
    },

    _initBroadcast() {
      if (!presenceBroadcast.isSupported()) {
        this.isLeaderTab = true
        return
      }
      presenceBroadcast.init({
        onStatusUpdate: (statusMap) => {
          // Receive statuses from leader tab
          Object.entries(statusMap).forEach(([userId, online]) => {
            this.setStatus(userId, online)
          })
        },
        onLeaderChange: (amLeader) => {
          this.isLeaderTab = amLeader
        },
      })
      this.isLeaderTab = presenceBroadcast.isLeader()
    },

    dispose() {
      this.statuses = {}
      this.lastUpdated = null
      this.trackedIds = []
      this.initialized = false
      this.isLeaderTab = false
      if (this.timer) {
        clearInterval(this.timer)
        this.timer = null
      }
      if (this._fetchTimer) {
        clearTimeout(this._fetchTimer)
        this._fetchTimer = null
      }
      if (this.subscription) {
        this.subscription()
        this.subscription = null
      }
      presenceBroadcast.dispose()
    },
  },
})
