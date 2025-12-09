import apiClient from '../utils/apiClient'

let queue = []
let isFlushing = false

async function flushQueue() {
  if (isFlushing || !queue.length) return
  isFlushing = true
  const payload = [...queue]
  queue = []
  try {
    await apiClient.post('/activity/events/', { events: payload })
  } catch (error) {
    console.error('[telemetry] failed to flush events', error)
    queue = [...payload, ...queue].slice(-50)
  } finally {
    isFlushing = false
  }
}

export const telemetry = {
  trigger(action, metadata = {}) {
    if (!action) return
    const event = {
      action,
      metadata,
      timestamp: new Date().toISOString(),
    }

    if (import.meta.env.DEV) {
      console.info('[telemetry]', action, metadata)
    }

    queue.push(event)
    if (queue.length >= 5) {
      flushQueue()
    } else {
      setTimeout(flushQueue, 200)
    }
  },
}
