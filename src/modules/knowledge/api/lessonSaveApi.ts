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
  folder: string | null           // Phase 24: folder UUID or null (root)
  created_at: string
  updated_at: string
  has_presentation: boolean
  chunk_count: number
  page_count: number              // кількість сторінок у поточному snapshot
  tutor_slug?: string
  board_thumbnail_url?: string    // Phase 25 BUG-6
}

// ── Phase 24: Folder types ──────────────────────────────────────────

export interface LessonFolder {
  id: string
  name: string
  parent: string | null
  order: number
  lesson_count: number
  children_count: number
  created_at: string
  updated_at: string
}

export interface MyLessonsResponse {
  lessons: MyLesson[]
  total: number
  offset: number
  limit: number
  has_more: boolean
}

export interface MyLessonsParams {
  q?: string
  folder?: string
  status?: string
  offset?: number
  limit?: number
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
    // BE повертає { lessons: [...] } (MyLessonsListView). Раніше читали `results`
    // → завжди []; через це GrantTransferModal показувала «немає уроків».
    return Array.isArray(data) ? data : (data.lessons ?? data.results ?? [])
  },

  /** Phase 24: Get my lessons with search, filter, pagination */
  async getMyLessonsFiltered(params: MyLessonsParams = {}): Promise<MyLessonsResponse> {
    const queryParams: Record<string, string> = {}
    if (params.q) queryParams.q = params.q
    if (params.folder) queryParams.folder = params.folder
    if (params.status) queryParams.status = params.status
    if (params.offset !== undefined) queryParams.offset = String(params.offset)
    if (params.limit !== undefined) queryParams.limit = String(params.limit)

    const res = await apiClient.get('/v1/knowledge/my-lessons/', { params: queryParams })
    return res.data ?? res
  },

  /** Phase 24: Get folders */
  async getFolders(): Promise<LessonFolder[]> {
    const res = await apiClient.get('/v1/knowledge/folders/')
    const data = res.data ?? res
    return data.folders ?? []
  },

  /** Phase 24: Create folder */
  async createFolder(name: string, parentId?: string | null): Promise<LessonFolder> {
    const body: Record<string, unknown> = { name }
    if (parentId) body.parent = parentId
    const res = await apiClient.post('/v1/knowledge/folders/create/', body)
    return res.data ?? res
  },

  /** Phase 24: Delete folder */
  async deleteFolder(folderId: string): Promise<void> {
    await apiClient.delete(`/v1/knowledge/folders/${folderId}/`)
  },

  /** Phase 25 BUG-3: Rename folder */
  async renameFolder(folderId: string, name: string): Promise<LessonFolder> {
    const res = await apiClient.patch(`/v1/knowledge/folders/${folderId}/`, { name })
    return res.data ?? res
  },

  /** Phase 25 BUG-4: Move lessons to folder (or root) */
  async bulkMove(lessonIds: string[], folderId: string | null): Promise<{ moved_count: number }> {
    const res = await apiClient.post('/v1/knowledge/my-lessons/bulk-move/', {
      lesson_ids: lessonIds,
      folder_id: folderId,
    })
    return res.data ?? res
  },

  /** Phase 25: Delete lesson (soft delete → status='hidden') */
  async deleteLesson(lessonId: string): Promise<void> {
    await apiClient.delete(`/v1/knowledge/my-lessons/${lessonId}/`)
  },

  /** Phase 25: Update lesson metadata (ONLY metadata, NOT snapshot) */
  async updateLesson(lessonId: string, data: {
    title?: string
    description?: string
    subject_tag?: string
    status?: string
    visibility?: string
    folder?: string | null
  }): Promise<MyLesson> {
    const res = await apiClient.patch(`/v1/knowledge/my-lessons/${lessonId}/`, data)
    return res.data ?? res
  },
}
