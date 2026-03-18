import { defineStore } from 'pinia'
import authApi from '../api/authApi'
import { storage } from '../../../utils/storage'
import { logAuthEvent, AUTH_EVENTS } from '../../../utils/telemetry/authEvents'
import { tokenVault } from '../../../utils/tokenVault'

const hasDocument = typeof document !== 'undefined'
// JWT TTL = 60 хв (backend SIMPLE_JWT.ACCESS_TOKEN_LIFETIME).
// Proactive refresh кожні 20 хв дає 3 спроби на 60-хвилинне вікно.
// При поверненні до вкладки — рефреш відбувається одразу (visibilitychange handler).
const REFRESH_INTERVAL_MS = 20 * 60 * 1000
let refreshInterval = null
// Cross-tab refresh coordination
const REFRESH_LOCK_KEY = 'auth_refresh_lock'
const REFRESH_LOCK_TTL_MS = 30_000 // 30 seconds max for refresh operation
const LOCK_RETRY_DELAY_MS = 100

export const useAuthStore = defineStore('auth', {
  state: () => {
    const rawUser = storage.getUser()
    const user = rawUser && typeof rawUser === 'object' && typeof rawUser.role === 'string'
      ? { ...rawUser, role: rawUser.role.toLowerCase() }
      : rawUser
    // Phase 1.3: access token is in httpOnly cookie for REST API.
    // We still keep the JWT in memory (NOT localStorage) for:
    //   - WebSocket authentication (ws subprotocol/query)
    //   - Winterboard beacon/fetch (keepalive requests)
    //   - isAuthenticated checks
    // localStorage stores only a session marker, never the real JWT.
    const hasSession = Boolean(storage.get('auth_session') || storage.getAccess())
    return {
      access: hasSession ? (storage.getAccess() || '__cookie__') : null,
      user,
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
      _bootstrapPromise: null,
      _lastUserFetch: null,
      USER_CACHE_TTL: 5 * 60 * 1000, // 5 хвилин
      refreshPromise: null,
      sessionExpiredNotified: false,
      showSessionRevokedBanner: false,
      sessionRevokedRequestId: null,
      lockedUntil: null,
      trialStatus: null,
      // Cross-tab coordination state
      _refreshLockOwned: false,
      _bc: null,
    }
  },

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
    /**
     * Decrypt access token from memory vault.
     * Single entry point for all WS auth and beacon requests.
     * Returns null if no real JWT available.
     */
    async getDecryptedAccess() {
      if (!this.access || this.access === '__cookie__') return null
      return await tokenVault.decrypt(this.access)
    },

    async bootstrap() {
      // Initialize tokenVault early (generates ephemeral AES key)
      await tokenVault.init()
      // Вже запущено — повертаємо існуючий promise
      if (this._bootstrapPromise) return this._bootstrapPromise
      // Вже ініціалізовано
      if (this.initialized) return

      this._bootstrapPromise = this._doBootstrap()
        .finally(() => {
          this.initialized = true
          this._bootstrapPromise = null
        })

      return this._bootstrapPromise
    },

    async _doBootstrap() {
      // Якщо немає access токена — не намагаємося refresh, просто виходимо
      if (!this.access) {
        return
      }

      // Phase 1.3: On page reload, access is '__cookie__' (session marker).
      // We need a real JWT in memory for WebSocket auth.
      // Trigger a refresh to get real JWT + let backend set fresh cookie.
      if (this.access === '__cookie__') {
        try {
          await this.refreshAccess()
        } catch (err) {
          // Refresh failed — REST API still works via httpOnly cookie,
          // but WS needs real JWT. Log for diagnostics, proceed with cookie auth.
          const status = err?.response?.status
          console.warn('[auth:bootstrap] Initial refresh failed, status:', status,
            '— REST API works via cookie, WS deferred until next refresh cycle')
          // If refresh returned 401/422 — session is truly dead
          if (status === 401 || status === 422) {
            await this.forceLogout('session_expired')
            return
          }
          // For 429/500/network — session is likely valid, continue
        }
      }

      // Завжди перезавантажувати user з API при bootstrap.
      // localStorage cache (this.user) використовується лише для instant render
      // (ініціали, ім'я), але може бути неповним (без first_name/last_name).
      try {
        const raw = await authApi.getCurrentUser({ meta: { skipLoader: true } })
        const user = this._normalizeUser(raw)
        this.user = user
        storage.setUser(user)
      } catch (error) {
        // FIX-1: forceLogout ONLY on 401. Server errors (500) must not kill session.
        const status = error?.response?.status
        if (status === 401) {
          await this.forceLogout('session_expired')
        }
        // Якщо API недоступний але user є з cache — продовжуємо з тим що є
        if (!this.user) return
      }

      // CRITICAL: always start proactive refresh when session exists.
      // Even if initial refresh failed (access='__cookie__'), the next proactive
      // refresh cycle will obtain a real JWT and WS can then connect.
      if (this.user) {
        this.startProactiveRefresh()
        this.initStorageSync()
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

      // Кеш: не перезавантажувати якщо дані свіжі (менше 5 хв)
      const now = Date.now()
      if (this._lastUserFetch && (now - this._lastUserFetch) < this.USER_CACHE_TTL) {
        return this.user
      }

      try {
        const raw = await authApi.getCurrentUser({ meta: { skipLoader: true } })
        const user = this._normalizeUser(raw)
        this.user = user
        this._lastUserFetch = now
        storage.setUser(user)
        return user
      } catch (error) {
        // FIX-2: forceLogout ONLY on 401. 500/network must not kill session.
        const status = error?.response?.status
        if (status === 401) {
          await this.forceLogout('session_expired')
        }
        throw error
      }
    },

    _normalizeUser(user) {
      if (!user || typeof user !== 'object') return user
      if (typeof user.role === 'string') {
        return { ...user, role: user.role.toLowerCase() }
      }
      return user
    },

    async setAuth({ access, user } = {}) {
      if (typeof access !== 'undefined') {
        // Phase 1.3: Keep JWT in memory for WS/beacon auth.
        // httpOnly cookie handles REST API auth.
        // localStorage stores only session marker (not real JWT).
        // Phase 2: JWT encrypted in memory via tokenVault (AES-GCM).
        // Pinia state holds ciphertext; decrypt() required for WS auth.
        if (access && access !== '__cookie__') {
          this.access = await tokenVault.encrypt(access)
        } else {
          this.access = access || null
        }
        if (access) {
          storage.set('auth_session', '1')
          // Migration: remove legacy access token from localStorage
          storage.removeAccess()
          this.sessionExpiredNotified = false
        } else {
          storage.remove('auth_session')
        }
      }

      if (typeof user !== 'undefined') {
        this.user = this._normalizeUser(user) || null
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
      } catch {
        // stores reset failed silently — not critical
      }
    },

    // Cross-tab refresh coordination using BroadcastChannel + localStorage lock
    // Prevents race condition when multiple tabs try to refresh simultaneously
    async _acquireRefreshLock() {
      if (typeof window === 'undefined') return true

      // Try to acquire lock via localStorage (synchronous, atomic within tab)
      const now = Date.now()
      const lockValue = JSON.stringify({ timestamp: now, tabId: this._tabId })

      // Check if lock is held by another tab
      const currentLock = storage.get(REFRESH_LOCK_KEY)
      if (currentLock) {
        try {
          const lock = JSON.parse(currentLock)
          // Lock is valid if not expired
          if (lock.timestamp && (now - lock.timestamp) < REFRESH_LOCK_TTL_MS) {
            // Lock held by another tab - wait and retry
            if (process.env.NODE_ENV === 'development') {
              console.log('[auth] Refresh lock held by other tab, waiting...')
            }
            return false
          }
        } catch {
          // Invalid lock format - can acquire
        }
      }

      // Try to acquire lock
      storage.set(REFRESH_LOCK_KEY, lockValue)

      // Verify we got the lock (race condition check)
      const verifyLock = storage.get(REFRESH_LOCK_KEY)
      if (verifyLock !== lockValue) {
        return false // Another tab got it
      }

      this._refreshLockOwned = true
      if (process.env.NODE_ENV === 'development') {
        console.log('[auth] Refresh lock acquired, proceeding with refresh')
      }
      return true
    },

    _releaseRefreshLock() {
      if (!this._refreshLockOwned) return
      if (typeof window === 'undefined') return

      // Only remove if we still own the lock
      const currentLock = storage.get(REFRESH_LOCK_KEY)
      if (currentLock) {
        try {
          const lock = JSON.parse(currentLock)
          if (lock.tabId === this._tabId) {
            storage.remove(REFRESH_LOCK_KEY)
          }
        } catch {
          storage.remove(REFRESH_LOCK_KEY)
        }
      }
      this._refreshLockOwned = false
    },

    // Generate unique tab ID for cross-tab coordination
    _getTabId() {
      if (typeof window === 'undefined') return 'server'
      if (!window.__m4shTabId) {
        window.__m4shTabId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
      }
      return window.__m4shTabId
    },

    get _tabId() {
      return this._getTabId()
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

      // Store reference to release lock for use in finally block
      const self = this

      this.refreshPromise = (async () => {
        try {
          const res = await authApi.refresh()
          if (!res?.access) {
            throw new Error('Не вдалося оновити токен')
          }

          // Phase 1.3: Keep JWT in memory for WS/beacon auth.
          // httpOnly cookie is set by backend automatically.
          // Phase 2: Encrypt JWT in memory via tokenVault (AES-GCM).
          this.access = await tokenVault.encrypt(res.access)
          storage.set('auth_session', '1')

          if (!this.csrfToken) {
            await this.ensureCsrfToken()
          }
          return this.access
        } finally {
          self._releaseRefreshLock()
        }
      })()

      try {
        return await this.refreshPromise
      } catch (error) {
        const status = error?.response?.status
        if (status === 429) {
          // Exponential backoff for rate limit - starts at 5s, max 5min
          const currentBackoff = this._rateLimitBackoffMs || 5_000
          const nextBackoff = Math.min(currentBackoff * 2, 5 * 60_000)
          this._rateLimitBackoffMs = nextBackoff
          this.lockedUntil = new Date(Date.now() + currentBackoff).toISOString()
          if (process.env.NODE_ENV === 'development') {
            console.log(`[auth] Rate limited, backing off for ${currentBackoff}ms (next: ${nextBackoff}ms)`)
          }
          return null
        }
        // Reset backoff on non-429 errors
        this._rateLimitBackoffMs = null
        throw error
      } finally {
        this.refreshPromise = null
      }
    },

    async fetchCurrentUser() {
      if (!this.access) return null
      try {
        const raw = await authApi.getCurrentUser()
        const user = this._normalizeUser(raw)
        this.user = user
        storage.setUser(user)
        return user
      } catch (error) {
        // FIX-3: forceLogout ONLY on 401.
        const status = error?.response?.status
        if (status === 401) {
          await this.forceLogout()
        }
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
          const newToken = await this.refreshAccess()
          // After successful refresh, ensure WS is connected.
          // If tokenProvider previously returned null (access was '__cookie__'),
          // WS is in CLOSED state with shouldReconnect=false — needs explicit reconnect.
          if (newToken && newToken !== '__cookie__') {
            this._ensureWsConnected()
          }
        } catch (error) {
          // FIX-4: forceLogout ONLY on 401 (token truly dead).
          // 429 = rate limit, 500 = server error, network = glitch — all recoverable.
          const status = error?.response?.status
          if (status === 401) {
            await this.forceLogout()
          }
          // else: skip, try again on next interval
        }
      }, REFRESH_INTERVAL_MS)

      // БАГ №3 FIX: при поверненні до вкладки — відразу перевіряємо токен
      // Без цього після 25+ хв у фоні перший запит дає 401
      if (hasDocument) {
        this._visibilityHandler = async () => {
          if (document.visibilityState !== 'visible') return
          if (!this.access) return
          // Рефрешимо одразу при поверненні — не чекаємо наступного інтервалу
          try {
            const newToken = await this.refreshAccess()
            if (newToken && newToken !== '__cookie__') {
              this._ensureWsConnected()
            }
          } catch (error) {
            // FIX-5: forceLogout ONLY on 401.
            const status = error?.response?.status
            if (status === 401) {
              await this.forceLogout()
            }
            // else: skip — will retry on next visibility change or interval
          }
        }
        document.addEventListener('visibilitychange', this._visibilityHandler)
      }
    },

    /**
     * Ensure WebSocket is connected after token refresh.
     * If WS was closed due to missing token (tokenProvider returned null),
     * this triggers a reconnect with the now-available real JWT.
     */
    async _ensureWsConnected() {
      try {
        const { useRealtimeStore } = await import('../../../stores/realtimeStore')
        const realtimeStore = useRealtimeStore()
        if (realtimeStore.initialized && (realtimeStore.status === 'closed' || realtimeStore.status === 'disconnected')) {
          realtimeStore.connect()
        }
      } catch {
        // realtimeStore may not be initialized yet — not critical
      }
    },

    stopProactiveRefresh() {
      if (refreshInterval) {
        clearInterval(refreshInterval)
        refreshInterval = null
      }
      // БАГ №3 FIX: прибираємо listener при зупинці
      if (hasDocument && this._visibilityHandler) {
        document.removeEventListener('visibilitychange', this._visibilityHandler)
        this._visibilityHandler = null
      }
    },

    async logout() {
      try {
        await authApi.logout()
      } catch (error) {
        // ігноруємо помилку logout, головне очистити стан локально
      }

      await this.forceLogout('manual_logout')

      // Після logout — редирект на сторінку логіну з можливістю повернення
      const returnUrl = sessionStorage.getItem('auth_return_url')
      sessionStorage.removeItem('auth_return_url')

      if (typeof window !== 'undefined') {
        if (returnUrl && returnUrl !== '/login' && returnUrl !== '/start') {
          window.location.href = `/start?redirect=${encodeURIComponent(returnUrl)}`
        } else {
          window.location.href = '/start'
        }
      }
    },

    async forceLogout(reason = 'session_expired') {
      // Зберегти URL для повернення (тільки якщо це не /start)
      const currentPath = typeof window !== 'undefined' ? window.location.pathname : ''
      if (currentPath && currentPath !== '/start' && currentPath !== '/login') {
        sessionStorage.setItem('auth_return_url', currentPath + window.location.search)
      }

      // Зберегти повідомлення для показу після логіну
      if (reason === 'session_expired') {
        sessionStorage.setItem('auth_message', 'session_expired')
      }

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
      this._lastUserFetch = null
      this._bootstrapPromise = null
      this.sessionExpiredNotified = false

      // БАГ №2 FIX: відключаємо WS при logout щоб уникнути отримання чужих подій
      try {
        const { websocketService } = await import('../../../services/websocket')
        websocketService.disconnect()
      } catch (_e) {
        // WS може не бути ініціалізований — це нормально
      }

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
      } catch {
        // stores reset on logout failed silently — not critical
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
      this._storageSyncUnsubscribe?.()
    },

    // Phase 1.3: Cross-tab sync via auth_session marker (not real token)
    initStorageSync() {
      if (typeof window === 'undefined') return () => {}

      const handler = (event) => {
        // Listen for auth_session marker OR legacy access key
        if (event.key === 'auth_session' || event.key === 'access') {
          if (!event.newValue) {
            // Інша вкладка зробила logout — теж виходимо
            this.forceLogout('other_tab_logout')
          } else if (event.key === 'auth_session' && !this.access) {
            // Інша вкладка залогінилась — оновлюємо маркер
            // JWT will be obtained on next refresh cycle
            this.access = '__cookie__'
          }
        }
      }

      window.addEventListener('storage', handler)
      this._storageSyncUnsubscribe = () => window.removeEventListener('storage', handler)
      return this._storageSyncUnsubscribe
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
