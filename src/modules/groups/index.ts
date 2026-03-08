/**
 * Barrel export для модуля "Групи / Класи"
 *
 * Відповідальність: організаційна одиниця навчання
 *   - LearningGroup (явні класи і неявні пари тьютор-учень)
 *   - GroupMaterialAccess (які матеріали доступні в групі)
 *   - Управління студентами в групі
 *
 * @see @/modules/library  — файли/матеріали тьютора (окремий домен)
 */

// Типи
export type {
  GroupType,
  LearningGroup,
  LearningGroupDetail,
  LearningGroupCreate,
  GroupMaterialAccess,
  GroupMaterialAdd,
  GroupStudentAdd,
  GroupStudentsResponse,
} from './types/group'

// Store
export { useGroupStore, useLearningGroupStore } from './stores/groupStore'

// API
export { groupApi } from './api/groupApi'

// Components
export { default as GroupMaterialsManager } from './components/GroupMaterialsManager.vue'
export { default as GroupSelector } from './components/GroupSelector.vue'
export { default as MaterialAccessToggle } from './components/MaterialAccessToggle.vue'
