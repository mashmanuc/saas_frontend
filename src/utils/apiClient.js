import axios from 'axios'
import { useAuthStore } from '../modules/auth/store/authStore'
import { useLoaderStore } from '../stores/loaderStore'
import { notifyError, notifyWarning } from './notify'

axios.defaults.withCredentials = false

const api = axios.create({
  baseURL: import.meta.env.DEV ? '/api' : (import.meta.env.VITE_API_BASE_URL || '/api'),
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

const createRequestId = () =>
  (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`)

api.interceptors.request.use(
  (config) => {
    const store = useAuthStore()
    const loader = useLoaderStore()
    loader.start()

    config.headers = config.headers || {}

    if (store.access) {
      config.headers.Authorization = `Bearer ${store.access}`
    }

    if (!config.headers['X-Request-Id']) {
      config.headers['X-Request-Id'] = createRequestId()
    }

    const method = String(config.method || 'get').toUpperCase()
    const isStateChanging = method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE'
    if (isStateChanging && store.csrfToken && !config.headers['X-CSRF-Token']) {
      config.headers['X-CSRF-Token'] = store.csrfToken
    }

    return config
  },
  (error) => {
    const loader = useLoaderStore()
    loader.stop()
    return Promise.reject(error)
  }
)

api.interceptors.response.use(
  (res) => {
    const loader = useLoaderStore()
    loader.stop()
    if (res?.config?.meta?.fullResponse) {
      return res
    }
    return res?.data
  },
  async (error) => {
    const loader = useLoaderStore()
    loader.stop()
    const store = useAuthStore()
    const original = error.config || {}

    // Network or CORS problems
    if (!error.response) {
      notifyError('Немає з’єднання з сервером. Перевірте мережу.')
      return Promise.reject(error)
    }

    const status = error.response.status
    const data = error.response?.data
    const requestId = (data && typeof data === 'object' && data.request_id) ? data.request_id : null

    if (status === 429) {
      const retryAfter = error.response?.headers?.['retry-after']
      if (retryAfter) {
        notifyWarning(`Забагато запитів. Спробуйте через ${retryAfter}с.`)
      } else {
        notifyWarning('Забагато запитів. Спробуйте пізніше.')
      }
    }

    const url = original.url || ''
    const isAuthRefresh = url.includes('/v1/auth/refresh')
    const isAuthLogout = url.includes('/v1/auth/logout')

    const notifySessionExpired = () => {
      if (!store.sessionExpiredNotified) {
        notifyWarning('Сесію завершено. Увійдіть знову.')
        store.sessionExpiredNotified = true
      }
    }

    if (status === 401 && !isAuthRefresh && !original._retry) {
      original._retry = true

      try {
        const newAccess = await store.refreshAccess()
        if (!newAccess) throw new Error('refresh_failed')

        original.headers = original.headers || {}
        original.headers.Authorization = `Bearer ${newAccess}`
        return api(original)
      } catch (refreshError) {
        const hadSession = Boolean(store.access)
        await store.forceLogout()
        if (hadSession) {
          notifySessionExpired()
        }
        return Promise.reject(refreshError)
      }
    }

    if (status === 401 && (isAuthRefresh || isAuthLogout || original._retry)) {
      const hadSession = Boolean(store.access)
      await store.forceLogout()
      if (hadSession) {
        notifySessionExpired()
      }
      return Promise.reject(error)
    }

    if (status === 403) {
      notifyError('Доступ заборонено. Зверніться до адміністратора.')
    } else if (status >= 500) {
      notifyError(requestId ? `На сервері сталася помилка. Спробуйте пізніше. request_id: ${requestId}` : 'На сервері сталася помилка. Спробуйте пізніше.')
    }

    return Promise.reject(error)
  }
)

export default api
export const apiClient = api
