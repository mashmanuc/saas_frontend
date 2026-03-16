// Phase 15 A1.1: Catalog API client — categories, search, featured, ratings, collections
// Public endpoints → plain fetch (CDN cached, no auth).
// Authenticated endpoints (rate) → apiClient.
// Ref: AGENT_A_FE_CORE.md A1.1

import type { PublicLesson } from './publicLessonApi'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SubjectCategory {
  id: string
  name: string
  slug: string
  icon: string
  lesson_count: number
  children: SubjectCategory[]
}

export interface CatalogSearchResult extends PublicLesson {
  average_rating: number | null
  rating_count: number
  category_name: string
}

export interface CatalogSearchResponse {
  lessons: CatalogSearchResult[]
  next_cursor: number | null
  total: number
}

export interface CatalogFilters {
  query?: string
  category?: string      // category slug
  min_rating?: number    // 1-5
  sort?: 'popular' | 'newest' | 'top-rated'
  cursor?: number
}

export interface LessonRating {
  id: string
  score: number
  comment: string
  user_name: string
  created_at: string
}

export interface RatingsSummary {
  average_score: number
  rating_count: number
  distribution: Record<number, number>  // {1: 5, 2: 3, 3: 10, 4: 25, 5: 50}
}

export interface LessonCollection {
  id: string
  title: string
  description: string
  slug: string
  is_featured: boolean
  lesson_count: number
}

export interface LessonCollectionDetail extends LessonCollection {
  items: Array<{
    lesson: PublicLesson
    order: number
  }>
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const CATALOG_BASE = '/api/v1/knowledge/catalog'
const PUBLIC_BASE = '/api/v1/knowledge/public'

async function publicFetch<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) {
    const err = new Error(`Catalog API error: ${res.status}`) as Error & { status: number }
    err.status = res.status
    throw err
  }
  return res.json() as Promise<T>
}

// ─── API ────────────────────────────────────────────────────────────────────

export const catalogApi = {
  // ── Categories (public, CDN cached 86400s) ─────────────────────────
  getCategories(): Promise<SubjectCategory[]> {
    return publicFetch<SubjectCategory[]>(`${CATALOG_BASE}/categories/`)
  },

  // ── Search (public, CDN cached 300s) ───────────────────────────────
  search(filters: CatalogFilters = {}): Promise<CatalogSearchResponse> {
    const params = new URLSearchParams()
    if (filters.query) params.set('query', filters.query)
    if (filters.category) params.set('category', filters.category)
    if (filters.min_rating != null) params.set('min_rating', String(filters.min_rating))
    if (filters.sort) params.set('sort', filters.sort)
    if (filters.cursor != null) params.set('cursor', String(filters.cursor))
    const qs = params.toString()
    return publicFetch<CatalogSearchResponse>(`${CATALOG_BASE}/search/${qs ? `?${qs}` : ''}`)
  },

  // ── Featured (public, CDN cached 3600s) ────────────────────────────
  getFeatured(): Promise<CatalogSearchResult[]> {
    return publicFetch<CatalogSearchResult[]>(`${CATALOG_BASE}/featured/`)
  },

  // ── Lesson ratings (public, cached 300s) ───────────────────────────
  getLessonRatings(
    tutorSlug: string,
    lessonSlug: string,
    cursor?: number,
  ): Promise<{ ratings: LessonRating[]; next_cursor: number | null }> {
    const base = `${PUBLIC_BASE}/lessons/${encodeURIComponent(tutorSlug)}/${encodeURIComponent(lessonSlug)}/ratings/`
    const url = cursor != null ? `${base}?cursor=${cursor}` : base
    return publicFetch(url)
  },

  // ── Rate lesson (authenticated) ────────────────────────────────────
  async rateLesson(
    tutorSlug: string,
    lessonSlug: string,
    score: number,
    comment?: string,
  ): Promise<LessonRating> {
    const { default: apiClient } = await import('@/utils/apiClient')
    const res = await apiClient.post(
      `/v1/knowledge/public/lessons/${encodeURIComponent(tutorSlug)}/${encodeURIComponent(lessonSlug)}/rate/`,
      { score, comment: comment || '' },
    )
    return res as LessonRating
  },

  // ── Log view (public, throttled) ───────────────────────────────────
  async logView(tutorSlug: string, lessonSlug: string, source?: string): Promise<void> {
    try {
      await fetch(
        `${PUBLIC_BASE}/lessons/${encodeURIComponent(tutorSlug)}/${encodeURIComponent(lessonSlug)}/view/`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: source || 'direct' }),
        },
      )
    } catch {
      // View logging is best-effort, don't throw
    }
  },

  // ── Collections (public, CDN cached 3600s) ─────────────────────────
  getCollections(): Promise<LessonCollection[]> {
    return publicFetch<LessonCollection[]>('/api/v1/knowledge/collections/')
  },

  getCollectionDetail(slug: string): Promise<LessonCollectionDetail> {
    return publicFetch<LessonCollectionDetail>(
      `/api/v1/knowledge/collections/${encodeURIComponent(slug)}/`,
    )
  },
}
