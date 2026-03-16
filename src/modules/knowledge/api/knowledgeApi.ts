import apiClient from '@/utils/apiClient'

export interface KnowledgeLesson {
  id: number
  public_id: string | null
  status: string
  lesson_type: string
  start: string
  end: string
  started_at: string | null
  student: number
  student_name: string
  student_is_demo: boolean
  content_count: number
  template_count: number
  has_board: boolean
  session_uuid: string | null
  created_at: string
}

/** @deprecated Use LessonTemplate from templateApi.ts for Phase 14+ code. Kept for legacy KnowledgeLibrary.vue */
export interface KnowledgeTemplate {
  id: number
  title: string
  subject: string
  lesson_type: string
  content_count: number
  has_board: boolean
  source_lesson_id: number | null
  created_at: string
}

export const knowledgeApi = {
  async getLessons(): Promise<KnowledgeLesson[]> {
    const res = await apiClient.get('/v1/knowledge/lessons/')
    const data = res as Record<string, unknown>
    return Array.isArray(data) ? data : ((data.results as KnowledgeLesson[]) ?? (data as unknown as KnowledgeLesson[]))
  },
}
