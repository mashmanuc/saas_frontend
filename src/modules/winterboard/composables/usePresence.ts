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

/** Server → Client message types from WBPresenceConsumer (camelCase from Django) */
interface WBPresenceJoinMsg {
  type: 'presence.join'
  userId: string
  displayName: string
  color: string
}

interface WBPresenceLeaveMsg {
  type: 'presence.leave'
  userId: string
}

interface WBCursorUpdateMsg {
  type: 'cursor.update'
  userId: string
  displayName: string
  color: string
  x: number
  y: number
  pageId: string
  tool: string
  // A5.2: Optional viewport data piggybacked on cursor updates
  scrollX?: number
  scrollY?: number
  zoom?: number
  role?: string
}

/** A5.2: Dedicated viewport update message */
interface WBViewportUpdateMsg {
  type: 'viewport.update'
  userId: string
  displayName: string
  color: string
  scrollX: number
  scrollY: number
  zoom: number
  pageId: string
  role?: string
}

interface WBPresenceErrorMsg {
  type: 'error'
  code: string
  message: string
  retry_after_seconds?: number
}

/** Classroom sync: state was saved by another participant */
interface WBStateUpdateMsg {
  type: 'session.state_update'
  userId: string
  rev: number
  pageIndex: number
  action: string
  ts: number
}

/** Phase 0: Remote stroke from other participant */
interface WBStrokeBroadcastMsg {
  type: 'stroke.broadcast'
  stroke: any
  strokeId?: string
  pageIndex: number
  action: string
  userId: string
  ts: number
}

/** Phase 38: Test session messages */
interface WBTestStartMsg {
  type: 'test.start'
  test_session_id: string
  test_objects: any[]
  test_meta: Record<string, unknown>
  page_id: string
  started_by: string
  ts: number
}

interface WBTestAnswerMsg {
  type: 'test.answer'
  test_session_id: string
  object_id: string
  answer: unknown
  page_id: string
  student_id: string
  student_name: string
}

interface WBTestPhaseMsg {
  type: 'test.phase'
  test_session_id: string
  phase: string
  page_id: string
}

interface WBTestGradeMsg {
  type: 'test.grade'
  test_session_id: string
  results: Record<string, any>
  page_id: string
}

interface WBTestSyncMsg {
  type: 'test.sync'
  test_session_id: string
  test_objects: any[]
  test_meta: Record<string, unknown>
  phase: string
  page_id: string
  started_by?: string
  my_answers?: Record<string, unknown>
  my_result?: any
  all_answers?: Record<string, Record<string, unknown>>
  all_results?: Record<string, any>
}

interface WBTestEndMsg {
  type: 'test.end'
  page_id: string
  ts: number
}

interface WBLaserPointerMsg {
  type: 'laser_pointer'
  user_id: string
  display_name: string
  x: number
  y: number
  active: boolean
  color: string
  page_id: string
}

