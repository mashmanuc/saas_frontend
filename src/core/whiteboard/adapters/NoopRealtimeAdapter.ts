/**
 * NoopRealtimeAdapter - Offline/Solo mode implementation
 * v0.84.0 - No-op implementation for solo whiteboard mode
 */

import type {
  RealtimeAdapter,
  RemoteCursor,
  PresenceUser,
  BoardOperation
} from './RealtimeAdapter'

/**
 * No-operation realtime adapter for solo/offline mode.
 * All methods are no-ops, no network calls are made.
 */
export class NoopRealtimeAdapter implements RealtimeAdapter {
  private connected = false
  private presenceUsers: PresenceUser[] = []
  
  async connect(_workspaceId: string, _userId: string): Promise<void> {
    this.connected = true
  }
  
  disconnect(): void {
    this.connected = false
    this.presenceUsers = []
  }
  
  isConnected(): boolean {
    return this.connected
  }
  
  getPresence(): PresenceUser[] {
    return this.presenceUsers
  }
  
  onPresenceChange(_callback: (users: PresenceUser[]) => void): void {
    // No-op
  }
  
  sendCursorMove(_x: number, _y: number, _tool: string, _color: string): void {
    // No-op
  }
  
  onCursorMove(_callback: (cursor: RemoteCursor) => void): void {
    // No-op
  }
  
  async sendOperation(_op: BoardOperation): Promise<void> {
    // No-op
  }
  
  onOperation(_callback: (op: BoardOperation) => void): void {
    // No-op
  }
  
  broadcastPageSwitch(_pageId: string): void {
    // No-op
  }
  
  onPageSwitch(_callback: (pageId: string, userId: string) => void): void {
    // No-op
  }
}
