/**
 * Performance Marks Utility — v0.13.0
 * Profiling marks for measuring app performance
 */

/**
 * Standard performance mark names
 */
export const PERF_MARKS = Object.freeze({
  // App lifecycle
  APP_INIT: 'app:init',
  APP_READY: 'app:ready',
  APP_MOUNTED: 'app:mounted',
  
  // Router
  ROUTE_START: 'route:start',
  ROUTE_END: 'route:end',
  
  // Auth
  AUTH_CHECK_START: 'auth:check:start',
  AUTH_CHECK_END: 'auth:check:end',
  
  // Chat
  CHAT_LOAD_START: 'chat:load:start',
  CHAT_LOAD_END: 'chat:load:end',
  CHAT_SEND_START: 'chat:send:start',
  CHAT_SEND_END: 'chat:send:end',
  
  // WebSocket
  WS_CONNECT_START: 'ws:connect:start',
  WS_CONNECT_END: 'ws:connect:end',
  WS_RECONNECT_START: 'ws:reconnect:start',
  WS_RECONNECT_END: 'ws:reconnect:end',
  
  // Lessons
  LESSONS_LOAD_START: 'lessons:load:start',
  LESSONS_LOAD_END: 'lessons:load:end',
  
  // Dashboard
  DASHBOARD_LOAD_START: 'dashboard:load:start',
  DASHBOARD_LOAD_END: 'dashboard:load:end',
  
  // Board
  BOARD_INIT_START: 'board:init:start',
  BOARD_INIT_END: 'board:init:end',
})

/**
 * Check if Performance API is available
 */
const hasPerformance = typeof performance !== 'undefined' && typeof performance.mark === 'function'

/**
 * Create a performance mark
 * @param {string} name - Mark name
 */
export function mark(name) {
  if (hasPerformance) {
    try {
      performance.mark(name)
    } catch (e) {
      // Ignore errors
    }
  }
}

/**
 * Measure time between two marks
 * @param {string} name - Measure name
 * @param {string} startMark - Start mark name
 * @param {string} endMark - End mark name
 * @returns {number|null} Duration in ms
 */
export function measure(name, startMark, endMark) {
  if (!hasPerformance) return null
  
  try {
    performance.measure(name, startMark, endMark)
    const entries = performance.getEntriesByName(name, 'measure')
    const duration = entries[entries.length - 1]?.duration
    
    if (import.meta.env?.DEV && duration != null) {
      console.log(`[perf] ${name}: ${duration.toFixed(2)}ms`)
    }
    
    return duration ?? null
  } catch (e) {
    // Marks may not exist
    return null
  }
}

/**
 * Clear all marks and measures
 */
export function clearMarks() {
  if (hasPerformance) {
    try {
      performance.clearMarks()
      performance.clearMeasures()
    } catch (e) {
      // Ignore errors
    }
  }
}

/**
 * Get all performance entries
 * @returns {PerformanceEntry[]}
 */
export function getEntries() {
  if (!hasPerformance) return []
  return performance.getEntries()
}

/**
 * Create a scoped timer for measuring async operations
 * @param {string} name - Timer name
 * @returns {{ end: () => number|null }}
 */
export function startTimer(name) {
  const startMark = `${name}:start`
  const endMark = `${name}:end`
  
  mark(startMark)
  
  return {
    end() {
      mark(endMark)
      return measure(name, startMark, endMark)
    },
  }
}

/**
 * Decorator for measuring function execution time
 * @param {string} name - Measure name
 * @returns {Function}
 */
export function withTiming(name) {
  return function (target, propertyKey, descriptor) {
    const originalMethod = descriptor.value
    
    descriptor.value = async function (...args) {
      const timer = startTimer(name)
      try {
        return await originalMethod.apply(this, args)
      } finally {
        timer.end()
      }
    }
    
    return descriptor
  }
}

/**
 * Report performance metrics to console (dev only)
 */
export function reportMetrics() {
  if (!import.meta.env?.DEV) return
  
  const measures = performance.getEntriesByType('measure')
  if (!measures.length) {
    console.log('[perf] No measures recorded')
    return
  }
  
  console.group('[perf] Performance Report')
  measures.forEach((entry) => {
    console.log(`${entry.name}: ${entry.duration.toFixed(2)}ms`)
  })
  console.groupEnd()
}

export default {
  PERF_MARKS,
  mark,
  measure,
  clearMarks,
  getEntries,
  startTimer,
  withTiming,
  reportMetrics,
}
