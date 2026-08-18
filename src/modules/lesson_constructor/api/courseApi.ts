import apiClient from '@/utils/apiClient'

/**
 * API курсів (Ф7). Дзеркалить BE-контракт 7-1/7-2 як є.
 *
 * ⚠️ `apiClient` уже віддає ТІЛО відповіді, не `.data.data` — тому жодних
 * розгортань тут немає (FRONTEND_CONVENTIONS).
 */

// ── Типи, дзеркальні до BE ────────────────────────────────────────────────

export type LessonType = 'intro' | 'practice' | 'generalize' | 'control' | 'repeat'
export type CourseStatus = 'draft' | 'published'

export interface CourseSpec {
  title: string
  level: string
  n_lessons: number
  subject?: string
  topics_scope?: string[] | null
  tasks_per_lesson?: number
  diff_profile?: string
  arc?: string
  checkpoint_every?: number | null
  start_with_repeat?: boolean
  random_seed?: number | null
}

export interface PlannedLesson {
  order: number
  topic_id: string
  title: string
  lesson_type: LessonType
  objective: string
  prerequisites: string[]
  /**
   * ЗАВЖДИ 'ordering'. Це порядок тем у підручниках, НЕ передумови:
   * графа передумов у проєкті не існує (C9). Підпис у UI — «йде після»,
   * і вдавати знання, якого немає, не можна.
   */
  prereq_kind: string
  checkpoint: boolean
  tasks: number
  density: number
  spec: Record<string, unknown>
}

export interface TopicDensity {
  n_bank: number
  by_difficulty: Record<string, number>
}

export interface CoursePlan {
  v: number
  lessons: PlannedLesson[]
  warnings: string[]
  density: Record<string, TopicDensity>
  evidence_version: string
}

export interface PlanPreviewResponse {
  plan: CoursePlan
  warnings: string[]
  density: Record<string, TopicDensity>
}

/** Урок у збереженому курсі. `session_id === null` = ще не матеріалізовано. */
export interface CourseLesson {
  order: number
  topic_id: string
  lesson_type: LessonType
  objective: string
  checkpoint: boolean
  prerequisites: string[]
  prereq_kind: string
  session_id: string | null
}

export interface Course {
  id: number
  title: string
  subject: string
  level: string
  rev: number
  parent_rev: number | null
  status: CourseStatus
  published_at: string | null
  spec: Record<string, unknown>
  plan: CoursePlan
  created_at: string
  /** Немає у короткій картці списку — лише в деталях. */
  lessons?: CourseLesson[]
}

export interface MaterializeReport {
  course_id: number
  created: Array<{ order: number; session_id: string }>
  skipped: Array<{ order: number; reason: string; session_id: string }>
  /** `error` — клас винятку (напр. `TaskSelectionError`), `detail` — текст. */
  failed: Array<{ order: number; error: string; detail: string }>
  total_requested: number
}

const BASE = '/v1/lesson-constructor/courses'

export const courseApi = {
  /** Прев'ю плану. НІЧОГО не зберігає — можна кликати скільки завгодно. */
  async plan(spec: CourseSpec): Promise<PlanPreviewResponse> {
    const res = await apiClient.post(`${BASE}/plan/`, { spec })
    return res as unknown as PlanPreviewResponse
  },

  async list(): Promise<{ courses: Course[] }> {
    const res = await apiClient.get(`${BASE}/`)
    return res as unknown as { courses: Course[] }
  },

  /** Створює чернетку. План BE переобчислює сам зі `spec`. */
  async create(spec: CourseSpec, plan?: CoursePlan): Promise<Course> {
    const res = await apiClient.post(`${BASE}/`, { spec, plan })
    return res as unknown as Course
  },

  async detail(id: number): Promise<Course> {
    const res = await apiClient.get(`${BASE}/${id}/`)
    return res as unknown as Course
  },

  /** `orders` порожній = усі уроки курсу. */
  async materialize(id: number, orders: number[]): Promise<MaterializeReport> {
    const res = await apiClient.post(`${BASE}/${id}/materialize/`, { orders })
    return res as unknown as MaterializeReport
  },

  async publish(id: number): Promise<Course> {
    const res = await apiClient.post(`${BASE}/${id}/publish/`, {})
    return res as unknown as Course
  },
}

export default courseApi
