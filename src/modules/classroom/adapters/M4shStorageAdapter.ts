/**
 * M4SH Storage Adapter implementation for classroom whiteboard
 * v0.82.0
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
  private readonly baseUrl: string

  constructor(baseUrl = '/api/v1/classroom') {
    this.baseUrl = baseUrl
  }

  async listPages(workspaceId: string): Promise<PageMetadata[]> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/sessions/${workspaceId}/pages/`)
      return response.data.pages || []
    } catch (error) {
      console.error('[M4shStorageAdapter] Failed to list pages:', error)
      throw new Error('Failed to load pages')
    }
  }

  async createPage(workspaceId: string, request: CreatePageRequest): Promise<PageData> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/sessions/${workspaceId}/pages/`, {
        title: request.title || `Page ${Date.now()}`,
      })
      return response.data
    } catch (error: any) {
      if (error.response?.status === 409 && error.response?.data?.code === 'limit_exceeded') {
        throw new Error('PAGE_LIMIT_EXCEEDED')
      }
      console.error('[M4shStorageAdapter] Failed to create page:', error)
      throw new Error('Failed to create page')
    }
  }

  async loadPage(pageId: string): Promise<PageData> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/pages/${pageId}/`)
      return response.data
    } catch (error) {
      console.error('[M4shStorageAdapter] Failed to load page:', error)
      throw new Error('Failed to load page')
    }
  }

  async savePage(pageId: string, request: SavePageRequest): Promise<{ version: number }> {
    try {
      const response = await apiClient.patch(`${this.baseUrl}/pages/${pageId}/`, {
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
