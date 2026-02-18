// WB: Presence composable — WebSocket cursor sync + online users
// Ref: TASK_BOARD.md A3.2, ManifestWinterboard_v2.md LAW-16
// Protocol: ws/winterboard/{sessionId}/ (AGENT-C C2.3)
// Events: presence.join, presence.leave, cursor.update

import { ref, reactive, computed, onUnmounted, type Ref } from 'vue'
import type { WBRemoteCursor, WBToolType } from '../types/winterboard'

// ─── Constants ──────────────────────────────────────────────────────────────

const LOG_PREFIX = '[WB:Presence]'
const CURSOR_THROTTLE_MS = 50        // Max 20 cursor updates/s (LAW-16)
const VIEWPORT_THROTTLE_MS = 100     // Max 10 viewport updates/s (A5.2)
const RECONNECT_MAX_ATTEMPTS = 3     // Max auto-reconnect attempts
const RECONNECT_BASE_MS = 1_000      // Exponential backoff base
const RECONNECT_MAX_MS = 8_000       // Max backoff delay
const STALE_CHECK_INTERVAL_MS = 2_000 // Check for stale cursors
const STALE_THRESHOLD_MS = 5_000     // Remove cursors inactive >5s

// ─── Types ──────────────────────────────────────────────────────────────────

export type WBPresenceConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'

export interface WBPresenceUser {
  userId: string
  displayName: string
  color: string
}

/** Server → Client message types from WBPresenceConsumer */
interface WBPresenceJoinMsg {
  type: 'presence.join'
  user_id: string
  display_name: string
  color: string
}

interface WBPresenceLeaveMsg {
  type: 'presence.leave'
  user_id: string
}

interface WBCursorUpdateMsg {
  type: 'cursor.update'
  user_id: string
  display_name: string
  color: string
  x: number
  y: number
  page_id: string
  tool: string
  // A5.2: Optional viewport data piggybacked on cursor updates
  scroll_x?: number
  scroll_y?: number
  zoom?: number
  role?: string
}

/** A5.2: Dedicated viewport update message */
interface WBViewportUpdateMsg {
  type: 'viewport.update'
  user_id: string
  display_name: string
  color: string
  scroll_x: number
  scroll_y: number
  zoom: number
  page_id: string
  role?: string
}

interface WBPresenceErrorMsg {
  type: 'error'
  code: string
  message: string
  retry_after_seconds?: number
}

type WBServerMessage =
  | WBPresenceJoinMsg
  | WBPresenceLeaveMsg
  | WBCursorUpdateMsg
  | WBViewportUpdateMsg
  | WBPresenceErrorMsg

// ─── Options ────────────────────────────────────────────────────────────────

