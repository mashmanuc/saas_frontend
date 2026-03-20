/**
 * Phase 22: Lesson View API client.
 * Unified endpoint for lesson consumption with access context.
 *
 * Endpoints:
 * - GET /api/v1/knowledge/lessons/{slug}/ — lesson detail + access
 * - POST /api/v1/knowledge/lessons/{id}/share/ — generate share link
 * - DELETE /api/v1/knowledge/lessons/{id}/share/ — revoke share link
 */
import api from '@/utils/apiClient'

const BASE = '/v1/knowledge'

// ─── Types ──────────────────────────────────────────────────────────────

export interface LessonTutor {
  id: number
  name: string
  slug: string | null
  photo: string | null
}

export interface LessonData {
  id: string
  slug: string
  title: string
  description: string
  subject_tag: string
  status: string
  visibility: string
  tutor: LessonTutor
  snapshot_url: string | null
  snapshot_version: number | null
  created_at: string
  updated_at: string
}

export interface AccessContext {
  can_view: boolean
  can_replay: boolean
  source: 'PUBLIC' | 'SHARE' | 'RELATION' | 'OWNER' | 'NONE'
}

export interface LessonViewResponse {
  lesson: LessonData
  access: AccessContext
}

export interface ShareLinkResponse {
  share_url: string
  share_enabled: boolean
  expires_at: string
}

export interface QuickOpenResponse {
  lesson_id: string
  title: string
  board_state_url: string | null
  snapshot_version: number | null
}

export interface LoadToSessionResponse {
  session_id: string
  board_id: string
  name: string
}

// ─── API ────────────────────────────────────────────────────────────────

export const lessonViewApi = {
  /**
   * GET /api/v1/knowledge/lessons/{slug}/
   * Fetch lesson with access context.
   * Optional ?token= for share link access.
   */
  async getLesson(slug: string, shareToken?: string): Promise<LessonViewResponse> {
    const params: Record<string, string> = {}
    if (shareToken) {
      params.token = shareToken
    }
    const res = await api.get(`${BASE}/lessons/${slug}/`, { params })
    return res.data ?? res
  },

  /**
   * POST /api/v1/knowledge/lessons/{id}/share/
   * Generate share link (regenerates token each time).
   */
  async generateShareLink(lessonId: string): Promise<ShareLinkResponse> {
    const res = await api.post(`${BASE}/lessons/${lessonId}/share/`)
    return res.data ?? res
  },

  /**
   * DELETE /api/v1/knowledge/lessons/{id}/share/
   * Revoke share link.
   */
  async revokeShareLink(lessonId: string): Promise<{ share_enabled: boolean }> {
    const res = await api.delete(`${BASE}/lessons/${lessonId}/share/`)
    return res.data ?? res
  },

  /**
   * GET /api/v1/knowledge/lessons/{id}/open/
   * Phase 23: Quick open — get board_state_url + title.
   */
  async quickOpen(lessonId: string): Promise<QuickOpenResponse> {
    const res = await api.get(`${BASE}/lessons/${lessonId}/open/`)
    return res.data ?? res
  },

  /**
   * POST /api/v1/knowledge/lessons/{id}/load-to-session/
   * Phase 23: Load lesson into new session.
   */
  async loadToSession(lessonId: string): Promise<LoadToSessionResponse> {
    const res = await api.post(`${BASE}/lessons/${lessonId}/load-to-session/`)
    return res.data ?? res
  },
}
