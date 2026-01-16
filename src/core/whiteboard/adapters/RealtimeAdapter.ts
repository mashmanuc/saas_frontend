/**
 * RealtimeAdapter interface for whiteboard realtime sync
 * v0.82.0 - Interface only, no implementation yet
 */

export interface RemoteCursor {
  userId: string
  userName: string
  x: number
  y: number
  tool: string
  color: string
  timestamp: number
}

export interface PresenceUser {
  userId: string
  userName: string
  isActive: boolean
  lastSeenAt: number
}

export interface BoardOperation {
  type: 'stroke_add' | 'stroke_update' | 'stroke_delete' | 'asset_add' | 'asset_update' | 'asset_delete'
  pageId: string
  data: unknown
  userId: string
  timestamp: number
  version: number
}

/**
 * Realtime adapter contract for whiteboard collaboration
 * v0.82.0: Interface prepared, implementation in v0.84.0
 */
export interface RealtimeAdapter {
  /**
   * Connect to realtime session
   */
  connect(workspaceId: string, userId: string): Promise<void>

  /**
   * Disconnect from realtime session
   */
  disconnect(): void

  /**
   * Check connection status
   */
  isConnected(): boolean

  /**
   * Get current presence users
   */
  getPresence(): PresenceUser[]

  /**
   * Subscribe to presence changes
   */
  onPresenceChange(callback: (users: PresenceUser[]) => void): void

  /**
   * Send cursor position
   */
  sendCursorMove(x: number, y: number, tool: string, color: string): void

  /**
   * Subscribe to remote cursor movements
   */
  onCursorMove(callback: (cursor: RemoteCursor) => void): void

  /**
   * Send board operation
   */
  sendOperation(op: BoardOperation): Promise<void>

  /**
   * Subscribe to board operations
   */
  onOperation(callback: (op: BoardOperation) => void): void

  /**
   * Broadcast page switch
   */
  broadcastPageSwitch(pageId: string): void

  /**
   * Subscribe to page switches
   */
  onPageSwitch(callback: (pageId: string, userId: string) => void): void
}
