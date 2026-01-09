import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { Relation } from '@/types/relations'
import { LimitExceededError } from '@/utils/errors'
// @ts-ignore: explicitly import TS implementation (legacy JS store exists)
import { useRelationsStore } from '../../src/stores/relationsStore.ts'
import { useLimitsStore } from '@/stores/limitsStore'

const axiosGetMock = vi.fn()
const axiosPostMock = vi.fn()

vi.mock('axios', () => {
  const defaultExport = {
    get: (...args: unknown[]) => axiosGetMock(...args),
    post: (...args: unknown[]) => axiosPostMock(...args),
    create: () => defaultExport,
    defaults: {
      withCredentials: false
    },
    interceptors: {
      request: {
        use: (fulfilled: (config: unknown) => unknown) => fulfilled
      },
      response: {
        use: () => {}
      }
    }
  }

  return { default: defaultExport }
})

const rethrowMock = vi.fn((err: unknown) => {
  throw err
})

vi.mock('@/utils/rethrowAsDomainError', () => ({
  rethrowAsDomainError: (err: unknown) => rethrowMock(err)
}))

function createRelation(overrides: Partial<Relation> = {}): Relation {
  return {
    id: overrides.id ?? 'rel-1',
    tutor: overrides.tutor ?? {
      id: 'tutor-1',
      name: 'Tutor One',
      avatar_url: '',
      subjects: [{ value: 'math', label: 'Math' }],
      hourly_rate: 20,
      currency: 'USD'
    },
    student: overrides.student ?? {
      id: 'student-1',
      name: 'Student One',
      avatar_url: ''
    },
    status: overrides.status ?? 'active',
    created_at: overrides.created_at ?? '2025-01-01T00:00:00Z',
    activated_at: overrides.activated_at ?? null,
    last_activity_at: overrides.last_activity_at ?? null,
    lesson_count: overrides.lesson_count ?? 0,
    has_upcoming_lessons: overrides.has_upcoming_lessons ?? false,
    has_current_lesson: overrides.has_current_lesson ?? false,
    active_lesson_id: overrides.active_lesson_id ?? null,
    can_chat: overrides.can_chat ?? true
  }
}

describe('relationsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    axiosGetMock.mockReset()
    axiosPostMock.mockReset()
    rethrowMock.mockReset()
    rethrowMock.mockImplementation((err: unknown) => {
      throw err
    })
  })

  it('fetchRelations merges payload and exposes computed lists', async () => {
    axiosGetMock.mockResolvedValueOnce({
      data: {
        relations: [
          createRelation({ id: 'rel-active', status: 'active' }),
          createRelation({ id: 'rel-invited', status: 'invited' })
        ]
      }
    })

    const store = useRelationsStore()
    await store.fetchRelations()

    expect(store.relations).toHaveLength(2)
    expect(store.activeTutors).toHaveLength(1)
    expect(store.invitedRequests).toHaveLength(1)
    expect(store.fetchError).toBeNull()
  })

  it('sets fetchError when fetchRelations fails', async () => {
    axiosGetMock.mockRejectedValueOnce(new Error('offline'))

    const store = useRelationsStore()
    await store.fetchRelations()

    expect(store.fetchError).toBe('offline')
    expect(store.isFetchingRelations).toBe(false)
  })

  it('requestTutor upserts relation and refreshes limits', async () => {
    const responseRelation = createRelation({ id: 'rel-new', status: 'invited' })
    axiosPostMock.mockResolvedValueOnce({ data: { relation: responseRelation } })

    const store = useRelationsStore()
    const limitsStore = useLimitsStore()
    const fetchLimitsSpy = vi.spyOn(limitsStore, 'fetchLimits').mockResolvedValue(undefined)

    await store.requestTutor('tutor-new')

    expect(axiosPostMock).toHaveBeenCalledWith(
      '/api/v1/users/relations/request-tutor/',
      { tutor_id: 'tutor-new', message: undefined }
    )
    expect(store.relations.some(relation => relation.id === 'rel-new')).toBe(true)
    expect(fetchLimitsSpy).toHaveBeenCalledTimes(1)
  })

  it('requestTutor surfaces LimitExceededError via helper', async () => {
    const limitError = new LimitExceededError({
      limit_type: 'student_request',
      used: 3,
      max: 3,
      reset_at: '2026-01-01T00:00:00Z'
    })

    axiosPostMock.mockRejectedValueOnce(new Error('limit'))
    rethrowMock.mockImplementationOnce(() => {
      throw limitError
    })

    const store = useRelationsStore()

    await expect(store.requestTutor('tutor-x')).rejects.toBe(limitError)
    expect(store.requestTutorError).toContain('Limit exceeded')
  })

  it('acceptRequest rethrows domain errors and records message', async () => {
    const limitError = new LimitExceededError({
      limit_type: 'tutor_accept',
      used: 5,
      max: 5,
      reset_at: '2026-02-01T00:00:00Z'
    })

    axiosPostMock.mockRejectedValueOnce(new Error('limit'))
    rethrowMock.mockImplementationOnce(() => {
      throw limitError
    })

    const store = useRelationsStore()

    await expect(store.acceptRequest('rel-1')).rejects.toBe(limitError)
    expect(store.acceptRequestError).toContain('Limit exceeded')
  })
})
