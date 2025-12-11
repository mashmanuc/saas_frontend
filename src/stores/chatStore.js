import { defineStore } from 'pinia'
import dayjs from 'dayjs'
import { chatApi } from '../api/chat'
import { realtimeService } from '../services/realtime'
import { notifyError } from '../utils/notify'
import { useAuthStore } from '../modules/auth/store/authStore'

const MAX_TYPING_AGE_MS = 5000
const TYPING_CHECK_INTERVAL = 2000

export const useChatStore = defineStore('chat', {
  state: () => ({
    messages: [],
    cursor: null,
    hasMore: false,
    loading: false,
    sending: false,
    activeLessonId: null,
    typingUsers: {},
    typingTimer: null,
    readPointers: {},
    subscriptionCleanup: null,
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
      this.fetchHistory()
      this.subscribeToRealtime()
    },

    async fetchHistory({ cursor } = {}) {
      if (!this.activeLessonId || this.loading) return
      this.loading = true
      try {
        const response = await chatApi.fetchHistory({ lessonId: this.activeLessonId, cursor: cursor ?? this.cursor })
        const results = Array.isArray(response?.results) ? response.results : response?.messages || []
        this.messages = [...results, ...this.messages]
        this.cursor = response?.cursor || null
        this.hasMore = Boolean(response?.has_more)
      } catch (error) {
        notifyError(error?.response?.data?.detail || 'Не вдалося завантажити історію чату')
      } finally {
        this.loading = false
      }
    },

    async sendMessage({ text, attachments }) {
      if (!text?.trim()) return
      this.sending = true
      try {
        const response = await chatApi.sendMessage({
          lesson_id: this.activeLessonId,
          text,
          attachments,
        })
        this.upsertMessage(response)
        realtimeService.publish('chat', { type: 'chat.message.new', payload: response })
      } catch (error) {
        notifyError(error?.response?.data?.detail || 'Не вдалося надіслати повідомлення')
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
      const index = this.messages.findIndex((item) => item.id === message.id)
      if (index === -1) {
        this.messages = [...this.messages, message]
      } else {
        this.messages = this.messages.map((item) => (item.id === message.id ? { ...item, ...message } : item))
      }
    },

    subscribeToRealtime() {
      if (this.subscriptionCleanup) {
        this.subscriptionCleanup()
        this.subscriptionCleanup = null
      }
      this.subscriptionCleanup = realtimeService.subscribe('chat', (payload) => {
        switch (payload?.type) {
          case 'chat.message.new':
          case 'chat.message.edited':
            this.upsertMessage(payload.payload)
            break
          case 'chat.message.deleted':
            this.messages = this.messages.filter((message) => message.id !== payload.payload?.id)
            break
          case 'chat.typing':
            this.markTyping(payload.payload)
            break
          case 'chat.read':
            this.updateReadPointer(payload.payload)
            break
          default:
            break
        }
      })
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
      if (this.subscriptionCleanup) {
        this.subscriptionCleanup()
        this.subscriptionCleanup = null
      }
      if (this.typingTimer) {
        clearInterval(this.typingTimer)
        this.typingTimer = null
      }
    },
  },
})
