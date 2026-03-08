/**
 * @deprecated Цей файл залишено для зворотної сумісності.
 * Використовуй: import { groupApi } from '@/modules/groups'
 *
 * Логіка перенесена до @/modules/groups/api/groupApi
 */
export { groupApi as learningGroupApi, groupApi } from '@/modules/groups/api/groupApi'
export type {
  LearningGroup,
  LearningGroupDetail,
  LearningGroupCreate,
  GroupMaterialAccess,
  GroupMaterialAdd,
  GroupStudentsResponse,
} from '@/modules/groups/types/group'
