// WB: useImageCache — lazy image loading with cache, retry, placeholder, fallback
// Ref: TASK_BOARD_PHASES.md A2.3, ManifestWinterboard_v2.md LAW-08
// Features:
// - LRU-bounded cache (Map<url, HTMLImageElement>)
// - Retry with exponential backoff (3 attempts)
// - Loading state per URL for placeholder rendering
// - Broken-image fallback after all retries fail
// - Page-scoped: preloads only current page assets

import { reactive, shallowRef } from 'vue'
import type { WBAsset } from '../types/winterboard'

// ─── Constants ──────────────────────────────────────────────────────────────

const LOG = '[WB:ImageCache]'
const MAX_CACHE_SIZE = 200
const MAX_RETRIES = 3
const RETRY_BASE_MS = 500 // 500ms, 1s, 2s exponential backoff

// ─── Types ──────────────────────────────────────────────────────────────────

export type WBImageLoadState = 'idle' | 'loading' | 'loaded' | 'error'

interface CacheEntry {
  image: HTMLImageElement
  lastAccess: number
}

// ─── Image Cache ────────────────────────────────────────────────────────────

/**
 * Composable for managing image loading with caching, retry, and fallback.
 *
 * Usage:
 * ```ts
 * const cache = useImageCache()
 * const img = cache.get(url) // HTMLImageElement | null
 * const state = cache.getState(url) // 'idle' | 'loading' | 'loaded' | 'error'
 * cache.preloadPageAssets(assets) // preload all images for current page
 * ```
 */
export function useImageCache(onImageLoaded?: () => void) {
  const cache = new Map<string, CacheEntry>()
  const loadStates = reactive(new Map<string, WBImageLoadState>())
  const retryCounters = new Map<string, number>()
  const pendingLoads = new Map<string, AbortController>()

  // ── Version counter for reactivity trigger ────────────────────────

  const version = shallowRef(0)
  function bumpVersion(): void {
    version.value++
    onImageLoaded?.()
  }

  // ── LRU eviction ──────────────────────────────────────────────────

  function evictIfNeeded(): void {
    if (cache.size <= MAX_CACHE_SIZE) return

    // Find oldest entry
    let oldestKey: string | null = null
    let oldestTime = Infinity

    for (const [key, entry] of cache) {
      if (entry.lastAccess < oldestTime) {
        oldestTime = entry.lastAccess
        oldestKey = key
      }
    }

    if (oldestKey) {
      cache.delete(oldestKey)
      loadStates.delete(oldestKey)
      retryCounters.delete(oldestKey)
      console.info(`${LOG} Evicted LRU entry`, { key: oldestKey.slice(0, 60) })
    }
  }

  // ── Load with retry ───────────────────────────────────────────────

  function loadImage(url: string, isRetry = false): void {
    // Skip data URLs — load directly without retry
    if (url.startsWith('data:')) {
      loadDataUrl(url)
      return
    }

    // Already loaded — skip. Already loading — skip unless this is a retry.
    const currentState = loadStates.get(url)
    if (currentState === 'loaded') return
    if (currentState === 'loading' && !isRetry) return

    const retries = retryCounters.get(url) ?? 0
    if (retries >= MAX_RETRIES) {
      // Already exhausted retries
      return
    }

    loadStates.set(url, 'loading')

    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      evictIfNeeded()
      cache.set(url, { image: img, lastAccess: Date.now() })
      loadStates.set(url, 'loaded')
      retryCounters.delete(url)
      pendingLoads.delete(url)
      bumpVersion()
    }

    img.onerror = () => {
      const attempt = (retryCounters.get(url) ?? 0) + 1
      retryCounters.set(url, attempt)
      pendingLoads.delete(url)

      if (attempt < MAX_RETRIES) {
        const delay = RETRY_BASE_MS * Math.pow(2, attempt - 1)
        console.warn(`${LOG} Load failed, retry ${attempt}/${MAX_RETRIES} in ${delay}ms`, {
          url: url.slice(0, 80),
        })
        loadStates.set(url, 'loading')

        setTimeout(() => {
          // Only retry if still needed (not evicted or cleared)
          if (loadStates.get(url) === 'loading') {
            loadImage(url, true)
          }
        }, delay)
      } else {
        loadStates.set(url, 'error')
        console.error(`${LOG} All retries exhausted`, { url: url.slice(0, 80) })
        bumpVersion()
      }
    }

    img.src = url
  }

  function loadDataUrl(url: string): void {
    if (loadStates.get(url) === 'loaded' || loadStates.get(url) === 'loading') return

    loadStates.set(url, 'loading')
    const img = new Image()

    img.onload = () => {
      evictIfNeeded()
      cache.set(url, { image: img, lastAccess: Date.now() })
      loadStates.set(url, 'loaded')
      bumpVersion()
    }

    img.onerror = () => {
      loadStates.set(url, 'error')
      bumpVersion()
    }

    img.src = url
  }

  // ── Public API ────────────────────────────────────────────────────

  /**
   * Get a cached HTMLImageElement for the given URL.
   * If not cached, triggers lazy loading and returns null.
   * Access the `version` ref to make computed properties reactive.
   */
  function get(url: string): HTMLImageElement | null {
    // Touch version for reactivity
    void version.value

    const entry = cache.get(url)
    if (entry) {
      entry.lastAccess = Date.now()
      return entry.image
    }

    // Trigger load if not started
    loadImage(url)
    return null
  }

  /**
   * Get the loading state for a URL.
   */
  function getState(url: string): WBImageLoadState {
    return loadStates.get(url) ?? 'idle'
  }

  /**
   * Check if a URL has failed to load after all retries.
   */
  function isBroken(url: string): boolean {
    return loadStates.get(url) === 'error'
  }

  /**
   * Check if a URL is currently loading.
   */
  function isLoading(url: string): boolean {
    return loadStates.get(url) === 'loading'
  }

  /**
   * Preload all image assets for the current page.
   * Only loads assets not already in cache.
   */
  function preloadPageAssets(assets: WBAsset[]): void {
    for (const asset of assets) {
      if (asset.type === 'image' && asset.src) {
        get(asset.src)
      }
    }
  }

  /**
   * Force retry a broken image.
   */
  function retryLoad(url: string): void {
    retryCounters.delete(url)
    loadStates.delete(url)
    cache.delete(url)
    loadImage(url)
  }

  /**
   * Clear entire cache (e.g. on page change).
   */
  function clear(): void {
    cache.clear()
    loadStates.clear()
    retryCounters.clear()
    pendingLoads.clear()
    bumpVersion()
  }

  /**
   * Get cache stats for debugging.
   */
  function stats(): { size: number; loading: number; errors: number } {
    let loading = 0
    let errors = 0
    for (const state of loadStates.values()) {
      if (state === 'loading') loading++
      if (state === 'error') errors++
    }
    return { size: cache.size, loading, errors }
  }

  return {
    get,
    getState,
    isLoading,
    isBroken,
    preloadPageAssets,
    retryLoad,
    clear,
    stats,
    /** Reactive version counter — use in computed for reactivity */
    version,
  }
}
