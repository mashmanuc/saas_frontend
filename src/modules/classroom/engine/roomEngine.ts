// F2: Room Engine - Main orchestrator
import { SyncEngine } from './syncEngine'
import { StorageEngine } from './storageEngine'
import { PermissionsEngine } from './permissionsEngine'
import { classroomApi, type RoomPermissions, type ClassroomSession } from '../api/classroom'
import mitt, { Emitter } from 'mitt'

const WS_BASE = import.meta.env.VITE_WS_BASE_URL || 'wss://api.example.com/ws'

export interface RoomConfig {
  sessionId: string
  token: string
  permissions: RoomPermissions
  initialBoardState?: Record<string, unknown>
  initialVersion?: number
}

export interface MediaState {
  videoEnabled: boolean
  audioEnabled: boolean
  screenSharing: boolean
}

type RoomEvents = {
  connected: void
  disconnected: void
  reconnecting: void
  board_update: Record<string, unknown>
  participant_joined: { userId: number; name: string }
  participant_left: { userId: number }
  session_updated: ClassroomSession
  error: Error
  media_state_changed: MediaState
}

export class RoomEngine {
  private sessionId: string
  private token: string
  private permissions: RoomPermissions

  private syncEngine: SyncEngine
  private storageEngine: StorageEngine
  private permissionsEngine: PermissionsEngine

  private wsWebRTC: WebSocket | null = null
  private wsBoard: WebSocket | null = null
  private wsSystem: WebSocket | null = null

  private eventEmitter: Emitter<RoomEvents> = mitt<RoomEvents>()
  private isConnected: boolean = false
  private reconnectAttempts: number = 0
  private maxReconnectAttempts: number = 5
  private reconnectDelay: number = 1000
  private reconnectAbort: boolean = false
  private reconnectTimeoutId: number | null = null

  private localStream: MediaStream | null = null
  private mediaState: MediaState = {
    videoEnabled: true,
    audioEnabled: true,
    screenSharing: false,
  }

  constructor(config: RoomConfig) {
    this.sessionId = config.sessionId
    this.token = config.token
    this.permissions = config.permissions

    this.syncEngine = new SyncEngine(config.initialVersion || 0)
    this.storageEngine = new StorageEngine(config.sessionId)
    this.permissionsEngine = new PermissionsEngine(config.permissions)

    // Setup sync engine listeners
    this.syncEngine.on('board_update', (data) => {
      this.eventEmitter.emit('board_update', data.data)
    })
  }

  async connect(): Promise<void> {
    try {
      this.reconnectAbort = false
      await Promise.all([
        this.connectWebRTC(),
        this.connectBoard(),
        this.connectSystem(),
      ])

      this.isConnected = true
      this.reconnectAttempts = 0
      this.eventEmitter.emit('connected')

      // Start autosave
      this.storageEngine.startAutosave(
        () => this.getBoardState(),
        () => this.syncEngine.getVersion()
      )
    } catch (error) {
      console.error('[RoomEngine] Connection failed:', error)
      this.eventEmitter.emit('error', error as Error)
      throw error
    }
  }

