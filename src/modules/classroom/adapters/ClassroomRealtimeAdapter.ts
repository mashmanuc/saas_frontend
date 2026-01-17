/**
 * ClassroomRealtimeAdapter - WebSocket implementation for classroom mode
 * v0.84.0 - Full realtime sync with presence, cursors, and operations
 * v0.85.0 - Added offline queue, ops_batch, ops_ack, and resync support
 * v0.88.0 - Added follow-mode support (presenter_page_switch)
 */

import type {
  RealtimeAdapter,
  RemoteCursor,
  PresenceUser,
  BoardOperation,
  WhiteboardOperation,
  OpsAckPayload,
  ResyncRequest,
  ResyncResponse,
  PresenterPageChangedPayload
} from '@/core/whiteboard/adapters/RealtimeAdapter'
import type { PendingOperation } from '@/core/whiteboard/adapters/OfflineQueue.types'

interface WebSocketMessage {
  type: string
  [key: string]: unknown
}

/**
 * WebSocket-based realtime adapter for classroom collaboration.
 * Connects to /ws/whiteboard/{workspace_id}/ endpoint.
 */
export class ClassroomRealtimeAdapter implements RealtimeAdapter {
  private ws: WebSocket | null = null
  private workspaceId: string | null = null
  private userId: string | null = null
  private presenceUsers: PresenceUser[] = []
  private presenceCallbacks: Array<(users: PresenceUser[]) => void> = []
  private cursorCallbacks: Array<(cursor: RemoteCursor) => void> = []
  private operationCallbacks: Array<(op: BoardOperation) => void> = []
  private pageSwitchCallbacks: Array<(pageId: string, userId: string) => void> = []
  private opsAckCallbacks: Array<(payload: OpsAckPayload) => void> = []
  private resyncCallbacks: Array<(payload: ResyncResponse) => void> = []
  
  // v0.86.0: Moderation callbacks
  private boardFrozenCallbacks: Array<(frozen: boolean, byUserId: string) => void> = []
  private presenterChangedCallbacks: Array<(presenterUserId: string | null, byUserId: string) => void> = []
  private pageClearedCallbacks: Array<(pageId: string, byUserId: string) => void> = []
  
  // v0.88.0: Follow-mode callbacks
  private presenterPageChangedCallbacks: Array<(payload: PresenterPageChangedPayload) => void> = []
  
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  
  // Offline queue (v0.85.0)
  private pendingOps: Map<string, PendingOperation> = new Map()
  private retryTimer: number | null = null
  private readonly maxRetries = 5
  private readonly retryDelay = 5000
  private readonly batchSize = 10
  
