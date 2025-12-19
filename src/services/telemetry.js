import apiClient from '../utils/apiClient'

let queue = []
let isFlushing = false
let isDisabled = false

const PRIMARY_ENDPOINT = '/v1/logs/frontend/'
const FALLBACK_ENDPOINT = '/activity/events/'

async function flushQueue() {
  if (isDisabled || isFlushing || !queue.length) return
  isFlushing = true
  const payload = [...queue]
  queue = []
  try {
    // v0.34: canonical logs ingestion endpoint
    // (keep fallback for older deployments)
    try {
      await apiClient.post(PRIMARY_ENDPOINT, { events: payload })
    } catch (primaryError) {
      const status = primaryError?.response?.status
      if (status === 404) {
        await apiClient.post(FALLBACK_ENDPOINT, { events: payload })
      } else {
        throw primaryError
      }
    }
  } catch (error) {
    const status = error?.response?.status
    if (status === 404) {
      isDisabled = true
      queue = []
      isFlushing = false
      return
    }
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
