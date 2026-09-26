/**
 * Staff: присутність і споживання (2026-09-26).
 * Власник: «щоб я міг дивитися: якщо немає нікого — то пушити», «графік присутності»,
 * «хто найбільше споживає і що цінне». Бекенд — apps/staff/api/presence_views.py.
 */
import apiClient from '@/utils/apiClient'

const BASE = '/v1/staff'

export interface PresencePerson {
  user_id: number
  email: string
  role: string
  name: string
  board_role?: string
  is_staff?: boolean
}

export interface PresenceNow {
  checked_at: string
  nobody: boolean
  people_count: number
  in_app: PresencePerson[]
  boards: { board_id: string; name: string; members: PresencePerson[] }[]
  recordings: { board_id: string; name: string; owner_id: number }[]
  guests: number
  /** Staff онлайн — НЕ рахується в «людях» (панель дивиться саме staff) */
  staff_online: PresencePerson[]
}

export interface PresencePoint {
  t: string
  /** Люди (не staff) + гості в момент знімка; у кошику — пік */
  total: number
  on_boards: number
  recordings: number
}

export interface PresenceTimeline {
  /** Запис знімків увімкнено (окремий запис beat, рішення власника) */
  sampling_enabled: boolean
  since: string | null
  bucket: 'sample' | 'hour' | 'day'
  sample_minutes: number
  points: PresencePoint[]
  /** [день тижня 0=пн][година 0..23] за Києвом → середня кількість людей; null — даних немає */
  heatmap: (number | null)[][]
}

export type UsageSort =
  | 'online_minutes' | 'board_minutes' | 'ai_requests' | 'ai_month' | 'storage_bytes' | 'boards' | 'replays'

export interface UsageRow {
  user_id: number
  name: string
  email: string
  role: string
  is_staff: boolean
  online_minutes: number
  board_minutes: number
  ai_requests: number
  ai_month: number
  storage_bytes: number
  boards: number
  replays: number
}

export interface UsageTop {
  days: number
  sort: UsageSort
  sample_minutes: number
  sampling_enabled: boolean
  results: UsageRow[]
}

export interface FeatureUsage {
  days: number
  aggregation_enabled: boolean
  objects: { object_type: string; total: number; users: number }[]
  objects_until: string | null
  integralyk_tools: { tool: string; total: number; users: number }[]
  /** Останній запис ops-логу дошки; null — лог не пишеться, дані про об'єкти неповні */
  ops_log_last_write: string | null
}

// Фонове опитування: без глобального лоадера, а мережевий збій — без тосту й без
// впливу на circuit breaker (FRONTEND_CONVENTIONS §1-2; apiClient meta.nonCriticalRequest).
const QUIET = { meta: { skipLoader: true, nonCriticalRequest: true } }

export function getPresenceNow(): Promise<PresenceNow> {
  return apiClient.get(`${BASE}/presence/now/`, QUIET)
}

export function getPresenceTimeline(days: number): Promise<PresenceTimeline> {
  return apiClient.get(`${BASE}/presence/timeline/`, { params: { days } })
}

export function getUsageTop(days: number, sort: UsageSort): Promise<UsageTop> {
  return apiClient.get(`${BASE}/usage/top/`, { params: { days, sort } })
}

export function getFeatureUsage(days: number): Promise<FeatureUsage> {
  return apiClient.get(`${BASE}/usage/features/`, { params: { days } })
}
