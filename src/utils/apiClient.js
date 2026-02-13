import axios from 'axios'
import { useAuthStore } from '../modules/auth/store/authStore'
import { useLoaderStore } from '../stores/loaderStore'
import { notifyError, notifyWarning } from './notify'

// Debug recorder (only in debug mode)
let debugRecorder = null
if (import.meta.env.VITE_CALENDAR_DEBUG === 'true') {
  import('../modules/booking/debug/services/calendarDebugRecorder').then(module => {
    debugRecorder = module.calendarDebugRecorder
    if (debugRecorder && api) {
      debugRecorder.attachAxiosInterceptors(api)
    }
  })
}

// NOTE: do not set global axios defaults; the API instance below controls credentials

const isProduction = !import.meta.env.DEV

const api = axios.create({
  baseURL: isProduction 
    ? 'https://saas-backend-rough-dawn-1961.fly.dev/api'  // Production: прямо на backend
    : '/api',  // Local: через Vite proxy
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

let isRefreshingToken = false
const refreshQueue = []

const enqueueRequestWhileRefreshing = (callback) => {
  refreshQueue.push(callback)
}

const flushRefreshQueue = (error, token) => {
  while (refreshQueue.length) {
    const queued = refreshQueue.shift()
    queued?.(error, token)
  }
}

const getCookie = (name) => {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

const createRequestId = () =>
  (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`)

api.interceptors.request.use(
  (config) => {
    const store = useAuthStore()
    const loader = useLoaderStore()
    loader.start()

    config.headers = config.headers || {}
    config.withCredentials = true

    if (store.access) {
      config.headers.Authorization = `Bearer ${store.access}`
    }

    if (!config.headers['X-Request-Id']) {
      config.headers['X-Request-Id'] = createRequestId()
    }

    const method = String(config.method || 'get').toUpperCase()
    const isStateChanging = method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE'
    if (isStateChanging && !config.headers['X-CSRF-Token']) {
      // Спочатку беремо з cookies, потім з store (cookies - більш надійне джерело)
      const csrfToken = getCookie('csrf') || getCookie('csrftoken') || store.csrfToken
      if (csrfToken) {
        config.headers['X-CSRF-Token'] = csrfToken
      }
    }

    // Guard: prevent double /api/api prefix (v0.59 fix)
    if (config.url && config.url.startsWith('/api/')) {
      if (import.meta.env.DEV) {
        console.debug('[apiClient] Adjusting API path (removed /api prefix):', config.url)
      }
      config.url = config.url.replace(/^\/api/, '')
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
    const isAuthRefresh = url.includes('/auth/refresh')
    const isAuthLogout = url.includes('/auth/logout')

    const notifySessionExpired = () => {
      if (!store.sessionExpiredNotified) {
        notifyWarning('Сесію завершено. Увійдіть знову.')
        store.sessionExpiredNotified = true
      }
    }

    if (status === 401 && !isAuthRefresh && !isAuthLogout) {
      if (!store.access) {
        return Promise.reject(error)
      }

      if (isRefreshingToken) {
        original._retry = true
        return new Promise((resolve, reject) => {
          enqueueRequestWhileRefreshing((queueError, newToken) => {
            if (queueError || !newToken) {
              reject(queueError || new Error('refresh_failed'))
              return
            }
            original.headers = original.headers || {}
            original.headers.Authorization = `Bearer ${newToken}`
            resolve(api(original))
          })
        })
      }

      original._retry = true
      isRefreshingToken = true

      try {
        const newAccess = await store.refreshAccess()
        if (!newAccess) {
          throw new Error('refresh_failed')
        }

        flushRefreshQueue(null, newAccess)
        original.headers = original.headers || {}
        original.headers.Authorization = `Bearer ${newAccess}`
        return api(original)
      } catch (refreshError) {
        flushRefreshQueue(refreshError, null)
        const refreshStatus = refreshError?.response?.status
        // If refresh is rate-limited, do not destroy session state.
        // Let the original request fail; next user action can retry.
        if (refreshStatus === 429) {
          return Promise.reject(error)
        }

        const hadSession = Boolean(store.access)
        await store.forceLogout()
        if (hadSession) {
          notifySessionExpired()
        }
        return Promise.reject(refreshError)
      } finally {
        isRefreshingToken = false
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
