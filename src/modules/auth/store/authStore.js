import { defineStore } from 'pinia'
import authApi from '../api/authApi'
import { storage } from '../../../utils/storage'

const hasDocument = typeof document !== 'undefined'
const REFRESH_INTERVAL_MS = 25 * 60 * 1000
let refreshInterval = null

export const useAuthStore = defineStore('auth', {
  state: () => ({
    access: storage.getAccess(),
    user: storage.getUser(),
    csrfToken: null,
    pendingMfaSessionId: null,
    loading: false,
    error: null,
    lastErrorCode: null,
    lastRequestId: null,
    lastFieldMessages: null,
    lastSummary: null,
    initialized: false,
    refreshPromise: null,
    sessionExpiredNotified: false,
  }),

  getters: {
    isAuthenticated: (state) => Boolean(state.access && state.user),
    userRole: (state) => state.user?.role || null,
    isBootstrapped: (state) => state.initialized,
  },

  actions: {
    async bootstrap() {
      if (this.initialized) return
      this.initialized = true

      // Якщо немає access токена — не намагаємося refresh, просто виходимо
      if (!this.access) {
        return
      }

      if (!this.user) {
        try {
          const user = await authApi.getCurrentUser()
          this.user = user
          storage.setUser(user)
        } catch (error) {
          await this.forceLogout()
          return
        }
      }

      if (this.user) {
        this.startProactiveRefresh()
      }
    },

    async login(form) {
      this.loading = true
      this.error = null
      this.lastErrorCode = null
      this.lastRequestId = null
      this.lastFieldMessages = null
      this.lastSummary = null
      this.pendingMfaSessionId = null

      try {
        const res = await authApi.login(form)
        const mfaRequired = Boolean(res?.mfa_required)
        const sessionId = res?.session_id

        if (mfaRequired) {
          this.pendingMfaSessionId = typeof sessionId === 'string' && sessionId.trim().length > 0 ? sessionId : null
          this.lastErrorCode = 'mfa_required'
          return { mfa_required: true, session_id: this.pendingMfaSessionId }
        }

        const { access, user } = res || {}
        this.setAuth({ access, user })
        await this.ensureCsrfToken()
        this.startProactiveRefresh()
        if (!this.user) {
          await this.reloadUser()
        }
        return this.user
      } catch (error) {
        this.handleError(error)
        throw error
      } finally {
        this.loading = false
      }
    },

    async verifyMfa(otp) {
      this.loading = true
      this.error = null
      this.lastErrorCode = null
      this.lastRequestId = null
      this.lastFieldMessages = null
      this.lastSummary = null

      try {
        const sessionId = this.pendingMfaSessionId
        const res = await authApi.mfaVerify({ otp, session_id: sessionId })
        const access = res?.access
        this.setAuth({ access })
        await this.ensureCsrfToken()
        this.startProactiveRefresh()
        await this.reloadUser()
        this.pendingMfaSessionId = null
        return this.user
      } catch (error) {
        this.handleError(error)
        throw error
      } finally {
        this.loading = false
      }
    },

    async validateInvite(token) {
      this.loading = true
      this.error = null
      this.lastErrorCode = null
      this.lastRequestId = null
      this.lastFieldMessages = null
      this.lastSummary = null

      try {
        return await authApi.validateInvite(token)
      } catch (error) {
        this.handleError(error)
        throw error
      } finally {
        this.loading = false
      }
    },

    async register(form) {
      this.loading = true
      this.error = null
      this.lastErrorCode = null
      this.lastRequestId = null
      this.lastFieldMessages = null
      this.lastSummary = null

      try {
        const res = await authApi.register(form)
        return res
      } catch (error) {
        this.handleError(error)
        throw error
      } finally {
        this.loading = false
      }
    },

    async acceptInvite(payload) {
      this.loading = true
      this.error = null
      this.lastErrorCode = null
      this.lastRequestId = null
      this.lastFieldMessages = null
      this.lastSummary = null

      try {
        const { access } = await authApi.acceptInvite(payload)
        this.setAuth({ access })
        await this.ensureCsrfToken()
        this.startProactiveRefresh()
        await this.reloadUser()
        return this.user
      } catch (error) {
        this.handleError(error)
        throw error
      } finally {
        this.loading = false
      }
    },

    async reloadUser() {
      if (!this.access) return null
      try {
        const user = await authApi.getCurrentUser()
        this.user = user
        storage.setUser(user)
        return user
      } catch (error) {
        await this.forceLogout()
        throw error
      }
    },

    setAuth({ access, user } = {}) {
      if (typeof access !== 'undefined') {
        this.access = access || null
        storage.setAccess(this.access)
        if (access) {
          this.sessionExpiredNotified = false
        }
      }

      if (typeof user !== 'undefined') {
        this.user = user || null
        storage.setUser(this.user)
      }

      this.error = null
      this.lastErrorCode = null
      this.lastRequestId = null
      this.lastFieldMessages = null
      this.lastSummary = null
    },

    async refreshAccess() {
      if (this.refreshPromise) {
        return this.refreshPromise
      }

      this.refreshPromise = (async () => {
        const res = await authApi.refresh()
        if (!res?.access) {
          throw new Error('Не вдалося оновити токен')
        }

        this.access = res.access
        storage.setAccess(this.access)

        if (!this.csrfToken) {
          await this.ensureCsrfToken()
        }
        return this.access
      })()

      try {
        return await this.refreshPromise
      } finally {
        this.refreshPromise = null
      }
    },

    async fetchCurrentUser() {
      if (!this.access) return null
      try {
        const user = await authApi.getCurrentUser()
        this.user = user
        storage.setUser(user)
        return user
      } catch (error) {
        await this.forceLogout()
        throw error
      }
    },

    startProactiveRefresh() {
      if (refreshInterval) {
        clearInterval(refreshInterval)
      }

      refreshInterval = setInterval(async () => {
        if (!this.access) return
        if (hasDocument && document.visibilityState !== 'visible') return

        try {
          await this.refreshAccess()
        } catch (error) {
          await this.forceLogout()
        }
      }, REFRESH_INTERVAL_MS)
    },

    stopProactiveRefresh() {
      if (refreshInterval) {
        clearInterval(refreshInterval)
        refreshInterval = null
      }
    },

    async logout() {
      try {
        await authApi.logout()
      } catch (error) {
        // ігноруємо помилку logout, головне очистити стан локально
      }

      await this.forceLogout()
    },

    async forceLogout() {
      this.stopProactiveRefresh()
      this.access = null
      this.user = null
      this.csrfToken = null
      this.error = null
      this.lastErrorCode = null
      this.loading = false
      this.refreshPromise = null
      this.lastRequestId = null
      this.lastFieldMessages = null
      this.lastSummary = null

      storage.clearAll()
    },

    async ensureCsrfToken() {
      try {
        const res = await authApi.csrf()
        const token = res?.csrf
        if (typeof token === 'string' && token.trim().length > 0) {
          this.csrfToken = token
        }
      } catch (_err) {
        // CSRF token може бути не обов'язковим на деяких середовищах; не ламаємо флоу
      }
    },

    dispose() {
      this.stopProactiveRefresh()
      this.refreshPromise = null
    },

    handleError(error) {
      const status = error?.response?.status
      const data = error?.response?.data

      const code = data && typeof data === 'object' ? data.code : null

      const requestId = data && typeof data === 'object' ? data.request_id : null
      this.lastRequestId = typeof requestId === 'string' ? requestId : null

      const withRequestId = (msg) => (this.lastRequestId ? `${msg} (request_id: ${this.lastRequestId})` : msg)

      this.lastErrorCode = null
      this.lastFieldMessages = null
      this.lastSummary = null

      if (status === 429) {
        this.lastErrorCode = 'rate_limited'
        const retryAfter = error?.response?.headers?.['retry-after']
        if (retryAfter) {
          this.error = withRequestId(`Забагато запитів. Спробуйте через ${retryAfter}с.`)
        } else {
          this.error = withRequestId('Забагато запитів. Спробуйте пізніше.')
        }
        return
      }

      if (status === 423) {
        this.lastErrorCode = 'account_locked'
        const message = data && typeof data === 'object' ? data.message : null
        this.error = withRequestId(typeof message === 'string' && message.trim().length > 0 ? message : 'Акаунт тимчасово заблоковано.')
        return
      }

      if (status === 410) {
        this.lastErrorCode = 'session_expired'
        const message = data && typeof data === 'object' ? data.message : null
        const finalMessage = typeof message === 'string' && message.trim().length > 0
          ? message
          : 'Сесія підтвердження завершилась. Спробуйте увійти ще раз.'
        this.lastFieldMessages = { otp: [withRequestId(finalMessage)] }
        this.error = withRequestId(finalMessage)
        return
      }

      if (status === 401) {
        this.lastErrorCode = 'invalid_credentials'
        const message = data && typeof data === 'object' ? data.message : null
        this.error = withRequestId(typeof message === 'string' && message.trim().length > 0 ? message : 'Невірні дані для входу.')
        return
      }

      if (status === 422 && data && typeof data === 'object' && code === 'mfa_invalid_code') {
        this.lastErrorCode = 'mfa_invalid_code'
        const message = typeof data.message === 'string' && data.message.trim().length > 0 ? data.message : 'Невірний код підтвердження.'
        this.lastFieldMessages = { otp: [withRequestId(message)] }
        this.error = withRequestId(message)
        return
      }

      if (status === 422 && data && typeof data === 'object') {
        this.lastErrorCode = 'validation_failed'

        const fieldMessages = data.field_messages && typeof data.field_messages === 'object' ? data.field_messages : null
        const summary = Array.isArray(data.summary) ? data.summary : null
        this.lastFieldMessages = fieldMessages
        this.lastSummary = summary

        // Для простого UI (де немає inline під кожним полем) — показуємо перше повідомлення
        if (fieldMessages) {
          const firstKey = Object.keys(fieldMessages)[0]
          const firstVal = firstKey ? fieldMessages[firstKey] : null
          if (Array.isArray(firstVal) && firstVal.length) {
            this.error = withRequestId(String(firstVal[0]))
            return
          }
        }

        if (summary && summary.length > 0) {
          this.error = withRequestId(String(summary[0]))
          return
        }

        const message = data.message
        this.error = withRequestId(typeof message === 'string' && message.trim().length > 0 ? message : 'Перевірте дані.')
        return
      }

      if (typeof status === 'number' && status >= 500) {
        this.lastErrorCode = 'internal_error'
        const message = data && typeof data === 'object' ? data.message : null
        this.error = withRequestId(
          typeof message === 'string' && message.trim().length > 0
            ? message
            : 'Тимчасова помилка. Спробуйте пізніше.'
        )
        return
      }

      if (!data) {
        this.error = withRequestId('Невідома помилка. Спробуйте ще раз.')
        return
      }

      if (data.message && typeof data.message === 'string') {
        this.error = withRequestId(data.message)
        return
      }

      if (data.detail) {
        this.error = withRequestId(data.detail)
        return
      }

      if (typeof data === 'object') {
        const firstKey = Object.keys(data)[0]
        const firstVal = data[firstKey]
        if (Array.isArray(firstVal)) {
          this.error = firstVal[0]
          return
        }
      }

      this.error = 'Сталася помилка. Перевірте дані.'
    },
  },
})
