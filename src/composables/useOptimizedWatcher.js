/**
 * Optimized Watcher Composable — v0.14.0
 * Оптимізація watchers для великих структур
 */

import { watch, watchEffect, shallowRef, computed, onUnmounted } from 'vue'
import { debounce, throttle } from '../utils/debounce'

/**
 * Debounced watch - delays callback until source stops changing
 * 
 * @param {WatchSource} source - Watch source
 * @param {Function} callback - Callback function
 * @param {object} options - Watch options + debounceMs
 */
export function useDebouncedWatch(source, callback, options = {}) {
  const { debounceMs = 300, ...watchOptions } = options
  
  const debouncedCallback = debounce(callback, debounceMs)
  
  const stop = watch(source, debouncedCallback, watchOptions)
  
  onUnmounted(() => {
    debouncedCallback.cancel?.()
    stop()
  })
  
  return stop
}

/**
 * Throttled watch - limits callback frequency
 * 
 * @param {WatchSource} source - Watch source
 * @param {Function} callback - Callback function
 * @param {object} options - Watch options + throttleMs
 */
export function useThrottledWatch(source, callback, options = {}) {
  const { throttleMs = 100, ...watchOptions } = options
  
  const throttledCallback = throttle(callback, throttleMs)
  
  const stop = watch(source, throttledCallback, watchOptions)
  
  onUnmounted(() => {
    throttledCallback.cancel?.()
    stop()
  })
  
  return stop
}

/**
 * Shallow watch - only triggers on reference change, not deep mutations
 * Useful for large arrays/objects where you control mutations
 * 
 * @param {WatchSource} source - Watch source (should be shallowRef)
 * @param {Function} callback - Callback function
 * @param {object} options - Watch options
 */
export function useShallowWatch(source, callback, options = {}) {
  return watch(source, callback, { ...options, deep: false })
}

/**
 * Computed with memoization based on specific keys
 * Prevents recalculation when irrelevant properties change
 * 
 * @param {Function} getter - Getter function
 * @param {Function} keyExtractor - Function to extract comparison key
 */
export function useMemoizedComputed(getter, keyExtractor) {
  const cache = shallowRef({ key: null, value: null })
  
  return computed(() => {
    const currentKey = keyExtractor()
    
    if (cache.value.key === currentKey) {
      return cache.value.value
    }
    
    const newValue = getter()
    cache.value = { key: currentKey, value: newValue }
    return newValue
  })
}

/**
 * Watch with change detection - only triggers when actual value changes
 * Useful when source emits same value multiple times
 * 
 * @param {WatchSource} source - Watch source
 * @param {Function} callback - Callback function
 * @param {object} options - Watch options + compareFn
 */
export function useDistinctWatch(source, callback, options = {}) {
  const { compareFn = (a, b) => a === b, ...watchOptions } = options
  
  let previousValue = undefined
  let isFirst = true
  
  return watch(source, (newValue, oldValue) => {
    if (isFirst) {
      isFirst = false
      previousValue = newValue
      callback(newValue, oldValue)
      return
    }
    
    if (!compareFn(newValue, previousValue)) {
      previousValue = newValue
      callback(newValue, oldValue)
    }
  }, watchOptions)
}

/**
 * Batched watch - collects changes and calls callback with batch
 * 
 * @param {WatchSource} source - Watch source
 * @param {Function} callback - Callback receives array of changes
 * @param {object} options - Watch options + batchMs, maxBatchSize
 */
export function useBatchedWatch(source, callback, options = {}) {
  const { batchMs = 50, maxBatchSize = 100, ...watchOptions } = options
  
  const batch = []
  let timer = null
  
  const flush = () => {
    if (batch.length === 0) return
    
    const changes = batch.splice(0, batch.length)
    callback(changes)
    
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }
  
  const stop = watch(source, (newValue, oldValue) => {
    batch.push({ newValue, oldValue, timestamp: Date.now() })
    
    if (batch.length >= maxBatchSize) {
      flush()
      return
    }
    
    if (!timer) {
      timer = setTimeout(flush, batchMs)
    }
  }, watchOptions)
  
  onUnmounted(() => {
    if (timer) {
      clearTimeout(timer)
    }
    stop()
  })
  
  return stop
}

/**
 * Lazy watch - only starts watching after first access
 * Useful for expensive computations that may not be needed
 * 
 * @param {WatchSource} source - Watch source
 * @param {Function} callback - Callback function
 * @param {object} options - Watch options
 */
export function useLazyWatch(source, callback, options = {}) {
  let stop = null
  let started = false
  
  const start = () => {
    if (started) return
    started = true
    stop = watch(source, callback, options)
  }
  
  const stopWatching = () => {
    if (stop) {
      stop()
      stop = null
      started = false
    }
  }
  
  onUnmounted(stopWatching)
  
  return {
    start,
    stop: stopWatching,
    get isWatching() {
      return started
    },
  }
}

/**
 * Watch with idle callback - runs callback when browser is idle
 * Best for non-critical updates
 * 
 * @param {WatchSource} source - Watch source
 * @param {Function} callback - Callback function
 * @param {object} options - Watch options + timeout
 */
export function useIdleWatch(source, callback, options = {}) {
  const { timeout = 1000, ...watchOptions } = options
  
  let idleCallbackId = null
  
  const scheduleCallback = (newValue, oldValue) => {
    if (idleCallbackId) {
      cancelIdleCallback(idleCallbackId)
    }
    
    if (typeof requestIdleCallback === 'function') {
      idleCallbackId = requestIdleCallback(
        () => callback(newValue, oldValue),
        { timeout }
      )
    } else {
      // Fallback for browsers without requestIdleCallback
      setTimeout(() => callback(newValue, oldValue), 0)
    }
  }
  
  const stop = watch(source, scheduleCallback, watchOptions)
  
  onUnmounted(() => {
    if (idleCallbackId) {
      cancelIdleCallback(idleCallbackId)
    }
    stop()
  })
  
  return stop
}

export default {
  useDebouncedWatch,
  useThrottledWatch,
  useShallowWatch,
  useMemoizedComputed,
  useDistinctWatch,
  useBatchedWatch,
  useLazyWatch,
  useIdleWatch,
}
