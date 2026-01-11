import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import axios from 'axios'
import { useRelationsStore } from '@/stores/relationsStore'
import type { Relation } from '@/types/relations'

let axiosMock: {
  defaults: Record<string, unknown>
  get: Mock
  post: Mock
  create: Mock
  isAxiosError: () => true
}

vi.mock('axios', () => {
  axiosMock = {
    defaults: {},
    get: vi.fn(),
    post: vi.fn(),
    create: vi.fn(() => ({
      get: vi.fn(),
      post: vi.fn()
    })),
    isAxiosError: () => true
  }

  return { default: axiosMock }
})

const useLimitsStoreMock = vi.fn()
vi.mock('@/stores/limitsStore', () => ({
  useLimitsStore: () => useLimitsStoreMock()
}))

const mockedAxios = axios as unknown as {
  get: Mock
  post: Mock
}

function createRelation(overrides: Partial<Relation> = {}): Relation {
  return {
    id: 'rel_1',
    status: 'active',
    tutor: {
      id: 'tutor_1',
      name: 'Jane Smith',
      avatar_url: '',
      subjects: [],
      hourly_rate: 20,
      currency: 'USD'
    },
    student: {
      id: 'student_1',
      name: 'John Doe',
      avatar_url: ''
    },
    created_at: '2024-01-01T10:00:00Z',
    activated_at: '2024-01-02T10:00:00Z',
    last_activity_at: null,
    lesson_count: 0,
    has_upcoming_lessons: false,
    has_current_lesson: false,
    active_lesson_id: null,
    can_chat: true,
    ...overrides
  }
}

describe('relationsStore v2.1', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockedAxios.get = vi.fn()
    mockedAxios.post = vi.fn()
    useLimitsStoreMock.mockReturnValue({ fetchLimits: vi.fn() })
  })

  describe('fetchRelations', () => {
    it('loads relations and merges state', async () => {
      const relations = [createRelation({ id: 'rel_1' }), createRelation({ id: 'rel_2' })]
      mockedAxios.get.mockResolvedValueOnce({ data: { relations } })

      const store = useRelationsStore()
      await store.fetchRelations()

      expect(mockedAxios.get).toHaveBeenCalledWith('/api/v1/users/me/relations/')
      expect(store.relations).toHaveLength(2)
    })

    it('stores error on failure', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Network'))
      const store = useRelationsStore()

      await store.fetchRelations()

      expect(store.fetchError).toBe('Network')
      expect(store.isFetchingRelations).toBe(false)
    })
  })

  describe('requestTutor', () => {
    it('calls API, upserts relation and refreshes limits', async () => {
      const relation = createRelation({ id: 'rel_10', status: 'invited' })
      mockedAxios.post.mockResolvedValueOnce({ data: { relation } })
      const fetchLimitsSpy = vi.fn()
      useLimitsStoreMock.mockReturnValueOnce({ fetchLimits: fetchLimitsSpy })

      const store = useRelationsStore()
      const result = await store.requestTutor('tutor_10', 'Hello')

      expect(mockedAxios.post).toHaveBeenCalledWith(
        '/api/v1/users/relations/request-tutor/',
        { tutor_id: 'tutor_10', message: 'Hello' }
      )
      expect(store.relations.find(r => r.id === 'rel_10')).toBeTruthy()
      expect(fetchLimitsSpy).toHaveBeenCalled()
      expect(result).toEqual(relation)
    })

    it('propagates domain errors via rethrow', async () => {
      const domainError = new Error('limit_exceeded')
      mockedAxios.post.mockRejectedValueOnce(domainError)

      const store = useRelationsStore()

      await expect(store.requestTutor('tutor_1')).rejects.toThrow('limit_exceeded')
      expect(store.requestTutorError).toContain('limit exceeded')
    })
  })

  describe('acceptRequest', () => {
    it('accepts relation and refreshes limits', async () => {
      const relation = createRelation({ id: 'rel_3', status: 'active' })
      mockedAxios.post.mockResolvedValueOnce({ data: { relation } })
      const fetchLimitsSpy = vi.fn()
      useLimitsStoreMock.mockReturnValueOnce({ fetchLimits: fetchLimitsSpy })

      const store = useRelationsStore()
      const result = await store.acceptRequest('rel_3')

      expect(mockedAxios.post).toHaveBeenCalledWith(
        '/api/v1/users/relations/accept-request/',
        { relation_id: 'rel_3' }
      )
      expect(store.relations.find(r => r.id === 'rel_3')).toEqual(relation)
      expect(fetchLimitsSpy).toHaveBeenCalled()
      expect(result).toEqual(relation)
    })
  })

  describe('computed properties', () => {
    it('returns active and invited relations', async () => {
      const store = useRelationsStore()
      store.relations = [
        createRelation({ id: 'active_1', status: 'active' }),
        createRelation({ id: 'invited_1', status: 'invited' })
      ]

      expect(store.activeTutors).toHaveLength(1)
      expect(store.invitedRequests).toHaveLength(1)
    })
  })
})
