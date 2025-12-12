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
  ): Promise<void> => {
    await apiClient.post(`/classroom/session/${uuid}/autosave/`, {
      board_state: boardState,
      version,
    })
  },

  getHistory: async (uuid: string): Promise<BoardSnapshot[]> => {
    const response = await apiClient.get<BoardSnapshot[]>(`/classroom/history/${uuid}/`)
    return response.data
  },

  restoreSnapshot: async (uuid: string, version: number): Promise<Record<string, unknown>> => {
    const response = await apiClient.post<Record<string, unknown>>(
      `/classroom/history/${uuid}/restore/${version}/`
    )
    return response.data
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
}
