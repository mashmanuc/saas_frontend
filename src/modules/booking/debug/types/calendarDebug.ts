/**
 * Calendar Debug Module Types
 * FE-55.DEBUG - Діагностичний модуль календаря v0.55
 */

export interface ApiLogEntry {
  id: string
  at: string // ISO timestamp
  method: string
  url: string
  params?: Record<string, any>
  status: number
  durationMs: number
  payloadSize: number
  responsePreview?: any // обмежено до 50-100KB
  error?: string
}

export interface WebSocketLogEntry {
  id: string
  at: string
  type: 'message' | 'error' | 'open' | 'close'
  payload?: any
  error?: string
}

export interface RawSnapshotPayload {
  type: 'v055'
  at: string
  tutorId?: number
  weekStart?: string
  payload: any
  size: number
}

export interface DebugState {
  apiLogs: ApiLogEntry[]
  wsLogs: WebSocketLogEntry[]
  rawSnapshots: RawSnapshotPayload[]
  isRecording: boolean
  maxLogs: number
  maxSnapshotSize: number
}

export interface DebugExportBundle {
  version: string
  exportedAt: string
  userContext: {
    role: string
    masked: boolean
  }
  flags: {
    calendarDebug: boolean
  }
  apiLogs: ApiLogEntry[]
  wsLogs: WebSocketLogEntry[]
  storeSnapshot: {
    v055: any
  }
  metadata: {
    totalSize: number
    logsCount: number
    snapshotsCount: number
  }
}

export interface DebugPanelTab {
  id: 'snapshot' | 'metadata' | 'logs'
  label: string
  icon?: string
}

export interface MaskedData {
  email?: string
  phone?: string
  userId?: number
  [key: string]: any
}
