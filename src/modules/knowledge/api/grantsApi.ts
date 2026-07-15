// LessonGrant — коди передачі паків уроків між тьюторами (Варіант A, 2026-07).
// Продавець генерує код на 1..N своїх опублікованих уроків; покупець-тьютор
// активує і отримує НЕЗАЛЕЖНІ копії (draft, не публікуються далі).
// BE: apps/knowledge/api/views_grants.py · ТЗ: LESSON_GRANT_TZ_2026-07-14.md

import apiClient from '@/utils/apiClient'

export interface GrantLessonBrief {
  id: string
  title: string
  subject_tag: string
  description: string
}

export interface LessonGrant {
  id: string
  code: string
  url_path: string
  lessons: GrantLessonBrief[]
  max_uses: number
  used_count: number
  expires_at: string | null
  revoked: boolean
  created_at: string
}

export interface GrantPreview {
  code: string
  seller_name: string
  lessons: GrantLessonBrief[]
  lessons_count: number
  uses_left: number
  already_activated: boolean
}

export interface GrantActivateResult {
  activated: boolean
  already_activated: boolean
  lessons: GrantLessonBrief[]
}

export const grantsApi = {
  /** Мої коди передачі (продавець). */
  async list(): Promise<LessonGrant[]> {
    const res = await apiClient.get('/v1/knowledge/grants/')
    const data = res.data ?? res
    return Array.isArray(data) ? data : (data.results ?? [])
  },

  /** Створити код на пак власних опублікованих уроків. */
  async create(payload: {
    lesson_ids: string[]
    max_uses?: number
    expires_days?: number | null
  }): Promise<LessonGrant> {
    const res = await apiClient.post('/v1/knowledge/grants/', payload)
    return res.data ?? res
  },

  /** Відкликати код (видані копії лишаються у покупців). */
  async revoke(grantId: string): Promise<LessonGrant> {
    const res = await apiClient.post(`/v1/knowledge/grants/${grantId}/revoke/`)
    return res.data ?? res
  },

  /** Превʼю паку за кодом (без активації). 404 = код недоступний. */
  async preview(code: string): Promise<GrantPreview> {
    const res = await apiClient.get(`/v1/knowledge/grants/preview/${encodeURIComponent(code)}/`)
    return res.data ?? res
  },

  /** Активувати код — отримати копії всього паку. */
  async activate(code: string): Promise<GrantActivateResult> {
    const res = await apiClient.post(`/v1/knowledge/grants/activate/${encodeURIComponent(code)}/`)
    return res.data ?? res
  },
}
