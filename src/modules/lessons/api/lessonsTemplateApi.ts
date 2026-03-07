import apiClient from '@/utils/apiClient'
import type {
  LessonTemplateSummary,
  LessonTemplateDetail,
  LessonTemplateCreatePayload,
  LessonHomework,
  LessonHomeworkCreatePayload,
  MarketplaceSearchParams,
  MarketplaceResponse,
  MarketplaceTemplateDetail,
  TemplatePurchaseResponse,
} from '../types/lessonTypes'

const BASE = '/v1/lessons'

export const lessonsTemplateApi = {
  // ── Templates ──────────────────────────────────────────────
  async getTemplates(): Promise<LessonTemplateSummary[]> {
    return apiClient.get(`${BASE}/templates/`)
  },

  async getTemplateDetail(id: number): Promise<LessonTemplateDetail> {
    return apiClient.get(`${BASE}/templates/${id}/`)
  },

  async createTemplate(data: LessonTemplateCreatePayload): Promise<LessonTemplateDetail> {
    return apiClient.post(`${BASE}/templates/`, data)
  },

  async updateTemplate(
    id: number,
    data: Partial<LessonTemplateCreatePayload>,
  ): Promise<LessonTemplateDetail> {
    return apiClient.patch(`${BASE}/templates/${id}/`, data)
  },

  async deleteTemplate(id: number): Promise<void> {
    return apiClient.delete(`${BASE}/templates/${id}/`)
  },

  // ── Save-as-template (Phase 4 Day 2) ──────────────────────
  async saveAsTemplate(
    lessonId: number,
    title: string,
  ): Promise<{ id: number; title: string; content_count: number; has_board: boolean; source_lesson_id: number; created_at: string }> {
    return apiClient.post(`${BASE}/${lessonId}/save-as-template/`, { title })
  },

  async createLessonFromTemplate(
    templateId: number,
    data: { student_id: number; start: string; end: string; group_id?: number },
  ): Promise<{ lesson_id: number; status: string; has_initial_board: boolean }> {
    return apiClient.post(`/v1/lesson-templates/${templateId}/create-lesson/`, data)
  },

  // ── Homework ───────────────────────────────────────────────
  async getHomework(lessonId: number): Promise<LessonHomework[]> {
    return apiClient.get(`${BASE}/${lessonId}/homework/`)
  },

  async createHomework(
    lessonId: number,
    data: LessonHomeworkCreatePayload,
  ): Promise<LessonHomework> {
    return apiClient.post(`${BASE}/${lessonId}/homework/`, data)
  },

  async updateHomework(
    homeworkId: number,
    data: Partial<LessonHomeworkCreatePayload & { status: string }>,
  ): Promise<LessonHomework> {
    return apiClient.patch(`${BASE}/homework/${homeworkId}/`, data)
  },

  // ── Marketplace ────────────────────────────────────────────
  async searchMarketplace(params?: MarketplaceSearchParams): Promise<MarketplaceResponse> {
    return apiClient.get(`${BASE}/templates/marketplace/`, { params })
  },

  async getMarketplaceDetail(id: number): Promise<MarketplaceTemplateDetail> {
    return apiClient.get(`${BASE}/templates/${id}/`)
  },

  async useTemplate(templateId: number): Promise<any> {
    return apiClient.post(`${BASE}/from-template/`, { template_id: templateId })
  },

  // ── Purchase ────────────────────────────────────────────
  async purchaseTemplate(templateId: number): Promise<TemplatePurchaseResponse> {
    return apiClient.post(`${BASE}/templates/${templateId}/purchase/`)
  },
}
