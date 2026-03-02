// ── Types ────────────────────────────────────────────────────
export type {
  LessonType,
  LessonStatus,
  OwnershipType,
  ModerationStatus,
  HomeworkStatus,
  LessonTemplateSummary,
  LessonTemplateDetail,
  LessonTemplateCreatePayload,
  LessonHomework,
  LessonHomeworkCreatePayload,
  MarketplaceTemplateSummary,
  MarketplaceTemplateDetail,
  MarketplaceSortOption,
  MarketplaceSearchParams,
  MarketplaceResponse,
  TemplatePurchase,
  TemplatePurchaseResponse,
} from './types/lessonTypes'

// ── API ──────────────────────────────────────────────────────
export { lessonsTemplateApi } from './api/lessonsTemplateApi'

// ── Stores ───────────────────────────────────────────────────
export { useLessonTemplateStore } from './stores/lessonTemplateStore'
export { useLessonStore } from './store/lessonStore'

// ── Components ───────────────────────────────────────────────
export { default as LessonTemplateCard } from './components/LessonTemplateCard.vue'
export { default as LessonTemplateEditor } from './components/LessonTemplateEditor.vue'
export { default as LessonHomeworkPanel } from './components/LessonHomeworkPanel.vue'
export { default as HomeworkAssignModal } from './components/HomeworkAssignModal.vue'
export { default as MarketplaceCard } from './components/MarketplaceCard.vue'
export { default as TemplatePreviewModal } from './components/TemplatePreviewModal.vue'
