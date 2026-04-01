// WB: REST API client for Winterboard backend
// Ref: C1.2 backend views, API_CONTRACTS_LOCK.md
// All endpoints: /api/v1/winterboard/*

import apiClient from '@/utils/apiClient'
import { useAuthStore } from '@/modules/auth/store/authStore'
import type {
  WBSession,
  WBExport,
  WBWorkspaceState,
} from '../types/winterboard'

// ── Types ──────────────────────────────────────────────────────────────

export interface WBSessionListResponse {
  count: number
  results: WBSessionListItem[]
}

export interface WBSessionListItem {
  id: string
  name: string
  page_count: number
  thumbnail_url: string | null
  rev: number
  updated_at: string
  created_at: string
}

export interface WBSessionDetailResponse {
  id: string
  name: string
  owner_id: string
  state: WBWorkspaceState | null
  page_count: number
  thumbnail_url: string | null
  rev: number
  state_digest: string
  last_write_at: string | null
  created_at: string
  updated_at: string
}

export interface WBDiffOp {
  op: 'add' | 'update' | 'remove'
  kind: 'stroke' | 'shape' | 'text' | 'asset' | 'meta'
  id?: string
  page_id?: string
  value?: Record<string, unknown>
  patch?: Record<string, unknown>
}

export interface WBDiffSavePayload {
  rev: number
  ops: WBDiffOp[]
  client_ts?: string
}

export interface WBDiffSaveResponse {
  server_ts: string
  next_rev: number
  digest: string
  /** Phase 3: canonical rev (same as next_rev, preferred) */
  rev?: number
  /** Phase 3: last assigned seq number */
  ack?: number
  /** Phase 3: mapping of op_id → assigned seq */
  assigned?: Array<{ op_id: string; seq: number }>
}

export interface WBStreamSaveResponse {
  detail: string
  rev: number
  digest: string
}

export interface WBShareStatus {
  is_shared: boolean
  token?: string
  url?: string
  expires_at?: string | null
  max_views?: number | null
  view_count?: number
  allow_download?: boolean
  is_valid?: boolean
}

export interface WBExportListResponse {
  count: number
  results: WBExport[]
}

export interface WBPresignResponse {
  asset_id: string
  upload_url: string
  asset_url: string
  storage_key: string
}

export interface WBConfirmResponse {
  confirmed: boolean
  asset_url: string
}

// ── Classroom (Phase 3: A3.1) ─────────────────────────────────────────

export type WBClassroomRole = 'owner' | 'host' | 'student' | 'viewer'

export interface WBClassroomPermissions {
  can_draw: boolean
  can_erase: boolean
  can_add_page: boolean
  can_delete_page: boolean
  can_clear: boolean
  can_export: boolean
  can_share: boolean
  can_lock: boolean
  can_kick: boolean
  can_end: boolean
  can_upload: boolean
  can_manage: boolean
}

export interface WBClassroomSessionResponse {
  session_id: string
  role: WBClassroomRole
  permissions: WBClassroomPermissions
  is_locked: boolean
  locked_by: string | null
  /** group_id з lesson — для sidebar матеріалів (GroupContentSidebar) */
  group_id?: string | null
}

export interface WBConnectedUser {
  user_id: string
  display_name: string
  role: WBClassroomRole
  cursor_color: string
  is_online: boolean
}

export interface WBLockResponse {
  locked: boolean
  locked_by: string | null
  locked_at: string | null
}

// ── PDF Import (Phase 5: A5.1) ────────────────────────────────────────

export interface PdfPageResult {
  page_index: number
  asset_id: string
  url: string
  width: number
  height: number
}

export interface ImportPdfResponse {
  task_id: string
  asset_id: string
  status: string
}

export interface ImportStatusResponse {
  status: 'processing' | 'done' | 'failed'
  pages?: PdfPageResult[]
  error?: string
}

