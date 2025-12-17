// F1: Classroom API Client
import apiClient from '@/utils/apiClient'

// Types
export interface SessionSettings {
  allow_recording: boolean
  auto_save_interval: number
  max_participants: number
  board_background: string
}

export interface SessionParticipant {
  user_id: number
  name: string
  avatar: string
  role: 'host' | 'student' | 'viewer' | 'solo'
  status: 'connected' | 'reconnecting' | 'disconnected'
  video_enabled: boolean
  audio_enabled: boolean
  connection_quality: 'excellent' | 'good' | 'fair' | 'poor'
}

export interface ClassroomSession {
  uuid: string
  session_type: 'lesson' | 'solo' | 'group' | 'demo'
  status: 'scheduled' | 'waiting' | 'active' | 'paused' | 'completed' | 'terminated'
  host: { id: number; name: string; avatar: string }
  participants: SessionParticipant[]
  scheduled_start: string
  scheduled_end: string
  actual_start: string | null
  board_version: number
  settings: SessionSettings
}

export interface RoomPermissions {
  can_draw: boolean
  can_erase: boolean
  can_add_layers: boolean
  can_delete_layers: boolean
  can_upload_images: boolean
  can_clear_board: boolean
  can_toggle_video: boolean
  can_terminate: boolean
}

export interface JoinResponse {
  session: ClassroomSession
  participant: SessionParticipant
  token: string
  permissions: RoomPermissions
  board_state: Record<string, unknown>
}

export interface CreateSessionInput {
  session_type: 'lesson' | 'solo' | 'group' | 'demo'
  scheduled_start: string
  scheduled_end: string
  booking_id?: number
  settings?: Partial<SessionSettings>
}

export interface BoardSnapshot {
  id: number
  version: number
  state: Record<string, unknown>
  created_at: string
  created_by: { id: number; name: string }
}

// v0.24.2 Types
export interface JWTResponse {
  token: string
  expires_at: string
  permissions: RoomPermissions
  session: ClassroomSession
}

export interface MediaStateInput {
  video_enabled?: boolean
  audio_enabled?: boolean
  screen_sharing?: boolean
}

export interface SessionEventInput {
  event_type: string
  data?: Record<string, unknown>
}

// v0.24.3 Types
export interface TimelineEventResponse {
  id: number
  event_type: string
  timestamp_ms: number
  user: { id: number; name: string } | null
  data: Record<string, unknown>
}

export interface SnapshotResponse {
  version: number
  snapshot_type: string
  created_at: string
  created_by: { id: number; name: string } | null
  size_bytes: number
  thumbnail_url: string | null
}

export interface AutosaveResponse {
  version?: number
}

export interface ReplayManifestResponse {
  session_id: string
  duration_ms: number
  events: { t: number; type: string; user?: number; data?: Record<string, unknown> }[]
  snapshots: { version: number; t: number }[]
  participants: { id: number; name: string; role: string }[]
}

export interface SessionSummaryResponse {
  session: {
    uuid: string
    started_at: string
    ended_at: string
    duration_ms: number
  }
  stats: {
    total_events: number
    board_events: number
    participant_count: number
    snapshot_count: number
  }
  participants: {
    id: number
    name: string
    role: string
    joined_at: string
    left_at: string | null
    duration_ms: number
  }[]
  snapshots: SnapshotResponse[]
}

