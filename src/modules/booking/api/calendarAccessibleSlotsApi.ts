/**
 * Calendar Accessible Slots API v0.55.7
 * CRUD operations for individual CalendarAccessibleSlot
 * 
 * Reference: backend/docs/plan/v0.55.7/API_CONTRACT_V0557.md
 */

import api from '@/utils/apiClient'

export interface AccessibleSlotDetail {
  id: number
  start: string
  end: string
  status: 'available' | 'blocked'
  source: 'manual' | 'template' | 'import' | 'system'
  duration: number
  is_recurring: boolean
  created_at: string
  updated_at: string
}

export interface UpdateAccessibleSlotRequest {
  start?: string
  end?: string
  status?: 'available' | 'blocked'
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

export const calendarAccessibleSlotsApi = {
  /**
   * Get accessible slot details
   * GET /api/v1/calendar/accessible-slots/{id}/
   */
  async getSlot(id: number): Promise<AccessibleSlotDetail> {
    const response = await api.get(`/v1/calendar/accessible-slots/${id}/`)
    return unwrapPayload<AccessibleSlotDetail>(response)
  },

  /**
   * Update accessible slot
   * PATCH /api/v1/calendar/accessible-slots/{id}/
   */
  async updateSlot(id: number, payload: UpdateAccessibleSlotRequest): Promise<AccessibleSlotDetail> {
    const response = await api.patch(`/v1/calendar/accessible-slots/${id}/`, payload)
    return unwrapPayload<AccessibleSlotDetail>(response)
  },

  /**
   * Delete accessible slot
   * DELETE /api/v1/calendar/accessible-slots/{id}/
   */
  async deleteSlot(id: number): Promise<void> {
    await api.delete(`/v1/calendar/accessible-slots/${id}/`)
  }
}