export interface UsePresenceOptions {
  /** Session ID to connect to */
  sessionId: Ref<string | null>
  /** Current user ID (to filter own cursor) */
  userId: string
  /** Display name for presence */
  displayName: string
  /** User color for cursor */
  color: string
  /** WebSocket base URL override (default: auto-detect from window.location) */
  wsBaseUrl?: string
  /** Auth token for WS connection */
  token?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getWsBaseUrl(): string {
  if (typeof window === 'undefined') return 'ws://localhost:8000'
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}`
}

function jitter(ms: number): number {
  const j = ms * 0.2
  return Math.max(0, Math.round(ms + (Math.random() * 2 - 1) * j))
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

// ─── Composable ─────────────────────────────────────────────────────────────

export function usePresence(options: UsePresenceOptions) {
  const { userId, displayName, color } = options
  const wsBaseUrl = options.wsBaseUrl ?? getWsBaseUrl()

  // ── Reactive state ──────────────────────────────────────────────────────

  const connectionState = ref<WBPresenceConnectionState>('disconnected')
  const remoteCursors = reactive<Map<string, WBRemoteCursor>>(new Map())
  const onlineUsers = reactive<Map<string, WBPresenceUser>>(new Map())
  const lastError = ref<string | null>(null)

  // ── Internal state ──────────────────────────────────────────────────────

  let ws: WebSocket | null = null
  let reconnectAttempts = 0
  let reconnectAborted = false
  let lastCursorSentAt = 0
  let lastViewportSentAt = 0
  let staleCleanupTimer: ReturnType<typeof setInterval> | null = null

  // ── Computed ────────────────────────────────────────────────────────────

  const isConnected = computed(() => connectionState.value === 'connected')

  const onlineUsersList = computed(() => Array.from(onlineUsers.values()))

  const remoteCursorsMap = computed(() => remoteCursors)

  // ── WebSocket connection ────────────────────────────────────────────────

  function connect(sessionId: string): void {
    disconnect()
    reconnectAborted = false
    reconnectAttempts = 0
    connectionState.value = 'connecting'

    const tokenParam = options.token ? `?token=${encodeURIComponent(options.token)}` : ''
    const url = `${wsBaseUrl}/ws/winterboard/${sessionId}/${tokenParam}`

    try {
      ws = new WebSocket(url)
    } catch (err) {
      console.error(LOG_PREFIX, 'Failed to create WebSocket:', err)
      connectionState.value = 'disconnected'
      lastError.value = 'Failed to create WebSocket connection'
      return
    }

    ws.onopen = () => {
      connectionState.value = 'connected'
      reconnectAttempts = 0
      lastError.value = null
      console.info(LOG_PREFIX, 'Connected to', sessionId)

      // Send join message
      sendMessage({
        type: 'presence.join',
        user_id: userId,
        display_name: displayName,
        color,
      })

      // Start stale cursor cleanup
      startStaleCleanup()
    }

    ws.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data as string) as WBServerMessage
        handleMessage(msg)
      } catch (err) {
        console.warn(LOG_PREFIX, 'Failed to parse message:', err)
      }
    }

    ws.onclose = (event: CloseEvent) => {
      connectionState.value = 'disconnected'
      stopStaleCleanup()

      const code = event.code
      console.info(LOG_PREFIX, 'Disconnected, code:', code)

      // 4403 = forbidden, 4401 = auth expired — do not reconnect
      if (code === 4403 || code === 4401) {
        lastError.value = code === 4403 ? 'Access denied' : 'Session expired'
        reconnectAborted = true
        return
      }

      // Auto-reconnect for other close codes
      if (!reconnectAborted && reconnectAttempts < RECONNECT_MAX_ATTEMPTS) {
        void scheduleReconnect(sessionId)
      }
    }

    ws.onerror = () => {
      console.warn(LOG_PREFIX, 'WebSocket error')
      lastError.value = 'WebSocket connection error'
    }
  }

  function disconnect(): void {
    reconnectAborted = true
    stopStaleCleanup()

    if (ws) {
      // Send leave before closing
      if (ws.readyState === WebSocket.OPEN) {
        try {
          sendMessage({
            type: 'presence.leave',
            user_id: userId,
          })
        } catch {
          // ignore send errors during disconnect
        }
      }

      try {
        ws.close(1000, 'User disconnected')
      } catch {
        // ignore close errors
      }
      ws = null
    }

    connectionState.value = 'disconnected'
    remoteCursors.clear()
    onlineUsers.clear()
  }

  async function scheduleReconnect(sessionId: string): Promise<void> {
    if (reconnectAborted) return
    connectionState.value = 'reconnecting'
    reconnectAttempts++

    const delay = jitter(Math.min(
      RECONNECT_BASE_MS * Math.pow(2, reconnectAttempts - 1),
      RECONNECT_MAX_MS,
    ))

    console.info(LOG_PREFIX, `Reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${RECONNECT_MAX_ATTEMPTS})`)
    await sleep(delay)

    if (reconnectAborted) return
    connect(sessionId)
  }

  // ── Message handling ────────────────────────────────────────────────────

  function handleMessage(msg: WBServerMessage): void {
    switch (msg.type) {
      case 'presence.join': {
        // Skip own join
        if (msg.user_id === userId) return

        onlineUsers.set(msg.user_id, {
          userId: msg.user_id,
          displayName: msg.display_name,
          color: msg.color,
        })
        break
      }

      case 'presence.leave': {
        onlineUsers.delete(msg.user_id)
        remoteCursors.delete(msg.user_id)
        break
      }

      case 'cursor.update': {
        // Skip own cursor
        if (msg.user_id === userId) return

        const existing = remoteCursors.get(msg.user_id)
        remoteCursors.set(msg.user_id, {
          userId: msg.user_id,
          displayName: msg.display_name,
          color: msg.color,
          x: msg.x,
          y: msg.y,
          pageId: msg.page_id,
          tool: msg.tool as WBToolType,
          lastUpdate: Date.now(),
          // A5.2: Preserve viewport data from cursor updates or keep existing
          scrollX: msg.scroll_x ?? existing?.scrollX,
          scrollY: msg.scroll_y ?? existing?.scrollY,
          zoom: msg.zoom ?? existing?.zoom,
          role: msg.role ?? existing?.role,
        })

        // Also update presence
        if (!onlineUsers.has(msg.user_id)) {
          onlineUsers.set(msg.user_id, {
            userId: msg.user_id,
            displayName: msg.display_name,
            color: msg.color,
          })
        }
        break
      }

      // A5.2: Dedicated viewport update
      case 'viewport.update': {
        if (msg.user_id === userId) return

        const cur = remoteCursors.get(msg.user_id)
        if (cur) {
          cur.scrollX = msg.scroll_x
          cur.scrollY = msg.scroll_y
          cur.zoom = msg.zoom
          cur.pageId = msg.page_id
          cur.role = msg.role
          cur.lastUpdate = Date.now()
        } else {
          // Create cursor entry with viewport data (no x/y yet)
          remoteCursors.set(msg.user_id, {
            userId: msg.user_id,
            displayName: msg.display_name,
            color: msg.color,
            x: 0,
            y: 0,
            pageId: msg.page_id,
            tool: 'pen' as WBToolType,
            lastUpdate: Date.now(),
            scrollX: msg.scroll_x,
            scrollY: msg.scroll_y,
            zoom: msg.zoom,
            role: msg.role,
          })
        }

        if (!onlineUsers.has(msg.user_id)) {
          onlineUsers.set(msg.user_id, {
            userId: msg.user_id,
            displayName: msg.display_name,
            color: msg.color,
          })
        }
        break
      }

      case 'error': {
        console.warn(LOG_PREFIX, 'Server error:', msg.code, msg.message)
        lastError.value = msg.message
        break
      }
    }
  }

  // ── Send helpers ────────────────────────────────────────────────────────

  function sendMessage(data: Record<string, unknown>): void {
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    try {
      ws.send(JSON.stringify(data))
    } catch (err) {
      console.warn(LOG_PREFIX, 'Send failed:', err)
    }
  }

  /**
   * Send cursor position (throttled to 50ms / 20 updates per second).
   * Follows contract policy: throttle+drop, do not queue.
   */
  function sendCursor(
    x: number,
    y: number,
    pageId: string,
    tool: WBToolType,
    cursorColor?: string,
  ): void {
    const now = performance.now()
    if (now - lastCursorSentAt < CURSOR_THROTTLE_MS) return
    lastCursorSentAt = now

    sendMessage({
      type: 'cursor.update',
      user_id: userId,
      display_name: displayName,
      color: cursorColor ?? color,
      x: Math.round(x * 10) / 10, // 1 decimal precision
      y: Math.round(y * 10) / 10,
      page_id: pageId,
      tool,
    })
  }

  /**
   * A5.2: Send viewport state (scroll + zoom) — throttled to 100ms / 10 updates per second.
   * Separate throttle from cursor to avoid viewport updates being dropped.
   */
  function sendViewport(
    scrollX: number,
    scrollY: number,
    zoom: number,
    pageId: string,
    role?: string,
  ): void {
    const now = performance.now()
    if (now - lastViewportSentAt < VIEWPORT_THROTTLE_MS) return
    lastViewportSentAt = now

    sendMessage({
      type: 'viewport.update',
      user_id: userId,
      display_name: displayName,
      color,
      scroll_x: Math.round(scrollX),
      scroll_y: Math.round(scrollY),
      zoom: Math.round(zoom * 100) / 100, // 2 decimal precision
      page_id: pageId,
      role,
    })
  }

  // ── Stale cursor cleanup ────────────────────────────────────────────────

  function startStaleCleanup(): void {
    stopStaleCleanup()
    staleCleanupTimer = setInterval(() => {
      const threshold = Date.now() - STALE_THRESHOLD_MS
      for (const [uid, cursor] of remoteCursors) {
        if (cursor.lastUpdate < threshold) {
          remoteCursors.delete(uid)
        }
      }
    }, STALE_CHECK_INTERVAL_MS)
  }

  function stopStaleCleanup(): void {
    if (staleCleanupTimer !== null) {
      clearInterval(staleCleanupTimer)
      staleCleanupTimer = null
    }
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────

  onUnmounted(() => {
    disconnect()
  })

  // ── Return ────────────────────────────────────────────────────────────

  return {
    // State
    connectionState,
    isConnected,
    remoteCursors: remoteCursorsMap,
    onlineUsers: onlineUsersList,
    lastError,

    // Actions
    connect,
    disconnect,
    sendCursor,
    sendViewport,
  }
}

export default usePresence
