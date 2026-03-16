// Phase 14 A3.5: Unit tests for useTemplateLibrary composable
// Tests: loadTemplates, loadMore, filters, debounce, error handling, abort

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'

// ── Mock apiClient ──────────────────────────────────────────────────────────

const mockGet = vi.fn()

vi.mock('@/utils/apiClient', () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
  },
}))

// ── Import after mocks ─────────────────────────────────────────────────────

import { useTemplateLibrary } from '../composables/useTemplateLibrary'

// ── Fixtures ────────────────────────────────────────────────────────────────

const mockTemplate = {
  id: 'tmpl-1',
  source_lesson_title: 'Test Lesson',
  source_lesson_slug: 'test-lesson',
  tutor_name: 'Ivan',
  tutor_slug: 'ivan',
  tutor_avatar_url: null,
  is_community: true,
  used_count: 10,
  subject_tag: 'math',
  difficulty_level: 3,
  board_thumbnail_url: null,
  created_at: '2026-03-16T10:00:00Z',
}

const mockResponse = {
  templates: [mockTemplate],
  next_cursor: 2,
  total_count: 15,
}

const mockResponsePage2 = {
  templates: [{ ...mockTemplate, id: 'tmpl-2' }],
  next_cursor: null,
  total_count: 15,
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('useTemplateLibrary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns correct initial state', () => {
    const { templates, isLoading, error, totalCount, nextCursor, filters } = useTemplateLibrary()
    expect(templates.value).toEqual([])
    expect(isLoading.value).toBe(false)
    expect(error.value).toBeNull()
    expect(totalCount.value).toBe(0)
    expect(nextCursor.value).toBeNull()
    expect(filters.sort).toBe('popular')
  })

  it('loadTemplates(true) resets and fetches first page', async () => {
    mockGet.mockResolvedValue(mockResponse)
    const { loadTemplates, templates, totalCount, nextCursor } = useTemplateLibrary()

    await loadTemplates(true)

    expect(mockGet).toHaveBeenCalledWith('/v1/knowledge/lesson-templates/library/?sort=popular')
    expect(templates.value).toEqual([mockTemplate])
    expect(totalCount.value).toBe(15)
    expect(nextCursor.value).toBe(2)
  })

  it('loadTemplates(false) appends to existing templates', async () => {
    mockGet.mockResolvedValueOnce(mockResponse)
    const { loadTemplates, templates, nextCursor } = useTemplateLibrary()

    await loadTemplates(true)
    expect(templates.value).toHaveLength(1)

    mockGet.mockResolvedValueOnce(mockResponsePage2)
    await loadTemplates(false)

    expect(templates.value).toHaveLength(2)
    expect(nextCursor.value).toBeNull()
  })

  it('loadMore does nothing when nextCursor is null', async () => {
    mockGet.mockResolvedValue({ templates: [], next_cursor: null, total_count: 0 })
    const { loadTemplates, loadMore } = useTemplateLibrary()

    await loadTemplates(true)
    mockGet.mockClear()

    await loadMore()
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('loadMore fetches next page when cursor exists', async () => {
    mockGet.mockResolvedValueOnce(mockResponse)
    const { loadTemplates, loadMore, templates } = useTemplateLibrary()

    await loadTemplates(true)

    mockGet.mockResolvedValueOnce(mockResponsePage2)
    await loadMore()

    expect(templates.value).toHaveLength(2)
    expect(mockGet).toHaveBeenLastCalledWith('/v1/knowledge/lesson-templates/library/?sort=popular&cursor=2')
  })

  it('hasMore returns true when nextCursor is not null', async () => {
    mockGet.mockResolvedValue(mockResponse)
    const { loadTemplates, hasMore } = useTemplateLibrary()

    await loadTemplates(true)
    expect(hasMore()).toBe(true)
  })

  it('hasMore returns false when nextCursor is null', async () => {
    mockGet.mockResolvedValue({ templates: [], next_cursor: null, total_count: 0 })
    const { loadTemplates, hasMore } = useTemplateLibrary()

    await loadTemplates(true)
    expect(hasMore()).toBe(false)
  })

  it('handles API error', async () => {
    mockGet.mockRejectedValue({
      response: { data: { detail: 'Server error' } },
    })
    const { loadTemplates, error, isLoading } = useTemplateLibrary()

    await loadTemplates(true)

    expect(error.value).toBe('Server error')
    expect(isLoading.value).toBe(false)
  })

  it('handles API error without detail — fallback message', async () => {
    mockGet.mockRejectedValue(new Error('Network error'))
    const { loadTemplates, error } = useTemplateLibrary()

    await loadTemplates(true)

    expect(error.value).toBe('Не вдалося завантажити шаблони')
  })

  it('filter change triggers debounced reload', async () => {
    mockGet.mockResolvedValue(mockResponse)
    const { filters } = useTemplateLibrary()

    filters.subject = 'physics'
    await nextTick()

    // Before debounce fires, no new call
    expect(mockGet).not.toHaveBeenCalled()

    // Advance timers past debounce
    vi.advanceTimersByTime(350)
    // Allow the async loadTemplates to resolve
    await vi.runAllTimersAsync()

    expect(mockGet).toHaveBeenCalledWith(
      '/v1/knowledge/lesson-templates/library/?subject=physics&sort=popular',
    )
  })

  it('rapid filter changes only trigger one API call (debounce)', async () => {
    mockGet.mockResolvedValue(mockResponse)
    const { filters } = useTemplateLibrary()

    filters.subject = 'math'
    await nextTick()
    vi.advanceTimersByTime(100)

    filters.subject = 'physics'
    await nextTick()
    vi.advanceTimersByTime(100)

    filters.subject = 'english'
    await nextTick()
    vi.advanceTimersByTime(350)
    await vi.runAllTimersAsync()

    // Should only have called once with the final value
    expect(mockGet).toHaveBeenCalledTimes(1)
    expect(mockGet).toHaveBeenCalledWith(
      '/v1/knowledge/lesson-templates/library/?subject=english&sort=popular',
    )
  })
})
