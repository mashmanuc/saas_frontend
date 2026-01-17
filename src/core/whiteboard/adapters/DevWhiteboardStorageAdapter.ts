/**
 * DevWhiteboardStorageAdapter - localStorage-based storage for dev workspaces
 * v0.93.0 - Dev-only persistence layer
 * 
 * LAW-02: Persistency або нічого - кожна зміна має призводити до persisted write
 * LAW-11: Dev-mode не змінює реальність - ізольований флагами/permissions
 */

import type { StorageAdapter, PageMetadata, PageData, CreatePageRequest, SavePageRequest } from './StorageAdapter'

/**
 * Payload schema для localStorage (v0.93.0)
 */
interface DevPagePayload {
  schema_version: 1
  workspace_id: string
  page_id: string
  saved_at: string
  strokes: unknown[]
  assets: unknown[]
}

/**
 * Dev-only storage adapter using localStorage
 * Використовується ТІЛЬКИ для workspaceId.startsWith('dev-workspace-')
 */
export class DevWhiteboardStorageAdapter implements StorageAdapter {
  private readonly KEY_PREFIX = 'winterboard:dev'

  /**
   * Generate localStorage key
   * Schema: winterboard:dev:${workspaceId}:${pageId}
   */
  private getKey(workspaceId: string, pageId: string): string {
    return `${this.KEY_PREFIX}:${workspaceId}:${pageId}`
  }

  /**
   * List all pages in workspace
   * Dev mode: metadata генерується в store, тому це noop
   */
  async listPages(workspaceId: string): Promise<PageMetadata[]> {
    console.info('[DevStorage] listPages called (noop for dev workspace)', { workspaceId })
    return []
  }

  /**
   * Create new page
   * Dev mode: metadata генерується в store, тому це noop
   */
  async createPage(workspaceId: string, request: CreatePageRequest): Promise<PageData> {
    console.info('[DevStorage] createPage called (noop for dev workspace)', { workspaceId, request })
    throw new Error('DevStorageAdapter.createPage is not implemented - use store.addDevPage()')
  }

  /**
   * Load page with full state from localStorage
   */
  async loadPage(pageId: string): Promise<PageData> {
    // Extract workspaceId from pageId (format: dev-workspace-xxx-page-N)
    const workspaceId = this.extractWorkspaceId(pageId)
    const key = this.getKey(workspaceId, pageId)

    console.info('[DevStorage] loadPage', { pageId, key })

    try {
      const raw = localStorage.getItem(key)
      
      if (!raw) {
        console.info('[DevStorage] No saved data for page, returning empty state', { pageId })
        // Return empty page data
        return {
          id: pageId,
          title: this.extractPageTitle(pageId),
          index: this.extractPageIndex(pageId),
          version: 1,
          state: { strokes: [], assets: [] },
          updatedAt: new Date().toISOString(),
        }
      }

      const payload: DevPagePayload = JSON.parse(raw)

      // Validate schema
      if (payload.schema_version !== 1) {
        console.warn('[DevStorage] Unknown schema version, resetting', { schema_version: payload.schema_version })
        return {
          id: pageId,
          title: this.extractPageTitle(pageId),
          index: this.extractPageIndex(pageId),
          version: 1,
          state: { strokes: [], assets: [] },
          updatedAt: new Date().toISOString(),
        }
      }

      console.info('[DevStorage] Loaded page data', {
        pageId,
        strokesCount: payload.strokes.length,
        assetsCount: payload.assets.length,
        savedAt: payload.saved_at,
      })

      return {
        id: pageId,
        title: this.extractPageTitle(pageId),
        index: this.extractPageIndex(pageId),
        version: 1,
        state: {
          strokes: payload.strokes,
          assets: payload.assets,
        },
        updatedAt: payload.saved_at,
      }
    } catch (err) {
      console.error('[DevStorage] Failed to load page', { pageId, error: err })
      // Return empty state on error
      return {
        id: pageId,
        title: this.extractPageTitle(pageId),
        index: this.extractPageIndex(pageId),
        version: 1,
        state: { strokes: [], assets: [] },
        updatedAt: new Date().toISOString(),
      }
    }
  }

  /**
   * Save page state to localStorage
   */
  async savePage(pageId: string, request: SavePageRequest): Promise<{ version: number }> {
    const workspaceId = this.extractWorkspaceId(pageId)
    const key = this.getKey(workspaceId, pageId)

    const payload: DevPagePayload = {
      schema_version: 1,
      workspace_id: workspaceId,
      page_id: pageId,
      saved_at: new Date().toISOString(),
      strokes: request.state.strokes,
      assets: request.state.assets,
    }

    try {
      localStorage.setItem(key, JSON.stringify(payload))
      
      console.info('[DevStorage] savePage', {
        pageId,
        key,
        strokesCount: payload.strokes.length,
        assetsCount: payload.assets.length,
        savedAt: payload.saved_at,
      })

      return { version: 1 }
    } catch (err) {
      console.error('[DevStorage] Failed to save page', { pageId, error: err })
      throw err
    }
  }

  /**
   * Extract workspaceId from pageId
   * Format: dev-workspace-xxx-page-N -> dev-workspace-xxx
   */
  private extractWorkspaceId(pageId: string): string {
    const index = pageId.indexOf('-page-')
    if (index === -1 || !pageId.startsWith('dev-workspace-')) {
      throw new Error(`Invalid dev pageId format: ${pageId}`)
    }
    return pageId.substring(0, index)
  }

  /**
   * Extract page title from pageId
   * Format: dev-workspace-xxx-page-5 -> Page 5
   */
  private extractPageTitle(pageId: string): string {
    const match = pageId.match(/-page-(\d+)$/)
    if (!match) {
      return 'Page'
    }
    return `Page ${match[1]}`
  }

  /**
   * Extract page index from pageId
   * Format: dev-workspace-xxx-page-5 -> 4 (0-indexed)
   */
  private extractPageIndex(pageId: string): number {
    const match = pageId.match(/-page-(\d+)$/)
    if (!match) {
      return 0
    }
    return parseInt(match[1], 10) - 1
  }
}
