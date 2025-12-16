/**
 * F29-STEALTH: Autosave Web Worker
 * Handles background saving without blocking main thread
 * 
 * Protocol:
 * Main → Worker: SAVE_DIFF, SAVE_FULL, ABORT_PENDING
 * Worker → Main: ACK_SUCCESS, ACK_QUEUED, ACK_ERROR
 */

// Message types
export interface SaveDiffMsg {
  type: 'SAVE_DIFF'
  sessionId: string
  rev: number
  diff: unknown
  token: string
  baseUrl: string
}

export interface SaveFullMsg {
  type: 'SAVE_FULL'
  sessionId: string
  rev: number
  page: unknown
  token: string
  baseUrl: string
}

export interface AbortPendingMsg {
  type: 'ABORT_PENDING'
}

export type SaveMsg = SaveDiffMsg | SaveFullMsg | AbortPendingMsg

export interface AckSuccessMsg {
  type: 'ACK_SUCCESS'
  sessionId: string
  rev: number
  serverTs: string
  rttMs: number
}

export interface AckQueuedMsg {
  type: 'ACK_QUEUED'
  sessionId: string
  rev: number
}

export interface AckErrorMsg {
  type: 'ACK_ERROR'
  sessionId: string
  rev: number
  code?: number
  retriable: boolean
  message?: string
}

export type AckMsg = AckSuccessMsg | AckQueuedMsg | AckErrorMsg

// Worker state
let currentController: AbortController | null = null
let pendingRequest: { sessionId: string; rev: number } | null = null
let backoffMs = 500
const MAX_BACKOFF_MS = 20000
const BACKOFF_MULTIPLIER = 2

// Backoff helper
function getNextBackoff(): number {
  const current = backoffMs
  backoffMs = Math.min(MAX_BACKOFF_MS, backoffMs * BACKOFF_MULTIPLIER)
  return current
}

function resetBackoff(): void {
  backoffMs = 500
}

// Handle incoming messages
self.onmessage = async (event: MessageEvent<SaveMsg>) => {
  const msg = event.data

  if (msg.type === 'ABORT_PENDING') {
    if (currentController) {
      currentController.abort()
      currentController = null
    }
    pendingRequest = null
    return
  }

  if (msg.type === 'SAVE_DIFF' || msg.type === 'SAVE_FULL') {
    // Abort previous request if still pending (coalescing)
    if (currentController) {
      currentController.abort()
      currentController = null
    }

    currentController = new AbortController()
    pendingRequest = { sessionId: msg.sessionId, rev: msg.rev }

    const startTime = performance.now()

    try {
      // Build payload
      const payload = msg.type === 'SAVE_DIFF'
        ? { diff: msg.diff }
        : { state: { pages: [msg.page], currentPageIndex: 0 } }

      // Use scheduler.postTask if available for background priority
      const doFetch = async () => {
        const response = await fetch(`${msg.baseUrl}/api/solo/sessions/${msg.sessionId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${msg.token}`,
          },
          body: JSON.stringify(payload),
          signal: currentController?.signal,
          keepalive: true,
          credentials: 'include',
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        return response.json()
      }

      // Try to use scheduler API for background priority
      let result: unknown
      if ('scheduler' in self && typeof (self as unknown as { scheduler: { postTask: (fn: () => Promise<unknown>, opts: { priority: string }) => Promise<unknown> } }).scheduler.postTask === 'function') {
        result = await (self as unknown as { scheduler: { postTask: (fn: () => Promise<unknown>, opts: { priority: string }) => Promise<unknown> } }).scheduler.postTask(doFetch, { priority: 'background' })
      } else {
        result = await doFetch()
      }

      const rttMs = performance.now() - startTime
      const data = result as { updated_at?: string }

      // Success
      resetBackoff()
      const ack: AckSuccessMsg = {
        type: 'ACK_SUCCESS',
        sessionId: msg.sessionId,
        rev: msg.rev,
        serverTs: data.updated_at || new Date().toISOString(),
        rttMs,
      }
      self.postMessage(ack)

    } catch (error) {
      const err = error as Error

      // Check if aborted (not an error, just coalesced)
      if (err.name === 'AbortError') {
        return
      }

      // Determine if retriable
      const isNetworkError = err.message.includes('fetch') || err.message.includes('network')
      const isServerError = err.message.includes('5')
      const retriable = isNetworkError || isServerError

      if (retriable) {
        // Queue for retry with backoff
        const delay = getNextBackoff()
        
        const ackQueued: AckQueuedMsg = {
          type: 'ACK_QUEUED',
          sessionId: msg.sessionId,
          rev: msg.rev,
        }
        self.postMessage(ackQueued)

        // Schedule retry
        setTimeout(() => {
          if (pendingRequest?.sessionId === msg.sessionId && pendingRequest?.rev === msg.rev) {
            // Re-send the same message
            self.onmessage?.(event)
          }
        }, delay)

      } else {
        // Non-retriable error
        const ackError: AckErrorMsg = {
          type: 'ACK_ERROR',
          sessionId: msg.sessionId,
          rev: msg.rev,
          code: parseInt(err.message.match(/\d+/)?.[0] || '0'),
          retriable: false,
          message: err.message,
        }
        self.postMessage(ackError)
      }

    } finally {
      currentController = null
    }
  }
}

// Export for type checking (worker context)
export {}
