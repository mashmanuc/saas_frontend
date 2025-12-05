const subscribers = new Set()

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

  subscribers.forEach((fn) => {
    try {
      fn(payload)
    } catch {
      // ignore listener errors
    }
  })

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log(`[notify:${type}]`, message)
  }
}

const notifications = {
  subscribe(handler) {
    subscribers.add(handler)
    return () => subscribers.delete(handler)
  },
}

const notifySuccess = (message, meta) => emit('success', message, meta)
const notifyError = (message, meta) => emit('error', message, meta)
const notifyWarning = (message, meta) => emit('warning', message, meta)
const notifyInfo = (message, meta) => emit('info', message, meta)

export { notifications, notifySuccess, notifyError, notifyWarning, notifyInfo }

export default {
  notifications,
  notifySuccess,
  notifyError,
  notifyWarning,
  notifyInfo,
}
