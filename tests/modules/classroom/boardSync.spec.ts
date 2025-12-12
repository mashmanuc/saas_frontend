// Tests for useBoardSync composable
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Mock API
vi.mock('@/modules/classroom/api/classroom', () => ({
  classroomApi: {
    getHistory: vi.fn(),
    autosave: vi.fn(),
    restoreSnapshot: vi.fn(),
    exportBoard: vi.fn(),
  },
}))

import { useBoardSync } from '@/modules/classroom/composables/useBoardSync'
import { useRoomStore } from '@/modules/classroom/stores/roomStore'
import { classroomApi } from '@/modules/classroom/api/classroom'

describe('useBoardSync', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('queueOperation', () => {
    it('should queue board operation', () => {
      const { queueOperation, hasPendingChanges } = useBoardSync()

      expect(hasPendingChanges.value).toBe(false)

      queueOperation('stroke:add', { id: 'stroke-1', points: [] })

      expect(hasPendingChanges.value).toBe(true)
    })
  })

  describe('autosave', () => {
    it('should not autosave without session', async () => {
      const { autosave } = useBoardSync()

      await autosave()

      expect(classroomApi.autosave).not.toHaveBeenCalled()
    })

    it('should not autosave without pending changes', async () => {
      const roomStore = useRoomStore()
      roomStore.session = {
        uuid: 'session-123',
        session_type: 'lesson',
        status: 'active',
        host: { id: 1, name: 'Host', avatar: null },
        scheduled_start: new Date().toISOString(),
        scheduled_end: new Date().toISOString(),
        actual_start: null,
        actual_end: null,
        settings: {
          max_participants: 2,
          allow_recording: false,
          auto_save_interval: 30,
        },
      }

      const { autosave } = useBoardSync()

      await autosave()

      expect(classroomApi.autosave).not.toHaveBeenCalled()
    })
  })

  describe('handleRemoteBoardEvent', () => {
    it('should apply stroke:add event', () => {
      const roomStore = useRoomStore()
      roomStore.boardState = { strokes: [] }

      const { handleRemoteBoardEvent } = useBoardSync()

      handleRemoteBoardEvent({
        type: 'stroke:add',
        data: { id: 'stroke-1', points: [[0, 0], [10, 10]] },
        version: 1,
        userId: 1,
      })

      expect((roomStore.boardState.strokes as unknown[]).length).toBe(1)
    })

    it('should apply canvas:clear event', () => {
      const roomStore = useRoomStore()
      roomStore.boardState = {
        strokes: [{ id: 'stroke-1' }],
        objects: [{ id: 'obj-1' }],
      }

      const { handleRemoteBoardEvent } = useBoardSync()

      handleRemoteBoardEvent({
        type: 'canvas:clear',
        data: {},
        version: 1,
        userId: 1,
      })

      expect((roomStore.boardState.strokes as unknown[]).length).toBe(0)
      expect((roomStore.boardState.objects as unknown[]).length).toBe(0)
    })
  })

  describe('restoreVersion', () => {
    it('should restore board to specific version', async () => {
      const roomStore = useRoomStore()
      roomStore.session = {
        uuid: 'session-123',
        session_type: 'lesson',
        status: 'active',
        host: { id: 1, name: 'Host', avatar: null },
        scheduled_start: new Date().toISOString(),
        scheduled_end: new Date().toISOString(),
        actual_start: null,
        actual_end: null,
        settings: {
          max_participants: 2,
          allow_recording: false,
          auto_save_interval: 30,
        },
      }

      const restoredState = { strokes: [{ id: 'old-stroke' }] }
      vi.mocked(classroomApi.restoreSnapshot).mockResolvedValue(restoredState)

      const { restoreVersion, isSyncing } = useBoardSync()

      const promise = restoreVersion(5)
      expect(isSyncing.value).toBe(true)

      await promise
      expect(isSyncing.value).toBe(false)
      expect(classroomApi.restoreSnapshot).toHaveBeenCalledWith('session-123', 5)
    })
  })
})
