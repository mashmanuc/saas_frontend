import { PeerConnection } from './PeerConnection'
import { MediaManager } from './MediaManager'
import { SignalingChannel } from './SignalingChannel'
import { QualityMonitor } from './QualityMonitor'
import { EventEmitter } from './eventEmitter'
import { DEFAULT_CONFIG, DEFAULT_ICE_SERVERS } from './constants'
import type {
  ConnectionState,
  QualityMetrics,
  VideoQuality,
  WebRTCConfig,
  WebRTCError,
  WebRTCEvents,
  WebRTCSession,
} from './types'

/**
 * Main WebRTC client orchestrating media, peer connection and signaling.
 */
export class WebRTCClient {
  private config: WebRTCConfig
  private session: WebRTCSession | null = null
  private peerConnection: PeerConnection | null = null
  private signalingChannel: SignalingChannel | null = null
  private mediaManager: MediaManager
  private qualityMonitor: QualityMonitor | null = null
  private connectionState: ConnectionState = 'idle'
  private localStream: MediaStream | null = null
  private remoteStream: MediaStream | null = null
  private heartbeatTimer: number | null = null
  private reconnectAttempts = 0

  public readonly events = new EventEmitter<WebRTCEvents>()

  constructor(config: WebRTCConfig) {
    this.config = {
      heartbeatIntervalMs: DEFAULT_CONFIG.heartbeatIntervalMs,
      statsIntervalMs: DEFAULT_CONFIG.statsIntervalMs,
      defaultQuality: DEFAULT_CONFIG.defaultQuality,
      iceServers: DEFAULT_ICE_SERVERS,
      ...config,
    }

    this.mediaManager = new MediaManager({
      defaultQuality: this.config.defaultQuality,
    })
  }

  /**
   * Initialize client and connect to signaling server
   */
  async initialize(sessionId: string, token: string): Promise<void> {
    this.setConnectionState('initializing')

    try {
      this.session = { sessionId, token }

      await this.setupSignalingChannel(sessionId, token)
      await this.setupPeerConnection()
      await this.acquireMedia()
      this.startHeartbeat()

      this.setConnectionState('connected')
    } catch (error) {
      this.handleError('INIT_FAILED', 'Failed to initialize WebRTC client', error)
      await this.cleanup()
      throw error
    }
  }

  /**
   * Start call - create offer and send to peer
   */
  async startCall(): Promise<void> {
    if (!this.peerConnection || !this.signalingChannel) {
      throw new Error('Client not initialized')
    }

    this.setConnectionState('connecting')

    try {
      const offer = await this.peerConnection.createOffer()
      this.signalingChannel.sendOffer(offer)
    } catch (error) {
      this.handleError('START_CALL_FAILED', 'Unable to start call', error)
      throw error
    }
  }

  /**
   * Answer incoming call
   */
  async answerCall(offer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection || !this.signalingChannel) {
      throw new Error('Client not initialized')
    }

    this.setConnectionState('connecting')

