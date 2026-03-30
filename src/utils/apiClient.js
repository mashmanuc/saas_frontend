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

// Phase 28: GET request deduplication (INV-2: transport-level only)
// If identical GET is already in-flight → reuse its Promise instead of making new HTTP call
// Store TTL decides WHETHER to fetch. This decides WHETHER to make a new HTTP request.
const _inFlightGets = new Map()

export function _getDedupeKey(config) {
  if (config.method?.toLowerCase() !== 'get') return null
  const params = config.params ? JSON.stringify(config.params, Object.keys(config.params).sort()) : ''
  return `GET:${config.url}:${params}`
}

let isRefreshingToken = false
let isRefreshingCsrf = false
const refreshQueue = []

// ── Global Circuit Breaker ──────────────────────────────────────────────
// Prevents self-DDOS: if backend is unreachable, stop ALL non-essential requests.
// Resets on: network recovery (online event), manual retry, or cooldown expiry.
const CIRCUIT_BREAKER_THRESHOLD = 5      // consecutive network failures to trip
const CIRCUIT_BREAKER_COOLDOWN_MS = 30_000  // 30s pause before retry
let _cbFailures = 0
let _cbOpen = false
let _cbTimer = null

function _cbRecordFailure() {
  _cbFailures++
  if (_cbFailures >= CIRCUIT_BREAKER_THRESHOLD && !_cbOpen) {
    _cbOpen = true
    console.warn(
      `[apiClient] Circuit breaker OPEN: ${_cbFailures} consecutive network failures. ` +
      `Blocking requests for ${CIRCUIT_BREAKER_COOLDOWN_MS / 1000}s`,
    )
    // Emit event so UI can show "offline" banner
    window.dispatchEvent(new CustomEvent('api:circuit-open'))

    _cbTimer = setTimeout(() => {
      _cbOpen = false
      _cbFailures = 0
      _cbTimer = null
      console.info('[apiClient] Circuit breaker CLOSED — resuming requests')
      window.dispatchEvent(new CustomEvent('api:circuit-close'))
    }, CIRCUIT_BREAKER_COOLDOWN_MS)
  }
}

function _cbRecordSuccess() {
  if (_cbFailures > 0) {
    _cbFailures = 0
    if (_cbOpen) {
      _cbOpen = false
      if (_cbTimer) { clearTimeout(_cbTimer); _cbTimer = null }
      console.info('[apiClient] Circuit breaker CLOSED — backend responsive')
      window.dispatchEvent(new CustomEvent('api:circuit-close'))
    }
  }
}

// Reset circuit breaker on network recovery
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    _cbFailures = 0
    if (_cbOpen) {
      _cbOpen = false
      if (_cbTimer) { clearTimeout(_cbTimer); _cbTimer = null }
      console.info('[apiClient] Circuit breaker RESET — network back online')
      window.dispatchEvent(new CustomEvent('api:circuit-close'))
    }
  })
}

/** Check if circuit breaker is open (for external consumers like autosave/replay) */
export function isCircuitBreakerOpen() {
  return _cbOpen
}

/** Force reset circuit breaker (manual retry button) */
export function resetCircuitBreaker() {
  _cbFailures = 0
  _cbOpen = false
  if (_cbTimer) { clearTimeout(_cbTimer); _cbTimer = null }
  window.dispatchEvent(new CustomEvent('api:circuit-close'))
}

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

    // Circuit breaker: reject non-essential requests when backend is unreachable
    if (_cbOpen && !config.meta?.bypassCircuitBreaker) {
      if (!config.meta?.skipLoader) loader.stop()
      return Promise.reject(new axios.Cancel('[apiClient] Circuit breaker open — request blocked'))
    }

    // Пропускаємо loader для фонових запитів (polling, тощо)
    if (!config.meta?.skipLoader) {
      loader.start()
    }

    config.headers = config.headers || {}
    config.withCredentials = true

    // Phase 1.3: Access token is now in httpOnly cookie.
    // Cookie is sent automatically with withCredentials:true.
    // Authorization header removed — no longer exposing token to JS.

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

    // Phase 28: GET dedup — attach dedup key to config for adapter
    const dedupeKey = _getDedupeKey(config)
    if (dedupeKey) {
      config._dedupeKey = dedupeKey
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

    // Circuit breaker: backend responded → record success
    _cbRecordSuccess()

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

    // Network or CORS problems (also includes server timeout / 5xx from proxy)
    if (!error.response) {
      _cbRecordFailure()
      notifyError("Немає з’єднання з сервером. Перевірте мережу.")
      return Promise.reject(error)
    }

    // Record success for circuit breaker (server responded, even with error)
    // Only network failures count against the breaker
    _cbRecordSuccess()

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

    // 429 rate-limit: log quietly, do NOT show toast to user.
    // Background store fetches (billing, entitlements, sessions) cause bursts
    // on page load that hit rate limits — notifying the user is confusing UX.
    if (status === 429) {
      const retryAfter = error.response?.headers?.['retry-after']
      console.warn(`[API] 429 Rate limited: ${original.url}${retryAfter ? ` (retry-after: ${retryAfter}s)` : ''}`)
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
            // Phase 1.3: Cookie auto-sent with retry, no Authorization header needed
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
        // Phase 1.3: Cookie auto-sent with retry, no Authorization header needed
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

        // FIX-7: forceLogout when refresh returns 401 or 422 (token truly dead).
        // 422 = unprocessable (expired/invalid refresh token) — same outcome.
        // 500 from refresh = server temporarily down, session may still be valid.
        if (refreshStatus === 401 || refreshStatus === 422) {
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

// Phase 28: GET dedup adapter (INV-2: transport-level dedup)
// FIX: axios 1.x adapter is an array of strings ['xhr','http','fetch'], not a function.
// Use axios.getAdapter() to resolve the correct adapter function.
// Fallback: in test environments axios.getAdapter may not exist — use raw adapter.
const _resolvedAdapter = typeof axios.getAdapter === 'function'
  ? axios.getAdapter(api.defaults.adapter || axios.defaults.adapter)
  : (typeof api.defaults.adapter === 'function' ? api.defaults.adapter : (config) => Promise.resolve({ data: {}, status: 200, config }))
api.defaults.adapter = function dedupAdapter(config) {
  const key = config._dedupeKey
  if (!key) {
    return _resolvedAdapter.call(this, config)
  }

  const existing = _inFlightGets.get(key)
  if (existing) {
    if (import.meta.env.DEV) {
      console.debug('[FETCH:dedup]', key, 'REUSED in-flight')
    }
    return existing.then(
      response => ({ ...response, config }),
      error => Promise.reject(error)
    )
  }

  if (import.meta.env.DEV) {
    console.debug('[FETCH:dedup]', key, 'NEW request')
  }

  const promise = _resolvedAdapter.call(this, config)
  _inFlightGets.set(key, promise)

  const cleanup = () => { _inFlightGets.delete(key) }
  promise.then(cleanup, cleanup)

  return promise
}

export default api
export const apiClient = api
