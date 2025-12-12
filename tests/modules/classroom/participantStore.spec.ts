import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useParticipantStore } from '@/modules/classroom/stores/participantStore'
import type { SessionParticipant } from '@/modules/classroom/api/classroom'

describe('participantStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  const createMockParticipant = (overrides: Partial<SessionParticipant> = {}): SessionParticipant => ({
    user_id: 1,
    name: 'Test User',
    avatar: '',
    role: 'student',
    status: 'connected',
    video_enabled: true,
    audio_enabled: true,
    connection_quality: 'good',
    ...overrides,
  })

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const store = useParticipantStore()

      expect(store.participants).toEqual([])
      expect(store.localMediaState).toEqual({ video: true, audio: true, screen: false })
      expect(store.localUserId).toBeNull()
    })
  })

  describe('computed properties', () => {
    it('should compute host correctly', () => {
      const store = useParticipantStore()

      expect(store.host).toBeUndefined()

      store.participants = [
        createMockParticipant({ user_id: 1, role: 'host' }),
        createMockParticipant({ user_id: 2, role: 'student' }),
      ]

      expect(store.host?.user_id).toBe(1)
    })

    it('should compute students correctly', () => {
      const store = useParticipantStore()

      store.participants = [
        createMockParticipant({ user_id: 1, role: 'host' }),
        createMockParticipant({ user_id: 2, role: 'student' }),
        createMockParticipant({ user_id: 3, role: 'student' }),
        createMockParticipant({ user_id: 4, role: 'viewer' }),
      ]

      expect(store.students).toHaveLength(2)
      expect(store.students.map((s) => s.user_id)).toEqual([2, 3])
    })

    it('should compute connectedParticipants correctly', () => {
      const store = useParticipantStore()

      store.participants = [
        createMockParticipant({ user_id: 1, status: 'connected' }),
        createMockParticipant({ user_id: 2, status: 'disconnected' }),
        createMockParticipant({ user_id: 3, status: 'reconnecting' }),
      ]

      expect(store.connectedParticipants).toHaveLength(1)
      expect(store.connectedCount).toBe(1)
    })

    it('should compute localParticipant correctly', () => {
      const store = useParticipantStore()

      store.localUserId = 2
      store.participants = [
        createMockParticipant({ user_id: 1 }),
        createMockParticipant({ user_id: 2 }),
      ]

      expect(store.localParticipant?.user_id).toBe(2)
    })

    it('should compute remoteParticipants correctly', () => {
      const store = useParticipantStore()

      store.localUserId = 1
      store.participants = [
        createMockParticipant({ user_id: 1 }),
        createMockParticipant({ user_id: 2 }),
        createMockParticipant({ user_id: 3 }),
      ]

      expect(store.remoteParticipants).toHaveLength(2)
      expect(store.remoteParticipants.map((p) => p.user_id)).toEqual([2, 3])
    })
  })

  describe('setParticipants action', () => {
    it('should set participants', () => {
      const store = useParticipantStore()
      const participants = [
        createMockParticipant({ user_id: 1 }),
        createMockParticipant({ user_id: 2 }),
      ]

      store.setParticipants(participants)

      expect(store.participants).toEqual(participants)
    })
  })

  describe('addParticipant action', () => {
    it('should add participant', () => {
      const store = useParticipantStore()
      const participant = createMockParticipant({ user_id: 1 })

      store.addParticipant(participant)

      expect(store.participants).toHaveLength(1)
      expect(store.participants[0]).toEqual(participant)
    })

    it('should not add duplicate participant', () => {
      const store = useParticipantStore()
      const participant = createMockParticipant({ user_id: 1 })

      store.addParticipant(participant)
      store.addParticipant(participant)

      expect(store.participants).toHaveLength(1)
    })
  })

  describe('removeParticipant action', () => {
    it('should remove participant', () => {
      const store = useParticipantStore()
      store.participants = [
        createMockParticipant({ user_id: 1 }),
        createMockParticipant({ user_id: 2 }),
      ]

      store.removeParticipant(1)

      expect(store.participants).toHaveLength(1)
      expect(store.participants[0].user_id).toBe(2)
    })
  })

  describe('updateParticipant action', () => {
    it('should update participant', () => {
      const store = useParticipantStore()
      store.participants = [createMockParticipant({ user_id: 1, name: 'Old Name' })]

      store.updateParticipant(1, { name: 'New Name' })

      expect(store.participants[0].name).toBe('New Name')
    })
  })

  describe('setParticipantStatus action', () => {
    it('should set participant status', () => {
      const store = useParticipantStore()
      store.participants = [createMockParticipant({ user_id: 1, status: 'connected' })]

      store.setParticipantStatus(1, 'disconnected')

      expect(store.participants[0].status).toBe('disconnected')
    })
  })

  describe('setParticipantMediaState action', () => {
    it('should set participant media state', () => {
      const store = useParticipantStore()
      store.participants = [
        createMockParticipant({ user_id: 1, video_enabled: true, audio_enabled: true }),
      ]

      store.setParticipantMediaState(1, false, false)

      expect(store.participants[0].video_enabled).toBe(false)
      expect(store.participants[0].audio_enabled).toBe(false)
    })
  })

  describe('local media state actions', () => {
    it('should toggle local video', () => {
      const store = useParticipantStore()

      expect(store.localMediaState.video).toBe(true)

      store.toggleLocalVideo()
      expect(store.localMediaState.video).toBe(false)

      store.toggleLocalVideo()
      expect(store.localMediaState.video).toBe(true)
    })

    it('should toggle local audio', () => {
      const store = useParticipantStore()

      expect(store.localMediaState.audio).toBe(true)

      store.toggleLocalAudio()
      expect(store.localMediaState.audio).toBe(false)
    })

    it('should set local media state', () => {
      const store = useParticipantStore()

      store.setLocalMediaState({ video: false, screen: true })

      expect(store.localMediaState.video).toBe(false)
      expect(store.localMediaState.audio).toBe(true) // unchanged
      expect(store.localMediaState.screen).toBe(true)
    })
  })

  describe('$reset action', () => {
    it('should reset store to initial state', () => {
      const store = useParticipantStore()

      store.participants = [createMockParticipant()]
      store.localUserId = 1
      store.localMediaState = { video: false, audio: false, screen: true }

      store.$reset()

      expect(store.participants).toEqual([])
      expect(store.localUserId).toBeNull()
      expect(store.localMediaState).toEqual({ video: true, audio: true, screen: false })
    })
  })
})
