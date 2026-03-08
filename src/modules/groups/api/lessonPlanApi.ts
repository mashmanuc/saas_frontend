// lessonPlanApi.ts — API для планів уроків групи (Group → LessonPlan → Board)
// Endpoints: /api/v1/learning-content/learning-groups/{groupId}/lesson-plans/

import apiClient from '@/utils/apiClient'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface LessonPlanMaterial {
  id: string
  content_item: {
    id: number
    title: string
    type: string
    asset_category: string | null
    processing_status: string
    version: number
  }
  order: number
}

export interface LessonPlan {
  id: string
  title: string
  description: string
  order: number
  material_count: number
  materials: LessonPlanMaterial[]
  created_at: string
  updated_at: string
}

export interface LessonPlanCreate {
  title: string
  description?: string
  order?: number
}

// ─── API ────────────────────────────────────────────────────────────────────

const BASE = '/v1/learning-content'

// NOTE: apiClient response interceptor вже повертає res.data (не повний axios response).
// Тому `r` у .then() — це вже тіло відповіді (масив / об'єкт), а не { data, status, ... }.

export const lessonPlanApi = {
  /** Список планів уроків для групи */
  list(groupId: string): Promise<LessonPlan[]> {
    return apiClient
      .get(`${BASE}/learning-groups/${groupId}/lesson-plans/`)
      .then((r: any) => Array.isArray(r) ? r : (r?.results ?? []))
  },

  /** Створити план уроку */
  create(groupId: string, data: LessonPlanCreate): Promise<LessonPlan> {
    return apiClient
      .post(`${BASE}/learning-groups/${groupId}/lesson-plans/`, data)
      .then((r: any) => r as LessonPlan)
  },

  /** Оновити план (title, description, order) */
  update(groupId: string, planId: string, data: Partial<LessonPlanCreate>): Promise<LessonPlan> {
    return apiClient
      .patch(`${BASE}/learning-groups/${groupId}/lesson-plans/${planId}/`, data)
      .then((r: any) => r as LessonPlan)
  },

  /** Видалити план */
  delete(groupId: string, planId: string): Promise<void> {
    return apiClient
      .delete(`${BASE}/learning-groups/${groupId}/lesson-plans/${planId}/`)
      .then(() => undefined)
  },

  /** Додати матеріал до плану */
  addMaterial(groupId: string, planId: string, contentItemId: number): Promise<LessonPlanMaterial> {
    return apiClient
      .post(
        `${BASE}/learning-groups/${groupId}/lesson-plans/${planId}/materials/add/`,
        { content_item_id: contentItemId },
      )
      .then((r: any) => r as LessonPlanMaterial)
  },

  /** Видалити матеріал з плану */
  removeMaterial(groupId: string, planId: string, materialId: string): Promise<void> {
    return apiClient
      .delete(
        `${BASE}/learning-groups/${groupId}/lesson-plans/${planId}/materials/${materialId}/`,
      )
      .then(() => undefined)
  },

  /** Скопіювати план в іншу групу */
  clone(groupId: string, planId: string, targetGroupId: string): Promise<LessonPlan> {
    return apiClient
      .post(
        `${BASE}/learning-groups/${groupId}/lesson-plans/${planId}/clone/`,
        { target_group_id: targetGroupId },
      )
      .then((r: any) => r as LessonPlan)
  },
}
