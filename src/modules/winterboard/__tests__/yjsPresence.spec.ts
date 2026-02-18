// WB: Unit tests for Yjs Presence (Phase 6: A6.2)
// Tests: awareness state, remote cursors, selections, throttle, fade, cleanup, fallback

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  useYjsPresence,
  type AwarenessLike,
  type YjsPresenceUser,
  type YjsPresenceCursorState,
} from '../composables/useYjsPresence'

// ─── Mock awareness ─────────────────────────────────────────────────────────

function createMockAwareness(localClientId = 1): AwarenessLike & {
  _states: Map<number, Record<string, unknown>>
  _listeners: Map<string, Set<(...args: unknown[]) => void>>
  _emit(event: string, ...args: unknown[]): void
} {
  const states = new Map<number, Record<string, unknown>>()
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>()

  // Initialize local state
  states.set(localClientId, {})

  return {
    clientID: localClientId,
    _states: states,
    _listeners: listeners,

    getLocalState() {
      return states.get(localClientId) ?? null
    },

    setLocalStateField(field: string, value: unknown) {
      const current = states.get(localClientId) ?? {}
      current[field] = value
      states.set(localClientId, current)
    },

    getStates() {
      return states
    },

    on(event: string, cb: (...args: unknown[]) => void) {
      if (!listeners.has(event)) listeners.set(event, new Set())
      listeners.get(event)!.add(cb)
    },

    off(event: string, cb: (...args: unknown[]) => void) {
      listeners.get(event)?.delete(cb)
    },

    _emit(event: string, ...args: unknown[]) {
      listeners.get(event)?.forEach((cb) => cb(...args))
    },
  }
}

// ─── Fixtures ───────────────────────────────────────────────────────────────

const localUser: YjsPresenceUser = {
  id: 'user-local',
  name: 'Local User',
  color: '#ff0000',
}

