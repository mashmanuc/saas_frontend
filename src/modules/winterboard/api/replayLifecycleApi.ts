// Replay Lifecycle v4.1 — API client for Replay content entity CRUD.
// Ref: saas_docs/plans/REPLAY_LIFECYCLE_PLAN.md §6.F.2

import apiClient from '@/utils/apiClient'

const BASE = '/v1/winterboard'

// ─── Types ─────────────────────────────────────────────────────────

export type ReplayStatus = 'active' | 'archived' | 'trashed'
/**
 * 'student' — «👤 Видно учню»: лише учень уроку цього запису, увійшовши у свій кабінет; за посиланням
 * НЕ відкривається (рішення власника 2026-10-14). За замовчуванням для нових записів уроку з учнем.
 */
export type ReplayVisibility = 'private' | 'student' | 'unlisted' | 'public'

/** Режими, у яких запис відкривається за посиланням (`public_token`). Дзеркало BE `Replay.LINK_VISIBILITIES`. */
export function isLinkVisibility(v: ReplayVisibility | string | null | undefined): boolean {
  return v === 'unlisted' || v === 'public' || v === 'link'
}

/** Чи є кому показати запис у режимі «👤 Видно учню»: учень уроку або обраний учителем (BE відмовить інакше). */
export function canShowToStudent(r: Pick<Replay, 'visibility' | 'lesson_student_id' | 'shared_student'> | null | undefined): boolean {
  return !!r && (!!r.lesson_student_id || !!r.shared_student || r.visibility === 'student')
}

export interface Replay {
  id: string
  title: string
  source_session?: string
  recorded_at: string
  duration_ms: number
  start_seq?: number
  end_seq?: number
  status: ReplayStatus
  visibility: ReplayVisibility
  public_token: string | null
  folder: string | null
  view_count: number
  /** Перший кадр запису (BE рендер start_state_ref). '' = нема прев'ю. */
  thumbnail_url?: string
  /** Учень уроку, з дошки якого запис; null — дошка не урок. */
  lesson_student_id?: number | null
  /** Учень, якому вчитель показав запис сам («👤 Показати учню…»), — ДОДАТКОВО до учня уроку. */
  shared_student?: { id: number; name: string } | null
  created_at?: string
  updated_at?: string
  archived_at: string | null
  trashed_at: string | null
}

export interface ReplayFolder {
  id: string
  name: string
  parent: string | null
  position: number
  created_at: string
  updated_at: string
}

export interface ReplayListParams {
  status?: ReplayStatus | 'all'
  folder?: string | 'root' | 'all'
  search?: string
  source_session?: string
}

// ─── List & detail ─────────────────────────────────────────────────

export async function listReplays(params: ReplayListParams = {}): Promise<{ replays: Replay[] }> {
  return apiClient.get<{ replays: Replay[] }>(`${BASE}/replays/`, { params })
}

export async function getReplay(id: string): Promise<Replay> {
  return apiClient.get<Replay>(`${BASE}/replays/${id}/`)
}

// ─── Учень уроку (2026-10-14) ──────────────────────────────────────

/** Запис очима учня уроку: без посилання, режиму й лічильника переглядів (BE `ReplayStudentSerializer`). */
export interface StudentReplay {
  id: string
  title: string
  source_session: string | null
  recorded_at: string
  duration_ms: number
  thumbnail_url?: string
  tutor: { id: number; name: string } | null
  viewer_role: 'student'
}

export function isStudentReplay(r: Replay | StudentReplay | null | undefined): r is StudentReplay {
  return !!r && (r as StudentReplay).viewer_role === 'student'
}

/** Записи МОЇХ уроків, які вчитель лишив видимими мені (найновіші, до 50). */
export async function listStudentReplays(): Promise<{ replays: StudentReplay[] }> {
  return apiClient.get<{ replays: StudentReplay[] }>(`${BASE}/replays/student/`)
}

/** Активний учень учителя, якому можна показати запис. */
export interface ShareStudent {
  id: number
  name: string
}

/** Кому вчитель може показати запис: його активні учні з робочим акаунтом. */
export async function listShareStudents(): Promise<{ students: ShareStudent[] }> {
  return apiClient.get<{ students: ShareStudent[] }>(`${BASE}/replays/share-students/`)
}

/** «👤 Показати учню…»: `studentId=null` — прибрати обраного учня. */
export async function shareReplayWithStudent(id: string, studentId: number | null): Promise<Replay> {
  return apiClient.post<Replay>(`${BASE}/replays/${id}/share-student/`, { student_id: studentId })
}

/** Запис для перегляду: власнику — повний, учневі уроку — `StudentReplay`; іншим BE віддає 404. */
export async function getReplayForViewer(id: string): Promise<Replay | StudentReplay> {
  return apiClient.get<Replay | StudentReplay>(`${BASE}/replays/${id}/`)
}

export async function updateReplay(
  id: string,
  patch: Partial<Pick<Replay, 'title' | 'visibility'>>,
): Promise<Replay> {
  return apiClient.patch<Replay>(`${BASE}/replays/${id}/`, patch)
}

// ─── Lifecycle ─────────────────────────────────────────────────────

export async function archiveReplay(id: string): Promise<Replay> {
  return apiClient.post<Replay>(`${BASE}/replays/${id}/archive/`, {})
}

export async function restoreReplay(id: string): Promise<Replay> {
  return apiClient.post<Replay>(`${BASE}/replays/${id}/restore/`, {})
}

export async function trashReplay(id: string): Promise<Replay> {
  return apiClient.post<Replay>(`${BASE}/replays/${id}/trash/`, {})
}

export async function changeReplayVisibility(
  id: string,
  visibility: ReplayVisibility,
): Promise<Replay> {
  return apiClient.post<Replay>(`${BASE}/replays/${id}/visibility/`, { visibility })
}

export async function moveReplayToFolder(
  id: string,
  folderId: string | null,
): Promise<Replay> {
  return apiClient.post<Replay>(`${BASE}/replays/${id}/move-folder/`, {
    folder_id: folderId,
  })
}

/**
 * Regenerate public_token — старий URL стає 404.
 * Використовується для "відкликати share link".
 */
export async function rotateReplayToken(id: string): Promise<Replay> {
  return apiClient.post<Replay>(`${BASE}/replays/${id}/rotate-token/`, {})
}

// ─── Folders ───────────────────────────────────────────────────────

export async function listReplayFolders(): Promise<{ folders: ReplayFolder[] }> {
  return apiClient.get<{ folders: ReplayFolder[] }>(`${BASE}/replay-folders/`)
}

export async function createReplayFolder(
  data: { name: string; parent?: string | null; position?: number },
): Promise<ReplayFolder> {
  return apiClient.post<ReplayFolder>(`${BASE}/replay-folders/`, data)
}

export async function updateReplayFolder(
  id: string,
  patch: Partial<{ name: string; parent: string | null; position: number }>,
): Promise<ReplayFolder> {
  return apiClient.patch<ReplayFolder>(`${BASE}/replay-folders/${id}/`, patch)
}

export async function deleteReplayFolder(id: string): Promise<void> {
  return apiClient.delete<void>(`${BASE}/replay-folders/${id}/`)
}
