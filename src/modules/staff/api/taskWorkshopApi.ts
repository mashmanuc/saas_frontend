/**
 * Staff: майстерня банку задач (власник 2026-10-23; ТЗ saas_docs/domains/learning_program/TZ_TASK_WORKSHOP_ADMIN_2026-10-23.md).
 * Бекенд — apps/staff/api/task_workshop_views.py → apps/lesson_constructor/services/task_workshop.py.
 * «Перевірено мною» не впливає на добір задач, доки тема не стала «готовою» (10 чинних перевірок на кожен рівень —
 * тоді урок з теми бере лише перевірені, власник 2026-10-24); «відхилити» прибирає задачу з добору.
 * Джерело: наші / чужі (старі банки, лише перегляд і «відхилити») / усі.
 * Кожен запис несе `expected_revision`: якщо задачу змінили з іншого місця — 409, сторінку треба оновити.
 */
import apiClient from '@/utils/apiClient'

export type WorkshopState = 'all' | 'new' | 'verified' | 'rejected' | 'edited'
export type WorkshopSource = 'ours' | 'foreign' | 'all'

/** Скільки чинних перевірок на рівні треба, щоб тема стала готовою (бекенд: owner_ready.READY_PER_LEVEL). */
export const READY_PER_LEVEL = 10

export interface WorkshopTopic {
  id: string
  label: string
  parent: string | null
  total: number
  /** Чинні перевірки власника (лише наші задачі) = сума `levels`. */
  verified: number
  /** Чинні перевірки на рівнях 1–5. */
  levels: number[]
  ready: boolean
}

export interface WorkshopListItem {
  id: number
  external_id: string
  problem_type: string
  text: string
  topic: string
  level: number | null
  verified: boolean
  stale: boolean
  rejected: boolean
  edited: boolean
  foreign: boolean
}

export interface WorkshopList {
  items: WorkshopListItem[]
  total: number
  page: number
  page_size: number
}

export interface WorkshopChoice {
  label?: string
  text: string
  is_correct: boolean
}

export interface WorkshopMatchItem {
  id: string
  text: string
}

export interface WorkshopContent {
  choices?: WorkshopChoice[]
  correct_answer?: string
  answer_type?: string
  left_items?: WorkshopMatchItem[]
  right_items?: WorkshopMatchItem[]
  correct_pairs?: [string, string][]
  [key: string]: unknown
}

export interface WorkshopEdit {
  id: number
  field: 'text' | 'content' | 'solution'
  before: unknown
  after: unknown
  reason: string
  at: string
  by: string | null
  reverts: number | null
}

export interface WorkshopTask {
  id: number
  external_id: string
  problem_type: string
  text: string
  content: WorkshopContent
  solution: string
  raw_topics: string[]
  topic: string
  tags: string[]
  source: string
  difficulty: number | null
  computed_difficulty: number | null
  resources: { resource_id: string; role?: string; order?: number; uri: string | null; mime: string }[]
  revision: string
  verification: { level: number; note: string; at: string; by: string; stale: boolean; topics: string[] } | null
  rejection: { reason: string; at: string; check: string } | null
  edited: boolean
  edits: WorkshopEdit[]
  duplicates: number
  foreign: boolean
}

export interface WorkshopUpdate {
  text?: string
  solution?: string
  content?: WorkshopContent
  topic?: string
  reason?: string
  expected_revision: string
}

const BASE = '/v1/staff/task-workshop'

export function getWorkshopTopics(source: WorkshopSource = 'ours'): Promise<{ topics: WorkshopTopic[] }> {
  return apiClient.get(`${BASE}/topics/`, { params: { source } })
}

export function listWorkshopTasks(params: { topic?: string; state?: WorkshopState; q?: string; page?: number;
                                            source?: WorkshopSource }): Promise<WorkshopList> {
  return apiClient.get(`${BASE}/tasks/`, { params })
}

export function getWorkshopTask(id: number): Promise<WorkshopTask> {
  return apiClient.get(`${BASE}/tasks/${id}/`)
}

export function updateWorkshopTask(id: number, payload: WorkshopUpdate): Promise<WorkshopTask> {
  return apiClient.patch(`${BASE}/tasks/${id}/`, payload)
}

export function verifyWorkshopTask(id: number, payload: { level: number; note?: string; expected_revision: string }):
  Promise<WorkshopTask> {
  return apiClient.post(`${BASE}/tasks/${id}/verify/`, payload)
}

export function rejectWorkshopTask(id: number, payload: { reason: string; expected_revision: string }):
  Promise<WorkshopTask> {
  return apiClient.post(`${BASE}/tasks/${id}/reject/`, payload)
}

export function unrejectWorkshopTask(id: number, payload: { expected_revision: string }): Promise<WorkshopTask> {
  return apiClient.post(`${BASE}/tasks/${id}/unreject/`, payload)
}

export function revertWorkshopEdit(editId: number): Promise<WorkshopTask> {
  return apiClient.post(`${BASE}/edits/${editId}/revert/`)
}
