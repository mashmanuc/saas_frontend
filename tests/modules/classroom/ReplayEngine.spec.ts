// Tests for ReplayEngine
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock API
vi.mock('@/modules/classroom/api/classroom', () => ({
  classroomApi: {
    getReplayStream: vi.fn(),
  },
}))

import { ReplayEngine } from '@/modules/classroom/replay/ReplayEngine'
import { classroomApi } from '@/modules/classroom/api/classroom'

describe('ReplayEngine', () => {
  let engine: ReplayEngine

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    engine = new ReplayEngine('session-123')
  })

  afterEach(() => {
    engine.destroy()
    vi.useRealTimers()
  })

  describe('load', () => {
    it('should load replay manifest', async () => {
      const mockManifest = {
        session_id: 'session-123',
        duration_ms: 60000,
        events: [
          { t: 1000, type: 'board_stroke', data: {} },
          { t: 2000, type: 'board_stroke', data: {} },
        ],
        snapshots: [{ version: 1, t: 0 }],
        participants: [{ id: 1, name: 'Host', role: 'host' }],
      }

      vi.mocked(classroomApi.getReplayStream).mockResolvedValue(mockManifest)

      expect(engine.isLoading.value).toBe(false)

      const promise = engine.load()
      expect(engine.isLoading.value).toBe(true)

      await promise

      expect(engine.isLoading.value).toBe(false)
      expect(engine.duration.value).toBe(60000)
      expect(engine.events.value).toHaveLength(2)
      expect(engine.currentTimeMs.value).toBe(0)
    })

    it('should handle load errors', async () => {
      vi.mocked(classroomApi.getReplayStream).mockRejectedValue(new Error('Network error'))

      await engine.load()

      expect(engine.isLoading.value).toBe(false)
      expect(engine.error.value).toBe('Не вдалося завантажити replay')
    })
  })

  describe('play/pause', () => {
    it('should toggle play state', async () => {
      const mockManifest = {
        session_id: 'session-123',
        duration_ms: 60000,
        events: [],
        snapshots: [],
        participants: [],
      }

      vi.mocked(classroomApi.getReplayStream).mockResolvedValue(mockManifest)
      await engine.load()

      expect(engine.isPlaying.value).toBe(false)

      engine.play()
      expect(engine.isPlaying.value).toBe(true)

      engine.pause()
      expect(engine.isPlaying.value).toBe(false)
    })

    it('should toggle with toggle()', async () => {
      const mockManifest = {
        session_id: 'session-123',
        duration_ms: 60000,
        events: [],
        snapshots: [],
        participants: [],
      }

      vi.mocked(classroomApi.getReplayStream).mockResolvedValue(mockManifest)
      await engine.load()

      engine.toggle()
      expect(engine.isPlaying.value).toBe(true)

      engine.toggle()
      expect(engine.isPlaying.value).toBe(false)
    })
  })

  describe('seek', () => {
    it('should seek to specific time', async () => {
      const mockManifest = {
        session_id: 'session-123',
        duration_ms: 60000,
        events: [],
        snapshots: [],
        participants: [],
      }

      vi.mocked(classroomApi.getReplayStream).mockResolvedValue(mockManifest)
      await engine.load()

      engine.seek(30000)
      expect(engine.currentTimeMs.value).toBe(30000)
    })

    it('should clamp seek to valid range', async () => {
      const mockManifest = {
        session_id: 'session-123',
        duration_ms: 60000,
        events: [],
        snapshots: [],
        participants: [],
      }

      vi.mocked(classroomApi.getReplayStream).mockResolvedValue(mockManifest)
      await engine.load()

      engine.seek(-1000)
      expect(engine.currentTimeMs.value).toBe(0)

      engine.seek(100000)
      expect(engine.currentTimeMs.value).toBe(60000)
    })
  })

  describe('speed', () => {
    it('should set playback speed', async () => {
      const mockManifest = {
        session_id: 'session-123',
        duration_ms: 60000,
        events: [],
        snapshots: [],
        participants: [],
      }

      vi.mocked(classroomApi.getReplayStream).mockResolvedValue(mockManifest)
      await engine.load()

      expect(engine.speed.value).toBe(1)

      engine.setSpeed(2)
      expect(engine.speed.value).toBe(2)

      engine.setSpeed(0.5)
      expect(engine.speed.value).toBe(0.5)
    })

    it('should clamp speed to valid range', async () => {
      const mockManifest = {
        session_id: 'session-123',
        duration_ms: 60000,
        events: [],
        snapshots: [],
        participants: [],
      }

      vi.mocked(classroomApi.getReplayStream).mockResolvedValue(mockManifest)
      await engine.load()

      engine.setSpeed(0.1)
      expect(engine.speed.value).toBe(0.25)

      engine.setSpeed(10)
      expect(engine.speed.value).toBe(4)
    })
  })

  describe('progress', () => {
    it('should calculate progress percentage', async () => {
      const mockManifest = {
        session_id: 'session-123',
        duration_ms: 100000,
        events: [],
        snapshots: [],
        participants: [],
      }

      vi.mocked(classroomApi.getReplayStream).mockResolvedValue(mockManifest)
      await engine.load()

      engine.seek(25000)
      expect(engine.progress.value).toBe(25)

      engine.seek(50000)
      expect(engine.progress.value).toBe(50)

      engine.seek(75000)
      expect(engine.progress.value).toBe(75)
    })
  })

  describe('skipForward/skipBackward', () => {
    it('should skip forward by seconds', async () => {
      const mockManifest = {
        session_id: 'session-123',
        duration_ms: 60000,
        events: [],
        snapshots: [],
        participants: [],
      }

      vi.mocked(classroomApi.getReplayStream).mockResolvedValue(mockManifest)
      await engine.load()

      engine.seek(20000)
      engine.skipForward(10)
      expect(engine.currentTimeMs.value).toBe(30000)
    })

    it('should skip backward by seconds', async () => {
      const mockManifest = {
        session_id: 'session-123',
        duration_ms: 60000,
        events: [],
        snapshots: [],
        participants: [],
      }

      vi.mocked(classroomApi.getReplayStream).mockResolvedValue(mockManifest)
      await engine.load()

      engine.seek(30000)
      engine.skipBackward(10)
      expect(engine.currentTimeMs.value).toBe(20000)
    })
  })
})
