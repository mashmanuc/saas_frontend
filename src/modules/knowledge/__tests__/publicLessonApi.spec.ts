// Phase 13 A3.4: Unit tests for publicLessonApi
// Tests: all API methods, error handling, CDN-cacheable fetch, cursor pagination

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mock global fetch ─────────────────────────────────────────────────────

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// ── Import after mock ─────────────────────────────────────────────────────

import {
  publicLessonApi,
  type PublicLesson,
  type ReplayChunksResponse,
  type PublicMarker,
  type PublicMaterial,
} from '../api/publicLessonApi'

// ── Fixtures ──────────────────────────────────────────────────────────────

const TUTOR_SLUG = 'ivan-petrenko'
const LESSON_SLUG = 'kvadratni-rivnyannya'

const mockLesson: PublicLesson = {
  id: 'lesson-1',
  title: 'Квадратні рівняння',
  slug: LESSON_SLUG,
  description: 'Розв\'язання квадратних рівнянь',
  subject_tag: 'math',
  tutor: {
    name: 'Іван Петренко',
    slug: TUTOR_SLUG,
    avatar_url: 'https://cdn.example.com/avatar.jpg',
    subjects: 'Математика',
    rating: 4.8,
    price_from: 300,
  },
  duration_seconds: 3600,
  board_thumbnail_url: 'https://cdn.example.com/thumb.jpg',
  created_at: '2026-01-15T10:00:00Z',
  visibility: 'public',
}

const mockChunksResponse: ReplayChunksResponse = {
  chunks: [
    {
      chunk_index: 0,
      start_ms: 0,
      end_ms: 10000,
      operations: [
        { op_type: 'stroke_add', page_id: 'p1', data: { id: 's1' }, timestamp_ms: 500 },
      ],
    },
  ],
  next_cursor: 1,
}

const mockMarkers: PublicMarker[] = [
  { id: 'm1', title: 'Вступ', time_seconds: 0 },
  { id: 'm2', title: 'Формула дискримінанта', time_seconds: 120 },
]

const mockMaterials: PublicMaterial[] = [
  { id: 'mat1', title: 'Підручник', type: 'pdf', url: 'https://cdn.example.com/book.pdf' },
]

// ── Helpers ───────────────────────────────────────────────────────────────

function jsonResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  } as Response
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('publicLessonApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getLessonDetail', () => {
    it('fetches lesson detail at correct URL', async () => {
      mockFetch.mockResolvedValue(jsonResponse(mockLesson))

      const result = await publicLessonApi.getLessonDetail(TUTOR_SLUG, LESSON_SLUG)

      expect(mockFetch).toHaveBeenCalledOnce()
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/v1/knowledge/public/lessons/${TUTOR_SLUG}/${LESSON_SLUG}/`,
      )
      expect(result).toEqual(mockLesson)
    })

    it('encodes special characters in slugs', async () => {
      mockFetch.mockResolvedValue(jsonResponse(mockLesson))

      await publicLessonApi.getLessonDetail('tutor with spaces', 'lesson/slash')

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/knowledge/public/lessons/tutor%20with%20spaces/lesson%2Fslash/',
      )
    })

    it('throws on non-OK response with status', async () => {
      mockFetch.mockResolvedValue(jsonResponse(null, 404))

      await expect(
        publicLessonApi.getLessonDetail(TUTOR_SLUG, 'nonexistent'),
      ).rejects.toMatchObject({
        message: 'Public API error: 404',
        status: 404,
      })
    })
  })

  describe('getReplayChunks', () => {
    it('fetches replay without cursor', async () => {
      mockFetch.mockResolvedValue(jsonResponse(mockChunksResponse))

      const result = await publicLessonApi.getReplayChunks(TUTOR_SLUG, LESSON_SLUG)

      expect(mockFetch).toHaveBeenCalledWith(
        `/api/v1/knowledge/public/lessons/${TUTOR_SLUG}/${LESSON_SLUG}/replay/`,
      )
      expect(result.chunks).toHaveLength(1)
      expect(result.next_cursor).toBe(1)
    })

    it('appends cursor parameter when provided', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ chunks: [], next_cursor: null }))

      await publicLessonApi.getReplayChunks(TUTOR_SLUG, LESSON_SLUG, 5)

      expect(mockFetch).toHaveBeenCalledWith(
        `/api/v1/knowledge/public/lessons/${TUTOR_SLUG}/${LESSON_SLUG}/replay/?cursor=5`,
      )
    })

    it('returns next_cursor: null when no more chunks', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ chunks: [], next_cursor: null }))

      const result = await publicLessonApi.getReplayChunks(TUTOR_SLUG, LESSON_SLUG, 99)

      expect(result.next_cursor).toBeNull()
    })
  })

  describe('getMarkers', () => {
    it('fetches markers at correct URL', async () => {
      mockFetch.mockResolvedValue(jsonResponse(mockMarkers))

      const result = await publicLessonApi.getMarkers(TUTOR_SLUG, LESSON_SLUG)

      expect(mockFetch).toHaveBeenCalledWith(
        `/api/v1/knowledge/public/lessons/${TUTOR_SLUG}/${LESSON_SLUG}/markers/`,
      )
      expect(result).toHaveLength(2)
    })
  })

  describe('getBoardState', () => {
    it('fetches board state JSON', async () => {
      const state = { pages: { p1: { strokes: [], assets: [] } } }
      mockFetch.mockResolvedValue(jsonResponse(state))

      const result = await publicLessonApi.getBoardState(TUTOR_SLUG, LESSON_SLUG)

      expect(mockFetch).toHaveBeenCalledWith(
        `/api/v1/knowledge/public/lessons/${TUTOR_SLUG}/${LESSON_SLUG}/board/`,
      )
      expect(result).toEqual(state)
    })
  })

  describe('getMaterials', () => {
    it('fetches materials list', async () => {
      mockFetch.mockResolvedValue(jsonResponse(mockMaterials))

      const result = await publicLessonApi.getMaterials(TUTOR_SLUG, LESSON_SLUG)

      expect(mockFetch).toHaveBeenCalledWith(
        `/api/v1/knowledge/public/lessons/${TUTOR_SLUG}/${LESSON_SLUG}/materials/`,
      )
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('pdf')
    })
  })

  describe('error handling', () => {
    it('rejects with status on 500', async () => {
      mockFetch.mockResolvedValue(jsonResponse(null, 500))

      await expect(
        publicLessonApi.getLessonDetail(TUTOR_SLUG, LESSON_SLUG),
      ).rejects.toMatchObject({ status: 500 })
    })

    it('rejects on network error', async () => {
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'))

      await expect(
        publicLessonApi.getLessonDetail(TUTOR_SLUG, LESSON_SLUG),
      ).rejects.toThrow('Failed to fetch')
    })
  })
})
