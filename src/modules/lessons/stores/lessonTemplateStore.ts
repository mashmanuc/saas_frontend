import { defineStore } from 'pinia'
import { lessonsTemplateApi } from '../api/lessonsTemplateApi'
import type {
  LessonTemplateSummary,
  LessonTemplateDetail,
  LessonTemplateCreatePayload,
} from '../types/lessonTypes'

interface LessonTemplateState {
  templates: LessonTemplateSummary[]
  selectedTemplate: LessonTemplateDetail | null
  isLoading: boolean
  error: string | null
}

export const useLessonTemplateStore = defineStore('lessonTemplates', {
  state: (): LessonTemplateState => ({
    templates: [],
    selectedTemplate: null,
    isLoading: false,
    error: null,
  }),

  getters: {
    publishedTemplates: (state): LessonTemplateSummary[] =>
      state.templates.filter((t) => t.is_published),

    draftTemplates: (state): LessonTemplateSummary[] =>
      state.templates.filter((t) => t.moderation_status === 'DRAFT'),

    getTemplateById: (state) => (id: number): LessonTemplateSummary | undefined =>
      state.templates.find((t) => t.id === id),
  },

  actions: {
    async fetchTemplates(): Promise<void> {
      this.isLoading = true
      this.error = null
      try {
        this.templates = await lessonsTemplateApi.getTemplates()
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
          'Failed to load templates'
        this.error = message
        throw err
      } finally {
        this.isLoading = false
      }
    },

    async fetchTemplateDetail(id: number): Promise<void> {
      this.isLoading = true
      this.error = null
      try {
        this.selectedTemplate = await lessonsTemplateApi.getTemplateDetail(id)
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
          'Failed to load template detail'
        this.error = message
        throw err
      } finally {
        this.isLoading = false
      }
    },

    async createTemplate(data: LessonTemplateCreatePayload): Promise<LessonTemplateDetail> {
      this.isLoading = true
      this.error = null
      try {
        const created = await lessonsTemplateApi.createTemplate(data)
        // Add summary-compatible entry to local list
        this.templates.unshift({
          id: created.id,
          title: created.title,
          description: created.description,
          subject: created.subject,
          lesson_type: created.lesson_type,
          materials_count: created.materials?.length ?? 0,
          has_homework: Boolean(created.homework_template?.instructions),
          version: created.version,
          moderation_status: created.moderation_status,
          is_published: created.is_published,
          created_at: created.created_at,
        })
        return created
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
          'Failed to create template'
        this.error = message
        throw err
      } finally {
        this.isLoading = false
      }
    },

    async updateTemplate(
      id: number,
      data: Partial<LessonTemplateCreatePayload>,
    ): Promise<LessonTemplateDetail> {
      this.isLoading = true
      this.error = null
      try {
        const updated = await lessonsTemplateApi.updateTemplate(id, data)
        // Sync local list entry
        const idx = this.templates.findIndex((t) => t.id === id)
        if (idx !== -1) {
          this.templates[idx] = {
            ...this.templates[idx],
            title: updated.title,
            description: updated.description,
            subject: updated.subject,
            lesson_type: updated.lesson_type,
            materials_count: updated.materials?.length ?? this.templates[idx].materials_count,
            has_homework: Boolean(updated.homework_template?.instructions),
            version: updated.version,
            moderation_status: updated.moderation_status,
            is_published: updated.is_published,
          }
        }
        // Sync detail if same
        if (this.selectedTemplate?.id === id) {
          this.selectedTemplate = updated
        }
        return updated
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
          'Failed to update template'
        this.error = message
        throw err
      } finally {
        this.isLoading = false
      }
    },

    async deleteTemplate(id: number): Promise<void> {
      this.isLoading = true
      this.error = null
      try {
        await lessonsTemplateApi.deleteTemplate(id)
        this.templates = this.templates.filter((t) => t.id !== id)
        if (this.selectedTemplate?.id === id) {
          this.selectedTemplate = null
        }
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
          'Failed to delete template'
        this.error = message
        throw err
      } finally {
        this.isLoading = false
      }
    },

    clearSelection(): void {
      this.selectedTemplate = null
    },

    clearError(): void {
      this.error = null
    },
  },
})
