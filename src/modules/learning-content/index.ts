// Store
export { useContentLibraryStore } from './stores/contentLibraryStore'

// Phase 1a: LearningGroup Store
export { useLearningGroupStore } from './stores/learningGroupStore'

// API
export { learningContentApi } from './api/learningContentApi'

// Phase 1a: LearningGroup API
export { learningGroupApi } from './api/learningGroupApi'

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
  // Phase 1c: Language support
  ContentLanguage,
  // Phase 1a: LearningGroup types
  GroupType,
  LearningGroup,
  LearningGroupDetail,
  LearningGroupCreate,
  GroupMaterialAccess,
  GroupMaterialAdd,
  // Phase 1a Day 2: Student management types
  GroupStudentAdd,
  GroupStudentsResponse,
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

// Phase 1a: LearningGroup Components
export { default as GroupSelector } from './components/GroupSelector.vue'

// Phase 1a Day 2: GroupMaterialsManager
export { default as GroupMaterialsManager } from './components/GroupMaterialsManager.vue'
export { default as MaterialAccessToggle } from './components/MaterialAccessToggle.vue'

// Phase 1b: StudentGroupSidebar
export { default as StudentGroupSidebar } from './components/StudentGroupSidebar.vue'

// Composables
export { useContentAccess } from './composables/useContentAccess'
export type { ContentAccessResult } from './composables/useContentAccess'

// Phase 2 Day 3: Lesson content composables
export { useLessonContent } from './composables/useLessonContent'
export { useLessonHistory } from './composables/useLessonHistory'
export type { LessonParticipant } from './composables/useLessonContent'

// Phase 2 Day 3: LessonHistory component
export { default as LessonHistory } from './components/LessonHistory.vue'

// Utils
export {
  renderContentToSvgDataUrl,
  renderTextWithLatex,
  parseLatexSegments,
} from './utils/contentRenderer'
