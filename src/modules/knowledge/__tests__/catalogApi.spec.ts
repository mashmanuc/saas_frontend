// Phase 15 A3.5: Unit tests for catalogApi
// Tests: all public + auth methods, error handling

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock global fetch ───────────────────────────────────────────────────────

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// ── Mock apiClient for rateLesson (dynamic import) ──────────────────────────

const mockPost = vi.fn()

vi.mock('@/utils/apiClient', () => ({
  default: {
    post: (...args: unknown[]) => mockPost(...args),
  },
}))

// ── Import after mocks ─────────────────────────────────────────────────────

import { catalogApi } from '../api/catalogApi'

// ── Helpers ─────────────────────────────────────────────────────────────────

function mockOkFetch(data: unknown) {
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(data),
  })
}

function mockErrorFetch(status: number) {
  mockFetch.mockResolvedValue({ ok: false, status })
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('catalogApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getCategories', () => {
    it('fetches categories at correct URL', async () => {
      const cats = [{ id: 'c1', name: 'Math', slug: 'math', icon: '📐', lesson_count: 10, children: [] }]
      mockOkFetch(cats)
      const res = await catalogApi.getCategories()
      expect(mockFetch).toHaveBeenCalledWith('/api/v1/knowledge/catalog/categories/')
      expect(res).toEqual(cats)
    })

    it('throws on error response', async () => {
      mockErrorFetch(500)
      await expect(catalogApi.getCategories()).rejects.toThrow('500')
    })
  })

  describe('search', () => {
    it('calls search without params when no filters', async () => {
      const data = { lessons: [], next_cursor: null, total: 0 }
      mockOkFetch(data)
      await catalogApi.search()
      expect(mockFetch).toHaveBeenCalledWith('/api/v1/knowledge/catalog/search/')
    })

    it('builds query string from filters', async () => {
      mockOkFetch({ lessons: [], next_cursor: null, total: 0 })
      await catalogApi.search({ query: 'math', category: 'algebra', min_rating: 4, sort: 'newest', cursor: 5 })
      const url = mockFetch.mock.calls[0][0] as string
      expect(url).toContain('query=math')
      expect(url).toContain('category=algebra')
      expect(url).toContain('min_rating=4')
      expect(url).toContain('sort=newest')
      expect(url).toContain('cursor=5')
    })

    it('omits undefined filter values', async () => {
      mockOkFetch({ lessons: [], next_cursor: null, total: 0 })
      await catalogApi.search({ sort: 'top-rated' })
      const url = mockFetch.mock.calls[0][0] as string
      expect(url).toContain('sort=top-rated')
      expect(url).not.toContain('query=')
      expect(url).not.toContain('category=')
    })
  })

  describe('getFeatured', () => {
    it('fetches featured lessons', async () => {
      const featured = [{ id: 'l1', title: 'Featured' }]
      mockOkFetch(featured)
      const res = await catalogApi.getFeatured()
      expect(mockFetch).toHaveBeenCalledWith('/api/v1/knowledge/catalog/featured/')
      expect(res).toEqual(featured)
    })
  })

  describe('getLessonRatings', () => {
    it('fetches ratings without cursor', async () => {
      const data = { ratings: [], next_cursor: null }
      mockOkFetch(data)
      await catalogApi.getLessonRatings('ivan', 'lesson-1')
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/knowledge/public/lessons/ivan/lesson-1/ratings/',
      )
    })

    it('appends cursor param', async () => {
      mockOkFetch({ ratings: [], next_cursor: null })
      await catalogApi.getLessonRatings('ivan', 'lesson-1', 5)
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/knowledge/public/lessons/ivan/lesson-1/ratings/?cursor=5',
      )
    })

    it('encodes special characters in slugs', async () => {
      mockOkFetch({ ratings: [], next_cursor: null })
      await catalogApi.getLessonRatings('іван петренко', 'мій-урок')
      const url = mockFetch.mock.calls[0][0] as string
      expect(url).toContain(encodeURIComponent('іван петренко'))
      expect(url).toContain(encodeURIComponent('мій-урок'))
    })
  })

  describe('rateLesson', () => {
    it('POSTs rating via apiClient', async () => {
      const rating = { id: 'r1', score: 5, comment: 'Great', user_name: 'Test', created_at: '2026-01-01' }
      mockPost.mockResolvedValue(rating)
      const res = await catalogApi.rateLesson('ivan', 'lesson-1', 5, 'Great')
      expect(mockPost).toHaveBeenCalledWith(
        '/v1/knowledge/public/lessons/ivan/lesson-1/rate/',
        { score: 5, comment: 'Great' },
      )
      expect(res).toEqual(rating)
    })

    it('sends empty comment when not provided', async () => {
      mockPost.mockResolvedValue({})
      await catalogApi.rateLesson('ivan', 'lesson-1', 4)
      expect(mockPost).toHaveBeenCalledWith(
        '/v1/knowledge/public/lessons/ivan/lesson-1/rate/',
        { score: 4, comment: '' },
      )
    })
  })

  describe('logView', () => {
    it('POSTs view log with source', async () => {
      mockFetch.mockResolvedValue({ ok: true })
      await catalogApi.logView('ivan', 'lesson-1', 'catalog')
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/knowledge/public/lessons/ivan/lesson-1/view/',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ source: 'catalog' }),
        }),
      )
    })

    it('uses direct as default source', async () => {
      mockFetch.mockResolvedValue({ ok: true })
      await catalogApi.logView('ivan', 'lesson-1')
      const body = JSON.parse((mockFetch.mock.calls[0][1] as { body: string }).body)
      expect(body.source).toBe('direct')
    })

    it('does not throw on network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network'))
      await expect(catalogApi.logView('ivan', 'lesson-1')).resolves.toBeUndefined()
    })
  })

  describe('getCollections', () => {
    it('fetches collections list', async () => {
      const cols = [{ id: 'c1', title: 'Best of', slug: 'best', lesson_count: 5 }]
      mockOkFetch(cols)
      const res = await catalogApi.getCollections()
      expect(mockFetch).toHaveBeenCalledWith('/api/v1/knowledge/collections/')
      expect(res).toEqual(cols)
    })
  })

  describe('getCollectionDetail', () => {
    it('fetches collection detail with encoded slug', async () => {
      const detail = { id: 'c1', title: 'Best', items: [] }
      mockOkFetch(detail)
      const res = await catalogApi.getCollectionDetail('best-of')
      expect(mockFetch).toHaveBeenCalledWith('/api/v1/knowledge/collections/best-of/')
      expect(res).toEqual(detail)
    })

    it('throws on 404', async () => {
      mockErrorFetch(404)
      await expect(catalogApi.getCollectionDetail('missing')).rejects.toThrow('404')
    })
  })
})
