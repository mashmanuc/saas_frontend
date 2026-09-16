/**
 * Teacher Lesson V2 API.
 *
 * TLV2-01: перевірка доступу. TLV2-02: підготовка уроку — бекенд створює нову WBSession
 * з п'ятьма сторінками через Ops і повертає її id; сама дошка відкривається чинним
 * маршрутом Winterboard. Інших викликів у модулі немає.
 *
 * 404 — штатна відповідь «V2 для вас не існує»: сторінка повертає на V1. Решту кодів
 * викликач показує як помилку; автоматичного повтору немає (LAW §12).
 */
import apiClient from '@/utils/apiClient'

export interface TeacherLessonV2Access {
  enabled: true
}

export interface PreparedLessonPage {
  page_id: string
  title: string
  stage_id: string
  page_role: string
}

export interface PreparedLesson {
  session_id: string
  lesson_key: string
  pages: PreparedLessonPage[]
}

export async function fetchTeacherLessonV2Access(): Promise<TeacherLessonV2Access> {
  const res = await apiClient.get('/v1/teacher-lesson-v2/access/')
  return ((res as { data?: TeacherLessonV2Access })?.data ?? res) as TeacherLessonV2Access
}

export async function prepareTeacherLesson(lessonKey: string): Promise<PreparedLesson> {
  const res = await apiClient.post(
    `/v1/teacher-lesson-v2/lessons/${encodeURIComponent(lessonKey)}/prepare/`,
  )
  return ((res as { data?: PreparedLesson })?.data ?? res) as PreparedLesson
}

export function httpStatusOf(err: unknown): number | null {
  const e = err as { response?: { status?: number }; status?: number } | null
  return e?.response?.status ?? e?.status ?? null
}
