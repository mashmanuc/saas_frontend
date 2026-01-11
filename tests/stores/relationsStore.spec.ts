import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import axios from 'axios'
import { useRelationsStore } from '@/stores/relationsStore'
import type { Relation } from '@/types/relations'

const axiosInstanceMock = vi.hoisted(() => {
  const instance = {
    defaults: {} as Record<string, unknown>,
    get: vi.fn(),
    post: vi.fn(),
    interceptors: {
      request: {
        use: vi.fn(),
        eject: vi.fn()
      },
      response: {
        use: vi.fn(),
        eject: vi.fn()
      }
    },
    isAxiosError: () => true,
    create: vi.fn()
  }

  instance.create.mockReturnValue(instance)
  return instance
})

vi.mock('axios', () => ({
  default: axiosInstanceMock
}))

const useLimitsStoreMock = vi.fn()
vi.mock('@/stores/limitsStore', () => ({
  useLimitsStore: () => useLimitsStoreMock()
}))

const mockedAxios = axiosInstanceMock as unknown as {
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

  it('initializes store correctly', () => {
    const store = useRelationsStore()
    expect(store).toBeDefined()
  })
})
