/**
 * Phase 30: Network Tracker — Axios request & duplicate counting
 *
 * Adds a SEPARATE interceptor on apiClient (INV-1: read-only, does NOT modify existing ones).
 *
 * Duplicate detection:
 * - Tracks dedupe keys (URL+params) with timestamps in a sliding window (5s)
 * - A "duplicate" = same dedupe key requested >1 time within the window
 * - Does NOT use _inFlightGets.size — instead tracks actual key reuse
 */
import _apiClient from '@/utils/apiClient'
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios'

// apiClient.d.ts exposes a simplified ApiClient type without interceptors,
// but the runtime value is a full AxiosInstance. Cast for interceptor access.
const apiClient = _apiClient as unknown as AxiosInstance

let _requestCount = 0
let _duplicateCount = 0
let _attached = false

// Sliding window: dedupe key → timestamps of requests within window
const _recentKeys = new Map<string, number[]>()
let _dedupWindowMs = 5_000

/**
 * Build a dedupe key from request config (mirrors apiClient._getDedupeKey logic).
 * We replicate instead of importing to keep INV-1 (no modification of existing code).
 */
function _buildDedupeKey(config: InternalAxiosRequestConfig): string | null {
  if (config.method?.toLowerCase() !== 'get') return null
  const params = config.params
    ? JSON.stringify(config.params, Object.keys(config.params).sort())
    : ''
  return `GET:${config.url}:${params}`
}

export function attachNetworkTracker(windowMs?: number): void {
  if (_attached) return
  _attached = true
  if (windowMs !== undefined) _dedupWindowMs = windowMs

  // Request interceptor — count every request + detect duplicates
  apiClient.interceptors.request.use(
    (config) => {
      _requestCount++

      // Duplicate detection via dedupe key in sliding window
      const key = _buildDedupeKey(config)
      if (key) {
        const now = Date.now()
        const cutoff = now - _dedupWindowMs
        const existing = _recentKeys.get(key)

        if (existing) {
          // Clean expired entries
          const valid = existing.filter(t => t >= cutoff)
          if (valid.length > 0) {
            // Same key was already seen within window → duplicate
            _duplicateCount++
            if (import.meta.env.DEV) {
              console.debug('[audit:dup]', key, `(${valid.length + 1}x in ${_dedupWindowMs}ms)`)
            }
          }
          valid.push(now)
          _recentKeys.set(key, valid)
        } else {
          _recentKeys.set(key, [now])
        }
      }

      return config
    },
    (error) => Promise.reject(error),
  )
}

export function getNetworkStats() {
  return {
    requests: _requestCount,
    duplicates: _duplicateCount,
  }
}

export function resetNetworkStats(): void {
  _requestCount = 0
  _duplicateCount = 0
  _recentKeys.clear()
}

export function detachNetworkTracker(): void {
  _attached = false
  resetNetworkStats()
}
