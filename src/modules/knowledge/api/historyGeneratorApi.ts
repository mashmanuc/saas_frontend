/**
 * «Згенерувати урок історії» (2026-10-09).
 *
 * Доступ вирішує лише бекенд (`HISTORY_GENERATOR_USER_IDS`): поза списком `program/` віддає 404 —
 * тоді кнопки немає. FE-прапорця немає й не буде (той самий взірець, що Teacher Lesson V2).
 */
import apiClient from '@/utils/apiClient'

export interface ProgramItem {
  id: string
  text: string
}

export interface ProgramSection {
  id: string
  title: string
  items: ProgramItem[]
}

export interface ProgramGrade {
  grade: number
  sections: ProgramSection[]
}

export interface HistoryProgram {
  subject?: string
  grades: ProgramGrade[]
}

export type HistoryJobStatus =
  | 'queued' | 'sources' | 'writing' | 'checking' | 'rewriting' | 'saving'
  | 'ready' | 'refused' | 'failed'

export interface HistoryJob {
  id: string
  status: HistoryJobStatus
  content_id: string
  topic: string
  reason?: string | null
  lesson_id?: string | null
  title?: string | null
  scenes?: number | null
  dropped?: number | null
  articles?: string[] | null
}

export const FINAL_STATUSES: HistoryJobStatus[] = ['ready', 'refused', 'failed']

export function httpStatusOf(err: unknown): number | null {
  const e = err as { response?: { status?: number }; status?: number } | null
  return e?.response?.status ?? e?.status ?? null
}

function body<T>(res: unknown): T {
  return ((res as { data?: T })?.data ?? res) as T
}

/** Програма МОН для вибору теми; `null` — генерації для цього вчителя «не існує» (404). */
export async function fetchHistoryProgram(): Promise<HistoryProgram | null> {
  try {
    // Тихо: сторінка «Мої уроки» питає це для КОЖНОГО вчителя, а 404 — звичайна відповідь.
    return body<HistoryProgram>(await apiClient.get('/v1/history-lessons/program/', { meta: { skipLoader: true } }))
  } catch (err) {
    if (httpStatusOf(err) === 404) return null
    throw err
  }
}

export async function startHistoryGeneration(contentId: string, topic: string): Promise<{ job_id: string }> {
  return body<{ job_id: string }>(
    await apiClient.post('/v1/history-lessons/generate/', { content_id: contentId, topic }),
  )
}

export async function fetchHistoryJob(jobId: string): Promise<HistoryJob> {
  return body<HistoryJob>(await apiClient.get(`/v1/history-lessons/generate/${encodeURIComponent(jobId)}/`, {
    meta: { skipLoader: true },          // опитування стану раз на 2 с — без глобального лоадера
  }))
}
