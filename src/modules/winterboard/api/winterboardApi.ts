// WB: REST API client for Winterboard backend
// Ref: C1.2 backend views, API_CONTRACTS_LOCK.md
// All endpoints: /api/v1/winterboard/*
//
// Phase 2 (2026-04-27) updates per OPS_SYNC_SSOT §11.1 + INV-20:
//   - lockSession contract change: request {is_locked}, response {is_locked, locked_by_id}
//   - NEW: pageBroadcast(sid, pageIndex) — POST /sessions/{pk}/page/ (broadcast hint, no DB write)
//   - NEW: stateUpdate(sid, payload) — POST /sessions/{pk}/state-update/ (broadcast hint)
//   - INV-20: X-Protocol-Version: v3 header REQUIRED on lock/page/state-update.

import apiClient from '@/utils/apiClient'
import { useAuthStore } from '@/modules/auth/store/authStore'
// SSOT версія протоколу (replay.ts) замість hardcoded 'v3' — майбутній bump = одна правка.
import { PROTOCOL_VERSION } from './replay'
import type {
  WBSession,
  WBExport,
  WBExportV2Response,
  WBWorkspaceState,
} from '../types/winterboard'

// ── Types ──────────────────────────────────────────────────────────────

export interface WBSessionListResponse {
  count: number
  next: string | null
  previous: string | null
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
  has_lesson: boolean
  lesson_info: {
    id: number
    student_name: string | null
    start: string | null
    status: string
  } | null
  folder: number | null
  // INV-KNOW-3 (Knowledge plan 2026-05-02 PR-1): materialized folder path
  // ("Math/Algebra/Lesson 1"). Null for root sessions. Backend SSOT —
  // BoardFolder.full_path stored field, do NOT compute on FE.
  folder_path: string | null
  // Phase 1.6 (Replay Surface):
  has_recording?: boolean
  recording_started_at?: string | null
  recording_stopped_at?: string | null
  recording_duration_seconds?: number | null
  is_replay_frozen?: boolean
  // [Phase C 2026-04-16] replay_visibility / replay_share_token removed —
  // moved to Replay entity. Use replayLifecycleApi (visibility / public_token).
  // INV-PREP-2 (Etap 2): provenance FK to KnowledgeLesson. NULL = scratch board.
  // Read-only — set once on session creation. Serializer: select_related('origin_lesson').
  origin_lesson_id?: string | null
  origin_lesson_title?: string | null
}

export interface ListSessionsQuery {
  category?: 'lesson' | 'standalone'
  search?: string
  sort?: string
  limit?: number
  offset?: number
  folder?: string | number
  // Phase 1.6: фільтр для сторінки «Мої записи»
  has_recording?: boolean
}

// ── Board Folder types (Level 2) ──────────────────────────────────────

export interface BoardFolder {
  id: number
  name: string
  parent: number | null
  sessions_count: number
  created_at: string
}

export interface BoardFolderTree {
  id: number
  name: string
  parent: number | null
  children: BoardFolderTree[]
  sessions_count: number
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
  // PR C.1: lesson lineage (INV-PREP-4 — set once on creation)
  origin_lesson_id: string | null
  origin_lesson_title: string | null
  updated_at: string
  // Recording control fields (present when session has recording)
  recording_started_seq?: number | null
  recording_stopped_seq?: number | null
  recording_started_at?: string | null
  // Phase 2A-1 (Plan v2.1 §4.2): heartbeat timestamp для INV-LIFECYCLE-3 + 2A-5 resume
  recording_last_heartbeat?: string | null
  is_replay_frozen?: boolean
  // Plan v2.3 (2026-05-05): state machine field — server-authoritative.
  // Default 'idle' for sessions without recording. FE syncs this directly.
  recording_state?: 'idle' | 'recording' | 'paused' | 'finalized'
  // INV-LESSON-PLAY: True для сесій з "Провести урок" (loadToSession).
  // WBSoloRoom показує WBRecordingBanner тільки коли true.
  // False = пряма My Boards сесія → запис відключений.
  is_lesson_play?: boolean
  // Live-classroom guard: присутнє лише якщо на сесію вказує IN_PROGRESS Lesson.
  // WBSoloRoom редіректить у classroom-рантайм (інакше teacher edits live session
  // поза classroom-синком → розсинхрон з учнем).
  active_lesson?: { id: string; status: string } | null
}

// Phase 2 (2026-04-27): WBDiffOp / WBDiffSavePayload / WBDiffSaveResponse /
// WBStreamSaveResponse types DELETED — dead types після legacy diff/stream save
// methods removal. Op types now live у `RecordOperationRequest` (replay api).

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
  /**
   * True для local backend (dev): FE має пропустити PUT і залити файл
   * у `confirmUpload` як multipart. False/undefined для S3/R2 — звичайний presigned PUT flow.
   */
  is_local?: boolean
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

