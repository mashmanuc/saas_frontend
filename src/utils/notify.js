const subscribers = new Set()
let initialized = false
let cleanupFns = []
let emitHook = null

const createId = () =>
  (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`)

const emit = (type, message, meta) => {
  const payload = {
    id: createId(),
    type,
    message,
    timestamp: Date.now(),
    meta: meta || {},
  }

  if (typeof emitHook === 'function') {
    try {
      emitHook(payload)
    } catch (error) {
      console.error('[notify] onEmit handler failed:', error)
    }
  }

  subscribers.forEach((fn) => {
    try {
      fn(payload)
    } catch (subscriberError) {
      console.error('[notify] subscriber failed:', subscriberError)
    }
  })

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log(`[notify:${type}]`, message)
  }
}

const notifySuccess = (message, meta) => emit('success', message, meta)
const notifyError = (message, meta) => emit('error', message, meta)
const notifyWarning = (message, meta) => emit('warning', message, meta)
const notifyInfo = (message, meta) => emit('info', message, meta)

function exposeDebugHelpers(namespace = '__M4_DEBUG__') {
  if (typeof window === 'undefined') return null
  const host = (window[namespace] = window[namespace] || {})
  host.notifications = {
    emit,
    notifySuccess,
    notifyError,
    notifyWarning,
    notifyInfo,
    subscribers,
  }
  return () => {
    if (host.notifications) {
      delete host.notifications
    }
  }
}

const notifications = {
  subscribe(handler) {
    subscribers.add(handler)
    return () => subscribers.delete(handler)
  },

  init(options = {}) {
    if (initialized) return () => cleanupFns.forEach((fn) => fn?.())
    initialized = true

    const config = {
      exposeDebug: import.meta.env.DEV,
      debugNamespace: '__M4_DEBUG__',
      onEmit: null,
      ...options,
    }

    emitHook = typeof config.onEmit === 'function' ? config.onEmit : null

    if (config.exposeDebug) {
      const debugCleanup = exposeDebugHelpers(config.debugNamespace)
      if (debugCleanup) {
        cleanupFns.push(debugCleanup)
      }
    }

    const teardown = () => {
      cleanupFns.forEach((fn) => {
        try {
          fn?.()
        } catch (error) {
          console.error('[notify] cleanup failed:', error)
        }
      })
      cleanupFns = []
      emitHook = null
      initialized = false
    }

    cleanupFns.push(() => {
      emitHook = null
      initialized = false
    })

    return teardown
  },
}

export { notifications, notifySuccess, notifyError, notifyWarning, notifyInfo }

export default {
  notifications,
  notifySuccess,
  notifyError,
  notifyWarning,
  notifyInfo,
}
