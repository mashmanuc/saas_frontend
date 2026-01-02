/**
 * Calendar Availability API v0.55.7
 * Draft management, conflict checking, workload targets
 * 
 * Reference: backend/docs/plan/v0.55.7/API_CONTRACT_V0557.md
 */

import api from '@/utils/apiClient'

export interface DraftSlot {
  slotId?: number | null
  tempId?: string
  start: string
  end: string
  status?: 'available' | 'blocked'
  action?: 'remove'
}

export interface CreateDraftRequest {
  weekStart: string
  slots: DraftSlot[]
}

export interface CreateDraftResponse {
  token: string
  expiresAt: string
  conflicts: ConflictEntry[]
  summary: {
    addedSlots: number
    removedSlots: number
    hoursDelta: number
  }
}

export interface ApplyDraftRequest {
  force?: boolean
}

export interface ApplyDraftResponse {
  status: 'applied' | 'conflicts'
  appliedAt?: string
  workloadProgress?: WorkloadProgress
  conflicts?: ConflictEntry[]
  appliedSlots?: {
    added: number[]
    removed: number[]
  }
}

export interface ConflictEntry {
  type: 'event_overlap' | 'blocked_overlap' | 'slot_overlap'
  slot: {
    start: string
    end: string
    tempId?: string
  }
  event?: {
    id: number
    studentName: string
    start: string
    end: string
  }
  blockedRange?: {
    id: number
    reason: string
    start: string
    end: string
  }
  slot1?: {
    start: string
    end: string
  }
  slot2?: {
    start: string
    end: string
  }
}

export interface CheckConflictsRequest {
  weekStart?: string
  slots: Array<{
    start: string
    end: string
    slotId?: number | null
  }>
}

export interface CheckConflictsResponse {
  conflicts: ConflictEntry[]
}

export interface WorkloadProgress {
  currentHours: number
  targetHours: number
  minHours: number
  status: 'needs_more' | 'ok' | 'exceeded'
}

export interface WorkloadTargetResponse {
  targetHours: number
  minHours: number
}

export interface UpdateWorkloadTargetRequest {
  targetHours?: number
  minHours?: number
}

function unwrapPayload<T>(payload: unknown): T {
  if (
    payload &&
    typeof payload === 'object' &&
    'status' in payload &&
    'data' in payload &&
    typeof (payload as any).data === 'object'
  ) {
    return (payload as { data: T }).data
  }
  return payload as T
}

export const calendarAvailabilityApi = {
  /**
   * Create new availability draft
   * POST /api/v1/calendar/availability/draft/
   */
  async createDraft(request: CreateDraftRequest): Promise<CreateDraftResponse> {
    const response = await api.post('/v1/calendar/availability/draft/', request)
    return unwrapPayload<CreateDraftResponse>(response)
  },

  /**
   * Apply draft changes to database
   * POST /api/v1/calendar/availability/draft/{token}/apply
   */
  async applyDraft(token: string, request: ApplyDraftRequest = {}): Promise<ApplyDraftResponse> {
    const response = await api.post(`/v1/calendar/availability/draft/${token}/apply`, request)
    return unwrapPayload<ApplyDraftResponse>(response)
  },

  /**
   * Delete draft
   * DELETE /api/v1/calendar/availability/draft/{token}/
   */
  async deleteDraft(token: string): Promise<void> {
    await api.delete(`/v1/calendar/availability/draft/${token}/`)
  },

  /**
   * Check for conflicts in proposed slots
   * POST /api/v1/calendar/availability/conflicts/
   */
  async checkConflicts(request: CheckConflictsRequest): Promise<CheckConflictsResponse> {
    const response = await api.post('/v1/calendar/availability/conflicts/', request)
    return unwrapPayload<CheckConflictsResponse>(response)
  },

  /**
   * Get workload target settings
   * GET /api/v1/calendar/workload-target/
   */
  async getWorkloadTarget(): Promise<WorkloadTargetResponse> {
    const response = await api.get('/v1/calendar/workload-target/')
    return unwrapPayload<WorkloadTargetResponse>(response)
  },

  /**
   * Update workload target settings
   * PUT /api/v1/calendar/workload-target/
   */
  async updateWorkloadTarget(request: UpdateWorkloadTargetRequest): Promise<WorkloadTargetResponse> {
    const response = await api.put('/v1/calendar/workload-target/', request)
    return unwrapPayload<WorkloadTargetResponse>(response)
  },
}