  async connect(workspaceId: string, userId: string): Promise<void> {
    this.workspaceId = workspaceId
    this.userId = userId
    
    return new Promise((resolve, reject) => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = `${protocol}//${window.location.host}/ws/whiteboard/${workspaceId}/`
      
      this.ws = new WebSocket(wsUrl)
      
      this.ws.onopen = () => {
        this.reconnectAttempts = 0
        this.sendMessage({ type: 'presence_join' })
        resolve()
      }
      
      this.ws.onerror = (error) => {
        console.error('[ClassroomRealtimeAdapter] WebSocket error:', error)
        reject(error)
      }
      
      this.ws.onmessage = (event) => {
        this.handleMessage(event.data)
      }
      
      this.ws.onclose = () => {
        this.handleDisconnect()
      }
    })
  }
  
  disconnect(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.presenceUsers = []
    this.workspaceId = null
    this.userId = null
  }
  
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }
  
  getPresence(): PresenceUser[] {
    return this.presenceUsers
  }
  
  onPresenceChange(callback: (users: PresenceUser[]) => void): void {
    this.presenceCallbacks.push(callback)
  }
  
  sendCursorMove(x: number, y: number, tool: string, color: string): void {
    this.sendMessage({
      type: 'cursor_move',
      cursor: {
        x,
        y,
        tool,
        color,
        timestamp: Date.now()
      }
    })
  }
  
  onCursorMove(callback: (cursor: RemoteCursor) => void): void {
    this.cursorCallbacks.push(callback)
  }
  
  async sendOperation(op: BoardOperation): Promise<void> {
    this.sendMessage({
      type: 'board_operation',
      operation: {
        type: op.type,
        pageId: op.pageId,
        version: op.version,
        data: op.data
      }
    })
  }
  
  onOperation(callback: (op: BoardOperation) => void): void {
    this.operationCallbacks.push(callback)
  }
  
  broadcastPageSwitch(pageId: string): void {
    this.sendMessage({
      type: 'page_switch',
      pageId
    })
  }
  
  onPageSwitch(callback: (pageId: string, userId: string) => void): void {
    this.pageSwitchCallbacks.push(callback)
  }
  
  // v0.85.0 methods
  async sendOperations(operations: WhiteboardOperation[]): Promise<void> {
    // Add to pending queue
    operations.forEach(op => {
      this.pendingOps.set(op.op_id, {
        operation: op,
        attempts: 0,
        lastAttemptAt: Date.now(),
        createdAt: Date.now()
      })
    })
    
    // Try to send immediately
    await this.flushPendingOps()
  }
  
  onOpsAck(callback: (payload: OpsAckPayload) => void): void {
    this.opsAckCallbacks.push(callback)
  }
  
  async requestResync(request: ResyncRequest): Promise<void> {
    this.sendMessage({
      type: 'resync_request',
      pageId: request.pageId,
      lastKnownVersion: request.lastKnownVersion
    })
  }
  
  onResync(callback: (payload: ResyncResponse) => void): void {
    this.resyncCallbacks.push(callback)
  }
  
  private async flushPendingOps(): Promise<void> {
    if (!this.isConnected() || this.pendingOps.size === 0) {
      return
    }
    
    // Get batch of operations to send
    const batch: WhiteboardOperation[] = []
    const now = Date.now()
    
    for (const [opId, pending] of this.pendingOps.entries()) {
      if (pending.attempts >= this.maxRetries) {
        console.error(`[ClassroomRealtimeAdapter] Max retries reached for operation ${opId}`)
        this.pendingOps.delete(opId)
        continue
      }
      
      // Check if enough time passed since last attempt
      if (now - pending.lastAttemptAt < this.retryDelay && pending.attempts > 0) {
        continue
      }
      
      batch.push(pending.operation)
      pending.attempts++
      pending.lastAttemptAt = now
      
      if (batch.length >= this.batchSize) {
        break
      }
    }
    
    if (batch.length > 0) {
      this.sendMessage({
        type: 'ops_batch',
        operations: batch
      })
      
      console.log(`[ClassroomRealtimeAdapter] Sent batch of ${batch.length} operations`)
    }
    
    // Schedule retry if there are still pending ops
    if (this.pendingOps.size > 0 && !this.retryTimer) {
      this.retryTimer = window.setTimeout(() => {
        this.retryTimer = null
        this.flushPendingOps()
      }, this.retryDelay)
    }
  }
  
  private sendMessage(message: WebSocketMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    } else {
      console.warn('[ClassroomRealtimeAdapter] Cannot send message, WebSocket not connected')
    }
  }
  
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data) as WebSocketMessage
      
      switch (message.type) {
        case 'presence':
          this.handlePresence(message.users as PresenceUser[])
          break
        
        case 'cursor_move':
          this.handleCursorMove(message as unknown as RemoteCursor & { type: string })
          break
        
        case 'board_operation':
          this.handleOperation(message as unknown as BoardOperation & { type: string })
          break
        
        case 'page_switch':
          this.handlePageSwitch(message.pageId as string, message.userId as string)
          break
        
        case 'version_conflict':
          this.handleVersionConflict(message.pageId as string, message.currentVersion as number)
          break
        
        case 'ops_ack':
          this.handleOpsAck(message as unknown as OpsAckPayload)
          break
        
        case 'resync_response':
          this.handleResyncResponse(message as unknown as ResyncResponse)
          break
        
        case 'board_frozen':
          this.handleBoardFrozen(message.isFrozen as boolean, message.byUserId as string)
          break
        
        case 'presenter_changed':
          this.handlePresenterChanged(message.presenterUserId as string | null, message.byUserId as string)
          break
        
        case 'page_cleared':
          this.handlePageCleared(message.pageId as string, message.byUserId as string)
          break
        
        case 'presenter_page_changed':
          this.handlePresenterPageChanged(message as unknown as PresenterPageChangedPayload)
          break
        
        case 'error':
          console.error('[ClassroomRealtimeAdapter] Server error:', message)
          break
        
        default:
          console.warn('[ClassroomRealtimeAdapter] Unknown message type:', message.type)
      }
    } catch (error) {
      console.error('[ClassroomRealtimeAdapter] Failed to parse message:', error)
    }
  }
  
  private handlePresence(users: PresenceUser[]): void {
    this.presenceUsers = users
    this.presenceCallbacks.forEach(callback => callback(users))
  }
  
  private handleCursorMove(data: RemoteCursor & { type: string }): void {
    const cursor: RemoteCursor = {
      userId: data.userId,
      userName: data.userName,
      x: data.x,
      y: data.y,
      tool: data.tool,
      color: data.color,
      timestamp: data.timestamp
    }
    this.cursorCallbacks.forEach(callback => callback(cursor))
  }
  
  private handleOperation(data: BoardOperation & { type: string }): void {
    const operation: BoardOperation = {
      type: data.type as BoardOperation['type'],
      pageId: data.pageId,
      data: data.data,
      userId: data.userId,
      timestamp: data.timestamp,
      version: data.version
    }
    this.operationCallbacks.forEach(callback => callback(operation))
  }
  
  private handlePageSwitch(pageId: string, userId: string): void {
    this.pageSwitchCallbacks.forEach(callback => callback(pageId, userId))
  }
  
  private handleVersionConflict(pageId: string, currentVersion: number): void {
    console.warn('[ClassroomRealtimeAdapter] Version conflict detected', {
      pageId,
      currentVersion
    })
    // Emit custom event for store to handle
    window.dispatchEvent(new CustomEvent('whiteboard:version-conflict', {
      detail: { pageId, currentVersion }
    }))
  }
  
  private handleOpsAck(payload: OpsAckPayload): void {
    // Remove acknowledged operations from pending queue
    payload.opIds.forEach(opId => {
      this.pendingOps.delete(opId)
    })
    
    console.log(`[ClassroomRealtimeAdapter] Acknowledged ${payload.opIds.length} operations, applied version: ${payload.appliedVersion}`)
    
    // Notify callbacks
    this.opsAckCallbacks.forEach(callback => callback(payload))
    
    // Try to flush remaining pending ops
    this.flushPendingOps()
  }
  
  private handleResyncResponse(payload: ResyncResponse): void {
    console.log(`[ClassroomRealtimeAdapter] Received resync response for page ${payload.pageId}`)
    
    // Clear pending ops for this page (they're now stale)
    for (const [opId, pending] of this.pendingOps.entries()) {
      if (pending.operation.pageId === payload.pageId) {
        this.pendingOps.delete(opId)
      }
    }
    
    // Notify callbacks
    this.resyncCallbacks.forEach(callback => callback(payload))
  }
  
  // v0.86.0: Moderation handlers
  private handleBoardFrozen(frozen: boolean, byUserId: string): void {
    console.log(`[ClassroomRealtimeAdapter] Board ${frozen ? 'frozen' : 'unfrozen'} by ${byUserId}`)
    this.boardFrozenCallbacks.forEach(callback => callback(frozen, byUserId))
  }
  
  private handlePresenterChanged(presenterUserId: string | null, byUserId: string): void {
    console.log(`[ClassroomRealtimeAdapter] Presenter changed to ${presenterUserId} by ${byUserId}`)
    this.presenterChangedCallbacks.forEach(callback => callback(presenterUserId, byUserId))
  }
  
  private handlePageCleared(pageId: string, byUserId: string): void {
    console.log(`[ClassroomRealtimeAdapter] Page ${pageId} cleared by ${byUserId}`)
    this.pageClearedCallbacks.forEach(callback => callback(pageId, byUserId))
  }
  
  // v0.86.0: Public moderation methods
  onBoardFrozen(callback: (frozen: boolean, byUserId: string) => void): void {
    this.boardFrozenCallbacks.push(callback)
  }
  
  onPresenterChanged(callback: (presenterUserId: string | null, byUserId: string) => void): void {
    this.presenterChangedCallbacks.push(callback)
  }
  
  onPageCleared(callback: (pageId: string, byUserId: string) => void): void {
    this.pageClearedCallbacks.push(callback)
  }
  
  async sendFreeze(frozen: boolean): Promise<void> {
    this.sendMessage({
      type: 'board_freeze',
      isFrozen: frozen
    })
  }
  
  async sendClearPage(pageId: string): Promise<void> {
    this.sendMessage({
      type: 'board_clear_page',
      pageId
    })
  }
  
  async sendSetPresenter(userId: string | null): Promise<void> {
    this.sendMessage({
      type: 'board_set_presenter',
      userId
    })
  }
  
  // v0.88.0: Follow-mode methods
  async sendPresenterPageSwitch(pageId: string): Promise<void> {
    this.sendMessage({
      type: 'presenter_page_switch',
      pageId
    })
  }
  
  onPresenterPageChanged(callback: (payload: PresenterPageChangedPayload) => void): void {
    this.presenterPageChangedCallbacks.push(callback)
  }
  
  private handlePresenterPageChanged(payload: PresenterPageChangedPayload): void {
    console.log(`[ClassroomRealtimeAdapter] Presenter page changed to ${payload.pageId} by ${payload.presenterUserId}`)
    this.presenterPageChangedCallbacks.forEach(callback => callback(payload))
  }
  
  private handleDisconnect(): void {
    console.log('[ClassroomRealtimeAdapter] WebSocket disconnected')
    
    if (this.reconnectAttempts < this.maxReconnectAttempts && this.workspaceId && this.userId) {
      this.reconnectAttempts++
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)
      
      console.log(`[ClassroomRealtimeAdapter] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
      
      setTimeout(() => {
        if (this.workspaceId && this.userId) {
          this.connect(this.workspaceId, this.userId).catch(error => {
            console.error('[ClassroomRealtimeAdapter] Reconnect failed:', error)
          })
        }
      }, delay)
    } else {
      console.error('[ClassroomRealtimeAdapter] Max reconnect attempts reached')
      this.presenceUsers = []
    }
  }
}
