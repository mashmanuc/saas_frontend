import { defineStore } from 'pinia'
import dayjs from 'dayjs'
import { chatApi } from '../api/chat'
import { realtimeService } from '../services/realtime'
import { notifyError } from '../utils/notify'
import { useAuthStore } from '../modules/auth/store/authStore'

const MAX_TYPING_AGE_MS = 5000
const TYPING_CHECK_INTERVAL = 2000
const DEFAULT_STATUS = 'delivered'
const SEND_RATE_LIMIT_MS = 300

let tempIdCounter = 0
const createTempId = () => `tmp-${Date.now()}-${++tempIdCounter}`

const normalizeMessage = (message = {}, overrides = {}) => {
  const normalizedStatus = overrides.status ?? message.status ?? DEFAULT_STATUS
  const normalizedError = overrides.errorMessage ?? message.errorMessage ?? null
  return {
    attachments: [],
    errorMessage: null,
    ...message,
    ...overrides,
    status: normalizedStatus,
    errorMessage: normalizedError,
  }
}

export const useChatStore = defineStore('chat', {
  state: () => ({
    messages: [],
    cursor: null,
    hasMore: false,
    loading: false,
    sending: false,
    sendLocked: false,
    sendLockTimer: null,
    activeLessonId: null,
    typingUsers: {},
    typingTimer: null,
    readPointers: {},
    subscriptionCleanup: null,
    statusUnsubscribe: null,
    currentChannel: null,
    syncing: false,
    // Batch messages for efficient updates (prevent excessive array creation)
    pendingMessages: [],
    batchTimer: null,
  }),

  getters: {
    sortedMessages(state) {
      return [...state.messages].sort((a, b) => dayjs(a.created_at).valueOf() - dayjs(b.created_at).valueOf())
    },
    typingList(state) {
      return Object.values(state.typingUsers)
    },
  },

  actions: {
    initLesson(lessonId) {
      if (this.activeLessonId === lessonId) return
      this.activeLessonId = lessonId
      this.messages = []
      this.cursor = null
      this.hasMore = false
      this.readPointers = {}
      this.fetchHistory({ replace: true })
      this.subscribeToRealtime()
      this.ensureRealtimeStatusListener()
    },

    async fetchHistory({ cursor, replace = false } = {}) {
      if (!this.activeLessonId || this.loading) return
      this.loading = true
      try {
        const requestCursor = typeof cursor === 'undefined' ? this.cursor : cursor
        const response = await chatApi.fetchHistory({ lessonId: this.activeLessonId, cursor: requestCursor ?? undefined })
        const results = Array.isArray(response?.results) ? response.results : response?.messages || []
        const normalized = results.map((item) => normalizeMessage(item))
        this.messages = replace ? normalized : [...normalized, ...this.messages]
        this.cursor = response?.cursor || null
        this.hasMore = Boolean(response?.has_more)
      } catch (error) {
        notifyError(error?.response?.data?.detail || 'Не вдалося завантажити історію чату')
      } finally {
        this.loading = false
      }
    },

    async sendMessage({ text, attachments } = {}) {
      if (!text?.trim() || !this.activeLessonId) return
      if (this.sendLocked || this.sending) return
      const auth = useAuthStore()
      const tempId = this.addOptimisticMessage({
        text,
        attachments,
        author: auth.user,
      })
      await this.performSendRequest({ text, attachments, tempId })
    },

    async retryMessage(messageId) {
      if (!messageId || this.sending || this.sendLocked) return
      const target = this.messages.find((message) => String(message.id) === String(messageId) || String(message.clientId) === String(messageId))
      if (!target || target.status !== 'error') return
      const tempId = target.clientId || target.id
      this.upsertMessage(
        normalizeMessage(target, {
          status: 'sending',
          errorMessage: null,
        }),
      )
      await this.performSendRequest({
        text: target.text,
        attachments: target.attachments,
        tempId,
      })
    },

    async performSendRequest({ text, attachments, tempId }) {
      if (!tempId) return
      this.sending = true
      this.startSendCooldown()
      const payload = {
        lesson_id: this.activeLessonId,
        text,
        attachments,
      }
      try {
        const response = await chatApi.sendMessage(payload)
        this.replaceOptimisticMessage(tempId, response)
        realtimeService.publish('chat', { type: 'chat.message.new', payload: response })
      } catch (error) {
        const message = error?.response?.data?.detail || 'Не вдалося надіслати повідомлення'
        this.markMessageError(tempId, message)
        notifyError(message)
      } finally {
        this.sending = false
      }
    },

    async editMessage(id, text) {
      try {
        const payload = await chatApi.editMessage(id, { text })
        this.upsertMessage(payload)
        realtimeService.publish('chat', { type: 'chat.message.edited', payload })
      } catch (error) {
        notifyError(error?.response?.data?.detail || 'Не вдалося відредагувати повідомлення')
      }
    },

    async deleteMessage(id) {
      try {
        await chatApi.deleteMessage(id)
        this.messages = this.messages.filter((message) => message.id !== id)
        realtimeService.publish('chat', { type: 'chat.message.deleted', payload: { id } })
      } catch (error) {
        notifyError(error?.response?.data?.detail || 'Не вдалося видалити повідомлення')
      }
    },

    upsertMessage(message) {
      if (!message) return
      const normalized = normalizeMessage(message)
      const existingIndex = this.messages.findIndex(
        (item) => item.id === normalized.id || (normalized.clientId && item.clientId === normalized.clientId),
      )
      // Add to pending batch instead of immediate update
      this.pendingMessages.push({ normalized, existingIndex })
      this.flushMessageBatch()
    },

    flushMessageBatch() {
      if (this.batchTimer) return
      this.batchTimer = setTimeout(() => {
        if (this.pendingMessages.length === 0) {
          this.batchTimer = null
          return
        }
        // Apply all pending updates in single array operation
        let newMessages = [...this.messages]
        this.pendingMessages.forEach(({ normalized, existingIndex }) => {
          if (existingIndex === -1) {
            // Check if already added by clientId in this batch
            const alreadyInBatch = newMessages.findIndex(
              (m) => (normalized.id && m.id === normalized.id) || (normalized.clientId && m.clientId === normalized.clientId)
            )
            if (alreadyInBatch === -1) {
              newMessages.push(normalized)
            }
          } else {
            newMessages = newMessages.map((item, idx) => (idx === existingIndex ? { ...item, ...normalized } : item))
          }
        })
        this.messages = newMessages
        this.pendingMessages = []
        this.batchTimer = null
      }, 16) // Single frame delay for batching
    },

    subscribeToRealtime() {
      if (this.subscriptionCleanup) {
        this.subscriptionCleanup()
        this.subscriptionCleanup = null
      }
      const auth = useAuthStore()
      const userId = auth.user?.id
      if (!userId) return
      const channel = `chat:user:${userId}`
      this.currentChannel = channel
      this.subscriptionCleanup = realtimeService.subscribe(channel, (payload) => {
        const eventType = payload?.type
        const eventPayload = payload?.payload ?? payload
        if (eventPayload?.lessonId && String(eventPayload.lessonId) !== String(this.activeLessonId)) return
        if (eventPayload?.lesson_id && String(eventPayload.lesson_id) !== String(this.activeLessonId)) return
        switch (eventType) {
          case 'chat.message.new':
          case 'chat.message.edited':
            this.upsertMessage(eventPayload)
            break
          case 'chat.message.deleted':
            this.messages = this.messages.filter((message) => String(message.id) !== String(eventPayload?.id))
            break
          case 'chat.typing':
            this.markTyping(eventPayload)
            break
          case 'chat.read':
            this.updateReadPointer(eventPayload)
            break
          default:
            break
        }
      })
    },

    ensureRealtimeStatusListener() {
      if (this.statusUnsubscribe) return
      this.statusUnsubscribe = realtimeService.on('status', (status) => {
        if (status === 'open' && this.activeLessonId) {
          // Reconnected — sync data
          this.syncAfterReconnect()
        }
      })
    },

    async syncAfterReconnect() {
      if (!this.activeLessonId || this.syncing) return
      this.syncing = true
      try {
        // Incremental sync: fetch only new messages since last cursor
        await this.fetchHistory({ replace: false })
      } finally {
        this.syncing = false
      }
    },

    markTyping({ userId, lessonId, displayName }) {
      if (lessonId && lessonId !== this.activeLessonId) return
      if (!userId) return
      this.typingUsers = {
        ...this.typingUsers,
        [userId]: {
          id: userId,
          name: displayName,
          timestamp: Date.now(),
        },
      }
      this.scheduleTypingCleanup()
    },

    scheduleTypingCleanup() {
      if (this.typingTimer) return
      this.typingTimer = setInterval(() => {
        const now = Date.now()
        const nextEntries = { ...this.typingUsers }
        let changed = false
        Object.entries(this.typingUsers).forEach(([key, entry]) => {
          if (now - entry.timestamp > MAX_TYPING_AGE_MS) {
            delete nextEntries[key]
            changed = true
          }
        })
        if (changed) {
          this.typingUsers = nextEntries
        }
        if (!Object.keys(this.typingUsers).length) {
          clearInterval(this.typingTimer)
          this.typingTimer = null
        }
      }, TYPING_CHECK_INTERVAL)
    },

    sendTyping() {
      if (!this.activeLessonId) return
      realtimeService.publish('chat', {
        type: 'chat.typing',
        payload: {
          lessonId: this.activeLessonId,
          lesson_id: this.activeLessonId,
        },
      })
    },

    updateReadPointer({ lessonId, userId, messageId, displayName }) {
      if (!lessonId || lessonId !== this.activeLessonId || !userId) return
      this.readPointers = {
        ...this.readPointers,
        [userId]: {
          messageId,
          name: displayName,
        },
      }
    },

    markAsRead(messageId) {
      const auth = useAuthStore()
      this.updateReadPointer({
        lessonId: this.activeLessonId,
        userId: auth.user?.id,
        messageId,
        displayName: auth.user?.full_name || auth.user?.email,
      })
      realtimeService.publish('chat', {
        type: 'chat.read',
        payload: {
          lessonId: this.activeLessonId,
          lesson_id: this.activeLessonId,
          messageId,
          displayName: auth.user?.full_name || auth.user?.email,
        },
      })
    },

    dispose() {
      this.messages = []
      this.cursor = null
      this.hasMore = false
      this.activeLessonId = null
      this.typingUsers = {}
      this.readPointers = {}
      this.pendingMessages = []
      if (this.batchTimer) {
        clearTimeout(this.batchTimer)
        this.batchTimer = null
      }
      if (this.subscriptionCleanup) {
        this.subscriptionCleanup()
        this.subscriptionCleanup = null
      }
      if (this.statusUnsubscribe) {
        this.statusUnsubscribe()
        this.statusUnsubscribe = null
      }
      this.currentChannel = null
      if (this.typingTimer) {
        clearInterval(this.typingTimer)
        this.typingTimer = null
      }
      this.clearSendCooldown()
    },

    addOptimisticMessage({ text, attachments = [], author }) {
      const tempId = createTempId()
      const optimistic = normalizeMessage(
        {
          id: tempId,
          clientId: tempId,
          text,
          attachments,
          created_at: new Date().toISOString(),
          author_id: author?.id,
          author_name: author?.full_name || author?.email,
          author,
        },
        {
          status: 'sending',
          optimistic: true,
        },
      )
      this.messages = [...this.messages, optimistic]
      return tempId
    },

    replaceOptimisticMessage(tempId, nextMessage) {
      if (!tempId || !nextMessage) return
      const normalized = normalizeMessage(nextMessage, { optimistic: false })
      let replaced = false
      this.messages = this.messages.map((item) => {
        if (String(item.id) === String(tempId) || String(item.clientId) === String(tempId)) {
          replaced = true
          return normalized
        }
        return item.id === normalized.id ? { ...item, ...normalized } : item
      })
      if (!replaced) {
        this.upsertMessage(normalized)
      }
    },

    markMessageError(tempId, errorMessage) {
      if (!tempId) return
      this.messages = this.messages.map((item) => {
        if (String(item.id) === String(tempId) || String(item.clientId) === String(tempId)) {
          return normalizeMessage(item, {
            status: 'error',
            errorMessage,
            optimistic: true,
          })
        }
        return item
      })
    },

    startSendCooldown() {
      this.sendLocked = true
      if (this.sendLockTimer) {
        clearTimeout(this.sendLockTimer)
      }
      this.sendLockTimer = setTimeout(() => {
        this.sendLocked = false
        this.sendLockTimer = null
      }, SEND_RATE_LIMIT_MS)
    },

    clearSendCooldown() {
      if (this.sendLockTimer) {
        clearTimeout(this.sendLockTimer)
        this.sendLockTimer = null
      }
      this.sendLocked = false
    },
  },
})
