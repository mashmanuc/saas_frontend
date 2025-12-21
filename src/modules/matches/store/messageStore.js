import { defineStore } from 'pinia'
import messagesApi from '../api/messagesApi'
import { trackEvent } from '@/utils/telemetry'

export const useMessageStore = defineStore('message', {
  state: () => ({
    messages: {},
    loading: false,
    error: null,
    uploadProgress: {}
  }),

  getters: {
    getMatchMessages: (state) => (matchId) => {
      return state.messages[matchId] || []
    }
  },

  actions: {
    async fetchMessages(matchId, params = {}) {
      this.loading = true
      this.error = null
      try {
        const data = await messagesApi.getMessages(matchId, params)
        this.messages[matchId] = data.results || []
        trackEvent('chat.prelesson.loaded', {
          match_id: matchId,
          message_count: data.results?.length || 0
        })
        return data
      } catch (err) {
        this.error = err.response?.data?.message || err.message
        throw err
      } finally {
        this.loading = false
      }
    },

    async sendMessage(matchId, data) {
      this.loading = true
      this.error = null
      try {
        const message = await messagesApi.sendMessage(matchId, data)
        if (!this.messages[matchId]) {
          this.messages[matchId] = []
        }
        this.messages[matchId].push(message)
        trackEvent('chat.prelesson.sent', {
          match_id: matchId,
          has_attachments: !!data.attachments?.length,
          request_id: message.request_id
        })
        return message
      } catch (err) {
        this.error = err.response?.data?.message || err.message
        trackEvent('chat.prelesson.send_failed', {
          match_id: matchId,
          error: this.error,
          request_id: err.response?.data?.request_id
        })
        throw err
      } finally {
        this.loading = false
      }
    },

    async uploadAttachment(file) {
      try {
        const { upload_url, asset_key } = await messagesApi.requestAttachmentUpload({
          filename: file.name,
          content_type: file.type,
          size: file.size
        })

        await fetch(upload_url, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type
          }
        })

        return asset_key
      } catch (err) {
        this.error = err.response?.data?.message || err.message
        throw err
      }
    },

    addMessage(matchId, message) {
      if (!this.messages[matchId]) {
        this.messages[matchId] = []
      }
      this.messages[matchId].push(message)
    },

    clearError() {
      this.error = null
    }
  }
})