  private async connectWebRTC(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `${WS_BASE}/classroom/${this.sessionId}/webrtc/?token=${this.token}`
      this.wsWebRTC = new WebSocket(url)

      this.wsWebRTC.onopen = () => resolve()
      this.wsWebRTC.onerror = (e) => reject(e)
      this.wsWebRTC.onclose = () => this.handleWebSocketClose('webrtc')
      this.wsWebRTC.onmessage = (msg) => this.handleWebRTCMessage(msg)
    })
  }

  private async connectBoard(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `${WS_BASE}/classroom/${this.sessionId}/board/?token=${this.token}`
      this.wsBoard = new WebSocket(url)

      this.wsBoard.onopen = () => {
        this.syncEngine.setSocket(this.wsBoard!)
        resolve()
      }
      this.wsBoard.onerror = (e) => reject(e)
      this.wsBoard.onclose = () => this.handleWebSocketClose('board')
    })
  }

  private async connectSystem(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `${WS_BASE}/classroom/${this.sessionId}/system/?token=${this.token}`
      this.wsSystem = new WebSocket(url)

      this.wsSystem.onopen = () => resolve()
      this.wsSystem.onerror = (e) => reject(e)
      this.wsSystem.onclose = () => this.handleWebSocketClose('system')
      this.wsSystem.onmessage = (msg) => this.handleSystemMessage(msg)
    })
  }

  private handleWebSocketClose(channel: string): void {
    console.warn(`[RoomEngine] WebSocket ${channel} closed`)

    if (this.isConnected) {
      this.isConnected = false
      this.eventEmitter.emit('disconnected')
      this.attemptReconnect()
    }
  }

  private async attemptReconnect(): Promise<void> {
    if (this.reconnectAbort) return
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[RoomEngine] Max reconnect attempts reached')
      return
    }

    this.reconnectAttempts++
    this.eventEmitter.emit('reconnecting')

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId)
      this.reconnectTimeoutId = null
    }

    await new Promise<void>((resolve) => {
      this.reconnectTimeoutId = window.setTimeout(() => {
        this.reconnectTimeoutId = null
        resolve()
      }, delay)
    })

    if (this.reconnectAbort) return

    try {
      await this.connect()
      // Request full sync after reconnect
      this.syncEngine.requestFullSync()
    } catch {
      this.attemptReconnect()
    }
  }

  private handleWebRTCMessage(msg: MessageEvent): void {
    try {
      const data = JSON.parse(msg.data)
      // Handle WebRTC signaling messages
      switch (data.type) {
        case 'offer':
        case 'answer':
        case 'ice_candidate':
          // Forward to WebRTC client
          break
      }
    } catch (error) {
      console.error('[RoomEngine] WebRTC message error:', error)
    }
  }

  private handleSystemMessage(msg: MessageEvent): void {
    try {
      const data = JSON.parse(msg.data)

      switch (data.type) {
        case 'participant_joined':
          this.eventEmitter.emit('participant_joined', data.participant)
          break
        case 'participant_left':
          this.eventEmitter.emit('participant_left', { userId: data.user_id })
          break
        case 'session_updated':
          this.eventEmitter.emit('session_updated', data.session)
          break
        case 'permissions_updated':
          this.permissionsEngine.updatePermissions(data.permissions)
          break
      }
    } catch (error) {
      console.error('[RoomEngine] System message error:', error)
    }
  }

  async disconnect(): Promise<void> {
    this.isConnected = false
    this.reconnectAbort = true

    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId)
      this.reconnectTimeoutId = null
    }

    this.storageEngine.stopAutosave()

    this.wsWebRTC?.close()
    this.wsBoard?.close()
    this.wsSystem?.close()

    this.syncEngine.disconnect()

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop())
      this.localStream = null
    }

    this.eventEmitter.emit('disconnected')
  }

  // Board operations
  sendBoardEvent(eventType: string, data: Record<string, unknown>): boolean {
    if (!this.permissionsEngine.canPerform(eventType)) {
      console.warn('[RoomEngine] Permission denied:', eventType)
      return false
    }

    this.syncEngine.sendEvent(eventType, data)
    return true
  }

  getBoardState(): Record<string, unknown> {
    // This would be populated by the board component
    return {}
  }

  // Media operations
  async startVideo(): Promise<MediaStream> {
    if (!this.permissionsEngine.canToggleVideo()) {
      throw new Error('No permission to toggle video')
    }

    this.localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    })

    this.mediaState.videoEnabled = true
    this.mediaState.audioEnabled = true
    this.eventEmitter.emit('media_state_changed', { ...this.mediaState })

    return this.localStream
  }

  async stopVideo(): Promise<void> {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => track.stop())
      this.mediaState.videoEnabled = false
      this.eventEmitter.emit('media_state_changed', { ...this.mediaState })
    }
  }

  async toggleAudio(enabled: boolean): Promise<void> {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = enabled
      })
      this.mediaState.audioEnabled = enabled
      this.eventEmitter.emit('media_state_changed', { ...this.mediaState })
    }
  }

  async toggleVideo(enabled: boolean): Promise<void> {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = enabled
      })
      this.mediaState.videoEnabled = enabled
      this.eventEmitter.emit('media_state_changed', { ...this.mediaState })
    }
  }

  // Session operations
  async terminate(reason?: string): Promise<void> {
    if (!this.permissionsEngine.canTerminate()) {
      throw new Error('No permission to terminate session')
    }

    await classroomApi.terminateSession(this.sessionId, reason)
    await this.disconnect()
  }

  async autosave(boardState: Record<string, unknown>): Promise<void> {
    const version = this.syncEngine.getVersion()
    this.storageEngine.saveState(boardState, version)

    try {
      await classroomApi.autosave(this.sessionId, boardState, version)
    } catch (error) {
      console.error('[RoomEngine] Server autosave failed:', error)
      // Local save already done, queue for retry
      this.storageEngine.queueOperation({
        type: 'autosave',
        data: { boardState, version },
      })
    }
  }

  // Event handling
  on<K extends keyof RoomEvents>(event: K, handler: (data: RoomEvents[K]) => void): void {
    this.eventEmitter.on(event, handler)
  }

  off<K extends keyof RoomEvents>(event: K, handler: (data: RoomEvents[K]) => void): void {
    this.eventEmitter.off(event, handler)
  }

  // Getters
  getSessionId(): string {
    return this.sessionId
  }

  isSessionConnected(): boolean {
    return this.isConnected
  }

  getPermissions(): RoomPermissions {
    return this.permissionsEngine.getPermissions()
  }

  getMediaState(): MediaState {
    return { ...this.mediaState }
  }

  getLocalStream(): MediaStream | null {
    return this.localStream
  }
}
