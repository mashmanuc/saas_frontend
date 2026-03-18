// Phase 21: Save/Load lesson API client — Knowledge Layer (Core)
// Ref: PHASE21_KNOWLEDGE_CORE.md

import apiClient from '@/utils/apiClient'

export interface SaveLessonRequest {
  session_id: string
  title: string
}

export interface SaveLessonResponse {
  id: string
  title: string
  status: string
  created_at: string
}

export interface LoadLessonResponse {
  session_id: string
  name: string
}

export interface MyLesson {
  id: string
  title: string
  description: string
  subject_tag: string
  slug: string
  status: string
  visibility: string
  fork_depth: number
  source_session_id: string | null
  created_at: string
  updated_at: string
  has_presentation: boolean
  chunk_count: number
  tutor_slug?: string
}

export const lessonSaveApi = {
  /** Save current session as a draft lesson */
  async saveLessonFromSession(data: SaveLessonRequest): Promise<SaveLessonResponse> {
    const res = await apiClient.post('/v1/knowledge/save-from-session/', data)
    return res.data ?? res
  },

  /** Create a new session from a lesson snapshot (INV-4: copy, not link) */
  async createSessionFromLesson(lessonId: string): Promise<LoadLessonResponse> {
    const res = await apiClient.post('/v1/knowledge/create-session-from-lesson/', {
      lesson_id: lessonId,
    })
    return res.data ?? res
  },

  /** Get my lessons list (existing endpoint) */
  async getMyLessons(): Promise<MyLesson[]> {
    const res = await apiClient.get('/v1/knowledge/my-lessons/')
    const data = res.data ?? res
    return Array.isArray(data) ? data : (data.results ?? [])
  },
}
