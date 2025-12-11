import { defineStore } from 'pinia'
import { notificationsApi } from '../api/notifications'
import { realtimeService } from '../services/realtime'
import { notifyInfo } from '../utils/notify'
import { useAuthStore } from '../modules/auth/store/authStore'

const REFRESH_DEBOUNCE_MS = 1200
const MAX_DEBUG_EVENTS = 50

const createId = () =>
  globalThis.crypto?.randomUUID?.() ?? `ntf-${Date.now()}-${Math.random().toString(16).slice(2)}`

export const useNotificationsStore = defineStore('notifications', {
  state: () => ({
    items: [],
    cursor: null,
    hasMore: false,
    loading: false,
    initialized: false,
    subscriptionCleanup: null,
    statusUnsubscribe: null,
    refreshTimer: null,
    authStop: null,
    currentUserId: null,
    debugEvents: [],
    mockOffline: false,
  }),

  getters: {
    unreadCount(state) {
      return state.items.filter((item) => !item.read_at).length
    },
    sortedItems(state) {
      return [...state.items].sort(
        (a, b) => new Date(b.created_at).valueOf() - new Date(a.created_at).valueOf(),
      )
    },
  },

  actions: {
    init() {
      if (this.initialized) return
      this.initialized = true
      this.observeAuthChanges()
      this.bindRealtimeStatus()
    },

    dispose() {
      this.resetSession()
      if (this.authStop) {
        this.authStop()
        this.authStop = null
      }
      if (this.statusUnsubscribe) {
        this.statusUnsubscribe()
        this.statusUnsubscribe = null
      }
      this.initialized = false
    },

    resetSession() {
      this.items = []
      this.cursor = null
      this.hasMore = false
      this.currentUserId = null
      this.teardownRealtime()
      if (this.refreshTimer) {
        clearTimeout(this.refreshTimer)
        this.refreshTimer = null
      }
    },

    observeAuthChanges() {
      const auth = useAuthStore()
      const handleUser = (user) => {
        const nextId = user?.id || null
        if (!nextId) {
          this.resetSession()
          return
        }
        if (this.currentUserId === nextId) {
          return
        }
        this.currentUserId = nextId
        this.logDebugEvent('auth.user', { userId: nextId })
        this.fetchNotifications({ replace: true })
        if (!this.mockOffline) {
          this.subscribeChannel(nextId)
        }
      }
      handleUser(auth.user)
      if (this.authStop) {
        this.authStop()
      }
      this.authStop = auth.$subscribe(
        (_, state) => {
          handleUser(state.user)
        },
        { detached: true },
      )
    },

    async fetchNotifications({ cursor = null, replace = false } = {}) {
      if (this.loading || !this.currentUserId) return
      this.loading = true
      try {
        const response = await notificationsApi.list(cursor)
        const results = Array.isArray(response?.results) ? response.results : []
        if (replace) {
          this.items = results
        } else {
          this.items = this.mergeUnique([...this.items, ...results])
        }
        this.cursor = response?.cursor || null
        this.hasMore = Boolean(response?.has_more)
        this.logDebugEvent('fetch.success', { count: results.length, replace })
      } catch (error) {
        console.error('[notifications] fetch failed', error)
        this.logDebugEvent('fetch.error', { message: error?.message })
      } finally {
        this.loading = false
      }
    },

    mergeUnique(collection = []) {
      const map = new Map()
      collection.forEach((item) => {
        if (!item?.id) return
        map.set(item.id, { ...map.get(item.id), ...item })
      })
      return Array.from(map.values())
    },

    async loadMore() {
      if (!this.cursor) return
      await this.fetchNotifications({ cursor: this.cursor, replace: false })
    },

    async markAsRead(id) {
      if (!id) return
      try {
        await notificationsApi.markRead(id)
        this.items = this.items.map((item) =>
          item.id === id
            ? {
                ...item,
                read_at: item.read_at || new Date().toISOString(),
              }
            : item,
        )
      } catch (error) {
        console.error('[notifications] mark read failed', error)
      }
    },

    async markAllAsRead() {
      const unread = this.items.filter((item) => !item.read_at)
      await Promise.all(unread.map((item) => this.markAsRead(item.id)))
    },

    subscribeChannel(userId) {
      this.teardownRealtime()
      if (!userId || this.mockOffline) return
      this.subscriptionCleanup = realtimeService.subscribe('notifications', (payload) => {
        if (!payload) return
        this.handleRealtimePayload(payload)
      })
      realtimeService.publish('notifications', {
        type: 'subscribe',
        channel: `notifications:user:${userId}`,
      })
    },

    teardownRealtime() {
      if (this.subscriptionCleanup) {
        this.subscriptionCleanup()
        this.subscriptionCleanup = null
      }
    },

    bindRealtimeStatus() {
      this.statusUnsubscribe = realtimeService.on?.('status', (status) => {
        if (status === 'open' && this.initialized && this.currentUserId) {
          this.fetchNotifications({ replace: true })
        }
      })
    },

    handleRealtimePayload(payload) {
      this.logDebugEvent('realtime.payload', payload)
      this.triggerToast(payload)
      this.scheduleRefresh()
    },

    triggerToast(payload) {
      const title = payload?.payload?.title || payload?.payload?.message || payload?.type || 'Notification'
      notifyInfo(title, {
        timeout: 6000,
      })
      this.logDebugEvent('toast.trigger', { title })
    },

    scheduleRefresh() {
      if (this.refreshTimer) return
      this.refreshTimer = setTimeout(() => {
        this.fetchNotifications({ replace: true })
        this.refreshTimer = null
        this.logDebugEvent('refresh.complete', {})
      }, REFRESH_DEBOUNCE_MS)
    },

    addMockNotification(raw = {}) {
      const createdAt = raw.created_at || new Date().toISOString()
      const basePayload = raw.payload || {}
      const entry = {
        id: raw.id || createId(),
        type: raw.type || 'debug.mock',
        payload: {
          title: raw.title || basePayload.title || 'Dev notification',
          body: raw.body || basePayload.body || raw.description || '',
          ...basePayload,
        },
        read_at: raw.read_at || null,
        created_at: createdAt,
      }
      this.items = this.mergeUnique([entry, ...this.items])
      this.logDebugEvent('mock.push', entry)
    },

    toggleOfflineSimulation(forceValue) {
      const nextState = typeof forceValue === 'boolean' ? forceValue : !this.mockOffline
      if (nextState === this.mockOffline) return
      this.mockOffline = nextState
      if (nextState) {
        this.teardownRealtime()
        this.logDebugEvent('status.offline', { reason: 'simulation' })
      } else {
        this.logDebugEvent('status.online', { reason: 'simulation' })
        if (this.currentUserId) {
          this.subscribeChannel(this.currentUserId)
        }
      }
    },

    logDebugEvent(event, payload) {
      const entry = {
        id: createId(),
        event,
        payload,
        timestamp: new Date().toISOString(),
      }
      this.debugEvents = [entry, ...this.debugEvents].slice(0, MAX_DEBUG_EVENTS)
    },
  },
})
