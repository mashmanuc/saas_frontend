/**
 * M4SH Policy Adapter implementation for classroom whiteboard
 * v0.82.0 - Returns no limits (maxPages: null)
 */

import type { PolicyAdapter, WhiteboardLimits } from '@/core/whiteboard/adapters'
import { apiClient } from '@/api/client'

export class M4shPolicyAdapter implements PolicyAdapter {
  private readonly baseUrl: string

  constructor(baseUrl = '/api/v1/classroom') {
    this.baseUrl = baseUrl
  }

  async getLimits(workspaceId: string): Promise<WhiteboardLimits> {
    try {
      // v0.82.0: Return no limits (enforcement disabled)
      // Future: fetch from backend API
      const response = await apiClient.get(`${this.baseUrl}/sessions/${workspaceId}/limits/`)
      return response.data
    } catch (error) {
      // Fallback: no limits
      console.warn('[M4shPolicyAdapter] Failed to fetch limits, using defaults:', error)
      return {
        maxPages: null,
        maxAssetsPerPage: null,
        maxStorageBytes: null,
      }
    }
  }

  async canCreatePage(workspaceId: string): Promise<boolean> {
    // v0.82.0: Always allow (no enforcement)
    return true
  }

  async canEditPage(pageId: string): Promise<boolean> {
    // v0.82.0: Always allow (no enforcement)
    return true
  }
}