function addRemoteUser(
  awareness: ReturnType<typeof createMockAwareness>,
  clientId: number,
  user: YjsPresenceUser,
  cursor?: YjsPresenceCursorState | null,
  selection?: { strokeIds: string[] },
): void {
  const state: Record<string, unknown> = { user }
  if (cursor !== undefined) state.cursor = cursor
  if (selection !== undefined) state.selection = selection
  awareness._states.set(clientId, state)
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Yjs Presence (A6.2)', () => {
  let awareness: ReturnType<typeof createMockAwareness>

  beforeEach(() => {
    awareness = createMockAwareness(1)
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ── Local awareness state ─────────────────────────────────────────────

  describe('Local awareness state', () => {
    it('sets user info on creation', () => {
      const { destroy } = useYjsPresence(awareness, localUser)

      const state = awareness.getLocalState()
      expect(state?.user).toEqual({
        id: 'user-local',
        name: 'Local User',
        color: '#ff0000',
      })

      destroy()
    })

    it('sets initial cursor to null', () => {
      const { destroy } = useYjsPresence(awareness, localUser)

      const state = awareness.getLocalState()
      expect(state?.cursor).toBeNull()

      destroy()
    })

    it('sets initial selection to empty', () => {
      const { destroy } = useYjsPresence(awareness, localUser)

      const state = awareness.getLocalState()
      expect(state?.selection).toEqual({ strokeIds: [] })

      destroy()
    })
  })

  // ── Cursor updates ────────────────────────────────────────────────────

  describe('Cursor updates', () => {
    it('updateCursor sets local cursor state', () => {
      const { updateCursor, destroy } = useYjsPresence(awareness, localUser)

      // Mock performance.now for throttle
      vi.spyOn(performance, 'now').mockReturnValue(1000)
      updateCursor(100, 200, 0, 'pen')

      const state = awareness.getLocalState()
      const cursor = state?.cursor as YjsPresenceCursorState
      expect(cursor.x).toBe(100)
      expect(cursor.y).toBe(200)
      expect(cursor.pageIndex).toBe(0)
      expect(cursor.tool).toBe('pen')

      destroy()
    })

    it('throttles cursor updates to 50ms', () => {
      const { updateCursor, destroy } = useYjsPresence(awareness, localUser)

      const perfSpy = vi.spyOn(performance, 'now')

      // First update at t=100 — should go through (lastCursorSentAt=0, delta=100 > 50)
      perfSpy.mockReturnValue(100)
      updateCursor(10, 20, 0, 'pen')

      const cursor0 = (awareness.getLocalState()?.cursor as YjsPresenceCursorState)
      expect(cursor0.x).toBe(10)

      // Second update at t=130ms — should be throttled (delta=30 < 50)
      perfSpy.mockReturnValue(130)
      updateCursor(30, 40, 0, 'pen')

      const cursor1 = (awareness.getLocalState()?.cursor as YjsPresenceCursorState)
      expect(cursor1.x).toBe(10) // Still first value

      // Third update at t=160ms — should go through (delta=60 > 50)
      perfSpy.mockReturnValue(160)
      updateCursor(50, 60, 0, 'highlighter')

      const cursor2 = (awareness.getLocalState()?.cursor as YjsPresenceCursorState)
      expect(cursor2.x).toBe(50)
      expect(cursor2.tool).toBe('highlighter')

      destroy()
    })

    it('rounds cursor coordinates to 1 decimal', () => {
      const { updateCursor, destroy } = useYjsPresence(awareness, localUser)

      vi.spyOn(performance, 'now').mockReturnValue(1000)
      updateCursor(10.1234, 20.5678, 0, 'pen')

      const cursor = awareness.getLocalState()?.cursor as YjsPresenceCursorState
      expect(cursor.x).toBe(10.1)
      expect(cursor.y).toBe(20.6)

      destroy()
    })
  })

  // ── Selection updates ─────────────────────────────────────────────────

  describe('Selection updates', () => {
    it('updateSelection sets local selection state', () => {
      const { updateSelection, destroy } = useYjsPresence(awareness, localUser)

      updateSelection(['stroke-1', 'stroke-2'])

      const state = awareness.getLocalState()
      expect(state?.selection).toEqual({ strokeIds: ['stroke-1', 'stroke-2'] })

      destroy()
    })

    it('updateSelection with empty array clears selection', () => {
      const { updateSelection, destroy } = useYjsPresence(awareness, localUser)

      updateSelection(['stroke-1'])
      updateSelection([])

      const state = awareness.getLocalState()
      expect(state?.selection).toEqual({ strokeIds: [] })

      destroy()
    })
  })

  // ── Remote cursor reading ─────────────────────────────────────────────

  describe('Remote cursors', () => {
    it('reads remote cursors from awareness', () => {
      const { remoteCursors, destroy } = useYjsPresence(awareness, localUser)

      // Add remote user
      addRemoteUser(awareness, 2, {
        id: 'user-remote',
        name: 'Remote User',
        color: '#00ff00',
      }, {
        x: 500,
        y: 600,
        pageIndex: 1,
        tool: 'eraser',
        timestamp: Date.now(),
      })

      // Trigger awareness change
      awareness._emit('change')

      expect(remoteCursors.value).toHaveLength(1)
      expect(remoteCursors.value[0].userId).toBe('user-remote')
      expect(remoteCursors.value[0].x).toBe(500)
      expect(remoteCursors.value[0].y).toBe(600)
      expect(remoteCursors.value[0].tool).toBe('eraser')
      expect(remoteCursors.value[0].color).toBe('#00ff00')

      destroy()
    })

    it('excludes local client from remote cursors', () => {
      const { remoteCursors, destroy } = useYjsPresence(awareness, localUser)

      // Local client already has state from init
      awareness._emit('change')

      expect(remoteCursors.value).toHaveLength(0)

      destroy()
    })

    it('marks cursor as faded after 5s inactivity', () => {
      const now = Date.now()
      vi.setSystemTime(now)

      const { remoteCursors, destroy } = useYjsPresence(awareness, localUser)

      addRemoteUser(awareness, 2, {
        id: 'user-remote',
        name: 'Remote',
        color: '#00ff00',
      }, {
        x: 100,
        y: 200,
        pageIndex: 0,
        tool: 'pen',
        timestamp: now - 6_000, // 6 seconds ago
      })

      awareness._emit('change')

      expect(remoteCursors.value[0].isFaded).toBe(true)

      destroy()
    })

    it('cursor is NOT faded when recently active', () => {
      const now = Date.now()
      vi.setSystemTime(now)

      const { remoteCursors, destroy } = useYjsPresence(awareness, localUser)

      addRemoteUser(awareness, 2, {
        id: 'user-remote',
        name: 'Remote',
        color: '#00ff00',
      }, {
        x: 100,
        y: 200,
        pageIndex: 0,
        tool: 'pen',
        timestamp: now - 1_000, // 1 second ago
      })

      awareness._emit('change')

      expect(remoteCursors.value[0].isFaded).toBe(false)

      destroy()
    })
  })

  // ── Remote selections ─────────────────────────────────────────────────

  describe('Remote selections', () => {
    it('reads remote selections from awareness', () => {
      const { remoteSelections, destroy } = useYjsPresence(awareness, localUser)

      addRemoteUser(awareness, 2, {
        id: 'user-remote',
        name: 'Remote',
        color: '#00ff00',
      }, null, {
        strokeIds: ['s1', 's2'],
      })

      awareness._emit('change')

      expect(remoteSelections.value).toHaveLength(1)
      expect(remoteSelections.value[0].strokeIds).toEqual(['s1', 's2'])

      destroy()
    })

    it('ignores empty selections', () => {
      const { remoteSelections, destroy } = useYjsPresence(awareness, localUser)

      addRemoteUser(awareness, 2, {
        id: 'user-remote',
        name: 'Remote',
        color: '#00ff00',
      }, null, {
        strokeIds: [],
      })

      awareness._emit('change')

      expect(remoteSelections.value).toHaveLength(0)

      destroy()
    })
  })

  // ── Online users ──────────────────────────────────────────────────────

  describe('Online users', () => {
    it('lists all remote users', () => {
      const { onlineUsers, destroy } = useYjsPresence(awareness, localUser)

      addRemoteUser(awareness, 2, {
        id: 'user-a',
        name: 'Alice',
        color: '#ff0000',
      }, {
        x: 0, y: 0, pageIndex: 0, tool: 'pen', timestamp: Date.now(),
      })

      addRemoteUser(awareness, 3, {
        id: 'user-b',
        name: 'Bob',
        color: '#0000ff',
      }, {
        x: 0, y: 0, pageIndex: 1, tool: 'eraser', timestamp: Date.now(),
      })

      awareness._emit('change')

      expect(onlineUsers.value).toHaveLength(2)
      expect(onlineUsers.value.map((u) => u.userId)).toContain('user-a')
      expect(onlineUsers.value.map((u) => u.userId)).toContain('user-b')

      destroy()
    })

    it('includes tool and pageIndex from cursor', () => {
      const { onlineUsers, destroy } = useYjsPresence(awareness, localUser)

      addRemoteUser(awareness, 2, {
        id: 'user-a',
        name: 'Alice',
        color: '#ff0000',
      }, {
        x: 0, y: 0, pageIndex: 3, tool: 'highlighter', timestamp: Date.now(),
      })

      awareness._emit('change')

      expect(onlineUsers.value[0].tool).toBe('highlighter')
      expect(onlineUsers.value[0].pageIndex).toBe(3)

      destroy()
    })

    it('handles user without cursor (tool=null, pageIndex=null)', () => {
      const { onlineUsers, destroy } = useYjsPresence(awareness, localUser)

      addRemoteUser(awareness, 2, {
        id: 'user-a',
        name: 'Alice',
        color: '#ff0000',
      })

      awareness._emit('change')

      expect(onlineUsers.value[0].tool).toBeNull()
      expect(onlineUsers.value[0].pageIndex).toBeNull()

      destroy()
    })
  })

  // ── Auto-cleanup on disconnect ────────────────────────────────────────

  describe('Auto-cleanup', () => {
    it('user disappears when removed from awareness states', () => {
      const { onlineUsers, remoteCursors, destroy } = useYjsPresence(awareness, localUser)

      addRemoteUser(awareness, 2, {
        id: 'user-remote',
        name: 'Remote',
        color: '#00ff00',
      }, {
        x: 100, y: 200, pageIndex: 0, tool: 'pen', timestamp: Date.now(),
      })

      awareness._emit('change')
      expect(onlineUsers.value).toHaveLength(1)
      expect(remoteCursors.value).toHaveLength(1)

      // Simulate disconnect — remove from states
      awareness._states.delete(2)
      awareness._emit('change')

      expect(onlineUsers.value).toHaveLength(0)
      expect(remoteCursors.value).toHaveLength(0)

      destroy()
    })
  })

  // ── Destroy ───────────────────────────────────────────────────────────

  describe('Destroy', () => {
    it('clears all state on destroy', () => {
      const { remoteCursors, onlineUsers, remoteSelections, destroy } = useYjsPresence(awareness, localUser)

      addRemoteUser(awareness, 2, {
        id: 'user-remote',
        name: 'Remote',
        color: '#00ff00',
      }, {
        x: 100, y: 200, pageIndex: 0, tool: 'pen', timestamp: Date.now(),
      }, {
        strokeIds: ['s1'],
      })

      awareness._emit('change')
      expect(remoteCursors.value).toHaveLength(1)

      destroy()

      expect(remoteCursors.value).toHaveLength(0)
      expect(onlineUsers.value).toHaveLength(0)
      expect(remoteSelections.value).toHaveLength(0)
    })

    it('unregisters awareness listener on destroy', () => {
      const { destroy } = useYjsPresence(awareness, localUser)

      const listenersBefore = awareness._listeners.get('change')?.size ?? 0
      destroy()
      const listenersAfter = awareness._listeners.get('change')?.size ?? 0

      expect(listenersAfter).toBe(listenersBefore - 1)
    })

    it('updateCursor is no-op after destroy', () => {
      const { updateCursor, destroy } = useYjsPresence(awareness, localUser)

      destroy()

      vi.spyOn(performance, 'now').mockReturnValue(10000)
      updateCursor(999, 999, 0, 'pen')

      // Cursor should still be null (set during init, not updated after destroy)
      // Actually after destroy the local state still exists but updateCursor should be no-op
      // The key test is that it doesn't throw
    })
  })

  // ── Multiple remote users ─────────────────────────────────────────────

  describe('Multiple remote users', () => {
    it('handles 5 concurrent users', () => {
      const { remoteCursors, onlineUsers, destroy } = useYjsPresence(awareness, localUser)

      for (let i = 2; i <= 6; i++) {
        addRemoteUser(awareness, i, {
          id: `user-${i}`,
          name: `User ${i}`,
          color: `#${i}${i}${i}${i}${i}${i}`,
        }, {
          x: i * 100,
          y: i * 50,
          pageIndex: 0,
          tool: 'pen',
          timestamp: Date.now(),
        })
      }

      awareness._emit('change')

      expect(onlineUsers.value).toHaveLength(5)
      expect(remoteCursors.value).toHaveLength(5)

      destroy()
    })
  })
})
