import { defineStore } from 'pinia'
import authApi from '../api/authApi'
import { storage } from '../../../utils/storage'

const hasDocument = typeof document !== 'undefined'
const REFRESH_INTERVAL_MS = 25 * 60 * 1000
let refreshInterval = null

export const useAuthStore = defineStore('auth', {
  state: () => ({
    access: storage.getAccess(),
    refresh: storage.getRefresh(),
    user: storage.getUser(),
    loading: false,
    error: null,
    lastErrorCode: null,
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

      try {
        const { access, refresh, user } = await authApi.login(form)
        this.setAuth({ access, refresh, user })
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

    async register(form) {
      this.loading = true
      this.error = null
      this.lastErrorCode = null

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

      try {
        const { access } = await authApi.acceptInvite(payload)
        this.setAuth({ access })
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

      if (typeof arguments[0]?.refresh !== 'undefined') {
        this.refresh = arguments[0].refresh || null
        storage.setRefresh(this.refresh)
      }

      if (typeof user !== 'undefined') {
        this.user = user || null
        storage.setUser(this.user)
      }

      this.error = null
      this.lastErrorCode = null
    },

    async refreshAccess() {
      if (this.refreshPromise) {
        return this.refreshPromise
      }

      if (!this.refresh) {
        throw new Error('refresh_missing')
      }

      this.refreshPromise = (async () => {
        const res = await authApi.refresh({ refresh: this.refresh })
        if (!res?.access) {
          throw new Error('Не вдалося оновити токен')
        }

        this.access = res.access
        storage.setAccess(this.access)

        if (res.refresh) {
          this.refresh = res.refresh
          storage.setRefresh(this.refresh)
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
        if (this.refresh) {
          await authApi.logout({ refresh: this.refresh })
        } else {
          await authApi.logout()
        }
      } catch (error) {
        // ігноруємо помилку logout, головне очистити стан локально
      }

      await this.forceLogout()
    },

    async forceLogout() {
      this.stopProactiveRefresh()
      this.access = null
      this.refresh = null
      this.user = null
      this.error = null
      this.lastErrorCode = null
      this.loading = false
      this.refreshPromise = null

      storage.clearAll()
    },

    dispose() {
      this.stopProactiveRefresh()
      this.refreshPromise = null
    },

    handleError(error) {
      const status = error?.response?.status
      const data = error?.response?.data

      this.lastErrorCode = null

      if (status === 429) {
        this.lastErrorCode = 'rate_limited'
        this.error = 'Забагато запитів. Спробуйте пізніше.'
        return
      }

      if (status === 401 && data && typeof data === 'object' && typeof data.error === 'string') {
        if (data.error === 'email_not_verified') {
          this.lastErrorCode = 'email_not_verified'
          this.error = 'Email не підтверджено.'
          return
        }
        if (data.error === 'invalid_credentials') {
          this.lastErrorCode = 'invalid_credentials'
          this.error = 'Невірний email або пароль.'
          return
        }
      }

      if (status === 422 && data && typeof data === 'object' && data.error === 'validation_failed') {
        this.lastErrorCode = 'validation_failed'
        const firstKey = data.fields ? Object.keys(data.fields)[0] : null
        const firstVal = firstKey ? data.fields[firstKey] : null
        if (Array.isArray(firstVal) && firstVal.length) {
          this.error = String(firstVal[0])
          return
        }
        this.error = 'Перевірте дані.'
        return
      }

      if (!data) {
        this.error = 'Невідома помилка. Спробуйте ще раз.'
        return
      }

      if (data.detail) {
        this.error = data.detail
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
