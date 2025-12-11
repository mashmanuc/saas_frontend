export type VideoQuality = '240p' | '480p' | '720p'

export type ConnectionState =
  | 'idle'
  | 'initializing'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'failed'
  | 'ended'

export interface MediaConstraints {
  audio?: MediaTrackConstraints | boolean
  video?: MediaTrackConstraints | boolean
}

export interface WebRTCConfig {
  signalingUrl: string
  tokenProvider?: () => Promise<string>
  reconnect?: {
    maxAttempts?: number
    baseDelayMs?: number
  }
  heartbeatIntervalMs?: number
  statsIntervalMs?: number
  defaultQuality?: VideoQuality
  iceServers?: RTCIceServer[]
}

export interface WebRTCError {
  code: string
  message: string
  details?: unknown
}

export interface QualityMetrics {
  timestamp: number
  rtt: number
  packetLoss: number
  jitter: number
  audioBitrate: number
  videoBitrate: number
  videoResolution: string
  quality: 'excellent' | 'good' | 'fair' | 'poor'
}

export interface WebRTCEvents extends Record<string, (...args: any[]) => void> {
  'state-change': (state: ConnectionState) => void
  'remote-stream': (stream: MediaStream | null) => void
  'quality-change': (metrics: QualityMetrics) => void
  error: (error: WebRTCError) => void
  'peer-muted': (type: 'audio' | 'video', muted: boolean) => void
  reconnecting: (attempt: number) => void
  reconnected: () => void
}

export type EventHandler<T> = T[keyof T]

export type TypedEventEmitter<TEvents extends Record<string, (...args: any[]) => void>> = {
  on<T extends keyof TEvents>(event: T, handler: TEvents[T]): () => void
  off<T extends keyof TEvents>(event: T, handler: TEvents[T]): void
  emit<T extends keyof TEvents>(event: T, ...args: Parameters<TEvents[T]>): void
}

export interface WebRTCSession {
  sessionId: string
  token: string
}