// ── Object Audio (OBJECT_AUDIO_PLAN.md §9) ────────────────────────────

export interface WBObjectAudioUploadResponse {
  audio_url: string
  duration: number | null
  content_type: string
  file_size: number
  storage_key: string
}

export interface WBObjectAudioUploadOptions {
  onUploadProgress?: (event: { loaded: number; total: number; percent: number }) => void
}

// ── API Client ─────────────────────────────────────────────────────────

const BASE = '/v1/winterboard'

export const winterboardApi = {
  // ── Sessions CRUD ──────────────────────────────────────────────────

  listSessions(): Promise<WBSessionListResponse> {
    return apiClient.get(`${BASE}/sessions/`).then((r: any) => r.data ?? r)
  },

  getSession(id: string): Promise<WBSessionDetailResponse> {
    return apiClient.get(`${BASE}/sessions/${id}/`).then((r: any) => r.data ?? r)
  },

  createSession(data: {
    name?: string
    state?: WBWorkspaceState
    page_count?: number
  }): Promise<WBSessionDetailResponse> {
    return apiClient.post(`${BASE}/sessions/`, data).then((r: any) => r.data ?? r)
  },

  updateSession(
    id: string,
    data: Partial<{ name: string; state: WBWorkspaceState; page_count: number; thumbnail_url: string }>,
  ): Promise<WBSessionDetailResponse> {
    return apiClient.patch(`${BASE}/sessions/${id}/`, data).then((r: any) => r.data ?? r)
  },

  deleteSession(id: string): Promise<void> {
    return apiClient.delete(`${BASE}/sessions/${id}/`)
  },

  duplicateSession(id: string): Promise<WBSessionDetailResponse> {
    return apiClient.post(`${BASE}/sessions/${id}/duplicate/`).then((r: any) => r.data ?? r)
  },

  // ── Save Endpoints ─────────────────────────────────────────────────

  /**
   * Diff save — incremental operations with optimistic locking.
   * Requires X-Rev header matching server rev.
   */
  diffSave(
    sessionId: string,
    payload: WBDiffSavePayload,
    rev: number,
  ): Promise<WBDiffSaveResponse> {
    return apiClient
      .patch(`${BASE}/sessions/${sessionId}/diff/`, payload, {
        headers: { 'X-Rev': String(rev) },
      })
      .then((r: any) => r.data ?? r)
  },

  /**
   * Stream save — full state upload (legacy fallback).
   * Used when board mutations set isDirty but don't generate ops yet.
   * TODO: Remove when all mutations use queueDiffOp.
   */
  async streamSave(
    sessionId: string,
    state: WBWorkspaceState,
    rev: number,
  ): Promise<WBStreamSaveResponse> {
    const payload = { state }
    const json = JSON.stringify(payload)

    // Compress large payloads with gzip (CompressionStream API)
    if (json.length > 100_000 && typeof CompressionStream !== 'undefined') {
      try {
        const encoder = new TextEncoder()
        const readable = new Blob([encoder.encode(json)]).stream()
        const compressed = readable.pipeThrough(new CompressionStream('gzip'))
        const compressedBlob = await new Response(compressed).blob()

        return apiClient
          .post(
            `${BASE}/sessions/${sessionId}/save-stream/`,
            compressedBlob,
            {
              headers: {
                'X-Rev': String(rev),
                'Content-Encoding': 'gzip',
                'Content-Type': 'application/json',
              },
            },
          )
          .then((r: any) => r.data ?? r)
      } catch {
        // Compression failed — fallback to uncompressed
      }
    }

    return apiClient
      .post(
        `${BASE}/sessions/${sessionId}/save-stream/`,
        payload,
        { headers: { 'X-Rev': String(rev) } },
      )
      .then((r: any) => r.data ?? r)
  },

  /**
   * Beacon save — fire-and-forget for beforeunload.
   * Uses fetch with keepalive + Authorization header.
   * navigator.sendBeacon cannot send custom headers, so we use fetch instead.
   */
  beaconSave(sessionId: string, data: Record<string, unknown>): boolean {
    const url = `${resolveBeaconUrl()}${BASE}/sessions/${sessionId}/beacon/`
    const body = JSON.stringify(data)
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }

    try {
      const authStore = useAuthStore()
      if (authStore.access) {
        headers['Authorization'] = `Bearer ${authStore.access}`
      }
    } catch {
      // Auth store unavailable — send without token (best-effort)
    }

    try {
      fetch(url, {
        method: 'POST',
        body,
        headers,
        keepalive: true,
        credentials: 'include',
      })
      return true
    } catch {
      return false
    }
  },

  // ── Assets (Phase 2: C2.1) ─────────────────────────────────────────

  /**
   * Request a presigned upload URL for a new asset.
   * Backend creates a pending WBAsset record and returns upload_url.
   * LAW-18: Asset Pipeline — presigned upload flow.
   */
  presignUpload(
    sessionId: string,
    params: { filename: string; content_type: string; file_size: number },
  ): Promise<WBPresignResponse> {
    return apiClient
      .post(`${BASE}/sessions/${sessionId}/assets/presign/`, params)
      .then((r: unknown) => (r as { data: WBPresignResponse }).data ?? r as WBPresignResponse)
  },

  /**
   * Upload file directly to presigned URL (S3 PUT).
   * For local backend: uses confirm endpoint with file body instead.
   */
  async uploadToPresigned(
    uploadUrl: string,
    file: File,
    onProgress?: (percent: number) => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('PUT', uploadUrl, true)
      xhr.setRequestHeader('Content-Type', file.type)

      if (onProgress) {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            onProgress(Math.round((e.loaded / e.total) * 100))
          }
        })
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve()
        } else {
          reject(new Error(`[WB:upload] S3 PUT failed: ${xhr.status} ${xhr.statusText}`))
        }
      }
      xhr.onerror = () => reject(new Error('[WB:upload] Network error during S3 PUT'))
      xhr.ontimeout = () => reject(new Error('[WB:upload] S3 PUT timed out'))
      xhr.timeout = 120_000 // 2 min timeout for large files

      xhr.send(file)
    })
  },

  /**
   * Confirm that an asset has been uploaded successfully.
   * For S3: backend verifies file exists via HEAD.
   * For local: optionally accepts file in request body.
   */
  confirmUpload(
    sessionId: string,
    assetId: string,
  ): Promise<WBConfirmResponse> {
    return apiClient
      .post(`${BASE}/sessions/${sessionId}/assets/${assetId}/confirm/`)
      .then((r: unknown) => (r as { data: WBConfirmResponse }).data ?? r as WBConfirmResponse)
  },

  /**
   * Delete an asset from storage.
   */
  deleteAsset(sessionId: string, assetId: string): Promise<void> {
    return apiClient.delete(`${BASE}/sessions/${sessionId}/assets/${assetId}/`)
  },

  // ── Export ──────────────────────────────────────────────────────────

  createExport(
    sessionId: string,
    format: 'png' | 'pdf' | 'annotated_pdf',
    idempotencyKey?: string,
  ): Promise<WBExport> {
    const headers: Record<string, string> = {}
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey
    return apiClient
      .post(`${BASE}/sessions/${sessionId}/export/`, { format }, { headers })
      .then((r: any) => r.data ?? r)
  },

  getExport(exportId: string): Promise<WBExport> {
    return apiClient.get(`${BASE}/exports/${exportId}/`).then((r: any) => r.data ?? r)
  },

  listExports(sessionId: string): Promise<WBExportListResponse> {
    return apiClient.get(`${BASE}/sessions/${sessionId}/exports/`).then((r: any) => r.data ?? r)
  },

  // ── Sharing ────────────────────────────────────────────────────────

  getShareStatus(sessionId: string): Promise<WBShareStatus> {
    return apiClient.get(`${BASE}/sessions/${sessionId}/share/`).then((r: any) => r.data ?? r)
  },

  createShare(
    sessionId: string,
    opts?: { expires_in_days?: number; max_views?: number; allow_download?: boolean },
  ): Promise<WBShareStatus> {
    return apiClient.post(`${BASE}/sessions/${sessionId}/share/`, opts ?? {}).then((r: any) => r.data ?? r)
  },

  revokeShare(sessionId: string): Promise<void> {
    return apiClient.delete(`${BASE}/sessions/${sessionId}/share/`)
  },

  // ── Object Audio ────────────────────────────────────────────────────

  /**
   * Upload audio annotation for a board object (stroke or asset).
   * POST /sessions/{id}/objects/{object_id}/audio/
   * Accepts multipart/form-data with 'file' field.
   * Ref: OBJECT_AUDIO_PLAN.md §9
   */
  uploadObjectAudio(
    sessionId: string,
    objectId: string,
    file: Blob,
    options?: WBObjectAudioUploadOptions,
  ): Promise<WBObjectAudioUploadResponse> {
    const formData = new FormData()
    formData.append('file', file, 'recording.webm')

    return apiClient
      .post(
        `${BASE}/sessions/${sessionId}/objects/${objectId}/audio/`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: options?.onUploadProgress
            ? (e: any) => {
                const loaded = e.loaded ?? 0
                const total = e.total ?? 1
                options.onUploadProgress!({
                  loaded,
                  total,
                  percent: Math.round((loaded / total) * 100),
                })
              }
            : undefined,
        },
      )
      .then((r: any) => r.data ?? r)
  },

  /**
   * Delete audio annotation from a board object.
   * DELETE /sessions/{id}/objects/{object_id}/audio/
   */
  deleteObjectAudio(sessionId: string, objectId: string): Promise<void> {
    return apiClient.delete(
      `${BASE}/sessions/${sessionId}/objects/${objectId}/audio/`,
    )
  },

  getPublicSession(token: string): Promise<Record<string, unknown>> {
    return apiClient.get(`${BASE}/public/${token}/`).then((r: any) => r.data ?? r)
  },

  // ── Telemetry ──────────────────────────────────────────────────────

  /**
   * Batch ingest telemetry events.
   * Graceful: returns false on failure, never throws.
   */
  async ingestTelemetry(
    events: Array<{ event_type: string; timestamp: string; session_id?: string | null; payload?: Record<string, unknown> }>,
  ): Promise<boolean> {
    try {
      await apiClient.post(`${BASE}/telemetry/ingest/`, { events })
      return true
    } catch {
      return false
    }
  },

  /**
   * Beacon telemetry — fire-and-forget for beforeunload.
   */
  // ── Classroom (Phase 3: A3.1) ────────────────────────────────────────

  /**
   * Get or resolve classroom session for a lesson.
   * Returns session info + user role + permissions.
   */
  getClassroomSession(lessonId: string): Promise<WBClassroomSessionResponse> {
    return apiClient
      .get(`${BASE}/classroom/${lessonId}/session/`)
      .then((r: unknown) => (r as { data: WBClassroomSessionResponse }).data ?? r as WBClassroomSessionResponse)
  },

  /**
   * Create a new WB session linked to a classroom lesson.
   * Teacher-only.
   */
  createClassroomSession(lessonId: string): Promise<WBClassroomSessionResponse> {
    return apiClient
      .post(`${BASE}/classroom/${lessonId}/session/`)
      .then((r: unknown) => (r as { data: WBClassroomSessionResponse }).data ?? r as WBClassroomSessionResponse)
  },

  /**
   * Lock/unlock student drawing on a session.
   * Teacher/host only.
   */
  lockSession(sessionId: string, locked: boolean): Promise<WBLockResponse> {
    return apiClient
      .post(`${BASE}/sessions/${sessionId}/lock/`, { locked })
      .then((r: unknown) => (r as { data: WBLockResponse }).data ?? r as WBLockResponse)
  },

  /**
   * Get list of connected users for a session.
   */
  getConnectedUsers(sessionId: string): Promise<WBConnectedUser[]> {
    return apiClient
      .get(`${BASE}/sessions/${sessionId}/participants/`, {
        meta: { skipLoader: true },
      })
      .then((r: unknown) => {
        const data = (r as { data: WBConnectedUser[] | { results: WBConnectedUser[] } }).data ?? r
        return Array.isArray(data) ? data : (data as { results: WBConnectedUser[] }).results ?? []
      })
  },

  /**
   * Get user's role and permissions for a specific session.
   */
  getSessionRole(sessionId: string): Promise<{ role: WBClassroomRole; permissions: WBClassroomPermissions }> {
    return apiClient
      .get(`${BASE}/sessions/${sessionId}/role/`)
      .then((r: unknown) => (r as { data: { role: WBClassroomRole; permissions: WBClassroomPermissions } }).data ?? r as { role: WBClassroomRole; permissions: WBClassroomPermissions })
  },

  /**
   * Kick a student from the session.
   * Teacher/host only.
   */
  kickStudent(sessionId: string, userId: string): Promise<void> {
    return apiClient.post(`${BASE}/sessions/${sessionId}/kick/${userId}/`)
  },

  /**
   * End a classroom session.
   * Teacher/host only.
   */
  endSession(sessionId: string): Promise<{ ended: boolean; export_id?: string; lesson_completed?: boolean; lesson_id?: number }> {
    return apiClient
      .post(`${BASE}/sessions/${sessionId}/end/`)
      .then((r: any) => r?.data ?? r)
  },

  // ── PDF Import (Phase 5: A5.1) ──────────────────────────────────────

  /**
   * Upload a PDF file for conversion to page images.
   * Backend creates a Celery task and returns task_id for polling.
   * LAW-18: Asset Pipeline — multipart upload.
   */
  importPdf(
    sessionId: string,
    file: File,
  ): Promise<ImportPdfResponse> {
    const formData = new FormData()
    formData.append('file', file)
    return apiClient
      .post(`${BASE}/sessions/${sessionId}/import-pdf/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120_000, // 2 min for large PDFs
      })
      .then((r: unknown) => (r as { data: ImportPdfResponse }).data ?? r as ImportPdfResponse)
  },

  /**
   * Poll PDF import task status.
   * Returns pages array when status === 'done'.
   */
  getImportStatus(
    sessionId: string,
    taskId: string,
  ): Promise<ImportStatusResponse> {
    return apiClient
      .get(`${BASE}/sessions/${sessionId}/import-pdf/${taskId}/`)
      .then((r: unknown) => (r as { data: ImportStatusResponse }).data ?? r as ImportStatusResponse)
  },

  beaconTelemetry(
    events: Array<{ event_type: string; timestamp: string; session_id?: string | null; payload?: Record<string, unknown> }>,
  ): boolean {
    const url = `${resolveBeaconUrl()}${BASE}/telemetry/ingest/`
    const body = JSON.stringify({ events })
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }

    try {
      const authStore = useAuthStore()
      if (authStore.access) {
        headers['Authorization'] = `Bearer ${authStore.access}`
      }
    } catch {
      // Auth store unavailable
    }

    try {
      fetch(url, {
        method: 'POST',
        body,
        headers,
        keepalive: true,
        credentials: 'include',
      })
      return true
    } catch {
      return false
    }
  },
}

// ── Helpers ────────────────────────────────────────────────────────────

function resolveBeaconUrl(): string {
  if (import.meta.env.DEV) {
    return window.location.origin + '/api'
  }
  return import.meta.env.VITE_API_BASE_URL || 'https://api.m4sh.org/api'
}

export default winterboardApi
