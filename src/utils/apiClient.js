import axios from 'axios'
import { useAuthStore } from '../modules/auth/store/authStore'
import { useLoaderStore } from '../stores/loaderStore'
import { notifyError, notifyWarning } from './notify'
import { isAuthDead } from '../core/auth/onAuthDeath'

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
  // Phase RS PR-RS-C2 (2026-05-01): explicit request timeout 30s.
  // axios default = NO timeout → hung requests block loader indefinitely
  // → safety timer (loaderStore) fires at 60s → INV-FE-4 violate emit.
  // 30s ceiling: server SLA accommodates slow networks + heavy endpoints
  // (PDF import, large session loads); aligned з safety timer threshold (60s).
  timeout: 30_000,
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

// PR2 (2026-04-26) → Phase 2 (2026-04-27 SSOT §7 + AUTH MODEL CORRECTION):
// Proactive auth refresh guard.
//
// Phase 2: BE V1AuthRefreshView повертає `exp` (Unix seconds) у refresh response.
// FE caches у authStore.accessExp. Guard fire'иться при
//     now > (accessExp * 1000 - REFRESH_BUFFER_MS)
// → 60-секундний buffer для network/visibility/upload race.
//
// Fallback (legacy session pre-Phase 1 BE deploy АБО exp not yet captured):
// timestamp proxy `lastRefreshAt + REFRESH_PROACTIVE_FALLBACK_MS` (45-хв legacy).
// Phase 3+ після prod migration complete — fallback може бути deleted.
const REFRESH_BUFFER_MS = 60 * 1000  // 60s ДО expiry per SSOT §7
const REFRESH_PROACTIVE_FALLBACK_MS = 45 * 60 * 1000  // legacy timestamp proxy (no-exp sessions)

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
  async (config) => {
    const store = useAuthStore()
    const loader = useLoaderStore()

    // Circuit breaker: reject non-essential requests when backend is unreachable.
    // Phase RS PR-RS-C2: REMOVED orphan loader.stop() — request hadn't called
    // .start() yet (line 222 ahead), so stop here decremented OTHER concurrent
    // requests' counter prematurely → loader UI flickered while real reqs
    // pending. Rejection now rouтується через response error handler (line 287)
    // which checks meta.skipLoader та decrements ONLY якщо matching start fired.
    if (_cbOpen && !config.meta?.bypassCircuitBreaker) {
      return Promise.reject(new axios.Cancel('[apiClient] Circuit breaker open — request blocked'))
    }

    // P0.0: Auth death guard — reject non-auth requests after forceLogout
    // Prevents zombie retry storms from replay recorder, polling, etc.
    // Auth endpoints (login, register, refresh, csrf) bypass — needed for recovery.
    // Phase RS PR-RS-C2: same removal as CB block above (orphan stop fix).
    const _url = config.url || ''
    const _isAuthEndpoint = _url.includes('/auth/')
    if (isAuthDead() && !_isAuthEndpoint && !config.meta?.bypassAuthDeath) {
      return Promise.reject(new axios.Cancel('[apiClient] Auth dead — request blocked'))
    }

    // Phase 2 (2026-04-27) per SSOT §7 + AUTH MODEL CORRECTION:
    // Proactive auth refresh guard. Refresh ДО того як BE поверне 401.
    //
    // Primary path (post-Phase 1 BE deploy): use `accessExp` Unix seconds.
    //   stale := now > (accessExp * 1000 - REFRESH_BUFFER_MS)
    //   accuracy: ~60s ДО real expiry (per SSOT §7 buffer).
    //
    // Fallback (no exp yet — bootstrap, legacy session, або BE response без exp):
    //   timestamp proxy `lastRefreshAt + REFRESH_PROACTIVE_FALLBACK_MS` (45m).
    //
    // Edge case `!lastRefreshAt && !accessExp` — після login token щойно отриманий,
    // race conditions можуть лишити обидва на 0. Guard fire'иться (краще зайвий
    // refresh ніж 401).
    //
    // Skip:
    //   - /auth/* — щоб не зациклити refresh request сам на себе
    //   - access='__cookie__' — bootstrap сам викличе refreshAccess()
    //   - isRefreshingToken=true — mutex, інший call вже в процесі
    const _hasRealAccess = store.access && store.access !== '__cookie__'
    let _stale = false
    if (typeof store.accessExp === 'number' && store.accessExp > 0) {
      // Primary: dynamic guard з real exp claim
      const _refreshAtMs = store.accessExp * 1000 - REFRESH_BUFFER_MS
      _stale = Date.now() > _refreshAtMs
    } else {
      // Fallback: legacy timestamp proxy (45m hard-code preserved for migration)
      _stale = !store.lastRefreshAt
        || Date.now() - store.lastRefreshAt > REFRESH_PROACTIVE_FALLBACK_MS
    }
    if (_hasRealAccess && _stale && !_isAuthEndpoint && !isRefreshingToken) {
      try {
        await store.refreshAccess()
      } catch {
        // Якщо refresh fail — reactive 401 handler підхопить original request.
        // Не блокуємо тут, щоб не ламати retry-flow.
      }
    }

    // Пропускаємо loader для фонових запитів (polling, тощо).
    // Phase RS PR-RS-C2 (2026-05-01): track flag _loaderStarted on config щоб
    // downstream stop callsites могли verify matching start fired (uniform
    // balance enforcement). Старе поведінка дозволяла orphan stops у CB/auth-
    // dead/request-rejected paths → premature decrements.
    if (!config.meta?.skipLoader) {
      loader.start()
      config.meta = config.meta || {}
      config.meta._loaderStarted = true
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
    // PR-RS-C2: stop ONLY якщо matching start fired (flag-tracked balance).
    // Combined check: !skipLoader AND _loaderStarted — handles retry path
    // (skipLoader=true overrides inherited flag from first attempt).
    if (
      !error?.config?.meta?.skipLoader
      && error?.config?.meta?._loaderStarted
    ) {
      loader.stop()
      error.config.meta._loaderStarted = false  // mark consumed (prevent double-stop)
    }
    return Promise.reject(error)
  }
)