type WBServerMessage =
  | WBPresenceJoinMsg
  | WBPresenceLeaveMsg
  | WBCursorUpdateMsg
  | WBViewportUpdateMsg
  | WBPresenceErrorMsg
  | WBStateUpdateMsg
  | WBStrokeBroadcastMsg
  | WBLaserPointerMsg
  | WBTestStartMsg
  | WBTestAnswerMsg
  | WBTestPhaseMsg
  | WBTestGradeMsg
  | WBTestSyncMsg
  | WBTestEndMsg

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
  // In production, use dedicated WS backend if configured
  // Priority 1: explicit base URL
  const wsBaseEnv = import.meta.env.VITE_WS_BASE_URL
  if (wsBaseEnv) return wsBaseEnv.replace(/\/+$/, '')
  // Priority 2: derive base from VITE_WB_WS_URL (strip /ws/winterboard/ suffix)
  const wbWsEnv = import.meta.env.VITE_WB_WS_URL
  if (wbWsEnv) return wbWsEnv.replace(/\/ws\/winterboard\/.*$/, '').replace(/\/+$/, '')
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}`
}

/**
 * Check if WebSocket presence is available.
 * On Cloudflare Pages (static hosting), WS is not available.
 * Returns false if no dedicated WS backend is configured in production.
 */
function isPresenceAvailable(): boolean {
  // Always available in dev (Vite proxy or local backend)
  if (import.meta.env.DEV) return true
  // Available if explicit WS URL is configured (either base or winterboard-specific)
  if (import.meta.env.VITE_WS_BASE_URL || import.meta.env.VITE_WB_WS_URL) return true
  // Not available on static hosting (Cloudflare Pages) without dedicated WS
  return false
}

function jitter(ms: number): number {
  const j = ms * 0.2
  return Math.max(0, Math.round(ms + (Math.random() * 2 - 1) * j))
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

// ─── Composable ─────────────────────────────────────────────────────────────

/**
 * Get fresh decrypted JWT from authStore at call time (not stale snapshot from mount).
 * Returns null if no real JWT available (e.g. '__cookie__' placeholder or decrypt fail).
 */
async function _getFreshTokenAsync(): Promise<string | null> {
  try {
    const { useAuthStore } = await import('@/modules/auth/store/authStore')
    const authStore = useAuthStore()
    if (!authStore.access || authStore.access === '__cookie__') return null
    return await authStore.getDecryptedAccess()
  } catch {
    return null
  }
}

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

  async function connect(sessionId: string): Promise<void> {
    // Skip WS connection if presence is not available (e.g. Cloudflare Pages)
    if (!isPresenceAvailable()) {
      console.info(LOG_PREFIX, 'Presence unavailable (no WS backend configured). Skipping.')
      connectionState.value = 'disconnected'
      return
    }

    // Get fresh decrypted token at connect time (not stale snapshot from mount)
    const token = await _getFreshTokenAsync()
    if (!token) {
      console.warn(LOG_PREFIX, 'No auth token available, deferring connect')
      connectionState.value = 'disconnected'
      return
    }

    disconnect()
    reconnectAborted = false
    reconnectAttempts = 0
    connectionState.value = 'connecting'

    const tokenParam = `?token=${encodeURIComponent(token)}`
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

      // Send join message (camelCase — matches BE _handle_join expectation)
      sendMessage({
        type: 'presence.join',
        userId,
        displayName,
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

      // 4403 = forbidden — do not reconnect (permanent)
      if (code === 4403) {
        lastError.value = 'Access denied'
        reconnectAborted = true
        return
      }

      // 4401 = auth expired — try to refresh token, then reconnect
      if (code === 4401) {
        console.info(LOG_PREFIX, 'Token expired, attempting refresh before reconnect')
        void (async () => {
          try {
            const { useAuthStore } = await import('@/modules/auth/store/authStore')
            const authStore = useAuthStore()
            await authStore.refreshAccess()
            // After refresh, _getFreshToken() will return new JWT
            if (!reconnectAborted && reconnectAttempts < RECONNECT_MAX_ATTEMPTS) {
              void scheduleReconnect(sessionId)
            }
          } catch {
            lastError.value = 'Session expired'
            reconnectAborted = true
          }
        })()
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
            userId,
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
        if (msg.userId === userId) return

        onlineUsers.set(msg.userId, {
          userId: msg.userId,
          displayName: msg.displayName,
          color: msg.color,
        })
        break
      }

      case 'presence.leave': {
        onlineUsers.delete(msg.userId)
        remoteCursors.delete(msg.userId)
        break
      }

      case 'cursor.update': {
        // Skip own cursor
        if (msg.userId === userId) return

        const existing = remoteCursors.get(msg.userId)
        remoteCursors.set(msg.userId, {
          userId: msg.userId,
          displayName: msg.displayName,
          color: msg.color,
          x: msg.x,
          y: msg.y,
          pageId: msg.pageId,
          tool: msg.tool as WBToolType,
          lastUpdate: Date.now(),
          // A5.2: Preserve viewport data from cursor updates or keep existing
          scrollX: msg.scrollX ?? existing?.scrollX,
          scrollY: msg.scrollY ?? existing?.scrollY,
          zoom: msg.zoom ?? existing?.zoom,
          role: msg.role ?? existing?.role,
        })

        // Also update presence
        if (!onlineUsers.has(msg.userId)) {
          onlineUsers.set(msg.userId, {
            userId: msg.userId,
            displayName: msg.displayName,
            color: msg.color,
          })
        }
        break
      }

      // A5.2: Dedicated viewport update
      case 'viewport.update': {
        if (msg.userId === userId) return

        const cur = remoteCursors.get(msg.userId)
        if (cur) {
          cur.scrollX = msg.scrollX
          cur.scrollY = msg.scrollY
          cur.zoom = msg.zoom
          cur.pageId = msg.pageId
          cur.role = msg.role
          cur.lastUpdate = Date.now()
        } else {
          // Create cursor entry with viewport data (no x/y yet)
          remoteCursors.set(msg.userId, {
            userId: msg.userId,
            displayName: msg.displayName,
            color: msg.color,
            x: 0,
            y: 0,
            pageId: msg.pageId,
            tool: 'pen' as WBToolType,
            lastUpdate: Date.now(),
            scrollX: msg.scrollX,
            scrollY: msg.scrollY,
            zoom: msg.zoom,
            role: msg.role,
          })
        }

        if (!onlineUsers.has(msg.userId)) {
          onlineUsers.set(msg.userId, {
            userId: msg.userId,
            displayName: msg.displayName,
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

      // Classroom sync: another participant saved state → emit custom event for refetch
      case 'session.state_update': {
        if (msg.userId === userId) return // Ignore own saves
        window.dispatchEvent(new CustomEvent('wb:remote-state-update', {
          detail: { rev: msg.rev, pageIndex: msg.pageIndex, action: msg.action },
        }))
        break
      }

      // Phase 0: Receive remote stroke from other participant
      case 'stroke.broadcast': {
        if (msg.userId === userId) return // Ignore own strokes
        window.dispatchEvent(new CustomEvent('wb:remote-stroke', {
          detail: {
            stroke: msg.stroke,
            strokeId: msg.strokeId,
            pageIndex: msg.pageIndex,
            action: msg.action,
            userId: msg.userId,
          },
        }))
        break
      }

      // Laser pointer from other participant
      case 'laser_pointer': {
        if (msg.user_id === userId) return
        window.dispatchEvent(new CustomEvent('wb:remote-laser', {
          detail: {
            userId: msg.user_id,
            displayName: msg.display_name,
            x: msg.x,
            y: msg.y,
            active: msg.active,
            color: msg.color,
            pageId: msg.page_id,
          },
        }))
        break
      }

      // Phase 38: Test session messages
      case 'test.start': {
        window.dispatchEvent(new CustomEvent('wb:test-start', { detail: msg }))
        break
      }

      case 'test.answer': {
        window.dispatchEvent(new CustomEvent('wb:test-answer', { detail: msg }))
        break
      }

      case 'test.phase': {
        window.dispatchEvent(new CustomEvent('wb:test-phase', { detail: msg }))
        break
      }

      case 'test.grade': {
        window.dispatchEvent(new CustomEvent('wb:test-grade', { detail: msg }))
        break
      }

      case 'test.sync': {
        window.dispatchEvent(new CustomEvent('wb:test-sync', { detail: msg }))
        break
      }

      case 'test.end': {
        window.dispatchEvent(new CustomEvent('wb:test-end', { detail: msg }))
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
      userId,
      displayName,
      color: cursorColor ?? color,
      x: Math.round(x * 10) / 10, // 1 decimal precision
      y: Math.round(y * 10) / 10,
      pageId,
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
      userId,
      displayName,
      color,
      scrollX: Math.round(scrollX),
      scrollY: Math.round(scrollY),
      zoom: Math.round(zoom * 100) / 100, // 2 decimal precision
      pageId,
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
    sendMessage,
  }
}

export default usePresence
