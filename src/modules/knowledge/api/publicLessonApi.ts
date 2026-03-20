// Phase 13 A1.3: Public Lesson API client
// Public endpoints — optional auth token. Uses plain fetch for CDN-cacheable responses.
// Phase 21: додано optional auth — власник може бачити свої draft уроки.
// Ref: PROGRESS.md Phase 13 — INV-SCALE-1 (ReplayChunks), INV-SCALE-3 (CDN cache), INV-SCALE-5 (cursor pagination)

const PUBLIC_BASE = '/api/v1/knowledge/public'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PublicLessonTutor {
  name: string
  slug: string
  avatar_url: string | null
  subjects: string
  rating: number | null
  price_from: number | null
}

export interface OgMeta {
  title: string
  description: string
  image: string
  time_seconds: number
  time_display: string
  marker_title: string | null
}

export interface PublicLesson {
  id: string
  title: string
  slug: string
  description: string
  subject_tag: string
  tutor: PublicLessonTutor
  duration_seconds: number
  board_thumbnail_url: string | null
  created_at: string
  visibility: 'demo' | 'public'
  views_count?: number
  fork_count?: number
  average_rating?: number | null
  rating_count?: number
  user_rating?: { score: number; comment: string } | null
  is_owner?: boolean
  og_meta?: OgMeta
}

export interface ReplayChunk {
  chunk_index: number
  start_ms: number
  end_ms: number
  operations: ReplayOperation[]
}

export interface ReplayOperation {
  op_type: string
  page_id: string
  data: Record<string, unknown>
  timestamp_ms: number
}

export interface ReplayChunksResponse {
  chunks: ReplayChunk[]
  next_cursor: number | null
}

export interface PublicMarker {
  id: string
  title: string
  time_seconds: number
  category?: string
}

export interface PublicMaterial {
  id: string
  title: string
  type: string
  url?: string | null
}

export interface RelatedLesson {
  id: string
  title: string
  slug: string
  tutor_slug: string
  subject_tag?: string
  board_thumbnail_url?: string | null
  created_at?: string
  views_count?: number
}

export interface LessonPackInfo {
  id: string
  title: string
  slug: string
  tutor_slug: string
  lessons_count: number
  description?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function publicFetch<T>(path: string): Promise<T> {
  // Phase 21: credentials: 'include' — browser sends httpOnly auth cookies,
  // so OptionalJWTAuthentication on BE can identify the owner for draft access.
  const res = await fetch(path, { credentials: 'include' })
  if (!res.ok) {
    const err = new Error(`Public API error: ${res.status}`) as Error & { status: number }
    err.status = res.status
    throw err
  }
  return res.json() as Promise<T>
}

// ─── API ────────────────────────────────────────────────────────────────────

export const publicLessonApi = {
  /**
   * GET /knowledge/public/lessons/{tutorSlug}/{lessonSlug}/
   * Lesson detail — CDN cached (Cache-Control: public, max-age=3600)
   */
  async getLessonDetail(tutorSlug: string, lessonSlug: string, params?: { t?: number }): Promise<PublicLesson> {
    const qs = params?.t != null ? `?t=${params.t}` : ''
    // Phase 26 B3: backend now returns nested tutor object directly
    return publicFetch<PublicLesson>(
      `${PUBLIC_BASE}/lessons/${encodeURIComponent(tutorSlug)}/${encodeURIComponent(lessonSlug)}/${qs}`,
    )
  },

  /**
   * GET /knowledge/public/lessons/{tutorSlug}/{lessonSlug}/replay/?cursor={cursor}
   * ReplayChunks with cursor pagination (INV-SCALE-1, INV-SCALE-5).
   * Max 50 chunks per request. next_cursor === null means no more chunks.
   */
  getReplayChunks(tutorSlug: string, lessonSlug: string, cursor?: number): Promise<ReplayChunksResponse> {
    const base = `${PUBLIC_BASE}/lessons/${encodeURIComponent(tutorSlug)}/${encodeURIComponent(lessonSlug)}/replay/`
    const url = cursor != null ? `${base}?cursor=${cursor}` : base
    return publicFetch<ReplayChunksResponse>(url)
  },

  /**
   * GET /knowledge/public/lessons/{tutorSlug}/{lessonSlug}/markers/
   */
  async getMarkers(tutorSlug: string, lessonSlug: string): Promise<PublicMarker[]> {
    const data = await publicFetch<{ markers: PublicMarker[] } | PublicMarker[]>(
      `${PUBLIC_BASE}/lessons/${encodeURIComponent(tutorSlug)}/${encodeURIComponent(lessonSlug)}/markers/`,
    )
    return Array.isArray(data) ? data : (data?.markers ?? [])
  },

  /**
   * GET /knowledge/public/lessons/{tutorSlug}/{lessonSlug}/board/
   * Final board state JSON — CDN cached (Cache-Control: public, max-age=86400)
   */
  async getBoardState(tutorSlug: string, lessonSlug: string): Promise<Record<string, unknown>> {
    const data = await publicFetch<Record<string, unknown>>(
      `${PUBLIC_BASE}/lessons/${encodeURIComponent(tutorSlug)}/${encodeURIComponent(lessonSlug)}/board/`,
    )
    // BE returns { snapshot_url: "..." } — if so, fetch the actual snapshot JSON
    if (data?.snapshot_url && typeof data.snapshot_url === 'string') {
      try {
        const snap = await fetch(data.snapshot_url as string, { credentials: 'include' })
        if (snap.ok) return snap.json()
      } catch { /* fallback to wrapper */ }
    }
    return data
  },

  /**
   * GET /knowledge/public/lessons/{tutorSlug}/{lessonSlug}/materials/
   */
  async getMaterials(tutorSlug: string, lessonSlug: string): Promise<PublicMaterial[]> {
    const data = await publicFetch<{ materials: PublicMaterial[] } | PublicMaterial[]>(
      `${PUBLIC_BASE}/lessons/${encodeURIComponent(tutorSlug)}/${encodeURIComponent(lessonSlug)}/materials/`,
    )
    return Array.isArray(data) ? data : (data?.materials ?? [])
  },

  /**
   * Phase 16 INT-18: Related lessons by same tutor.
   * GET /knowledge/public/lessons/{tutorSlug}/{lessonSlug}/related/?limit=N
   * Returns array of related lessons (excludes current lesson server-side).
   */
  async getRelatedLessons(tutorSlug: string, lessonSlug: string, limit = 3): Promise<RelatedLesson[]> {
    try {
      return await publicFetch<RelatedLesson[]>(
        `${PUBLIC_BASE}/lessons/${encodeURIComponent(tutorSlug)}/${encodeURIComponent(lessonSlug)}/related/?limit=${limit}`,
      )
    } catch {
      return []
    }
  },

  /**
   * Phase 16 INT-19: Packs that contain this lesson.
   * GET /knowledge/public/lessons/{tutorSlug}/{lessonSlug}/packs/
   * Returns array of packs (empty if lesson is not in any pack).
   */
  async getLessonPacks(tutorSlug: string, lessonSlug: string): Promise<LessonPackInfo[]> {
    try {
      return await publicFetch<LessonPackInfo[]>(
        `${PUBLIC_BASE}/lessons/${encodeURIComponent(tutorSlug)}/${encodeURIComponent(lessonSlug)}/packs/`,
      )
    } catch {
      return []
    }
  },
}
