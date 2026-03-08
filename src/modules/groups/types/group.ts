/**
 * Типи домену "Групи / Класи"
 * Виокремлено з @/modules/learning-content/types/learningContent
 *
 * Відповідальність: організаційна одиниця — хто з ким і з якими матеріалами
 */

export type GroupType = 'EXPLICIT' | 'IMPLICIT'

export interface LearningGroup {
  id: string              // UUID
  group_type: GroupType
  title: string
  subject: number | null
  is_active: boolean
  student_count: number
  material_count: number
  lesson_plan_count: number
  created_at: string
}

export interface LearningGroupDetail extends LearningGroup {
  students: number[]       // user IDs
  default_modules: string[]
  updated_at: string
}

export interface LearningGroupCreate {
  title: string
  subject?: number | null
}

export interface GroupMaterialAccess {
  id: string              // UUID
  content_item: number
  content_title: string
  content_type: string    // ContentItemType з learning-content
  is_active: boolean
  added_at: string
  added_by: number | null
}

export interface GroupMaterialAdd {
  content_item_id: number
}

export interface GroupStudentAdd {
  user_id: number
}

export interface GroupStudentsResponse {
  students: number[]
  count: number
}
