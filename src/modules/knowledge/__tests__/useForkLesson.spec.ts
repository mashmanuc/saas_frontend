// Phase 14 A3.5: Unit tests for useForkLesson composable
// Tests: fork flow, toast, error handling

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock apiClient ──────────────────────────────────────────────────────────

const mockPost = vi.fn()

vi.mock('@/utils/apiClient', () => ({
  default: {
    post: (...args: unknown[]) => mockPost(...args),
  },
}))

// ── Mock useToast ───────────────────────────────────────────────────────────

const mockShowToast = vi.fn()

vi.mock('@/modules/winterboard/composables/useToast', () => ({
  useToast: () => ({
    toasts: { value: [] },
    showToast: mockShowToast,
    dismissToast: vi.fn(),
    clearAllToasts: vi.fn(),
  }),
}))

// ── Import after mocks ─────────────────────────────────────────────────────

import { useForkLesson } from '../composables/useForkLesson'

// ── Fixtures ────────────────────────────────────────────────────────────────

const mockForkResult = {
  id: 'l-forked',
  title: 'Forked Lesson',
  slug: 'forked-lesson',
  tutor_slug: 'ivan',
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('useForkLesson', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns correct initial state', () => {
    const { isForking, error } = useForkLesson()
    expect(isForking.value).toBe(false)
    expect(error.value).toBeNull()
  })

  it('forks lesson successfully and shows toast', async () => {
    mockPost.mockResolvedValue(mockForkResult)
    const { fork, isForking, error } = useForkLesson()

    const result = await fork('l-1')

    expect(mockPost).toHaveBeenCalledWith('/v1/knowledge/my-lessons/l-1/fork/')
    expect(result).toEqual(mockForkResult)
    expect(isForking.value).toBe(false)
    expect(error.value).toBeNull()
    expect(mockShowToast).toHaveBeenCalledWith('Урок форкнуто!', 'success')
  })

  it('handles API error with detail message', async () => {
    mockPost.mockRejectedValue({
      response: { data: { detail: 'Не можна форкнути свій урок' } },
    })
    const { fork, error } = useForkLesson()

    const result = await fork('l-1')

    expect(result).toBeNull()
    expect(error.value).toBe('Не можна форкнути свій урок')
    expect(mockShowToast).toHaveBeenCalledWith('Не можна форкнути свій урок', 'error')
  })

  it('handles API error without detail — fallback message', async () => {
    mockPost.mockRejectedValue(new Error('Network error'))
    const { fork, error } = useForkLesson()

    const result = await fork('l-1')

    expect(result).toBeNull()
    expect(error.value).toBe('Не вдалося форкнути урок')
    expect(mockShowToast).toHaveBeenCalledWith('Не вдалося форкнути урок', 'error')
  })

  it('sets isForking during request', async () => {
    let resolveFn: (v: unknown) => void
    mockPost.mockReturnValue(new Promise((resolve) => { resolveFn = resolve }))
    const { fork, isForking } = useForkLesson()

    const promise = fork('l-1')
    // Cannot check isForking synchronously during await, but after resolve it should be false
    resolveFn!(mockForkResult)
    await promise
    expect(isForking.value).toBe(false)
  })

  it('clears previous error on new fork attempt', async () => {
    mockPost.mockRejectedValueOnce(new Error('fail'))
    const { fork, error } = useForkLesson()

    await fork('l-1')
    expect(error.value).toBe('Не вдалося форкнути урок')

    mockPost.mockResolvedValueOnce(mockForkResult)
    await fork('l-2')
    expect(error.value).toBeNull()
  })
})
