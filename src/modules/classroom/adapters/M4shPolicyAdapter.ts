/**
 * M4SH Policy Adapter implementation for classroom whiteboard
 * v0.83.0 - Real limits from user entitlement
 */

import type { PolicyAdapter, WhiteboardLimits } from '@/core/whiteboard/adapters'
import { apiClient } from '@/api/client'

export class M4shPolicyAdapter implements PolicyAdapter {
  async getLimits(workspaceId: string): Promise<WhiteboardLimits> {
    try {
      // v0.83.0: Fetch real limits from backend
      // Backend calculates based on user's plan (free/pro/business)
      const response = await apiClient.get(`/api/v1/whiteboard/workspaces/${workspaceId}/limits/`)
      return {
        maxPages: response.data.max_pages,
        maxAssetsPerPage: response.data.max_assets_per_page || null,
        maxStorageBytes: response.data.max_storage_bytes || null,
      }
    } catch (error) {
      // Fallback: use default free tier limits
      console.warn('[M4shPolicyAdapter] Failed to fetch limits, using free tier defaults:', error)
      return {
        maxPages: 2, // FREE tier default
        maxAssetsPerPage: null,
        maxStorageBytes: null,
      }
    }
  }

  async canCreatePage(workspaceId: string): Promise<boolean> {
    // Check limits before allowing creation
    try {
      const limits = await this.getLimits(workspaceId)
      if (limits.maxPages === null) {
        return true // Unlimited
      }
      
      // Get current page count
      const response = await apiClient.get(`/api/v1/whiteboard/workspaces/${workspaceId}/pages/`)
      const currentCount = response.data.pages?.length || 0
      
      return currentCount < limits.maxPages
    } catch (error) {
      console.error('[M4shPolicyAdapter] Failed to check canCreatePage:', error)
      return true // Fail open
    }
  }

  async canEditPage(pageId: string): Promise<boolean> {
    // v0.83.0: Always allow editing existing pages
    return true
  }
}
