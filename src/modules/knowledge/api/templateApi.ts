// Phase 14 A1.1: Template, Fork, Clone, Pack API client
// Authenticated endpoints → apiClient (axios with auth).
// Public pack endpoint → plain fetch (CDN cached, no auth).
// Ref: AGENT_A_FE_CORE.md A1.1

import apiClient from '@/utils/apiClient'
import type { PublicLesson } from './publicLessonApi'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface LessonTemplate {
  id: string
  source_lesson_title: string
  source_lesson_slug: string
  tutor_name: string
  tutor_slug: string
  tutor_avatar_url: string | null
  is_community: boolean
  used_count: number
  subject_tag: string
  difficulty_level: number // 1-5
  board_thumbnail_url: string | null
  created_at: string
}

export interface LessonTemplateDetail extends LessonTemplate {
  description: string
  markers: Array<{ title: string; lesson_time_seconds: number; category: string }>
  snapshot_url: string
}

export interface TemplateFilters {
  subject?: string
  difficulty_min?: number
  difficulty_max?: number
  sort?: 'popular' | 'newest'
  cursor?: number
}

export interface TemplateListResponse {
  templates: LessonTemplate[]
  next_cursor: number | null
  total_count: number
}

export interface CloneResult {
  session_id: string
  session_name: string
}

export interface ForkResult {
  id: string
  title: string
  slug: string
  tutor_slug: string
}

export interface LessonPack {
  id: string
  title: string
  description: string
  slug: string
  status: 'draft' | 'public' | 'hidden'
  lesson_count: number
  tutor_name: string
  tutor_slug: string
  created_at: string
}

export interface LessonPackDetail extends LessonPack {
  items: Array<{
    lesson: PublicLesson
    order: number
  }>
}

export interface CreatePackData {
  title: string
  description?: string
  slug?: string
  lesson_ids: string[]
  status?: 'draft' | 'public'
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildFilterParams(filters: TemplateFilters): string {
  const params = new URLSearchParams()
  if (filters.subject) params.set('subject', filters.subject)
  if (filters.difficulty_min != null) params.set('difficulty_min', String(filters.difficulty_min))
  if (filters.difficulty_max != null) params.set('difficulty_max', String(filters.difficulty_max))
  if (filters.sort) params.set('sort', filters.sort)
  if (filters.cursor != null) params.set('cursor', String(filters.cursor))
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

// ─── API ────────────────────────────────────────────────────────────────────

export const templateApi = {
  // ── Templates (authenticated) ─────────────────────────────────────────

  /**
   * GET /api/v1/knowledge/lesson-templates/library/?subject=&difficulty_min=&sort=&cursor=
   * Cursor pagination, returns templates list + next_cursor + total_count.
   */
  async getTemplates(filters: TemplateFilters = {}): Promise<TemplateListResponse> {
    const qs = buildFilterParams(filters)
    const raw: any = await apiClient.get(`/v1/knowledge/lesson-templates/library/${qs}`)
    // BUG-6 fix: BE returns { total }, FE expects { total_count }
    return {
      templates: raw.templates ?? [],
      next_cursor: raw.next_cursor ?? null,
      total_count: raw.total_count ?? raw.total ?? 0,
    }
  },

  /**
   * GET /api/v1/knowledge/lesson-templates/{id}/
   */
  async getTemplateDetail(id: string): Promise<LessonTemplateDetail> {
    const res = await apiClient.get(`/v1/knowledge/lesson-templates/${encodeURIComponent(id)}/`)
    return res as LessonTemplateDetail
  },

  /**
   * POST /api/v1/knowledge/lesson-templates/
   * Save a published lesson as a reusable template.
   */
  async saveAsTemplate(payload: {
    lesson_id: string
    is_community: boolean
    difficulty_level: number
  }): Promise<LessonTemplate> {
    const res = await apiClient.post('/v1/knowledge/lesson-templates/', payload)
    return res as LessonTemplate
  },

  /**
   * POST /api/v1/knowledge/lesson-templates/{id}/clone/
   * Clone template → creates new WBSession with board state.
   * Returns { session_id, session_name }.
   */
  async cloneTemplate(id: string): Promise<CloneResult> {
    const res = await apiClient.post(`/v1/knowledge/lesson-templates/${encodeURIComponent(id)}/clone/`)
    return res as CloneResult
  },

  // ── Fork (authenticated) ──────────────────────────────────────────────

  /**
   * POST /api/v1/knowledge/my-lessons/{lessonId}/fork/
   * Fork a public lesson → creates new KnowledgeLesson under current tutor.
   */
  async forkLesson(lessonId: string): Promise<ForkResult> {
    const res = await apiClient.post(`/v1/knowledge/my-lessons/${encodeURIComponent(lessonId)}/fork/`)
    return res as ForkResult
  },

  /**
   * GET /api/v1/knowledge/my-lessons/{lessonId}/forks/
   * Get fork count and list for a lesson.
   */
  async getLessonForks(lessonId: string): Promise<{ fork_count: number; forks: ForkResult[] }> {
    const res = await apiClient.get(
      `/v1/knowledge/my-lessons/${encodeURIComponent(lessonId)}/forks/`,
    )
    return res as { fork_count: number; forks: ForkResult[] }
  },

  // ── Packs (authenticated) ─────────────────────────────────────────────

  /**
   * GET /api/v1/knowledge/packs/
   */
  async getMyPacks(): Promise<LessonPack[]> {
    const res = await apiClient.get('/v1/knowledge/packs/')
    // BUG-1 fix: BE returns { packs: [...] } wrapper, unwrap it
    return Array.isArray(res) ? res : ((res as any).packs ?? [])
  },

  /**
   * POST /api/v1/knowledge/packs/
   */
  async createPack(payload: CreatePackData): Promise<LessonPack> {
    const res = await apiClient.post('/v1/knowledge/packs/', payload)
    return res as LessonPack
  },

  /**
   * PATCH /api/v1/knowledge/packs/{id}/
   */
  async updatePack(id: string, payload: Partial<CreatePackData>): Promise<LessonPack> {
    const res = await apiClient.patch(`/v1/knowledge/packs/${encodeURIComponent(id)}/`, payload)
    return res as LessonPack
  },

  /**
   * DELETE /api/v1/knowledge/packs/{id}/
   */
  async deletePack(id: string): Promise<void> {
    await apiClient.delete(`/v1/knowledge/packs/${encodeURIComponent(id)}/`)
  },

  // ── Public pack (no auth, CDN cached) ─────────────────────────────────

  /**
   * GET /api/v1/knowledge/public/packs/{tutorSlug}/{packSlug}/
   * Public endpoint — plain fetch (no auth token).
   */
  async getPublicPack(tutorSlug: string, packSlug: string): Promise<LessonPackDetail> {
    const url = `/api/v1/knowledge/public/packs/${encodeURIComponent(tutorSlug)}/${encodeURIComponent(packSlug)}/`
    const res = await fetch(url)
    if (!res.ok) {
      const err = new Error(`Public pack API error: ${res.status}`) as Error & { status: number }
      err.status = res.status
      throw err
    }
    return res.json() as Promise<LessonPackDetail>
  },
}