    try {
      const answer = await this.peerConnection.createAnswer(offer)
      this.signalingChannel.sendAnswer(answer)
      this.setConnectionState('connected')
    } catch (error) {
      this.handleError('ANSWER_CALL_FAILED', 'Unable to answer call', error)
      throw error
    }
  }

  /**
   * End call and cleanup
   */
  async endCall(): Promise<void> {
    this.setConnectionState('ended')
    await this.cleanup()
    this.events.emit('remote-stream', null)
  }

  /**
   * Toggle audio mute
   */
  toggleAudio(): boolean {
    const state = this.mediaManager.toggleAudio()
    this.signalingChannel?.sendMuteState('audio', !state)
    this.events.emit('peer-muted', 'audio', !state)
    return state
  }

  /**
   * Toggle video mute
   */
  toggleVideo(): boolean {
    const state = this.mediaManager.toggleVideo()
    this.signalingChannel?.sendMuteState('video', !state)
    this.events.emit('peer-muted', 'video', !state)
    return state
  }

  /**
   * Set video quality
   */
  async setVideoQuality(quality: VideoQuality): Promise<void> {
    try {
      await this.mediaManager.setVideoQuality(quality)
      this.signalingChannel?.sendQualityStats({
        quality,
        timestamp: Date.now(),
      })
    } catch (error) {
      this.handleError('QUALITY_CHANGE_FAILED', 'Failed to change video quality', error)
      throw error
    }
  }

  /**
   * Get local media stream
   */
  getLocalStream(): MediaStream | null {
    return this.localStream
  }

  /**
   * Get remote media stream
   */
  getRemoteStream(): MediaStream | null {
    return this.remoteStream
  }

  /**
   * Get connection state
   */
  getState(): ConnectionState {
    return this.connectionState
  }

  /**
   * Get quality metrics
   */
  getQualityMetrics(): QualityMetrics | null {
    return this.qualityMonitor?.getCurrentMetrics() ?? null
  }

  /**
   * Destroy client and cleanup all resources
   */
  async destroy(): Promise<void> {
    await this.cleanup()
    this.events.removeAll()
    this.setConnectionState('idle')
  }

  private async setupSignalingChannel(sessionId: string, token: string): Promise<void> {
    this.signalingChannel = new SignalingChannel(this.config.signalingUrl, token, {
      onOffer: (sdp: RTCSessionDescriptionInit) => this.handleIncomingOffer(sdp),
      onAnswer: (sdp: RTCSessionDescriptionInit) => this.handleIncomingAnswer(sdp),
      onIceCandidate: (candidate: RTCIceCandidateInit) => this.peerConnection?.addIceCandidate(candidate),
      onPeerJoined: () => {},
      onPeerLeft: () => this.endCall(),
      onPeerMuted: (type: 'audio' | 'video', muted: boolean) => this.events.emit('peer-muted', type, muted),
      onError: (error: Error) => this.handleError('SIGNALING_ERROR', 'Signaling error', error),
    })

    await this.signalingChannel.connect(sessionId)
  }

  private async setupPeerConnection(): Promise<void> {
    this.peerConnection = new PeerConnection(
      this.config.iceServers ?? DEFAULT_ICE_SERVERS,
      (candidate: RTCIceCandidate) => this.signalingChannel?.sendIceCandidate(candidate),
      (stream: MediaStream) => this.handleRemoteStream(stream),
      (state: RTCPeerConnectionState) => this.handlePeerConnectionState(state)
    )

    await this.peerConnection.create()

    this.qualityMonitor = new QualityMonitor(
      this.peerConnection,
      (metrics: QualityMetrics) => this.handleQualityUpdate(metrics),
      (quality: VideoQuality) => this.setVideoQuality(quality).catch(() => undefined)
    )

    this.qualityMonitor.start(this.config.statsIntervalMs ?? DEFAULT_CONFIG.statsIntervalMs)
  }

  private async acquireMedia(): Promise<void> {
    this.localStream = await this.mediaManager.getUserMedia()
    this.events.emit('remote-stream', this.localStream)

    if (!this.peerConnection || !this.localStream) return

    for (const track of this.localStream.getTracks()) {
      this.peerConnection.addTrack(track, this.localStream)
    }
  }

  private async handleIncomingOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection || !this.signalingChannel) return
    const answer = await this.peerConnection.createAnswer(offer)
    this.signalingChannel.sendAnswer(answer)
    this.setConnectionState('connected')
  }

  private async handleIncomingAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) return
    await this.peerConnection.setRemoteDescription(answer)
    this.setConnectionState('connected')
  }

  private handleRemoteStream(stream: MediaStream): void {
    this.remoteStream = stream
    this.events.emit('remote-stream', stream)
  }

  private handlePeerConnectionState(state: RTCPeerConnectionState): void {
    if (state === 'failed' || state === 'disconnected') {
      this.setConnectionState('reconnecting')
      this.events.emit('reconnecting', ++this.reconnectAttempts)
      this.peerConnection
        ?.reconnect()
        .then((success: boolean) => {
          if (success) {
            this.reconnectAttempts = 0
            this.setConnectionState('connected')
            this.events.emit('reconnected')
          } else {
            this.handleError('RECONNECT_FAILED', 'Failed to reconnect peer connection')
          }
        })
        .catch((error) => this.handleError('RECONNECT_FAILED', 'Failed to reconnect peer connection', error))
    } else if (state === 'connected') {
      this.setConnectionState('connected')
    }
  }

  private handleQualityUpdate(metrics: QualityMetrics): void {
    this.events.emit('quality-change', metrics)
  }

  private setConnectionState(state: ConnectionState): void {
    this.connectionState = state
    this.events.emit('state-change', state)
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
    }
    this.heartbeatTimer = window.setInterval(() => {
      this.signalingChannel?.sendHeartbeat?.()
    }, this.config.heartbeatIntervalMs ?? DEFAULT_CONFIG.heartbeatIntervalMs)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private async cleanup(): Promise<void> {
    this.stopHeartbeat()
    this.qualityMonitor?.stop()
    this.qualityMonitor = null

    this.mediaManager.stopAllTracks()
    this.localStream = null
    this.remoteStream = null

    this.peerConnection?.close()
    this.peerConnection = null

    this.signalingChannel?.disconnect()
    this.signalingChannel = null
  }

  private handleError(code: string, message: string, details?: unknown): void {
    const error: WebRTCError = { code, message, details }
    this.events.emit('error', error)
  }
}

export default WebRTCClient
