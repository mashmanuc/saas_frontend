// WB: useClassroomRole — reactive role + permissions for classroom context
// Ref: TASK_BOARD_PHASES.md A3.1, permissions.py ROLE_PERMISSIONS matrix
// Feature flag: VITE_WB_FEATURE_CLASSROOM

import { ref, computed, readonly, type Ref } from 'vue'
import { winterboardApi } from '../api/winterboardApi'
import type {
  WBClassroomRole,
  WBClassroomPermissions,
} from '../api/winterboardApi'

// ─── Constants ──────────────────────────────────────────────────────────────

const LOG = '[WB:ClassroomRole]'

const DEFAULT_PERMISSIONS: WBClassroomPermissions = {
  can_draw: false,
  can_erase: false,
  can_add_page: false,
  can_delete_page: false,
  can_clear: false,
  can_export: false,
  can_share: false,
  can_lock: false,
  can_kick: false,
  can_end: false,
  can_upload: false,
  can_manage: false,
}

const OWNER_PERMISSIONS: WBClassroomPermissions = {
  can_draw: true,
  can_erase: true,
  can_add_page: true,
  can_delete_page: true,
  can_clear: true,
  can_export: true,
  can_share: true,
  can_lock: true,
  can_kick: true,
  can_end: true,
  can_upload: true,
  can_manage: true,
}

// ─── Composable ─────────────────────────────────────────────────────────────

/**
 * Reactive classroom role and permissions for a WB session.
 *
 * Usage:
 * ```ts
 * const { role, permissions, isTeacher, isStudent, canDraw, fetchRole } = useClassroomRole(sessionId)
 * await fetchRole()
 * ```
 */
export function useClassroomRole(sessionId: Ref<string | null>) {
  const role = ref<WBClassroomRole | null>(null)
  const permissions = ref<WBClassroomPermissions>({ ...DEFAULT_PERMISSIONS })
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // ── Computed helpers ────────────────────────────────────────────────

  const isOwner = computed(() => role.value === 'owner')
  const isHost = computed(() => role.value === 'host')
  const isTeacher = computed(() => role.value === 'owner' || role.value === 'host')
  const isStudent = computed(() => role.value === 'student')
  const isViewer = computed(() => role.value === 'viewer')

  const canDraw = computed(() => permissions.value.can_draw)
  const canErase = computed(() => permissions.value.can_erase)
  const canAddPage = computed(() => permissions.value.can_add_page)
  const canDeletePage = computed(() => permissions.value.can_delete_page)
  const canClear = computed(() => permissions.value.can_clear)
  const canExport = computed(() => permissions.value.can_export)
  const canShare = computed(() => permissions.value.can_share)
  const canLock = computed(() => permissions.value.can_lock)
  const canKick = computed(() => permissions.value.can_kick)
  const canEnd = computed(() => permissions.value.can_end)
  const canUpload = computed(() => permissions.value.can_upload)
  const canManage = computed(() => permissions.value.can_manage)

  // ── Fetch role from backend ─────────────────────────────────────────

  async function fetchRole(): Promise<void> {
    const sid = sessionId.value
    if (!sid) {
      console.warn(`${LOG} No sessionId, skipping role fetch`)
      return
    }

    isLoading.value = true
    error.value = null

    try {
      const result = await winterboardApi.getSessionRole(sid)
      role.value = result.role
      permissions.value = { ...DEFAULT_PERMISSIONS, ...result.permissions }

      console.info(`${LOG} Role fetched`, { sessionId: sid, role: result.role })
    } catch (err) {
      const status = (err as Record<string, Record<string, number>>)?.response?.status
      if (status === 403) {
        role.value = null
        permissions.value = { ...DEFAULT_PERMISSIONS }
        error.value = 'Access denied'
      } else {
        error.value = (err as Error)?.message || 'Failed to fetch role'
      }
      console.error(`${LOG} fetchRole failed`, { sessionId: sid, err })
    } finally {
      isLoading.value = false
    }
  }

  // ── Set role locally (e.g. from classroom session response) ─────────

  function setRole(newRole: WBClassroomRole, newPermissions?: WBClassroomPermissions): void {
    role.value = newRole
    if (newPermissions) {
      permissions.value = { ...DEFAULT_PERMISSIONS, ...newPermissions }
    } else {
      // Use default full permissions for owner/host
      if (newRole === 'owner' || newRole === 'host') {
        permissions.value = { ...OWNER_PERMISSIONS }
      }
    }
  }

  function reset(): void {
    role.value = null
    permissions.value = { ...DEFAULT_PERMISSIONS }
    error.value = null
    isLoading.value = false
  }

  return {
    role: readonly(role),
    permissions: readonly(permissions),
    isLoading: readonly(isLoading),
    error: readonly(error),

    isOwner,
    isHost,
    isTeacher,
    isStudent,
    isViewer,

    canDraw,
    canErase,
    canAddPage,
    canDeletePage,
    canClear,
    canExport,
    canShare,
    canLock,
    canKick,
    canEnd,
    canUpload,
    canManage,

    fetchRole,
    setRole,
    reset,
  }
}

export { DEFAULT_PERMISSIONS, OWNER_PERMISSIONS }
