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
  lesson_id: string
}

export interface UpdateSnapshotResponse {
  snapshot_url: string
  version: number
}

export interface PrepareSessionResponse {
  wb_session_id: string
  is_new: boolean
}

// ── Conducted lessons (Проведені уроки tab) ─────────────────────────────
export interface ConductedLessonItem {
  id: string
  name: string
  page_count: number
  thumbnail_url: string | null
  rev: number
  updated_at: string
  created_at: string
  has_lesson: boolean
  lesson_info: Record<string, unknown> | null
  folder: number | null
  folder_path: string | null
  has_recording: boolean
  recording_started_at: string | null
  recording_stopped_at: string | null
  recording_duration_seconds: number | null
  is_replay_frozen: boolean
  origin_lesson_id: string | null
  origin_lesson_title: string | null
  /** «З ким урок?» (LAW §9 v1.68): учень проведеного уроку; null — «Без учня». */
  student?: ConductStudent | null
}

/** Учень у «З ким урок?» і в папках «Проведених уроків». */
export interface ConductStudent {
  id: number
  name: string
}

/** Папки-учні «Проведених уроків» з числом уроків (без фільтрів). */
export interface ConductedFolders {
  students: (ConductStudent & { count: number })[]
  none: number
}

export interface ConductedLessonsResponse {
  sessions: ConductedLessonItem[]
  total: number
  offset: number
  limit: number
  has_more: boolean
  folders?: ConductedFolders
}

export interface ConductedLessonsParams {
  offset?: number
  limit?: number
  has_recording?: boolean
  q?: string
  /** Папка учня: id учня або 'none' — «Без учня». */
  student?: number | 'none'
}

// "+ Нова дошка" у Студії — створює draft шаблон + prep сесію одразу.
export interface CreateDraftWithPrepResponse {
  lesson_id: string
  wb_session_id: string
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
  async loadToSession(lessonId: string, studentId: number | null = null): Promise<LoadToSessionResponse> {
    // «З ким урок?» (LAW §9 v1.68): учень — у папку «Проведених уроків»; null — «Без учня».
    const res = await api.post(`${BASE}/lessons/${lessonId}/load-to-session/`, { student_id: studentId })
    return res.data ?? res
  },

  /**
   * POST /api/v1/knowledge/lessons/{id}/update-snapshot/
   * Re-save existing lesson snapshot from current WBSession state.
   * Call after opsSync.flush() so session.state is current.
   */
  async updateSnapshot(lessonId: string, sessionId: string): Promise<UpdateSnapshotResponse> {
    const res = await api.post(`${BASE}/lessons/${lessonId}/update-snapshot/`, { session_id: sessionId })
    return res.data ?? res
  },

  /**
   * POST /api/v1/knowledge/lessons/{id}/prepare/
   * PR 2.2: getOrCreate preparation WBSession for a KnowledgeLesson.
   * 200 — existing session returned; 201 — new session seeded.
   */
  async prepareLesson(lessonId: string): Promise<PrepareSessionResponse> {
    const res = await api.post(`${BASE}/lessons/${lessonId}/prepare/`)
    return res.data ?? res
  },

  /**
   * GET /api/v1/knowledge/my-lessons/conducted/
   * Список проведених уроків tutor'а (lesson-play сесії).
   * Read-only — для вкладки "Проведені уроки" у Моїх уроках.
   */
  /**
   * POST /api/v1/knowledge/lessons/draft-with-prep/
   * Створити порожній draft шаблон + prep WBSession. Для кнопки
   * "+ Нова дошка" у Студії — нова дошка одразу = новий шаблон уроку.
   */
  async createDraftWithPrep(title?: string): Promise<CreateDraftWithPrepResponse> {
    const res = await api.post(`${BASE}/lessons/draft-with-prep/`, title ? { title } : {})
    return res.data ?? res
  },

  async listConducted(params: ConductedLessonsParams = {}): Promise<ConductedLessonsResponse> {
    const query: Record<string, string> = {}
    if (params.offset !== undefined) query.offset = String(params.offset)
    if (params.limit !== undefined) query.limit = String(params.limit)
    if (params.has_recording) query.has_recording = '1'
    if (params.q) query.q = params.q
    if (params.student !== undefined) query.student = String(params.student)
    const res = await api.get(`${BASE}/my-lessons/conducted/`, { params: query })
    return res.data ?? res
  },

  /** «З ким урок?»: активні учні вчителя (і без акаунта), спершу ті, з ким проводили найсвіжіше. */
  async listConductStudents(): Promise<{ students: ConductStudent[] }> {
    const res = await api.get(`${BASE}/my-lessons/conduct-students/`)
    return res.data ?? res
  },

  /** «Змінити учня» на картці проведеного уроку; null — «Без учня». */
  async setConductedStudent(sessionId: string, studentId: number | null): Promise<{ id: string; student: ConductStudent | null }> {
    const res = await api.post(`${BASE}/my-lessons/conducted/${sessionId}/student/`, { student_id: studentId })
    return res.data ?? res
  },
}
