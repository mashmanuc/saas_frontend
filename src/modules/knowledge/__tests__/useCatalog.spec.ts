// Phase 15 A3.5: Unit tests for useCatalog composable
// Tests: initial state, searchLessons, loadMore, hasMore, filter debounce, error handling

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'

// ── Mock catalogApi ─────────────────────────────────────────────────────────

const mockGetCategories = vi.fn()
const mockSearch = vi.fn()

vi.mock('../api/catalogApi', () => ({
  catalogApi: {
    getCategories: (...args: unknown[]) => mockGetCategories(...args),
    search: (...args: unknown[]) => mockSearch(...args),
  },
}))

// ── Import after mocks ─────────────────────────────────────────────────────

import { useCatalog } from '../composables/useCatalog'

// ── Fixtures ────────────────────────────────────────────────────────────────

const mockSearchResponse = {
  lessons: [{ id: 'l1', title: 'Math basics' }],
  next_cursor: 2,
  total: 10,
}

const mockSearchResponsePage2 = {
  lessons: [{ id: 'l2', title: 'Math advanced' }],
  next_cursor: null,
  total: 10,
}

const mockCategories = [
  { id: 'c1', name: 'Math', slug: 'math', icon: '📐', lesson_count: 5, children: [] },
]

// ── Tests ───────────────────────────────────────────────────────────────────

describe('useCatalog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('has correct initial state', () => {
    const { lessons, categories, isLoading, error, filters, nextCursor, totalCount } = useCatalog()
    expect(lessons.value).toEqual([])
    expect(categories.value).toEqual([])
    expect(isLoading.value).toBe(false)
    expect(error.value).toBeNull()
    expect(filters.sort).toBe('popular')
    expect(nextCursor.value).toBeNull()
    expect(totalCount.value).toBe(0)
  })

  it('loadCategories fetches and stores categories', async () => {
    mockGetCategories.mockResolvedValue(mockCategories)
    const { loadCategories, categories } = useCatalog()

    await loadCategories()
    expect(mockGetCategories).toHaveBeenCalledOnce()
    expect(categories.value).toEqual(mockCategories)
  })

  it('searchLessons(true) resets and fetches first page', async () => {
    mockSearch.mockResolvedValue(mockSearchResponse)
    const { searchLessons, lessons, totalCount, nextCursor } = useCatalog()

    await searchLessons(true)

    expect(mockSearch).toHaveBeenCalledWith(
      expect.objectContaining({ sort: 'popular', cursor: undefined }),
    )
    expect(lessons.value).toEqual(mockSearchResponse.lessons)
    expect(totalCount.value).toBe(10)
    expect(nextCursor.value).toBe(2)
  })

  it('searchLessons(false) appends results', async () => {
    mockSearch.mockResolvedValueOnce(mockSearchResponse)
    const { searchLessons, lessons, nextCursor } = useCatalog()

    await searchLessons(true)

    mockSearch.mockResolvedValueOnce(mockSearchResponsePage2)
    await searchLessons(false)

    expect(lessons.value).toHaveLength(2)
    expect(nextCursor.value).toBeNull()
  })

  it('loadMore does nothing when no cursor', async () => {
    mockSearch.mockResolvedValueOnce({ lessons: [], next_cursor: null, total: 0 })
    const { searchLessons, loadMore } = useCatalog()

    await searchLessons(true)
    mockSearch.mockClear()

    await loadMore()
    expect(mockSearch).not.toHaveBeenCalled()
  })

  it('loadMore fetches next page when cursor exists', async () => {
    mockSearch.mockResolvedValueOnce(mockSearchResponse)
    const { searchLessons, loadMore, lessons } = useCatalog()

    await searchLessons(true)

    mockSearch.mockResolvedValueOnce(mockSearchResponsePage2)
    await loadMore()

    expect(lessons.value).toHaveLength(2)
  })

  it('hasMore returns true when nextCursor is not null', async () => {
    mockSearch.mockResolvedValue(mockSearchResponse)
    const { searchLessons, hasMore } = useCatalog()

    await searchLessons(true)
    expect(hasMore()).toBe(true)
  })

  it('handles API error', async () => {
    mockSearch.mockRejectedValue(new Error('Network error'))
    const { searchLessons, error, isLoading } = useCatalog()

    await searchLessons(true)

    expect(error.value).toBe('Не вдалося завантажити уроки')
    expect(isLoading.value).toBe(false)
  })

  it('debounces filter changes', async () => {
    mockSearch.mockResolvedValue(mockSearchResponse)
    const { filters } = useCatalog()

    filters.query = 'math'
    await nextTick()

    expect(mockSearch).not.toHaveBeenCalled()

    vi.advanceTimersByTime(350)
    await vi.runAllTimersAsync()

    expect(mockSearch).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'math', sort: 'popular' }),
    )
  })

  it('rapid filter changes only trigger one API call', async () => {
    mockSearch.mockResolvedValue(mockSearchResponse)
    const { filters } = useCatalog()

    filters.query = 'math'
    await nextTick()
    vi.advanceTimersByTime(100)

    filters.query = 'physics'
    await nextTick()
    vi.advanceTimersByTime(100)

    filters.query = 'english'
    await nextTick()
    vi.advanceTimersByTime(350)
    await vi.runAllTimersAsync()

    expect(mockSearch).toHaveBeenCalledTimes(1)
    expect(mockSearch).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'english' }),
    )
  })
})
