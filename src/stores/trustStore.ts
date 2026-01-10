/**
 * Trust & Safety Store v0.66.0
 * 
 * Pinia store for managing trust & safety state:
 * - User blocks
 * - User reports
 * - Ban status
 * - Block/unblock actions
 * - Report creation
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { trustApi } from '@/api/trust'
import { rethrowAsDomainError } from '@/utils/rethrowAsDomainError'
import type {
  UserBlock,
  UserReport,
  ActiveBan,
  BlockUserRequest,
  CreateReportRequest,
} from '@/types/trust'

export const useTrustStore = defineStore('trust', () => {
  // State
  const blocks = ref<UserBlock[]>([])
  const reports = ref<UserReport[]>([])
  const bans = ref<ActiveBan[]>([])
  const isLoading = ref<boolean>(false)
  const error = ref<string | null>(null)

  // Computed
  const hasActiveBlocks = computed(() => blocks.value.length > 0)
  const hasActiveBans = computed(() => bans.value.length > 0)
  const isBlockedByAny = computed(() => hasActiveBlocks.value)

  /**
   * Load user's blocks
   */
  async function loadBlocks() {
    isLoading.value = true
    error.value = null

    try {
      const response = await trustApi.getBlocks()
      blocks.value = response.blocks
    } catch (err) {
      error.value = String(err)
      rethrowAsDomainError(err)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Load user's reports
   */
  async function loadReports() {
    isLoading.value = true
    error.value = null

    try {
      const response = await trustApi.getReports()
      reports.value = response.reports
    } catch (err) {
      error.value = String(err)
      rethrowAsDomainError(err)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Load user's ban status
   */
  async function loadBanStatus() {
    isLoading.value = true
    error.value = null

    try {
      const response = await trustApi.getBanStatus()
      bans.value = response.bans
    } catch (err) {
      error.value = String(err)
      rethrowAsDomainError(err)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Load full trust status (blocks + bans)
   */
  async function loadTrustStatus() {
    isLoading.value = true
    error.value = null

    try {
      await Promise.all([loadBlocks(), loadBanStatus()])
    } catch (err) {
      error.value = String(err)
      rethrowAsDomainError(err)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Block a user
   * 
   * Optimistic update: adds block immediately, reverts on error
   */
  async function blockUser(payload: BlockUserRequest) {
    const optimisticBlock: UserBlock = {
      id: `temp-${Date.now()}`,
      blocked_user_id: payload.user_id,
      blocked_user_email: '',
      reason: payload.reason || '',
      created_at: new Date().toISOString(),
    }

    blocks.value.push(optimisticBlock)

    try {
      await trustApi.blockUser(payload)
      await loadBlocks()
    } catch (err) {
      blocks.value = blocks.value.filter(b => b.id !== optimisticBlock.id)
      error.value = String(err)
      rethrowAsDomainError(err)
    }
  }

  /**
   * Unblock a user
   * 
   * Optimistic update: removes block immediately, reverts on error
   */
  async function unblockUser(userId: number) {
    const previousBlocks = [...blocks.value]
    blocks.value = blocks.value.filter(b => b.blocked_user_id !== userId)

    try {
      await trustApi.unblockUser({ user_id: userId })
    } catch (err) {
      blocks.value = previousBlocks
      error.value = String(err)
      rethrowAsDomainError(err)
    }
  }

  /**
   * Create a report
   */
  async function createReport(payload: CreateReportRequest) {
    isLoading.value = true
    error.value = null

    try {
      const response = await trustApi.createReport(payload)
      await loadReports()
      return response
    } catch (err) {
      error.value = String(err)
      rethrowAsDomainError(err)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Check if user is blocked
   */
  function isUserBlocked(userId: number): boolean {
    return blocks.value.some(b => b.blocked_user_id === userId)
  }

  /**
   * Check if user has ban in specific scope
   */
  function hasBanInScope(scope: string): boolean {
    return bans.value.some(b => b.scope === scope || b.scope === 'ALL')
  }

  /**
   * Reset store state
   */
  function reset() {
    blocks.value = []
    reports.value = []
    bans.value = []
    isLoading.value = false
    error.value = null
  }

  return {
    // State
    blocks,
    reports,
    bans,
    isLoading,
    error,

    // Computed
    hasActiveBlocks,
    hasActiveBans,
    isBlockedByAny,

    // Actions
    loadBlocks,
    loadReports,
    loadBanStatus,
    loadTrustStatus,
    blockUser,
    unblockUser,
    createReport,
    isUserBlocked,
    hasBanInScope,
    reset,
  }
})