/**
 * Phase 1 (2026-04-27) per OPS_SYNC_SSOT §11.1:
 *   Request:  {is_locked: boolean}        (was {locked})
 *   Response: {is_locked, locked_by_id}    (was {locked, locked_by, locked_at})
 *   Header:   X-Protocol-Version: v3 REQUIRED (INV-20)
 */
export interface WBLockResponse {
  is_locked: boolean
  locked_by_id: number | null
}

/** SSOT §11.1 broadcast payloads (received via WS, NOT request bodies). */
export interface WBPageBroadcastPayload {
  type: 'session.page'
  pageIndex: number
  userId: string
  ts: number
}

export interface WBStateUpdateBroadcastPayload {
  type: 'session.state_update'
  rev: number
  pageIndex: number
  action: string
  userId: string
  ts: number
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

// ── Solo → Classroom fork ────────────────────────────────────────────────

export interface StartClassroomResponse {
  lesson_id: string
  classroom_url: string
  wb_session_id: string
}

// ── API Client ─────────────────────────────────────────────────────────

const BASE = '/v1/winterboard'

export const winterboardApi = {
  // ── Sessions CRUD ──────────────────────────────────────────────────

  listSessions(query?: ListSessionsQuery): Promise<WBSessionListResponse> {
    return apiClient.get(`${BASE}/sessions/`, { params: query }).then((r: any) => r.data ?? r)
  },

  getSession(id: string): Promise<WBSessionDetailResponse> {
    return apiClient.get(`${BASE}/sessions/${id}/`).then((r: any) => r.data ?? r)
  },

  /**
   * Asset upload statuses для render cross-reference
   * (ASSET_LIFECYCLE_SSOT INV-ASSET-3). FE резолвить op.src → cdn_url → placeholder.
   */
  getSessionAssets(
    id: string,
  ): Promise<{ assets: Array<{ id: string; status: string; cdn_url: string }> }> {
    return apiClient.get(`${BASE}/sessions/${id}/assets/`).then((r: any) => r.data ?? r)
  },

  /**
   * Create a new WB session.
   *
   * INV-KNOW-1 (Knowledge plan 2026-05-02): `folder` is REQUIRED in the
   * payload type. Pass `null` for root sessions, or a positive folder id.
   * NOT optional — TS will fail compile if a caller forgets the field.
   * This is the single guard against the "folder context loss" regression
   * (PR-2 root cause #1).
   */
  createSession(data: {
    name?: string
    state?: WBWorkspaceState
    page_count?: number
    folder: number | null
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

  // ── Save Endpoints — DELETED Phase 2 (2026-04-27) ──────────────────
  //
  // Per user directive 2026-04-27 (full legacy cleanup):
  //   diffSave    — POST /sessions/{pk}/diff/        — DELETED
  //   streamSave  — POST /sessions/{pk}/save-stream/ — DELETED
  //   beaconSave  — POST /sessions/{pk}/beacon/      — DELETED (fetch keepalive variant)
  //
  // Single write pipeline replaced ALL three:
  //   UI → useReplayRecorder.record() → opsSyncStore.flush() → POST /replay/batch/
  //
  // Crash recovery: useOpsBackup (localStorage backup of opsSyncStore buffers)
  // + opsSyncStore.bootstrap()/.resync() reads /sessions/{pk}/state/ для server seq.
  //
  // Reason: dual-write pipelines (legacy save-stream / diff / beacon paralel
  // з /replay/batch/) caused 409 storms — both paths competed за WBSession row lock
  // на BE-side. Phase 1.0 reconstruction made /replay/batch/ THE single writer
  // через OpsApplyService (LAW §2 INV-7). FE legacy paths были обхідними shortcut
  // що порушував INV-7 contract.

  // ── Assets (Phase 2: C2.1) ─────────────────────────────────────────

  /**
   * Request a presigned upload URL for a new asset.
   * Backend creates a pending WBAsset record and returns upload_url.
   * LAW-18: Asset Pipeline — presigned upload flow.
   */
  presignUpload(
    sessionId: string,
    params: { filename: string; content_type: string; file_size: number },
    signal?: AbortSignal,
  ): Promise<WBPresignResponse> {
    return apiClient
      .post(`${BASE}/sessions/${sessionId}/assets/presign/`, params, { signal })
      .then((r: unknown) => (r as { data: WBPresignResponse }).data ?? r as WBPresignResponse)
  },

  /**
   * Upload file directly to presigned URL (S3 PUT).
   * For local backend: uses confirm endpoint with file body instead.
   * `signal` — переривати реальний XHR при abort (інакше PUT долетить до S3
   * навіть після quota_exceeded в іншому файлі → orphan у storage).
   */
  async uploadToPresigned(
    uploadUrl: string,
    file: File,
    onProgress?: (percent: number) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new DOMException('Aborted', 'AbortError'))
        return
      }
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

      const onAbort = () => {
        xhr.abort()
        reject(new DOMException('Aborted', 'AbortError'))
      }
      signal?.addEventListener('abort', onAbort, { once: true })

      const cleanup = () => signal?.removeEventListener('abort', onAbort)

      xhr.onload = () => {
        cleanup()
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve()
        } else {
          reject(new Error(`[WB:upload] S3 PUT failed: ${xhr.status} ${xhr.statusText}`))
        }
      }
      xhr.onerror = () => { cleanup(); reject(new Error('[WB:upload] Network error during S3 PUT')) }
      xhr.ontimeout = () => { cleanup(); reject(new Error('[WB:upload] S3 PUT timed out')) }
      xhr.onabort = () => { cleanup() /* reject уже викликано в onAbort */ }
      xhr.timeout = 120_000 // 2 min timeout for large files

      xhr.send(file)
    })
  },

  /**
   * Confirm that an asset has been uploaded successfully.
   * For S3: backend verifies file exists via HEAD.
   * For local: pass `file` — буде залито multipart/form-data у тому ж POST,
   * BE збереже у MEDIA_ROOT і одразу позначить asset як confirmed.
   */
  confirmUpload(
    sessionId: string,
    assetId: string,
    file?: File,
    signal?: AbortSignal,
  ): Promise<WBConfirmResponse> {
    const url = `${BASE}/sessions/${sessionId}/assets/${assetId}/confirm/`
    if (file) {
      const form = new FormData()
      form.append('file', file, file.name || 'upload')
      return apiClient
        .post(url, form, { headers: { 'Content-Type': 'multipart/form-data' }, signal })
        .then((r: unknown) => (r as { data: WBConfirmResponse }).data ?? r as WBConfirmResponse)
    }
    return apiClient
      .post(url, undefined, { signal })
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

  exportV2(sessionId: string): Promise<WBExportV2Response> {
    return apiClient
      .post(`${BASE}/sessions/${sessionId}/export-v2/`, {})
      .then((r: any) => r.data ?? r)
  },

  getExport(exportId: string): Promise<WBExport> {
    return apiClient.get(`${BASE}/exports/${exportId}/`).then((r: any) => r.data ?? r)
  },

  listExports(sessionId: string): Promise<WBExportListResponse> {
    return apiClient.get(`${BASE}/sessions/${sessionId}/exports/`).then((r: any) => r.data ?? r)
  },

  // ── Export preparations (Stage 1 PR-1/PR-2 EXPORT_PREPARATION_SSOT) ──
  //
  // Disposable widget preview side-channel. Не торкається ops/WS/seq.
  // Ref: saas_docs/domains/winterboard/export/EXPORT_PREPARATION_SSOT.md
  uploadExportPreview(
    sessionId: string,
    args: {
      assetId: string
      blob: Blob
      width: number
      height: number
      widgetSchemaVersion?: number
    },
    signal?: AbortSignal,
  ): Promise<{ id: string; preview_url: string; expires_at: string; reused: boolean } | null> {
    const form = new FormData()
    form.append('asset_id', args.assetId)
    form.append('file', args.blob, `${args.assetId}.png`)
    form.append('width', String(args.width))
    form.append('height', String(args.height))
    form.append('widget_schema_version', String(args.widgetSchemaVersion ?? 1))
    return apiClient
      .post(`${BASE}/sessions/${sessionId}/export-preparations/`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        signal,
        // 2026-07-27: прев'ю віджета — свідомо НЕкритичний запит (INV-EP-3: збій не
        // блокує export, BE малює placeholder). Без цього прапорця кожен збій показував
        // глобальний тост «Немає з'єднання з сервером» і рахувався у circuit breaker
        // (5 підряд → ВСІ запити застосунку блокуються на 30с). Великий export = десятки
        // таких запитів, тож один поганий момент морозив усю дошку. Про реальні збої
        // юзер дізнається з підсумкового повідомлення в діалозі експорту.
        meta: { nonCriticalRequest: true },
      })
      .then((r: any) => r.data ?? r)
      .catch((err: any) => {
        // INV-EP-3: preview failure NEVER blocks export — silent null.
        // Failure logging is BE responsibility (`logger.warning` per reject
        // branch у WBSessionExportPreparationView); FE just degrades.
        if (signal?.aborted) return null
        return null
      })
  },

  /**
   * 2026-07-15: client-знімок реального вигляду дошки → постійне прев'ю
   * картки (WBSession.thumbnail_url, source='client'). Помилка → silent
   * null: прев'ю — side-effect, ніколи не ламає роботу з дошкою.
   */
  uploadSessionThumbnail(
    sessionId: string,
    args: { blob: Blob },
    signal?: AbortSignal,
  ): Promise<{ thumbnail_url: string; source: string } | null> {
    const form = new FormData()
    form.append('file', args.blob, 'thumb.png')
    return apiClient
      .post(`${BASE}/sessions/${sessionId}/thumbnail/`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        signal,
      })
      .then((r: any) => r.data ?? r)
      .catch(() => null)
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
   *
   * Phase 1 (2026-04-27) breaking change per SSOT §11.1:
   *   - Request body: {is_locked} (was {locked})
   *   - Response: {is_locked, locked_by_id} (was {locked, locked_by, locked_at})
   *   - Header X-Protocol-Version: v3 REQUIRED (INV-20)
   *
   * Broadcast on commit (received via WS): {type: 'session.lock', locked, userId, ts}
   * — legacy field names preserved для FE listener compatibility.
   */
  lockSession(sessionId: string, isLocked: boolean): Promise<WBLockResponse> {
    return apiClient
      .post(
        `${BASE}/sessions/${sessionId}/lock/`,
        { is_locked: isLocked },
        { headers: { 'X-Protocol-Version': PROTOCOL_VERSION } },
      )
      .then((r: unknown) => (r as { data: WBLockResponse }).data ?? r as WBLockResponse)
  },

  /**
   * Phase 1 NEW (SSOT §11.1): teacher follow-mode hint — broadcast page change.
   *
   * NO DB write — pure broadcast (`session.page` event у WS room).
   * Permission: IsTeacherOrOwner (owner OR teacher).
   * Throttle: 60/min per user (WBSessionMetaThrottle).
   * Header X-Protocol-Version: v3 REQUIRED.
   */
  pageBroadcast(sessionId: string, pageIndex: number): Promise<{ pageIndex: number }> {
    return apiClient
      .post<{ pageIndex: number }>(
        `${BASE}/sessions/${sessionId}/page/`,
        { pageIndex },
        { headers: { 'X-Protocol-Version': PROTOCOL_VERSION } },
      )
  },

  /**
   * Phase 1 NEW (SSOT §11.1): lightweight state change notification.
   *
   * NO DB write — pure broadcast (`session.state_update` event у WS room).
   * Permission: IsTeacherOrOwner.
   * Throttle: 60/min per user (WBSessionMetaThrottle).
   * Header X-Protocol-Version: v3 REQUIRED.
   *
   * @param payload — {rev, pageIndex, action} per SSOT §11.1
   */
  stateUpdate(
    sessionId: string,
    payload: { rev: number; pageIndex: number; action: string },
  ): Promise<{ ok: true }> {
    return apiClient
      .post<{ ok: true }>(
        `${BASE}/sessions/${sessionId}/state-update/`,
        payload,
        { headers: { 'X-Protocol-Version': PROTOCOL_VERSION } },
      )
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

  // ── Solo → Classroom fork (Solo-to-Classroom Plan 2026-05-20) ────────

  /**
   * Fork a solo WBSession into a new classroom WBSession + Lesson.
   * BE: POST /winterboard/sessions/{pk}/start-classroom/
   * Caller MUST flushAll() before this call (flush barrier).
   */
  startClassroom(
    sessionId: string,
    data: { student_id: number; lesson_name?: string },
  ): Promise<StartClassroomResponse> {
    return apiClient
      .post(`${BASE}/sessions/${sessionId}/start-classroom/`, data)
      .then((r: any) => r.data ?? r)
  },

  // ── Board Folders (Level 2) ──────────────────────────────────────────

  listBoardFolders(): Promise<BoardFolderTree[]> {
    return apiClient.get(`${BASE}/board-folders/`, { params: { tree: 'true' } }).then((r: any) => r.data ?? r)
  },

  createBoardFolder(data: { name: string; parent?: number | null }): Promise<BoardFolder> {
    return apiClient.post(`${BASE}/board-folders/`, data).then((r: any) => r.data ?? r)
  },

  updateBoardFolder(id: number, data: { name?: string; parent?: number | null }): Promise<BoardFolder> {
    return apiClient.patch(`${BASE}/board-folders/${id}/`, data).then((r: any) => r.data ?? r)
  },

  deleteBoardFolder(id: number): Promise<void> {
    return apiClient.delete(`${BASE}/board-folders/${id}/`)
  },

  moveSessionToFolder(sessionId: string, folderId: number | null): Promise<any> {
    return apiClient.patch(`${BASE}/sessions/${sessionId}/`, { folder: folderId }).then((r: any) => r.data ?? r)
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
