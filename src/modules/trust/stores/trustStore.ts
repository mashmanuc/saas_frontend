/**
 * Trust Store
 * 
 * DOMAIN-12: Trust & Safety State Management
 * 
 * Pinia store for managing blocks, reports, bans, and appeals.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { trustApi, Block, Report, Ban, Appeal, SuspiciousActivity } from '../api/trust'

export const useTrustStore = defineStore('trust', () => {
  // State
  const blocks = ref<Block[]>([])
  const reports = ref<Report[]>([])
  const bans = ref<Ban[]>([])
  const appeals = ref<Appeal[]>([])
  const suspiciousActivity = ref<SuspiciousActivity[]>([])
  
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Getters
  const blockedUserIds = computed(() => {
    return new Set(blocks.value.map(b => b.target_user_id))
  })

  const isBlocked = (userId: number) => {
    return blockedUserIds.value.has(userId)
  }

  const activeBanCount = computed(() => bans.value.length)
  
  const hasActiveBans = computed(() => bans.value.length > 0)
  
  const pendingAppeals = computed(() => 
    appeals.value.filter(a => a.status === 'pending')
  )

  const activeBansByScope = computed(() => {
    return bans.value.reduce((acc, ban) => {
      acc[ban.scope] = (acc[ban.scope] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  })

  // Actions
  async function fetchBlocks(): Promise<void> {
    loading.value = true
    error.value = null
    
    try {
      const response = await trustApi.getBlockedUsers()
      blocks.value = response
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch blocked users'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function blockUser(targetUserId: number, reason?: string): Promise<Block> {
    loading.value = true
    error.value = null
    
    try {
      const response = await trustApi.blockUser({ target_user_id: targetUserId, reason })
      blocks.value.push(response)
      return response
    } catch (e: any) {
      error.value = e.message || 'Failed to block user'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function unblockUser(blockId: number): Promise<void> {
    loading.value = true
    error.value = null
    
    try {
      await trustApi.unblockUser(blockId)
      blocks.value = blocks.value.filter(b => b.id !== blockId)
    } catch (e: any) {
      error.value = e.message || 'Failed to unblock user'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function createReport(
    targetType: Report['target_type'],
    targetId: number,
    category: Report['category'],
    comment?: string
  ): Promise<Report> {
    loading.value = true
    error.value = null
    
    try {
      const response = await trustApi.createReport({
        target_type: targetType,
        target_id: targetId,
        category,
        comment
      })
      reports.value.unshift(response)
      return response
    } catch (e: any) {
      error.value = e.message || 'Failed to create report'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchReports(): Promise<void> {
    loading.value = true
    error.value = null
    
    try {
      const response = await trustApi.getMyReports()
      reports.value = response
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch reports'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchBans(): Promise<void> {
    loading.value = true
    error.value = null
    
    try {
      const response = await trustApi.getActiveBans()
      bans.value = response
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch bans'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchAppeals(): Promise<void> {
    loading.value = true
    error.value = null
    
    try {
      const response = await trustApi.getMyAppeals()
      appeals.value = response
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch appeals'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function createAppeal(banId: number, reason: string): Promise<Appeal> {
    loading.value = true
    error.value = null
    
    try {
      const response = await trustApi.createAppeal({ ban_id: banId, reason })
      appeals.value.unshift(response)
      return response
    } catch (e: any) {
      error.value = e.message || 'Failed to create appeal'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function withdrawAppeal(appealId: number): Promise<void> {
    loading.value = true
    error.value = null
    
    try {
      await trustApi.withdrawAppeal(appealId)
      appeals.value = appeals.value.filter(a => a.id !== appealId)
    } catch (e: any) {
      error.value = e.message || 'Failed to withdraw appeal'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchSuspiciousActivity(params?: { from?: string; to?: string; severity?: string }): Promise<void> {
    loading.value = true
    error.value = null
    
    try {
      const response = await trustApi.getSuspiciousActivity(params)
      suspiciousActivity.value = response
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch suspicious activity'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function markActivityReviewed(activityId: number): Promise<void> {
    try {
      await trustApi.markActivityReviewed(activityId)
      const activity = suspiciousActivity.value.find(a => a.id === activityId)
      if (activity) {
        activity.reviewed = true
      }
    } catch (e: any) {
      error.value = e.message || 'Failed to mark activity as reviewed'
      throw e
    }
  }

  function $reset(): void {
    blocks.value = []
    reports.value = []
    bans.value = []
    appeals.value = []
    suspiciousActivity.value = []
    loading.value = false
    error.value = null
  }

  return {
    // State
    blocks,
    reports,
    bans,
    appeals,
    suspiciousActivity,
    loading,
    error,
    
    // Getters
    blockedUserIds,
    isBlocked,
    activeBanCount,
    hasActiveBans,
    pendingAppeals,
    activeBansByScope,
    
    // Actions
    fetchBlocks,
    blockUser,
    unblockUser,
    createReport,
    fetchReports,
    fetchBans,
    fetchAppeals,
    createAppeal,
    withdrawAppeal,
    fetchSuspiciousActivity,
    markActivityReviewed,
    $reset,
  }
})
