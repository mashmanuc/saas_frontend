// Store
export { useContentLibraryStore } from './stores/contentLibraryStore'

// API
export { learningContentApi } from './api/learningContentApi'

// Types
export type {
  Subject,
  Collection,
  Topic,
  Unit,
  UnitSummary,
  ContentItemSummary,
  ContentItemDetail,
  ContentItemType,
  LessonMaterial,
  ContentDragPayload,
  SearchParams,
  SearchResult,
  CreateLessonMaterialPayload,
  OwnershipType,
  AccessType,
} from './types/learningContent'

// Schemas / Type guards
export {
  isProblem,
  isTheory,
  isTest,
  isVideo,
  isPresentation,
  isLink,
} from './schemas/contentSchemas'
export type {
  ProblemContent,
  TheoryContent,
  TestContent,
  VideoContent,
  PresentationContent,
  LinkContent,
} from './schemas/contentSchemas'

// Components
export { default as ContentPanel } from './components/ContentPanel.vue'
export { default as ContentItemCard } from './components/ContentItemCard.vue'
export { default as ContentItemPreview } from './components/ContentItemPreview.vue'
export { default as OwnershipBadge } from './components/OwnershipBadge.vue'
export { default as AccessLockIcon } from './components/AccessLockIcon.vue'

// Composables
export { useContentAccess } from './composables/useContentAccess'
export type { ContentAccessResult } from './composables/useContentAccess'

// Utils
export {
  renderContentToSvgDataUrl,
  renderTextWithLatex,
  parseLatexSegments,
} from './utils/contentRenderer'
