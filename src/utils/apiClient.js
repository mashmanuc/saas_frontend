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
    ? (import.meta.env.VITE_API_BASE_URL || 'https://api.m4sh.org/api')
    : '/api',  // Local: через Vite proxy
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

let isRefreshingToken = false
let isRefreshingCsrf = false
const refreshQueue = []

/**
 * Detect backend csrf:missing / csrf:invalid validation error.
 * Backend returns 400 with body like {"csrf": ["missing"]} or {"csrf": ["invalid"]}.
 */
const isCsrfError = (error) => {
  const status = error?.response?.status
  if (status !== 400) return false
  const data = error?.response?.data
  if (!data || typeof data !== 'object') return false
  const csrfField = data.csrf || data.fields?.csrf
  if (!Array.isArray(csrfField)) return false
  return csrfField.some(msg => typeof msg === 'string' && (msg === 'missing' || msg === 'invalid'))
}

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
    // Пропускаємо loader для фонових запитів (polling, тощо)
    if (!config.meta?.skipLoader) {
      loader.start()
    }

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
    if (!error?.config?.meta?.skipLoader) {
      loader.stop()
    }
    return Promise.reject(error)
  }
)

api.interceptors.response.use(
  (res) => {
    const loader = useLoaderStore()
    if (!res?.config?.meta?.skipLoader) {
      loader.stop()
    }
    
    if (res?.config?.meta?.fullResponse) {
      return res
    }
    return res?.data
  },
  async (error) => {
    const loader = useLoaderStore()
    if (!error?.config?.meta?.skipLoader) {
      loader.stop()
    }
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

    // CSRF auto-retry: if backend returns csrf:missing/invalid, refresh token and retry once
    if (isCsrfError(error) && !original._csrfRetry) {
      original._csrfRetry = true
      try {
        if (!isRefreshingCsrf) {
          isRefreshingCsrf = true
          await store.ensureCsrfToken()
          isRefreshingCsrf = false
        }
        // Re-attach fresh CSRF token
        const freshCsrf = getCookie('csrf') || getCookie('csrftoken') || store.csrfToken
        if (freshCsrf) {
          original.headers = original.headers || {}
          original.headers['X-CSRF-Token'] = freshCsrf
        }
        if (!original.meta) original.meta = {}
        original.meta.skipLoader = true
        return api(original)
      } catch (csrfErr) {
        isRefreshingCsrf = false
        // CSRF refresh failed — fall through to normal error handling
      }
    }

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
        // Session already cleared (e.g. by a previous forceLogout).
        // Notify user so they know why their action failed.
        notifySessionExpired()
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
            // FIX: skipLoader для retry — original вже зробив stop()
            if (!original.meta) original.meta = {}
            original.meta.skipLoader = true
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
        // FIX: Позначаємо retry-запит щоб request interceptor не робив зайвий loader.start()
        // (loader.stop() для оригінального запиту вже відбувся вище)
        if (!original.meta) original.meta = {}
        original.meta.skipLoader = true
        return api(original)
      } catch (refreshError) {
        flushRefreshQueue(refreshError, null)
        const refreshStatus = refreshError?.response?.status
        // If refresh is rate-limited, do not destroy session state.
        // Let the original request fail; next user action can retry.
        if (refreshStatus === 429) {
          return Promise.reject(error)
        }

        // FIX: Не робити forceLogout при мережевій помилці або відсутності інтернету
        if (!navigator.onLine || !refreshError?.response) {
          return Promise.reject(refreshError)
        }

        // FIX-7: forceLogout ONLY when refresh returns 401 (token truly dead).
        // 500 from refresh = server temporarily down, session may still be valid.
        if (refreshStatus === 401) {
          const hadSession = Boolean(store.access)
          await store.forceLogout('session_expired')
          if (hadSession) {
            notifySessionExpired()
            try {
              const { default: router } = await import('../router')
              router.push('/start')
            } catch { /* navigation may fail if already at /start */ }
          }
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
        try {
          const { default: router } = await import('../router')
          router.push('/start')
        } catch { /* navigation may fail if already at /start */ }
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