// API Client
export const classroomApi = {
  // Session management
  createSession: async (data: CreateSessionInput): Promise<ClassroomSession> => {
    const response = await apiClient.post<ClassroomSession>('/classroom/session/create/', data)
    return response.data
  },

  getSession: async (uuid: string): Promise<ClassroomSession> => {
    const response = await apiClient.get<ClassroomSession>(`/classroom/session/${uuid}/`)
    return response.data
  },

  joinSession: async (uuid: string, accessCode?: string): Promise<JoinResponse> => {
    const response = await apiClient.post<JoinResponse>(`/classroom/session/${uuid}/join/`, {
      access_code: accessCode,
    })
    return response.data
  },

  startSession: async (uuid: string): Promise<ClassroomSession> => {
    const response = await apiClient.post<ClassroomSession>(`/classroom/session/${uuid}/start/`)
    return response.data
  },

  pauseSession: async (uuid: string): Promise<ClassroomSession> => {
    const response = await apiClient.post<ClassroomSession>(`/classroom/session/${uuid}/pause/`)
    return response.data
  },

  resumeSession: async (uuid: string): Promise<ClassroomSession> => {
    const response = await apiClient.post<ClassroomSession>(`/classroom/session/${uuid}/resume/`)
    return response.data
  },

  terminateSession: async (uuid: string, reason?: string): Promise<ClassroomSession> => {
    const response = await apiClient.post<ClassroomSession>(
      `/classroom/session/${uuid}/terminate/`,
      { reason }
    )
    return response.data
  },

  // Board operations
  autosave: async (
    uuid: string,
    boardState: Record<string, unknown>,
    version: number
  ): Promise<AutosaveResponse> => {
    const response = await apiClient.post<AutosaveResponse>(`/classroom/session/${uuid}/autosave/`, {
      board_state: boardState,
      version,
    })
    return response.data
  },

  getHistory: async (uuid: string): Promise<BoardSnapshot[]> => {
    const response = await apiClient.get<BoardSnapshot[]>(`/classroom/history/${uuid}/`)
    return response.data
  },

  restoreSnapshot: async (
    uuid: string,
    version: number
  ): Promise<{ board_state?: Record<string, unknown>; state?: Record<string, unknown>; version?: number }> => {
    const response = await apiClient.post(
      `/classroom/history/${uuid}/restore/${version}/`
    )
    return response.data as { board_state?: Record<string, unknown>; state?: Record<string, unknown>; version?: number }
  },

  exportBoard: async (uuid: string, format: 'json' | 'png' | 'svg'): Promise<Blob> => {
    const response = await apiClient.get<Blob>(`/classroom/history/${uuid}/export/`, {
      params: { format },
      responseType: 'blob',
    })
    return response.data
  },

  // User sessions
  getMySessions: async (params?: { status?: string }): Promise<ClassroomSession[]> => {
    const response = await apiClient.get<ClassroomSession[]>('/classroom/my-sessions/', { params })
    return response.data
  },

  // Participant management
  kickParticipant: async (uuid: string, userId: number): Promise<void> => {
    await apiClient.post(`/classroom/session/${uuid}/kick/`, { user_id: userId })
  },

  updateParticipantRole: async (
    uuid: string,
    userId: number,
    role: SessionParticipant['role']
  ): Promise<void> => {
    await apiClient.post(`/classroom/session/${uuid}/role/`, { user_id: userId, role })
  },

  // v0.24.2 Methods
  getJwt: async (sessionId: string): Promise<JWTResponse> => {
    const response = await apiClient.post<JWTResponse>(`/classroom/session/${sessionId}/jwt/`)
    return response.data
  },

  getPermissions: async (sessionId: string): Promise<RoomPermissions> => {
    const response = await apiClient.get<RoomPermissions>(
      `/classroom/session/${sessionId}/permissions/`
    )
    return response.data
  },

  updateMediaState: async (sessionId: string, state: MediaStateInput): Promise<void> => {
    await apiClient.post(`/classroom/session/${sessionId}/media-state/`, state)
  },

  logEvent: async (sessionId: string, event: SessionEventInput): Promise<void> => {
    await apiClient.post(`/classroom/session/${sessionId}/event/`, event)
  },

  // v0.24.3 Methods - Timeline
  getTimeline: async (
    sessionId: string,
    params?: {
      offset?: number
      limit?: number
      from_ms?: number
      to_ms?: number
      event_types?: string[]
    }
  ): Promise<{
    events: TimelineEventResponse[]
    total: number
    has_more: boolean
  }> => {
    const response = await apiClient.get(`/classroom/session/${sessionId}/timeline/`, {
      params,
    })
    return response.data
  },

  // v0.24.3 Methods - Snapshots
  getSnapshots: async (
    sessionId: string,
    type?: string
  ): Promise<{ snapshots: SnapshotResponse[] }> => {
    const response = await apiClient.get(`/classroom/session/${sessionId}/snapshots/`, {
      params: { type },
    })
    return response.data
  },

  getSnapshot: async (
    sessionId: string,
    version: number
  ): Promise<{ board_state: Record<string, unknown>; version: number }> => {
    const response = await apiClient.get(
      `/classroom/session/${sessionId}/snapshots/${version}/`
    )
    return response.data
  },

  exportSnapshot: async (
    sessionId: string,
    version: number,
    format: 'json' | 'png' | 'svg'
  ): Promise<Blob> => {
    const response = await apiClient.get(
      `/classroom/session/${sessionId}/snapshots/${version}/export/`,
      {
        params: { format },
        responseType: 'blob',
      }
    )
    return response.data
  },

  // v0.24.3 Methods - Replay
  getReplayStream: async (sessionId: string): Promise<ReplayManifestResponse> => {
    const response = await apiClient.get(`/classroom/session/${sessionId}/replay/stream/`)
    return response.data
  },

  getReplayManifest: async (sessionId: string): Promise<ReplayManifestResponse> => {
    const response = await apiClient.get(`/classroom/session/${sessionId}/replay/manifest/`)
    return response.data
  },

  // v0.24.3 Methods - Summary
  getSummary: async (sessionId: string): Promise<SessionSummaryResponse> => {
    const response = await apiClient.get(`/classroom/session/${sessionId}/summary/`)
    return response.data
  },
}
