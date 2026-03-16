// Phase 13 A1.3: Public Lesson API client
// Public endpoints — NO auth token. Uses plain fetch for CDN-cacheable responses.
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
  const res = await fetch(path)
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
    const raw: any = await publicFetch<any>(
      `${PUBLIC_BASE}/lessons/${encodeURIComponent(tutorSlug)}/${encodeURIComponent(lessonSlug)}/${qs}`,
    )
    // BUG-9 fix: BE returns flat tutor_name/tutor_slug/tutor_avatar_url,
    // FE expects nested tutor: { name, slug, avatar_url, ... }
    if (raw.tutor_name != null && !raw.tutor) {
      raw.tutor = {
        name: raw.tutor_name ?? '',
        slug: raw.tutor_slug ?? tutorSlug,
        avatar_url: raw.tutor_avatar_url ?? null,
        subjects: raw.subject_tag ?? '',
        rating: raw.average_rating ?? null,
        price_from: null,
      }
    }
    return raw as PublicLesson
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
  getMarkers(tutorSlug: string, lessonSlug: string): Promise<PublicMarker[]> {
    return publicFetch<PublicMarker[]>(
      `${PUBLIC_BASE}/lessons/${encodeURIComponent(tutorSlug)}/${encodeURIComponent(lessonSlug)}/markers/`,
    )
  },

  /**
   * GET /knowledge/public/lessons/{tutorSlug}/{lessonSlug}/board/
   * Final board state JSON — CDN cached (Cache-Control: public, max-age=86400)
   */
  getBoardState(tutorSlug: string, lessonSlug: string): Promise<Record<string, unknown>> {
    return publicFetch<Record<string, unknown>>(
      `${PUBLIC_BASE}/lessons/${encodeURIComponent(tutorSlug)}/${encodeURIComponent(lessonSlug)}/board/`,
    )
  },

  /**
   * GET /knowledge/public/lessons/{tutorSlug}/{lessonSlug}/materials/
   */
  getMaterials(tutorSlug: string, lessonSlug: string): Promise<PublicMaterial[]> {
    return publicFetch<PublicMaterial[]>(
      `${PUBLIC_BASE}/lessons/${encodeURIComponent(tutorSlug)}/${encodeURIComponent(lessonSlug)}/materials/`,
    )
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
