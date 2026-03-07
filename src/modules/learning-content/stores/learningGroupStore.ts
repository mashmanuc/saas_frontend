import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { learningGroupApi } from '../api/learningGroupApi'
import type {
  LearningGroup,
  LearningGroupDetail,
  LearningGroupCreate,
  GroupMaterialAccess,
} from '../types/learningContent'

export const useLearningGroupStore = defineStore('learningGroup', () => {
  // ── State ─────────────────────────────────────────────────────
  const groups = ref<LearningGroup[]>([])
  const selectedGroup = ref<LearningGroupDetail | null>(null)
  const materials = ref<GroupMaterialAccess[]>([])
  const students = ref<number[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // ── Computed ──────────────────────────────────────────────────
  const explicitGroups = computed(() =>
    groups.value.filter(g => g.group_type === 'EXPLICIT' && g.is_active)
  )
  const implicitGroups = computed(() =>
    groups.value.filter(g => g.group_type === 'IMPLICIT' && g.is_active)
  )
  const activeMaterials = computed(() =>
    materials.value.filter(m => m.is_active)
  )

  // ── Actions: Groups ───────────────────────────────────────────
  async function fetchGroups() {
    isLoading.value = true
    error.value = null
    try {
      groups.value = await learningGroupApi.listGroups()
    } catch (e) {
      error.value = 'Failed to load groups'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function createGroup(data: LearningGroupCreate) {
    const group = await learningGroupApi.createGroup(data)
    groups.value.unshift(group)
    return group
  }

  async function selectGroup(groupId: string) {
    isLoading.value = true
    error.value = null
    try {
      selectedGroup.value = await learningGroupApi.getGroup(groupId)
      await Promise.all([
        fetchMaterials(groupId),
        fetchStudents(groupId),
      ])
    } catch (e) {
      error.value = 'Failed to load group details'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function updateGroup(groupId: string, data: Partial<LearningGroupCreate>) {
    const updated = await learningGroupApi.updateGroup(groupId, data)
    selectedGroup.value = updated
    const idx = groups.value.findIndex(g => g.id === groupId)
    if (idx !== -1) {
      groups.value[idx] = { ...groups.value[idx], ...updated }
    }
    return updated
  }

  // ── Actions: Materials ────────────────────────────────────────
  async function fetchMaterials(groupId: string) {
    materials.value = await learningGroupApi.listMaterials(groupId)
  }

  async function addMaterial(groupId: string, contentItemId: number) {
    const gma = await learningGroupApi.addMaterial(groupId, {
      content_item_id: contentItemId,
    })
    materials.value.push(gma)
    return gma
  }

  async function toggleMaterial(materialId: string, isActive: boolean) {
    const updated = await learningGroupApi.toggleMaterial(materialId, isActive)
    const idx = materials.value.findIndex(m => m.id === materialId)
    if (idx !== -1) {
      materials.value[idx] = updated
    }
    return updated
  }

  async function removeMaterial(materialId: string) {
    await learningGroupApi.removeMaterial(materialId)
    materials.value = materials.value.filter(m => m.id !== materialId)
  }

  // ── Actions: Students ─────────────────────────────────────────
  async function fetchStudents(groupId: string) {
    const resp = await learningGroupApi.listStudents(groupId)
    students.value = resp.students
  }

  async function addStudent(groupId: string, userId: number) {
    await learningGroupApi.addStudent(groupId, userId)
    students.value.push(userId)
  }

  async function removeStudent(groupId: string, userId: number) {
    await learningGroupApi.removeStudent(groupId, userId)
    students.value = students.value.filter(id => id !== userId)
  }

  // ── Actions: Subject ──────────────────────────────────────────
  async function updateSubject(groupId: string, subjectId: number | null) {
    const updated = await learningGroupApi.updateGroup(groupId, { subject: subjectId })
    selectedGroup.value = updated
    const idx = groups.value.findIndex(g => g.id === groupId)
    if (idx !== -1) {
      groups.value[idx] = { ...groups.value[idx], ...updated }
    }
    // Refresh materials — StarterPack may have auto-populated
    await fetchMaterials(groupId)
    return updated
  }

  // ── Reset ─────────────────────────────────────────────────────
  function $reset() {
    groups.value = []
    selectedGroup.value = null
    materials.value = []
    students.value = []
    isLoading.value = false
    error.value = null
  }

  return {
    // State
    groups,
    selectedGroup,
    materials,
    students,
    isLoading,
    error,
    // Computed
    explicitGroups,
    implicitGroups,
    activeMaterials,
    // Actions
    fetchGroups,
    createGroup,
    selectGroup,
    updateGroup,
    fetchMaterials,
    addMaterial,
    toggleMaterial,
    removeMaterial,
    fetchStudents,
    addStudent,
    removeStudent,
    updateSubject,
    $reset,
  }
})
