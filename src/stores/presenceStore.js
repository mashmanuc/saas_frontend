import { defineStore } from 'pinia'
import dayjs from 'dayjs'
import { presenceApi } from '../api/presence'
import { realtimeService } from '../services/realtime'
import { notifyError } from '../utils/notify'

const TTL_SECONDS = 90
const REFRESH_INTERVAL = 30_000

export const usePresenceStore = defineStore('presence', {
  state: () => ({
    statuses: {},
    lastUpdated: null,
    timer: null,
    initialized: false,
    trackedIds: [],
  }),

  getters: {
    isOnline: (state) => (userId) => {
      const entry = state.statuses[userId]
      if (!entry) return false
      return dayjs(entry.timestamp).isAfter(dayjs().subtract(TTL_SECONDS, 'second'))
    },
    list(state) {
      return Object.entries(state.statuses).map(([id, data]) => ({
        id,
        ...data,
        online: dayjs(data.timestamp).isAfter(dayjs().subtract(TTL_SECONDS, 'second')),
      }))
    },
  },

  actions: {
    init() {
      if (this.initialized) return
      this.initialized = true
      this.subscribeRealtime()
    },

    async fetch(ids = []) {
      if (!ids.length) return
      try {
        const response = await presenceApi.getStatuses(ids)
        if (Array.isArray(response)) {
          response.forEach((entry) => {
            this.setStatus(entry.user_id, entry.online)
          })
        }
        this.lastUpdated = new Date().toISOString()
      } catch (error) {
        notifyError(error?.response?.data?.detail || 'Не вдалося оновити статус онлайн')
      }
    },

    track(ids = []) {
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
        this.fetch(this.trackedIds)
      }
    },

    setStatus(userId, online) {
      if (!userId) return
      this.statuses = {
        ...this.statuses,
        [userId]: {
          online,
          timestamp: new Date().toISOString(),
        },
      }
    },

    subscribeRealtime() {
      realtimeService.subscribe('presence', (payload) => {
        if (payload?.type === 'user.online') {
          this.setStatus(payload.userId, true)
        }
        if (payload?.type === 'user.offline') {
          this.setStatus(payload.userId, false)
        }
      })

      this.timer = setInterval(() => {
        this.prune()
        if (this.trackedIds.length) {
          this.fetch(this.trackedIds)
        }
      }, REFRESH_INTERVAL)
    },

    prune() {
      const next = {}
      Object.entries(this.statuses).forEach(([id, entry]) => {
        if (dayjs(entry.timestamp).isAfter(dayjs().subtract(TTL_SECONDS, 'second'))) {
          next[id] = entry
        }
      })
      this.statuses = next
    },

    dispose() {
      this.statuses = {}
      this.lastUpdated = null
      this.trackedIds = []
      if (this.timer) {
        clearInterval(this.timer)
        this.timer = null
      }
    },
  },
})
