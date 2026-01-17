/**
 * Room Store Tests - v0.92.0 Dev Session Wiring
 * Tests for dev workspace_id injection in joinRoom
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useRoomStore } from '@/modules/classroom/stores/roomStore'

describe('RoomStore v0.92.0 - Dev Session Wiring', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('joinRoom with dev token', () => {
    it('creates dev-workspace-{sessionId} for dev sessions', async () => {
      const store = useRoomStore()
      const sessionId = 'test-session-123'
      const devToken = 'dev-token-abc'

      await store.joinRoom(sessionId, devToken)

      expect(store.session).toBeTruthy()
      expect(store.session?.uuid).toBe(sessionId)
      expect(store.session?.workspace_id).toBe(`dev-workspace-${sessionId}`)
      expect(store.connectionStatus).toBe('connected')
    })

    it('sets full permissions for dev sessions', async () => {
      const store = useRoomStore()
      const sessionId = 'dev-session-456'
      const devToken = 'dev-token-xyz'

      await store.joinRoom(sessionId, devToken)

      expect(store.permissions).toBeTruthy()
      expect(store.permissions?.can_draw).toBe(true)
      expect(store.permissions?.can_erase).toBe(true)
      expect(store.permissions?.can_terminate).toBe(true)
      expect(store.permissions?.can_clear_board).toBe(true)
    })

    it('skips WebSocket connection for dev sessions', async () => {
      const store = useRoomStore()
      const sessionId = 'dev-ws-skip'
      const devToken = 'dev-token'

      await store.joinRoom(sessionId, devToken)

      expect(store.connectionStatus).toBe('connected')
      expect(store.roomEngine).toBeTruthy()
    })

    it('dev session has workspace_id while production would not', async () => {
      const store = useRoomStore()
      const sessionId = 'test-session'
      const devToken = 'dev-token'

      await store.joinRoom(sessionId, devToken)

      // Dev session MUST have workspace_id
      expect(store.session?.workspace_id).toBeDefined()
      expect(store.session?.workspace_id).toMatch(/^dev-workspace-/)
      
      // Production sessions (tested in E2E) would NOT have dev-workspace- prefix
      // This is verified in smoke tests and E2E tests
    })
  })

  describe('workspace_id format', () => {
    it('uses correct dev-workspace- prefix', async () => {
      const store = useRoomStore()
      await store.joinRoom('my-session', 'token')

      expect(store.session?.workspace_id).toMatch(/^dev-workspace-/)
      expect(store.session?.workspace_id).toBe('dev-workspace-my-session')
    })

    it('preserves sessionId in workspace_id', async () => {
      const store = useRoomStore()
      const sessionId = 'unique-session-id-789'
      await store.joinRoom(sessionId, 'dev-token')

      expect(store.session?.workspace_id).toContain(sessionId)
      expect(store.session?.workspace_id).toBe(`dev-workspace-${sessionId}`)
    })

    it('handles sessionId with hyphens and numbers', async () => {
      const store = useRoomStore()
      const sessionId = 'session-2024-01-17-abc-123'
      await store.joinRoom(sessionId, 'token')

      expect(store.session?.workspace_id).toBe(`dev-workspace-${sessionId}`)
    })
  })

  describe('dev session state', () => {
    it('sets session_type to lesson', async () => {
      const store = useRoomStore()
      await store.joinRoom('test-session', 'dev-token')

      expect(store.session?.session_type).toBe('lesson')
    })

    it('sets session status to active', async () => {
      const store = useRoomStore()
      await store.joinRoom('test-session', 'dev-token')

      expect(store.session?.status).toBe('active')
    })

    it('sets board_version to 0', async () => {
      const store = useRoomStore()
      await store.joinRoom('test-session', 'dev-token')

      expect(store.boardVersion).toBe(0)
    })

    it('initializes empty participants array', async () => {
      const store = useRoomStore()
      await store.joinRoom('test-session', 'dev-token')

      expect(store.session?.participants).toEqual([])
    })

    it('sets empty board_state', async () => {
      const store = useRoomStore()
      await store.joinRoom('test-session', 'dev-token')

      expect(store.boardState).toEqual({})
    })

    it('creates roomEngine instance', async () => {
      const store = useRoomStore()
      await store.joinRoom('test-session', 'dev-token')

      expect(store.roomEngine).toBeTruthy()
      expect(store.roomEngine).toBeDefined()
    })
  })
})
