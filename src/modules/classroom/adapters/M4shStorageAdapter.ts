/**
 * M4SH Storage Adapter implementation for classroom whiteboard
 * v0.83.0 - Updated to use new whiteboard API endpoints
 */

import type {
  StorageAdapter,
  PageMetadata,
  PageData,
  CreatePageRequest,
  SavePageRequest,
} from '@/core/whiteboard/adapters'
import { apiClient } from '@/api/client'

export class M4shStorageAdapter implements StorageAdapter {
  private workspaceId: string | null = null

  async resolveWorkspace(workspaceType: string, workspaceId: string): Promise<string> {
    try {
      const response = await apiClient.post('/api/v1/whiteboard/workspaces/resolve/', {
        workspace_type: workspaceType,
        workspace_id: workspaceId,
      })
      this.workspaceId = response.data.id
      return this.workspaceId
    } catch (error) {
      console.error('[M4shStorageAdapter] Failed to resolve workspace:', error)
      throw new Error('Failed to resolve workspace')
    }
  }

  async listPages(workspaceId: string): Promise<PageMetadata[]> {
    try {
      const wsId = this.workspaceId || workspaceId
      const response = await apiClient.get(`/api/v1/whiteboard/workspaces/${wsId}/pages/`)
      return response.data.pages || []
    } catch (error) {
      console.error('[M4shStorageAdapter] Failed to list pages:', error)
      throw new Error('Failed to load pages')
    }
  }

  async createPage(workspaceId: string, request: CreatePageRequest): Promise<PageData> {
    try {
      const wsId = this.workspaceId || workspaceId
      const response = await apiClient.post(`/api/v1/whiteboard/workspaces/${wsId}/pages/`, {
        title: request.title || `Page ${Date.now()}`,
      })
      return response.data
    } catch (error: any) {
      if (error.response?.status === 409 && error.response?.data?.code === 'limit_exceeded') {
        const limitError: any = new Error('PAGE_LIMIT_EXCEEDED')
        limitError.limitData = error.response.data
        throw limitError
      }
      console.error('[M4shStorageAdapter] Failed to create page:', error)
      throw new Error('Failed to create page')
    }
  }

  async loadPage(pageId: string): Promise<PageData> {
    try {
      const response = await apiClient.get(`/api/v1/whiteboard/pages/${pageId}/`)
      return response.data
    } catch (error) {
      console.error('[M4shStorageAdapter] Failed to load page:', error)
      throw new Error('Failed to load page')
    }
  }

  async savePage(pageId: string, request: SavePageRequest): Promise<{ version: number }> {
    try {
      const response = await apiClient.patch(`/api/v1/whiteboard/pages/${pageId}/`, {
        state: request.state,
        version: request.version,
      })
      return { version: response.data.version }
    } catch (error: any) {
      if (error.response?.status === 409 && error.response?.data?.code === 'version_conflict') {
        throw new Error('VERSION_CONFLICT')
      }
      if (error.response?.status === 413) {
        throw new Error('PAYLOAD_TOO_LARGE')
      }
      console.error('[M4shStorageAdapter] Failed to save page:', error)
      throw new Error('Failed to save page')
    }
  }
}
