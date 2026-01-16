/**
 * ClassroomRealtimeAdapter - WebSocket implementation for classroom mode
 * v0.84.0 - Full realtime sync with presence, cursors, and operations
 */

import type {
  RealtimeAdapter,
  RemoteCursor,
  PresenceUser,
  BoardOperation
} from '@/core/whiteboard/adapters/RealtimeAdapter'

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
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  
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
