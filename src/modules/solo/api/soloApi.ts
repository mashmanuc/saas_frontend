import apiClient from '@/utils/apiClient'
import type { SoloSession, ShareToken, ExportRequest } from '../types/solo'

export type PresignReq = {
  session_id: string
  content_type: 'image/png' | 'image/jpeg' | 'image/webp'
  size_bytes: number
  ext?: 'png' | 'jpg' | 'jpeg' | 'webp'
  sha256?: string
}

export type PresignResp = {
  upload_url: string
  cdn_url: string
  method: 'PUT'
  headers: Record<string, string>
  max_bytes: number
  expires_at: string
}

// Note: apiClient interceptor returns res.data directly, not AxiosResponse
// So all methods return Promise<T> where T is the response data type

export const soloApi = {
  // Sessions
  getSessions: (): Promise<{ count: number; results: SoloSession[] }> =>
    apiClient.get('/v1/solo/sessions/'),

  getSession: (id: string): Promise<SoloSession> =>
    apiClient.get(`/v1/solo/sessions/${id}/`),

  createSession: (data: Partial<SoloSession>): Promise<SoloSession> =>
    apiClient.post('/v1/solo/sessions/', data),

  updateSession: (id: string, data: Partial<SoloSession>): Promise<SoloSession> =>
    apiClient.patch(`/v1/solo/sessions/${id}/`, data),

  deleteSession: (id: string): Promise<void> =>
    apiClient.delete(`/v1/solo/sessions/${id}/`),

  duplicateSession: (id: string): Promise<SoloSession> =>
    apiClient.post(`/v1/solo/sessions/${id}/duplicate/`),

  // Sharing
  createShare: (id: string, options: {
    expires_in_days?: number
    max_views?: number
    allow_download?: boolean
  }): Promise<ShareToken> =>
    apiClient.post(`/v1/solo/sessions/${id}/share/`, options),

  getShare: (id: string): Promise<ShareToken> =>
    apiClient.get(`/v1/solo/sessions/${id}/share/`),

  revokeShare: (id: string): Promise<void> =>
    apiClient.delete(`/v1/solo/sessions/${id}/share/`),

  getPublicSession: (token: string): Promise<SoloSession> =>
    apiClient.get(`/v1/solo/public/${token}/`),

  // Export
  requestExport: (id: string, format: 'png' | 'pdf' | 'json'): Promise<ExportRequest> =>
    apiClient.post(`/v1/solo/sessions/${id}/export/`, { format }),

  getExportStatus: (exportId: string): Promise<ExportRequest> =>
    apiClient.get(`/v1/exports/${exportId}/`),

  // Thumbnail
  regenerateThumbnail: (id: string): Promise<{ thumbnail_url: string; status: string }> =>
    apiClient.post(`/v1/solo/sessions/${id}/thumbnail/`),

  // Uploads (v0.30)
  presignUpload: (payload: PresignReq): Promise<PresignResp> =>
    apiClient.post('/v1/solo/uploads/presign/', payload),
}
