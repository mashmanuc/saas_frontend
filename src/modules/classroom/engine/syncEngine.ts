// F3: Sync Engine - Board synchronization
import mitt, { Emitter } from 'mitt'

export interface BoardEvent {
  type: 'board_event'
  event_type: string
  data: Record<string, unknown>
  version: number
  timestamp: number
  user_id?: number
}

export interface BoardUpdate {
  type: 'board_update'
  event_type: string
  data: Record<string, unknown>
  version: number
  user_id: number
}

export interface ConflictData {
  type: 'conflict'
  local_version: number
  server_version: number
  server_state: Record<string, unknown>
}

export interface SyncResponse {
  type: 'sync_response'
  version: number
  state: Record<string, unknown>
}

type SyncEvents = {
  board_update: BoardUpdate
  sync_complete: SyncResponse
  conflict_resolved: Record<string, unknown>
  error: Error
}

export class SyncEngine {
  private socket: WebSocket | null = null
  private localVersion: number = 0
  private pendingEvents: BoardEvent[] = []
  private eventEmitter: Emitter<SyncEvents> = mitt<SyncEvents>()
  private isConnected: boolean = false

  private logWarn(...args: any[]): void {
    const isDev = Boolean((import.meta as any)?.env?.DEV)
    if (isDev) {
      // eslint-disable-next-line no-console
      console.warn(...args)
      return
    }
    // eslint-disable-next-line no-console
    console.debug(...args)
  }

  constructor(initialVersion: number = 0) {
    this.localVersion = initialVersion
  }

  setSocket(socket: WebSocket): void {
    this.socket = socket
    this.socket.onmessage = this.handleMessage.bind(this)
    this.socket.onopen = () => {
      this.isConnected = true
      this.flushPendingEvents()
    }
    this.socket.onclose = () => {
      this.isConnected = false
    }
  }

  getSocket(): WebSocket | null {
    return this.socket
  }

  getVersion(): number {
    return this.localVersion
  }

  sendEvent(eventType: string, data: Record<string, unknown>): void {
    const event: BoardEvent = {
      type: 'board_event',
      event_type: eventType,
      data,
      version: this.localVersion,
      timestamp: Date.now(),
    }

    if (this.isConnected && this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(event))
    } else {
      // Queue for later
      this.pendingEvents.push(event)
    }
  }

  private flushPendingEvents(): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return

    while (this.pendingEvents.length > 0) {
      const event = this.pendingEvents.shift()
      if (event) {
        this.socket.send(JSON.stringify(event))
      }
    }
  }

  private handleMessage(msg: MessageEvent): void {
    try {
      const data = JSON.parse(msg.data)

      switch (data.type) {
        case 'sync_response':
          this.handleSyncResponse(data as SyncResponse)
          break
        case 'board_update':
          this.handleBoardUpdate(data as BoardUpdate)
          break
        case 'conflict':
          this.handleConflict(data as ConflictData)
          break
        case 'ack':
          this.handleAck(data)
          break
        default:
          this.logWarn('[SyncEngine] Unknown message type:', data.type)
      }
    } catch (error) {
      console.error('[SyncEngine] Failed to parse message:', error)
      this.eventEmitter.emit('error', error as Error)
    }
  }

  private handleSyncResponse(data: SyncResponse): void {
    this.localVersion = data.version
    this.eventEmitter.emit('sync_complete', data)
  }

  private handleBoardUpdate(data: BoardUpdate): void {
    // Apply remote change
    this.localVersion = data.version
    this.eventEmitter.emit('board_update', data)
  }

  private handleConflict(data: ConflictData): void {
    // Resolve conflict by accepting server state
    // In a more complex implementation, we could use OT
    this.localVersion = data.server_version
    this.eventEmitter.emit('conflict_resolved', data.server_state)
  }

  private handleAck(data: { version: number }): void {
    // Update local version on acknowledgment
    if (data.version > this.localVersion) {
      this.localVersion = data.version
    }
  }

  on<K extends keyof SyncEvents>(event: K, handler: (data: SyncEvents[K]) => void): void {
    this.eventEmitter.on(event, handler)
  }

  off<K extends keyof SyncEvents>(event: K, handler: (data: SyncEvents[K]) => void): void {
    this.eventEmitter.off(event, handler)
  }

  requestFullSync(): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: 'sync_request' }))
    }
  }

  disconnect(): void {
    this.isConnected = false
    this.socket = null
  }
}
