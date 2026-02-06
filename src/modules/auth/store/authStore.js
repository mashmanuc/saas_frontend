import { defineStore } from 'pinia'
import authApi from '../api/authApi'
import { storage } from '../../../utils/storage'
import { logAuthEvent, AUTH_EVENTS } from '../../../utils/telemetry/authEvents'

const hasDocument = typeof document !== 'undefined'
const REFRESH_INTERVAL_MS = 25 * 60 * 1000
let refreshInterval = null

export const useAuthStore = defineStore('auth', {
  state: () => ({
    access: storage.getAccess(),
    user: storage.getUser(),
    csrfToken: null,
    pendingMfaSessionId: null,
    pendingWebAuthnSessionId: null,
    webAuthnChallenge: null,
    loading: false,
    error: null,
    lastErrorCode: null,
    lastRequestId: null,
    lastFieldMessages: null,
    lastSummary: null,
    initialized: false,
    refreshPromise: null,
    sessionExpiredNotified: false,
    showSessionRevokedBanner: false,
    sessionRevokedRequestId: null,
    lockedUntil: null,
    trialStatus: null,
  }),

  getters: {
    isAuthenticated: (state) => Boolean(state.access && state.user),
    userRole: (state) => state.user?.role || null,
    isBootstrapped: (state) => state.initialized,
    isAccountLocked: (state) => state.lastErrorCode === 'account_locked',
    canRequestUnlock: (state) => state.lastErrorCode === 'account_locked',
    hasTrial: (state) => Boolean(state.trialStatus?.active),
    trialDaysLeft: (state) => state.trialStatus?.days_left || 0,
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
      this.pendingWebAuthnSessionId = null
      this.webAuthnChallenge = null

      try {
        const res = await authApi.login(form)
        const mfaRequired = Boolean(res?.mfa_required)
        const webauthnRequired = Boolean(res?.webauthn_required)
        const sessionId = res?.session_id

        if (webauthnRequired) {
          this.pendingWebAuthnSessionId = typeof sessionId === 'string' && sessionId.trim().length > 0 ? sessionId : null
          this.lastErrorCode = 'webauthn_required'
          return { webauthn_required: true, session_id: this.pendingWebAuthnSessionId }
        }

        if (mfaRequired) {
          this.pendingMfaSessionId = typeof sessionId === 'string' && sessionId.trim().length > 0 ? sessionId : null
          this.lastErrorCode = 'mfa_required'
          logAuthEvent({
            event: AUTH_EVENTS.MFA_REQUIRED,
            email: form.email,
          })
          return { mfa_required: true, session_id: this.pendingMfaSessionId }
        }

        const { access, user } = res || {}
        this.setAuth({ access, user })
        await this.postAuthInit()
        await this.ensureCsrfToken()
        this.startProactiveRefresh()
        if (!this.user) {
          await this.reloadUser()
        }
        logAuthEvent({
          event: AUTH_EVENTS.LOGIN_SUCCESS,
          userId: this.user?.id,
          email: form.email,
        })
        return this.user
      } catch (error) {
        logAuthEvent({
          event: AUTH_EVENTS.LOGIN_FAILED,
          email: form.email,
          errorCode: error?.response?.data?.code || error?.response?.data?.error,
          errorMessage: error?.response?.data?.message,
          requestId: error?.response?.data?.request_id,
        })
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
        await this.postAuthInit()
        await this.ensureCsrfToken()
        this.startProactiveRefresh()
        await this.reloadUser()
        this.pendingMfaSessionId = null
        logAuthEvent({
          event: AUTH_EVENTS.MFA_VERIFY_SUCCESS,
          userId: this.user?.id,
        })
        return this.user
      } catch (error) {
        logAuthEvent({
          event: AUTH_EVENTS.MFA_VERIFY_FAILED,
          errorCode: error?.response?.data?.code,
          errorMessage: error?.response?.data?.message,
        })
        this.handleError(error)
        throw error
      } finally {
        this.loading = false
      }
    },

    async loadWebAuthnChallenge() {
      try {
        const sessionId = this.pendingWebAuthnSessionId
        if (!sessionId) {
          throw new Error('No pending WebAuthn session')
        }
        const res = await authApi.webauthnChallenge(sessionId)
        this.webAuthnChallenge = res
        return res
      } catch (error) {
        this.handleError(error)
        throw error
      }
    },

    async verifyWebAuthn(assertion) {
      this.loading = true
      this.error = null
      this.lastErrorCode = null
      this.lastRequestId = null
      this.lastFieldMessages = null
      this.lastSummary = null

      try {
        const sessionId = this.pendingWebAuthnSessionId
        const res = await authApi.webauthnVerify({ session_id: sessionId, ...assertion })
        const access = res?.access
        this.setAuth({ access })
        await this.postAuthInit()
        await this.ensureCsrfToken()
        this.startProactiveRefresh()
        await this.reloadUser()
        this.pendingWebAuthnSessionId = null
        this.webAuthnChallenge = null
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
        await this.postAuthInit()
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

    async postAuthInit() {
      // v0.87.0: КРИТИЧНО - reset всіх stores після зміни користувача/ролі
      // Це запобігає role context leak (tutor UI + student API)
      // Детермінований порядок: reset → init
      try {
        const { useRelationsStore } = await import('../../../stores/relationsStore')
        const relationsStore = useRelationsStore()
        relationsStore.$reset()

        const { useContactAccessStore } = await import('../../../stores/contactAccessStore')
        const contactAccessStore = useContactAccessStore()
        contactAccessStore.$reset()

        console.log('[AuthStore] All stores reset on user change')
      } catch (error) {
        console.warn('[AuthStore] Failed to reset stores:', error)
      }
    },

    async refreshAccess() {
      if (!this.access) return null

      if (this.lockedUntil) {
        const until = Date.parse(this.lockedUntil)
        if (Number.isFinite(until) && Date.now() < until) {
          return null
        }
        this.lockedUntil = null
      }

      // FE-76.2.2: Prevent parallel refresh cycles
      // If refresh is already in-flight, return the same promise
      // This ensures only one refresh request at a time
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
      } catch (error) {
        const status = error?.response?.status
        if (status === 429) {
          // Cooldown to avoid hammering refresh endpoint
          this.lockedUntil = new Date(Date.now() + 60_000).toISOString()
          return null
        }
        throw error
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
          // Якщо 429 (rate limit) - не робимо logout, просто пропускаємо цей refresh
          const status = error?.response?.status
          if (status === 429) {
            console.warn('Refresh rate limited, skipping this cycle')
            return
          }
          
          // Для інших помилок - logout
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
      
      // 🔥 CRITICAL FIX v0.87.1: Перезавантажуємо сторінку для повного очищення стану
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
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
      
      // 🔥 CRITICAL FIX v0.87.1: Очищення всіх Pinia stores при logout
      // Запобігає витоку даних між користувачами
      try {
        const pinia = this.$pinia
        if (pinia) {
          // Очищуємо всі stores крім auth
          pinia._s.forEach((store, key) => {
            if (key !== 'auth' && typeof store.$reset === 'function') {
              store.$reset()
            }
          })
        }
      } catch (error) {
        console.warn('[authStore] Failed to reset stores on logout:', error)
      }
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

    async requestAccountUnlock(email) {
      this.loading = true
      this.error = null
      this.lastErrorCode = null
      this.lastRequestId = null

      try {
        await authApi.requestAccountUnlock({ email })
        logAuthEvent({
          event: AUTH_EVENTS.UNLOCK_REQUESTED,
          email,
        })
        return { success: true }
      } catch (error) {
        logAuthEvent({
          event: AUTH_EVENTS.UNLOCK_FAILED,
          email,
          errorCode: error?.response?.data?.code,
          errorMessage: error?.response?.data?.message,
        })
        this.handleError(error)
        throw error
      } finally {
        this.loading = false
      }
    },

    async confirmAccountUnlock(token) {
      this.loading = true
      this.error = null
      this.lastErrorCode = null
      this.lastRequestId = null

      try {
        await authApi.confirmAccountUnlock({ token })
        this.lockedUntil = null
        this.lastErrorCode = null
        logAuthEvent({
          event: AUTH_EVENTS.UNLOCK_CONFIRMED,
        })
        return { success: true }
      } catch (error) {
        logAuthEvent({
          event: AUTH_EVENTS.UNLOCK_FAILED,
          errorCode: error?.response?.data?.code,
          errorMessage: error?.response?.data?.message,
        })
        this.handleError(error)
        throw error
      } finally {
        this.loading = false
      }
    },

    async fetchTrialStatus() {
      try {
        const res = await authApi.getCurrentUser()
        if (res?.trial_status) {
          this.trialStatus = res.trial_status
        }
      } catch (error) {
        console.error('Failed to fetch trial status', error)
      }
    },

    dispose() {
      this.stopProactiveRefresh()
      this.refreshPromise = null
    },

    handleError(error) {
      const status = error?.response?.status
      const data = error?.response?.data

      // v0.82.0: Пріоритет data.error над data.code для login контракту
      const errorCode = data && typeof data === 'object' ? (data.error || data.code) : null

      const requestIdFromResponse = data && typeof data === 'object' ? data.request_id : null
      const requestIdFromHeaders = error?.response?.headers?.['x-request-id']
      const normalizedRequestId = typeof requestIdFromResponse === 'string' && requestIdFromResponse.trim().length > 0
        ? requestIdFromResponse
        : typeof requestIdFromHeaders === 'string' && requestIdFromHeaders.trim().length > 0
          ? requestIdFromHeaders
          : null

      this.lastRequestId = normalizedRequestId

      const userMessage = (msg) => (typeof msg === 'string' ? msg : '')
      const withRequestId = (msg) => {
        const text = typeof msg === 'string' && msg.trim().length > 0 ? msg : ''
        return this.lastRequestId ? `${text} (request_id: ${this.lastRequestId})` : text
      }

      this.lastErrorCode = null
      this.lastFieldMessages = null
      this.lastSummary = null

      if (!error?.response) {
        this.error = withRequestId('Немає зʼєднання з сервером. Перевірте мережу і спробуйте ще раз.')
        return
      }

      if (status === 429) {
        this.lastErrorCode = 'rate_limited'
        const retryAfter = error?.response?.headers?.['retry-after']
        const msg = retryAfter
          ? `Забагато запитів. Спробуйте через ${retryAfter}с.`
          : 'Забагато запитів. Спробуйте пізніше.'
        this.error = withRequestId(userMessage(msg))
        return
      }

      if (status === 423) {
        this.lastErrorCode = 'account_locked'
        const message = data && typeof data === 'object' ? data.message : null
        const details = data && typeof data === 'object' ? data.details : null
        if (details && details.locked_until) {
          this.lockedUntil = details.locked_until
        }
        this.error = withRequestId(userMessage(typeof message === 'string' && message.trim().length > 0 ? message : 'Акаунт тимчасово заблоковано.'))
        return
      }

      if (status === 410) {
        this.lastErrorCode = 'session_expired'
        const message = data && typeof data === 'object' ? data.message : null
        const finalMessage = typeof message === 'string' && message.trim().length > 0
          ? message
          : 'Сесія підтвердження завершилась. Спробуйте увійти ще раз.'
        this.lastFieldMessages = { otp: [userMessage(finalMessage)] }
        this.error = withRequestId(userMessage(finalMessage))
        return
      }

      if (status === 401) {
        // v0.82.0: Розпізнаємо конкретний код помилки з backend
        if (errorCode === 'invalid_credentials') {
          this.lastErrorCode = 'invalid_credentials'
          const message = data && typeof data === 'object' ? data.message : null
          this.error = withRequestId(userMessage(typeof message === 'string' && message.trim().length > 0 ? message : 'Невірні дані для входу.'))
          return
        }
        if (errorCode === 'email_not_verified') {
          this.lastErrorCode = 'email_not_verified'
          const message = data && typeof data === 'object' ? data.message : null
          this.error = withRequestId(userMessage(typeof message === 'string' && message.trim().length > 0 ? message : 'Підтвердіть email для входу.'))
          return
        }
        // Fallback для інших 401
        this.lastErrorCode = 'invalid_credentials'
        const message = data && typeof data === 'object' ? data.message : null
        this.error = withRequestId(userMessage(typeof message === 'string' && message.trim().length > 0 ? message : 'Невірні дані для входу.'))
        return
      }

      if (status === 422 && data && typeof data === 'object' && errorCode === 'mfa_invalid_code') {
        this.lastErrorCode = 'mfa_invalid_code'
        const message = typeof data.message === 'string' && data.message.trim().length > 0 ? data.message : 'Невірний код підтвердження.'
        this.lastFieldMessages = { otp: [userMessage(message)] }
        this.error = withRequestId(userMessage(message))
        return
      }

      if (status === 422 && data && typeof data === 'object' && errorCode === 'webauthn_invalid_assertion') {
        this.lastErrorCode = 'webauthn_invalid_assertion'
        const message = typeof data.message === 'string' && data.message.trim().length > 0 ? data.message : 'Невірний WebAuthn assertion.'
        this.error = withRequestId(message)
        return
      }

      if (status === 410 && data && typeof data === 'object' && errorCode === 'webauthn_challenge_expired') {
        this.lastErrorCode = 'webauthn_challenge_expired'
        const message = typeof data.message === 'string' && data.message.trim().length > 0 ? data.message : 'WebAuthn challenge завершився.'
        this.error = withRequestId(message)
        return
      }

      if (status === 401 && data && typeof data === 'object' && errorCode === 'session_revoked') {
        this.lastErrorCode = 'session_revoked'
        this.sessionRevokedRequestId = data.request_id || ''
        const message = typeof data.message === 'string' && data.message.trim().length > 0 ? data.message : 'Сесію відкликано.'
        this.error = withRequestId(message)
        this.showSessionRevokedBanner = true
        this.forceLogout()
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
            this.error = withRequestId(userMessage(String(firstVal[0])))
            return
          }
        }

        if (summary && summary.length > 0) {
          this.error = withRequestId(userMessage(String(summary[0])))
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
