/**
 * StorageAdapter interface for whiteboard pages persistence
 * v0.82.0 - Foundation for modular storage
 */

export interface PageMetadata {
  id: string
  title: string
  index: number
  version: number
  updatedAt: string
}

export interface PageData extends PageMetadata {
  state: {
    strokes: unknown[]
    assets: unknown[]
    [key: string]: unknown
  }
}

export interface CreatePageRequest {
  title?: string
}

export interface SavePageRequest {
  state: PageData['state']
  version?: number
}

/**
 * Storage adapter contract for whiteboard pages
 */
export interface StorageAdapter {
  /**
   * List all pages in workspace
   */
  listPages(workspaceId: string): Promise<PageMetadata[]>

  /**
   * Create new page
   */
  createPage(workspaceId: string, request: CreatePageRequest): Promise<PageData>

  /**
   * Load page with full state
   */
  loadPage(pageId: string): Promise<PageData>

  /**
   * Save page state
   */
  savePage(pageId: string, request: SavePageRequest): Promise<{ version: number }>
}
