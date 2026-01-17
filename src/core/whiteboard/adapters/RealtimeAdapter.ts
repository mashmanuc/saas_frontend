/**
 * RealtimeAdapter interface for whiteboard realtime sync
 * v0.82.0 - Interface only, no implementation yet
 * v0.85.0 - Extended with ops_batch, ops_ack, and resync support
 * v0.88.0 - Extended with follow-mode support (presenter_page_switch)
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

export interface WhiteboardOperation {
  op_id: string
  pageId: string
  baseVersion: number
  payload: BoardOperation
}

export interface OpsAckPayload {
  pageId: string
  appliedVersion: number
  opIds: string[]
}

export interface ResyncRequest {
  pageId: string
  lastKnownVersion: number
}

export interface ResyncResponse {
  pageId: string
  snapshot: {
    version: number
    state: unknown
  }
  operations: Array<{
    op_id: string
    payload: BoardOperation
    appliedVersion: number
    authorId: string
  }>
}

/**
 * v0.88.0: Presenter page changed payload
 */
export interface PresenterPageChangedPayload {
  workspaceId: string
  presenterUserId: string | null
  pageId: string
  ts: number
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

  /**
   * Send batch of operations (v0.85.0)
   */
  sendOperations?(operations: WhiteboardOperation[]): Promise<void>

  /**
   * Subscribe to operations acknowledgment (v0.85.0)
   */
  onOpsAck?(callback: (payload: OpsAckPayload) => void): void

  /**
   * Request resync with snapshot (v0.85.0)
   */
  requestResync?(request: ResyncRequest): Promise<void>

  /**
   * Subscribe to resync response (v0.85.0)
   */
  onResync?(callback: (payload: ResyncResponse) => void): void

  /**
   * Send presenter page switch (v0.88.0)
   */
  sendPresenterPageSwitch?(pageId: string): Promise<void>

  /**
   * Subscribe to presenter page changed (v0.88.0)
   */
  onPresenterPageChanged?(callback: (payload: PresenterPageChangedPayload) => void): void
}
