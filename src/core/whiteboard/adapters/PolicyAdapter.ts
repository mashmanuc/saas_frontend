/**
 * PolicyAdapter interface for whiteboard limits and permissions
 * v0.82.0 - Foundation for limit enforcement (currently disabled)
 */

export interface WhiteboardLimits {
  /**
   * Maximum pages per workspace
   * null = unlimited (v0.82.0 default)
   */
  maxPages: number | null

  /**
   * Maximum assets per page
   * null = unlimited
   */
  maxAssetsPerPage?: number | null

  /**
   * Maximum storage size in bytes
   * null = unlimited
   */
  maxStorageBytes?: number | null
}

/**
 * Policy adapter contract for whiteboard permissions and limits
 */
export interface PolicyAdapter {
  /**
   * Get limits for workspace
   * v0.82.0: Returns { maxPages: null } (no enforcement)
   */
  getLimits(workspaceId: string): Promise<WhiteboardLimits>

  /**
   * Check if user can create page
   * v0.82.0: Always returns true
   */
  canCreatePage?(workspaceId: string): Promise<boolean>

  /**
   * Check if user can edit page
   * v0.82.0: Always returns true
   */
  canEditPage?(pageId: string): Promise<boolean>
}