api.interceptors.response.use(
  (res) => {
    const loader = useLoaderStore()
    // PR-RS-C2: flag-balanced stop (combined skipLoader + _loaderStarted check).
    if (
      !res?.config?.meta?.skipLoader
      && res?.config?.meta?._loaderStarted
    ) {
      loader.stop()
      res.config.meta._loaderStarted = false  // mark consumed
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
    // PR-RS-C2: flag-balanced stop. Skips orphan stops для CB-blocked /
    // auth-dead requests rejected ДО loader.start() reached.
    if (
      !error?.config?.meta?.skipLoader
      && error?.config?.meta?._loaderStarted
    ) {
      loader.stop()
      error.config.meta._loaderStarted = false  // mark consumed
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
        // P2.0: Track refresh success for fail rate calculation
        import('./telemetryAgent').then(
          m => m.trackEvent('auth.refresh.success'),
        ).catch(() => {})
        // Phase 1.3: Cookie auto-sent with retry, no Authorization header needed
        // FIX: Позначаємо retry-запит щоб request interceptor не робив зайвий loader.start()
        // (loader.stop() для оригінального запиту вже відбувся вище)
        if (!original.meta) original.meta = {}
        original.meta.skipLoader = true
        return api(original)
      } catch (refreshError) {
        flushRefreshQueue(refreshError, null)
        const refreshStatus = refreshError?.response?.status
        // P2.0: Track refresh failures for cascade detection
        import('./telemetryAgent').then(
          m => m.trackEvent('auth.refresh.fail', { status: refreshStatus }),
        ).catch(() => {})
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

    // Phase 2 (2026-04-27) — duplicate UX suppression per agent-A directive Section E:
    // Winterboard ops_sync error codes (PROTOCOL_VERSION_MISMATCH / SERVER_BUSY /
    // SEQ_MISMATCH) handled by dedicated UI gates (ProtocolMismatchModal /
    // DesyncRecoveryBanner) wired through opsSyncStore.mode watch. Generic
    // notifyError() on top of those gates = duplicate UX. Suppress тут.
    //
    // Detection: error.response.data.error string match. Status:
    //   - 503 SERVER_BUSY     — would otherwise hit `status >= 500` toast
    //   - 400 PROTOCOL_VERSION_MISMATCH — already silent (400 не у toast branch)
    //   - 409 SEQ_MISMATCH    — already silent (409 не у toast branch)
    //
    // Suppression covers всі 3 для consistency якщо future додасть 5xx variants.
    const _opsSyncErrorCode = data && typeof data === 'object'
      ? data.error
      : null
    const _isOpsSyncGatedError =
      _opsSyncErrorCode === 'PROTOCOL_VERSION_MISMATCH' ||
      _opsSyncErrorCode === 'SERVER_BUSY' ||
      _opsSyncErrorCode === 'SEQ_MISMATCH'

    if (_isOpsSyncGatedError) {
      // Skip generic notify — UI gate handles via opsSyncStore mode watch
      return Promise.reject(error)
    }

    // ── INV-22 PR-1b — single-purpose toast suppression for finalize barrier ──
    //
    // FORBIDDEN: Adding new opt-out flags or expanding _finalizeBarrierToastSuppressed
    //            to other endpoints WITHOUT explicit SSOT review. Per OPS_SYNC_SSOT.md
    //            INV-22 §22.7 + LAW §12 spirit: transport-layer error semantics must
    //            stay strict; per-endpoint UX overrides become slippery slope where
    //            "every service mutes its own errors" → users miss real failures.
    //
    // Allowed use: ONLY у `finalizeWithBarrier()` helper (api/replay.ts) — flag
    // suppresses the generic 5xx toast for 504 APPLY_BACKLOG_TIMEOUT because the
    // caller renders its own blocking modal з retry UX.
    //
    // If you find yourself wanting to add another flag here for another endpoint
    // → STOP, write SSOT for that case, get review, then add explicit named flag
    // (NOT a generic array of "skip these statuses").
    const isFinalizeBarrierTimeout = (
      original?._finalizeBarrierToastSuppressed === true && status === 504
    )

    if (status === 403) {
      notifyError('Доступ заборонено. Зверніться до адміністратора.')
    } else if (status >= 500 && !isFinalizeBarrierTimeout) {
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
