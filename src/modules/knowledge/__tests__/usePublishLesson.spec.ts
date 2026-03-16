// Phase 13 A3.4: Unit tests for usePublishLesson composable
// Tests: publish flow, error handling, computed URLs, reset

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock apiClient ────────────────────────────────────────────────────────

const mockPost = vi.fn()

vi.mock('@/utils/apiClient', () => ({
  default: {
    post: (...args: unknown[]) => mockPost(...args),
  },
}))

// ── Import after mocks ───────────────────────────────────────────────────

import { usePublishLesson, type PublishedLesson } from '../composables/usePublishLesson'

// ── Fixtures ─────────────────────────────────────────────────────────────

const mockPublished: PublishedLesson = {
  id: 'kl-1',
  title: 'Квадратні рівняння',
  slug: 'kvadratni-rivnyannya',
  tutor_slug: 'ivan-petrenko',
  status: 'published',
  visibility: 'public',
  created_at: '2026-01-15T10:00:00Z',
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('usePublishLesson', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns correct initial state', () => {
    const { isPublishing, publishedLesson, error, publicUrl, publicAbsoluteUrl } = usePublishLesson()

    expect(isPublishing.value).toBe(false)
    expect(publishedLesson.value).toBeNull()
    expect(error.value).toBeNull()
    expect(publicUrl.value).toBeNull()
    expect(publicAbsoluteUrl.value).toBeNull()
  })

  it('publishes lesson successfully', async () => {
    mockPost.mockResolvedValue(mockPublished)

    const { publish, isPublishing, publishedLesson, error } = usePublishLesson()

    const promise = publish('session-1', { title: 'Квадратні рівняння' })

    // isPublishing should be true while in-flight
    expect(isPublishing.value).toBe(true)

    await promise

    expect(isPublishing.value).toBe(false)
    expect(error.value).toBeNull()
    expect(publishedLesson.value).toEqual(mockPublished)

    expect(mockPost).toHaveBeenCalledWith('/v1/knowledge/my-lessons/publish/', {
      session_id: 'session-1',
      title: 'Квадратні рівняння',
    })
  })

  it('sends all optional fields', async () => {
    mockPost.mockResolvedValue(mockPublished)

    const { publish } = usePublishLesson()

    await publish('session-1', {
      title: 'Test',
      description: 'Desc',
      subject_tag: 'math',
      slug: 'custom-slug',
      visibility: 'demo',
    })

    expect(mockPost).toHaveBeenCalledWith('/v1/knowledge/my-lessons/publish/', {
      session_id: 'session-1',
      title: 'Test',
      description: 'Desc',
      subject_tag: 'math',
      slug: 'custom-slug',
      visibility: 'demo',
    })
  })

  it('computes publicUrl after publish', async () => {
    mockPost.mockResolvedValue(mockPublished)

    const { publish, publicUrl } = usePublishLesson()

    expect(publicUrl.value).toBeNull()

    await publish('session-1', { title: 'Test' })

    expect(publicUrl.value).toBe('/lesson/ivan-petrenko/kvadratni-rivnyannya')
  })

  it('computes publicAbsoluteUrl with origin', async () => {
    mockPost.mockResolvedValue(mockPublished)

    const { publish, publicAbsoluteUrl } = usePublishLesson()

    await publish('session-1', { title: 'Test' })

    expect(publicAbsoluteUrl.value).toBe(
      `${window.location.origin}/lesson/ivan-petrenko/kvadratni-rivnyannya`,
    )
  })

  it('handles API error with detail message', async () => {
    const apiError = {
      response: { data: { detail: 'Session not found' } },
    }
    mockPost.mockRejectedValue(apiError)

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { publish, error, publishedLesson, isPublishing } = usePublishLesson()

    await publish('nonexistent', { title: 'Test' })

    expect(isPublishing.value).toBe(false)
    expect(error.value).toBe('Session not found')
    expect(publishedLesson.value).toBeNull()

    consoleSpy.mockRestore()
  })

  it('handles API error without detail — fallback message', async () => {
    mockPost.mockRejectedValue(new Error('Network error'))

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { publish, error } = usePublishLesson()

    await publish('session-1', { title: 'Test' })

    expect(error.value).toBe('Не вдалося опублікувати урок')

    consoleSpy.mockRestore()
  })

  it('reset clears all state', async () => {
    mockPost.mockResolvedValue(mockPublished)

    const { publish, reset, publishedLesson, error, isPublishing, publicUrl } = usePublishLesson()

    await publish('session-1', { title: 'Test' })
    expect(publishedLesson.value).not.toBeNull()

    reset()

    expect(publishedLesson.value).toBeNull()
    expect(error.value).toBeNull()
    expect(isPublishing.value).toBe(false)
    expect(publicUrl.value).toBeNull()
  })

  it('clears previous error on new publish attempt', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    mockPost.mockRejectedValueOnce(new Error('fail'))
    const { publish, error } = usePublishLesson()

    await publish('session-1', { title: 'Test' })
    expect(error.value).toBeTruthy()

    // Second attempt succeeds
    mockPost.mockResolvedValueOnce(mockPublished)
    await publish('session-1', { title: 'Test' })
    expect(error.value).toBeNull()

    consoleSpy.mockRestore()
  })
})
