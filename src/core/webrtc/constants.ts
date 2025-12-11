import type { WebRTCConfig, VideoQuality } from './types'

export const DEFAULT_VIDEO_QUALITY: VideoQuality = '480p'

export const DEFAULT_CONFIG: Required<Pick<WebRTCConfig,
  'heartbeatIntervalMs' | 'statsIntervalMs' | 'defaultQuality'>> = {
  heartbeatIntervalMs: 30000,
  statsIntervalMs: 5000,
  defaultQuality: DEFAULT_VIDEO_QUALITY,
}

export const QUALITY_ORDER: VideoQuality[] = ['240p', '480p', '720p']

export const QUALITY_LABELS: Record<VideoQuality, string> = {
  '240p': 'Low',
  '480p': 'Medium',
  '720p': 'High',
}

export const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
]
