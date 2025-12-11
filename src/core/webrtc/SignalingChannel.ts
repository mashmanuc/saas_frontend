import { DEFAULT_CONFIG } from './constants'

export type SignalingMessageType =
  | 'offer'
  | 'answer'
  | 'ice'
  | 'peer-joined'
  | 'peer-left'
  | 'mute-state'
  | 'quality'
  | 'ping'
  | 'pong'

export interface SignalingMessage<TPayload = unknown> {
  type: SignalingMessageType
  payload?: TPayload
}

export interface SignalingHandlers {
  onOffer: (sdp: RTCSessionDescriptionInit) => void
  onAnswer: (sdp: RTCSessionDescriptionInit) => void
  onIceCandidate: (candidate: RTCIceCandidateInit) => void
  onPeerJoined: (peerId: string) => void
  onPeerLeft: (peerId: string) => void
  onPeerMuted: (type: 'audio' | 'video', muted: boolean) => void
  onError: (error: Error) => void
}

interface SignalingChannelOptions {
  reconnectAttempts?: number
  reconnectDelayMs?: number
  reconnectBackoffMultiplier?: number
  heartbeatIntervalMs?: number
}

export class SignalingChannel {
  private ws: WebSocket | null = null
  private reconnecting = false
  private reconnectAttempt = 0
  private heartbeatTimer: number | null = null
  private queue: SignalingMessage[] = []
  private sessionId: string | null = null

  constructor(
    private url: string,
    private token: string,
    private handlers: SignalingHandlers,
    private options: SignalingChannelOptions = {}
  ) {}

  async connect(sessionId: string): Promise<void> {
    this.sessionId = sessionId
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return
    }

    await new Promise<void>((resolve, reject) => {
      try {
        const wsUrl = `${this.url}?session=${sessionId}&token=${this.token}`
        this.ws = new WebSocket(wsUrl)
        this.ws.onopen = () => {
          this.flushQueue()
          this.startHeartbeat()
          resolve()
        }
        this.ws.onmessage = (event) => this.handleMessage(event)
        this.ws.onerror = () => {
          const error = new Error('Signaling socket error')
          this.handlers.onError(error)
          reject(error)
        }
        this.ws.onclose = () => {
          this.stopHeartbeat()
          this.tryReconnect(sessionId).catch((error) => this.handlers.onError(error))
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  disconnect(): void {
    this.stopHeartbeat()
    this.ws?.close()
    this.ws = null
  }

  send<TPayload = unknown>(message: SignalingMessage<TPayload>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.queue.push(message)
      return
    }
    this.ws.send(JSON.stringify(message))
  }

  sendOffer(sdp: RTCSessionDescriptionInit): void {
    this.send({ type: 'offer', payload: sdp })
  }

  sendAnswer(sdp: RTCSessionDescriptionInit): void {
    this.send({ type: 'answer', payload: sdp })
  }

  sendIceCandidate(candidate: RTCIceCandidate): void {
    this.send({ type: 'ice', payload: candidate.toJSON() })
  }

  sendMuteState(type: 'audio' | 'video', muted: boolean): void {
    this.send({ type: 'mute-state', payload: { type, muted } })
  }

  sendQualityStats(stats: Record<string, unknown>): void {
    this.send({ type: 'quality', payload: stats })
  }

  sendHeartbeat(): void {
    this.send({ type: 'ping' })
  }

  private handleMessage(event: MessageEvent<string>): void {
    try {
      const data = JSON.parse(event.data)
      switch (data.type) {
        case 'offer':
          this.handlers.onOffer(data.payload)
          break
        case 'answer':
          this.handlers.onAnswer(data.payload)
          break
        case 'ice':
          this.handlers.onIceCandidate(data.payload)
          break
        case 'peer-joined':
          this.handlers.onPeerJoined(data.payload?.peerId)
          break
        case 'peer-left':
          this.handlers.onPeerLeft(data.payload?.peerId)
          break
        case 'mute-state':
          this.handlers.onPeerMuted(data.payload?.type, data.payload?.muted)
          break
        case 'pong':
          break
        default:
          break
      }
    } catch (error) {
      this.handlers.onError(error as Error)
    }
  }

  private async tryReconnect(sessionId: string): Promise<void> {
    if (this.reconnecting) return
    const maxAttempts = this.options.reconnectAttempts ?? 5
    if (this.reconnectAttempt >= maxAttempts) {
      throw new Error('Max reconnect attempts reached')
    }
    this.reconnecting = true
    this.reconnectAttempt += 1
    const delay =
      (this.options.reconnectDelayMs ?? 1000) *
      Math.pow(this.options.reconnectBackoffMultiplier ?? 1.5, this.reconnectAttempt - 1)

    await new Promise((resolve) => setTimeout(resolve, delay))
    this.reconnecting = false
    await this.connect(sessionId)
  }

  private flushQueue(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    while (this.queue.length > 0) {
      const message = this.queue.shift()
      if (message) {
        this.send(message)
      }
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat()
    this.heartbeatTimer = window.setInterval(
      () => this.sendHeartbeat(),
      this.options.heartbeatIntervalMs ?? DEFAULT_CONFIG.heartbeatIntervalMs
    )
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }
}

export default SignalingChannel
