import apiClient from '@/utils/apiClient'
import type {
  LearningGroup,
  LearningGroupDetail,
  LearningGroupCreate,
  GroupMaterialAccess,
  GroupMaterialAdd,
  GroupStudentsResponse,
} from '../types/learningContent'

const BASE = '/v1/learning-content'

export const learningGroupApi = {
  // ── LearningGroup CRUD ──────────────────────────────────────

  async listGroups(): Promise<LearningGroup[]> {
    return apiClient.get(`${BASE}/learning-groups/`)
  },

  async createGroup(data: LearningGroupCreate): Promise<LearningGroup> {
    return apiClient.post(`${BASE}/learning-groups/`, data)
  },

  async getGroup(groupId: string): Promise<LearningGroupDetail> {
    return apiClient.get(`${BASE}/learning-groups/${groupId}/`)
  },

  async updateGroup(groupId: string, data: Partial<LearningGroupCreate>): Promise<LearningGroupDetail> {
    return apiClient.patch(`${BASE}/learning-groups/${groupId}/`, data)
  },

  // ── GroupMaterialAccess CRUD ────────────────────────────────

  async listMaterials(groupId: string): Promise<GroupMaterialAccess[]> {
    return apiClient.get(`${BASE}/learning-groups/${groupId}/materials/`)
  },

  async addMaterial(groupId: string, data: GroupMaterialAdd): Promise<GroupMaterialAccess> {
    return apiClient.post(`${BASE}/learning-groups/${groupId}/materials/`, data)
  },

  async toggleMaterial(materialId: string, isActive: boolean): Promise<GroupMaterialAccess> {
    return apiClient.patch(`${BASE}/group-materials/${materialId}/`, { is_active: isActive })
  },

  async removeMaterial(materialId: string): Promise<void> {
    return apiClient.delete(`${BASE}/group-materials/${materialId}/`)
  },

  // ── Student Management ──────────────────────────────────────

  async listStudents(groupId: string): Promise<GroupStudentsResponse> {
    return apiClient.get(`${BASE}/learning-groups/${groupId}/students/`)
  },

  async addStudent(groupId: string, userId: number): Promise<{ student_id: number; group_id: string }> {
    return apiClient.post(`${BASE}/learning-groups/${groupId}/students/`, { user_id: userId })
  },

  async removeStudent(groupId: string, userId: number): Promise<void> {
    return apiClient.delete(`${BASE}/learning-groups/${groupId}/students/${userId}/`)
  },
}
