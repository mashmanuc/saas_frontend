import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useRoomStore } from '@/modules/classroom/stores/roomStore'
import { classroomApi } from '@/modules/classroom/api/classroom'

// Mock API
vi.mock('@/modules/classroom/api/classroom', () => ({
  classroomApi: {
    joinSession: vi.fn(),
    startSession: vi.fn(),
    pauseSession: vi.fn(),
    resumeSession: vi.fn(),
    terminateSession: vi.fn(),
  },
}))

// Mock RoomEngine
vi.mock('@/modules/classroom/engine/roomEngine', () => ({
  RoomEngine: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    off: vi.fn(),
    sendBoardEvent: vi.fn().mockReturnValue(true),
    terminate: vi.fn().mockResolvedValue(undefined),
  })),
}))

describe('roomStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const store = useRoomStore()

      expect(store.session).toBeNull()
      expect(store.token).toBeNull()
      expect(store.permissions).toBeNull()
      expect(store.boardState).toEqual({})
      expect(store.boardVersion).toBe(0)
      expect(store.connectionStatus).toBe('disconnected')
      expect(store.layoutMode).toBe('side-by-side')
      expect(store.elapsedSeconds).toBe(0)
      expect(store.error).toBeNull()
    })
  })

  describe('computed properties', () => {
    it('should compute isHost correctly', () => {
      const store = useRoomStore()

      expect(store.isHost).toBe(false)

      store.session = {
        uuid: 'test-uuid',
        host: { id: 1, name: 'Host', avatar: '' },
        participants: [],
        status: 'active',
        session_type: 'lesson',
        board_version: 0,
        settings: { allow_recording: false, auto_save_interval: 30, max_participants: 10, board_background: 'white' },
        scheduled_start: new Date().toISOString(),
        scheduled_end: new Date().toISOString(),
        actual_start: null,
      }
      store.currentUserId = 1

      expect(store.isHost).toBe(true)
    })

    it('should compute isActive correctly', () => {
      const store = useRoomStore()

      expect(store.isActive).toBe(false)

      store.session = {
        uuid: 'test-uuid',
        host: { id: 1, name: 'Host', avatar: '' },
        participants: [],
        status: 'active',
        session_type: 'lesson',
        board_version: 0,
        settings: { allow_recording: false, auto_save_interval: 30, max_participants: 10, board_background: 'white' },
        scheduled_start: new Date().toISOString(),
        scheduled_end: new Date().toISOString(),
        actual_start: null,
      }

      expect(store.isActive).toBe(true)
    })

    it('should format time correctly', () => {
      const store = useRoomStore()

      store.elapsedSeconds = 65
      expect(store.formattedTime).toBe('1:05')

      store.elapsedSeconds = 3665
      expect(store.formattedTime).toBe('1:01:05')
    })
  })

  describe('joinRoom action', () => {
    it('should join room successfully', async () => {
      const store = useRoomStore()
      const mockResponse = {
        session: {
          uuid: 'test-uuid',
          host: { id: 1, name: 'Host', avatar: '' },
          participants: [],
          status: 'active',
          session_type: 'lesson',
          board_version: 0,
          settings: { allow_recording: false, auto_save_interval: 30, max_participants: 10, board_background: 'white' },
          scheduled_start: new Date().toISOString(),
          scheduled_end: new Date().toISOString(),
          actual_start: null,
        },
        token: 'test-token',
        permissions: {
          can_draw: true,
          can_erase: true,
          can_add_layers: true,
          can_delete_layers: true,
          can_upload_images: true,
          can_clear_board: true,
          can_toggle_video: true,
          can_terminate: true,
        },
        board_state: { elements: [] },
        participant: { user_id: 1, name: 'Test', avatar: '', role: 'host', status: 'connected', video_enabled: true, audio_enabled: true, connection_quality: 'good' },
      }

      vi.mocked(classroomApi.joinSession).mockResolvedValue(mockResponse as any)

      await store.joinRoom('test-uuid')

      expect(classroomApi.joinSession).toHaveBeenCalledWith('test-uuid', undefined)
      expect(store.session).toEqual(mockResponse.session)
      expect(store.token).toBe('test-token')
      expect(store.permissions).toEqual(mockResponse.permissions)
      expect(store.connectionStatus).toBe('connected')
    })

    it('should handle join error', async () => {
      const store = useRoomStore()
      const error = new Error('Connection failed')

      vi.mocked(classroomApi.joinSession).mockRejectedValue(error)

      await expect(store.joinRoom('test-uuid')).rejects.toThrow('Connection failed')
      expect(store.connectionStatus).toBe('disconnected')
      expect(store.error).toBe('Connection failed')
    })
  })

  describe('setLayoutMode action', () => {
    it('should change layout mode', () => {
      const store = useRoomStore()

      store.setLayoutMode('pip')
      expect(store.layoutMode).toBe('pip')

      store.setLayoutMode('board-focus')
      expect(store.layoutMode).toBe('board-focus')
    })
  })

  describe('updateBoardState action', () => {
    it('should update board state and version', () => {
      const store = useRoomStore()
      const newState = { elements: [{ id: 1, type: 'line' }] }

      store.updateBoardState(newState, 5)

      expect(store.boardState).toEqual(newState)
      expect(store.boardVersion).toBe(5)
    })
  })

  describe('$reset action', () => {
    it('should reset store to initial state', () => {
      const store = useRoomStore()

      // Set some state
      store.session = {
        uuid: 'test-uuid',
        host: { id: 1, name: 'Host', avatar: '' },
        participants: [],
        status: 'active',
        session_type: 'lesson',
        board_version: 0,
        settings: { allow_recording: false, auto_save_interval: 30, max_participants: 10, board_background: 'white' },
        scheduled_start: new Date().toISOString(),
        scheduled_end: new Date().toISOString(),
        actual_start: null,
      }
      store.token = 'test-token'
      store.layoutMode = 'pip'
      store.elapsedSeconds = 100

      store.$reset()

      expect(store.session).toBeNull()
      expect(store.token).toBeNull()
      expect(store.layoutMode).toBe('side-by-side')
      expect(store.elapsedSeconds).toBe(0)
    })
  })
})
