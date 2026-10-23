/**
 * Staff: майстерня банку задач (власник 2026-10-23; ТЗ saas_docs/domains/learning_program/TZ_TASK_WORKSHOP_ADMIN_2026-10-23.md).
 * Бекенд — apps/staff/api/task_workshop_views.py → apps/lesson_constructor/services/task_workshop.py.
 * «Перевірено мною» не впливає на добір задач для уроків; «відхилити» — навпаки, прибирає задачу з добору.
 * Кожен запис несе `expected_revision`: якщо задачу змінили з іншого місця — 409, сторінку треба оновити.
 */
import apiClient from '@/utils/apiClient'

export type WorkshopState = 'all' | 'new' | 'verified' | 'rejected' | 'edited'

export interface WorkshopTopic {
  id: string
  label: string
  parent: string | null
  total: number
  verified: number
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

export function getWorkshopTopics(): Promise<{ topics: WorkshopTopic[] }> {
  return apiClient.get(`${BASE}/topics/`)
}

export function listWorkshopTasks(params: { topic?: string; state?: WorkshopState; q?: string; page?: number }):
  Promise<WorkshopList> {
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
