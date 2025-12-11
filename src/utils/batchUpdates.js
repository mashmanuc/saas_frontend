/**
 * Batch Updates Utility — v0.14.0
 * Throttling rendering при WS бурстах
 */

import { ref, shallowRef, triggerRef, nextTick } from 'vue'

/**
 * Default batch configuration
 */
const DEFAULT_CONFIG = {
  maxBatchSize: 50,
  maxWaitMs: 100,
  throttleMs: 16, // ~60fps
}

/**
 * Create a batched reactive array that throttles updates
 * Useful for high-frequency WS events (chat messages, board updates)
 * 
 * @param {Array} initialValue - Initial array value
 * @param {object} config - Batch configuration
 * @returns {{ items: ShallowRef, push: Function, set: Function, flush: Function }}
 */
export function useBatchedArray(initialValue = [], config = {}) {
  const { maxBatchSize, maxWaitMs, throttleMs } = { ...DEFAULT_CONFIG, ...config }
  
  const items = shallowRef([...initialValue])
  const pendingItems = []
  let flushTimer = null
  let lastFlush = 0
  
  const flush = () => {
    if (pendingItems.length === 0) return
    
    const toAdd = pendingItems.splice(0, pendingItems.length)
    items.value = [...items.value, ...toAdd]
    lastFlush = Date.now()
    
    if (flushTimer) {
      clearTimeout(flushTimer)
      flushTimer = null
    }
  }
  
  const scheduleFlush = () => {
    if (flushTimer) return
    
    const now = Date.now()
    const timeSinceLastFlush = now - lastFlush
    const delay = Math.max(0, throttleMs - timeSinceLastFlush)
    
    flushTimer = setTimeout(() => {
      flushTimer = null
      flush()
    }, delay)
  }
  
  const push = (item) => {
    pendingItems.push(item)
    
    // Flush immediately if batch is full
    if (pendingItems.length >= maxBatchSize) {
      flush()
      return
    }
    
    // Schedule flush
    scheduleFlush()
    
    // Force flush after maxWaitMs
    if (pendingItems.length === 1) {
      setTimeout(() => {
        if (pendingItems.length > 0) {
          flush()
        }
      }, maxWaitMs)
    }
  }
  
  const pushMany = (newItems) => {
    pendingItems.push(...newItems)
    
    if (pendingItems.length >= maxBatchSize) {
      flush()
    } else {
      scheduleFlush()
    }
  }
  
  const set = (newItems) => {
    pendingItems.length = 0
    items.value = [...newItems]
    lastFlush = Date.now()
  }
  
  const clear = () => {
    pendingItems.length = 0
    items.value = []
  }
  
  return {
    items,
    push,
    pushMany,
    set,
    flush,
    clear,
    get pending() {
      return pendingItems.length
    },
  }
}

/**
 * Create a batched reactive map for keyed updates
 * Useful for presence updates, typing indicators
 * 
 * @param {object} initialValue - Initial map value
 * @param {object} config - Batch configuration
 */
export function useBatchedMap(initialValue = {}, config = {}) {
  const { maxBatchSize, maxWaitMs, throttleMs } = { ...DEFAULT_CONFIG, ...config }
  
  const map = shallowRef({ ...initialValue })
  const pendingUpdates = new Map()
  let flushTimer = null
  let lastFlush = 0
  
  const flush = () => {
    if (pendingUpdates.size === 0) return
    
    const updates = Object.fromEntries(pendingUpdates)
    pendingUpdates.clear()
    
    map.value = { ...map.value, ...updates }
    lastFlush = Date.now()
    
    if (flushTimer) {
      clearTimeout(flushTimer)
      flushTimer = null
    }
  }
  
  const scheduleFlush = () => {
    if (flushTimer) return
    
    const now = Date.now()
    const timeSinceLastFlush = now - lastFlush
    const delay = Math.max(0, throttleMs - timeSinceLastFlush)
    
    flushTimer = setTimeout(() => {
      flushTimer = null
      flush()
    }, delay)
  }
  
  const set = (key, value) => {
    pendingUpdates.set(key, value)
    
    if (pendingUpdates.size >= maxBatchSize) {
      flush()
    } else {
      scheduleFlush()
    }
  }
  
  const remove = (key) => {
    pendingUpdates.delete(key)
    const next = { ...map.value }
    delete next[key]
    map.value = next
  }
  
  const reset = (newValue = {}) => {
    pendingUpdates.clear()
    map.value = { ...newValue }
  }
  
  return {
    map,
    set,
    remove,
    reset,
    flush,
    get pending() {
      return pendingUpdates.size
    },
  }
}

/**
 * Throttled state updater for high-frequency updates
 * 
 * @param {any} initialValue - Initial value
 * @param {number} throttleMs - Throttle interval
 */
export function useThrottledState(initialValue, throttleMs = 16) {
  const state = shallowRef(initialValue)
  let pendingValue = initialValue
  let timer = null
  let lastUpdate = 0
  
  const set = (value) => {
    pendingValue = value
    
    const now = Date.now()
    const timeSinceLastUpdate = now - lastUpdate
    
    if (timeSinceLastUpdate >= throttleMs) {
      state.value = pendingValue
      lastUpdate = now
      return
    }
    
    if (!timer) {
      timer = setTimeout(() => {
        timer = null
        state.value = pendingValue
        lastUpdate = Date.now()
      }, throttleMs - timeSinceLastUpdate)
    }
  }
  
  const forceUpdate = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    state.value = pendingValue
    lastUpdate = Date.now()
  }
  
  return {
    state,
    set,
    forceUpdate,
  }
}

/**
 * Request Animation Frame based updater
 * Best for visual updates that need smooth rendering
 */
export function useRAFUpdater() {
  let rafId = null
  let pendingCallback = null
  
  const schedule = (callback) => {
    pendingCallback = callback
    
    if (rafId) return
    
    rafId = requestAnimationFrame(() => {
      rafId = null
      if (pendingCallback) {
        pendingCallback()
        pendingCallback = null
      }
    })
  }
  
  const cancel = () => {
    if (rafId) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    pendingCallback = null
  }
  
  return {
    schedule,
    cancel,
  }
}

export default {
  useBatchedArray,
  useBatchedMap,
  useThrottledState,
  useRAFUpdater,
}
