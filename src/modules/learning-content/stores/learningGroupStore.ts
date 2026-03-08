/**
 * @deprecated Цей файл залишено для зворотної сумісності.
 * Використовуй: import { useGroupStore } from '@/modules/groups'
 *
 * Логіка перенесена до @/modules/groups/stores/groupStore
 */
export { useGroupStore as useLearningGroupStore, useGroupStore } from '@/modules/groups/stores/groupStore'
export type {
  LearningGroup,
  LearningGroupDetail,
  LearningGroupCreate,
  GroupMaterialAccess,
} from '@/modules/groups/types/group'
