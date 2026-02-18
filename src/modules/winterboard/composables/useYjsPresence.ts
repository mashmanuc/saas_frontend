// WB: useYjsPresence — Yjs awareness-based presence (replaces custom WS presence)
// Ref: TASK_BOARD_PHASES.md A6.2, LAW-16 (Multi-User Presence)
//
// Uses Yjs awareness protocol for:
// - Cursor position (throttled to 20 updates/s)
// - Selection state (stroke IDs being edited)
// - Tool state
// - Online users list
// - Auto-cleanup on disconnect (Yjs handles this)
//
// Fallback: when Yjs disabled → usePresence (custom WS) is used instead

import { ref, computed, onUnmounted, type Ref, type ComputedRef } from 'vue'
import type { WBRemoteCursor, WBToolType } from '../types/winterboard'

// ─── Constants ──────────────────────────────────────────────────────────────

const LOG = '[WB:YjsPresence]'
const CURSOR_THROTTLE_MS = 50       // Max 20 cursor updates/s (LAW-16)
const FADE_TIMEOUT_MS = 5_000       // Fade cursor after 5s inactivity
const STALE_CHECK_MS = 2_000        // Check for stale cursors every 2s

// ─── Types ──────────────────────────────────────────────────────────────────

export interface YjsPresenceUser {
  id: string
  name: string
  color: string
}

export interface YjsPresenceCursorState {
  x: number
  y: number
  pageIndex: number
  tool: WBToolType
  timestamp: number
}

export interface YjsPresenceSelectionState {
  strokeIds: string[]
}

/** Full local awareness state shape */
export interface YjsAwarenessLocalState {
  user: YjsPresenceUser
  cursor: YjsPresenceCursorState | null
  selection: YjsPresenceSelectionState
}

/** Remote cursor with fade support */
export interface YjsRemoteCursor extends WBRemoteCursor {
  /** Whether cursor is faded (inactive > 5s) */
  isFaded: boolean
}

export interface RemoteSelection {
  userId: string
  displayName: string
  color: string
  strokeIds: string[]
}

export interface OnlineUser {
  userId: string
  displayName: string
  color: string
  tool: WBToolType | null
  pageIndex: number | null
}

/** Minimal awareness interface — decoupled from y-websocket for testability */
export interface AwarenessLike {
  clientID: number
  getLocalState(): Record<string, unknown> | null
  setLocalStateField(field: string, value: unknown): void
  getStates(): Map<number, Record<string, unknown>>
  on(event: string, cb: (...args: unknown[]) => void): void
  off(event: string, cb: (...args: unknown[]) => void): void
}

export interface UseYjsPresenceReturn {
  remoteCursors: Ref<YjsRemoteCursor[]>
  remoteSelections: Ref<RemoteSelection[]>
  onlineUsers: Ref<OnlineUser[]>
  updateCursor: (x: number, y: number, pageIndex: number, tool: WBToolType) => void
  updateSelection: (strokeIds: string[]) => void
  destroy: () => void
}

// ─── Composable ─────────────────────────────────────────────────────────────

export function useYjsPresence(
  awareness: AwarenessLike,
  user: YjsPresenceUser,
): UseYjsPresenceReturn {
  // ── Reactive state ────────────────────────────────────────────────────

  const remoteCursors = ref<YjsRemoteCursor[]>([])
  const remoteSelections = ref<RemoteSelection[]>([])
  const onlineUsers = ref<OnlineUser[]>([])

  let destroyed = false
  let lastCursorSentAt = 0
  let staleTimer: ReturnType<typeof setInterval> | null = null

  // ── Set local user info ───────────────────────────────────────────────

  awareness.setLocalStateField('user', {
    id: user.id,
    name: user.name,
    color: user.color,
  })
  awareness.setLocalStateField('cursor', null)
  awareness.setLocalStateField('selection', { strokeIds: [] })

  // ── Throttled cursor update ───────────────────────────────────────────

  function updateCursor(x: number, y: number, pageIndex: number, tool: WBToolType): void {
    if (destroyed) return

    const now = performance.now()
    if (now - lastCursorSentAt < CURSOR_THROTTLE_MS) return
    lastCursorSentAt = now

    awareness.setLocalStateField('cursor', {
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      pageIndex,
      tool,
      timestamp: Date.now(),
    })
  }

  // ── Selection update ──────────────────────────────────────────────────

  function updateSelection(strokeIds: string[]): void {
    if (destroyed) return
    awareness.setLocalStateField('selection', { strokeIds })
  }

  // ── Read remote states ────────────────────────────────────────────────

  function readRemoteStates(): void {
    if (destroyed) return

    const states = awareness.getStates()
    const localClientId = awareness.clientID
    const now = Date.now()

    const cursors: YjsRemoteCursor[] = []
    const selections: RemoteSelection[] = []
    const users: OnlineUser[] = []

    states.forEach((state, clientId) => {
      if (clientId === localClientId) return

      const remoteUser = state.user as YjsPresenceUser | undefined
      if (!remoteUser?.id) return

      const cursor = state.cursor as YjsPresenceCursorState | null
      const selection = state.selection as YjsPresenceSelectionState | undefined

      // Online user
      users.push({
        userId: remoteUser.id,
        displayName: remoteUser.name,
        color: remoteUser.color,
        tool: cursor?.tool ?? null,
        pageIndex: cursor?.pageIndex ?? null,
      })

      // Remote cursor
      if (cursor) {
        const age = now - cursor.timestamp
        cursors.push({
          userId: remoteUser.id,
          displayName: remoteUser.name,
          color: remoteUser.color,
          x: cursor.x,
          y: cursor.y,
          pageId: String(cursor.pageIndex),
          tool: cursor.tool,
          lastUpdate: cursor.timestamp,
          isFaded: age > FADE_TIMEOUT_MS,
        })
      }

      // Remote selection
      if (selection?.strokeIds && selection.strokeIds.length > 0) {
        selections.push({
          userId: remoteUser.id,
          displayName: remoteUser.name,
          color: remoteUser.color,
          strokeIds: selection.strokeIds,
        })
      }
    })

    remoteCursors.value = cursors
    remoteSelections.value = selections
    onlineUsers.value = users
  }

  // ── Awareness change handler ──────────────────────────────────────────

  function onAwarenessChange(): void {
    readRemoteStates()
  }

  awareness.on('change', onAwarenessChange)

  // Initial read
  readRemoteStates()

  // ── Stale cursor cleanup (fade check) ─────────────────────────────────

  staleTimer = setInterval(() => {
    if (destroyed) return
    // Re-read to update fade states
    readRemoteStates()
  }, STALE_CHECK_MS)

  // ── Cleanup ───────────────────────────────────────────────────────────

  function destroy(): void {
    destroyed = true
    awareness.off('change', onAwarenessChange)

    if (staleTimer !== null) {
      clearInterval(staleTimer)
      staleTimer = null
    }

    remoteCursors.value = []
    remoteSelections.value = []
    onlineUsers.value = []
  }

  onUnmounted(destroy)

  return {
    remoteCursors,
    remoteSelections,
    onlineUsers,
    updateCursor,
    updateSelection,
    destroy,
  }
}
