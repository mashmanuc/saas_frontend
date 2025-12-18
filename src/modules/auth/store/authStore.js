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
    loading: false,
    error: null,
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

      try {
        const { access } = await authApi.login(form)
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

    async register(form) {
      this.loading = true
      this.error = null

      try {
        const { access } = await authApi.register(form)
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

    async acceptInvite(payload) {
      this.loading = true
      this.error = null

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

      if (typeof user !== 'undefined') {
        this.user = user || null
        storage.setUser(this.user)
      }

      this.error = null
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
      this.error = null
      this.loading = false
      this.refreshPromise = null

      storage.clearAll()
    },

    dispose() {
      this.stopProactiveRefresh()
      this.refreshPromise = null
    },

    handleError(error) {
      const data = error?.response?.data

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
