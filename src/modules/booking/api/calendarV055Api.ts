/**
 * Calendar API v0.55 - Single Source of Truth
 * Following contract: GET /v1/calendar/week/ with extended snapshot
 */

import api from '@/utils/apiClient'
import { calendarWeekApi } from './calendarWeekApi'
import type { 
  CalendarSnapshot, 
  CalendarEvent as CalendarEventV055, 
  AccessibleSlot as AccessibleSlotV055,
  DaySnapshot,
  BlockedRange,
  Dictionaries,
  SnapshotMeta,
  ReschedulePreviewRequest, 
  ReschedulePreviewResponse, 
  RescheduleConfirmRequest, 
  NoShowRequest, 
  BlockRangeRequest 
} from '@/modules/booking/types/calendarV055'
import type { 
  WeekSnapshot,
  CalendarEvent as LegacyEvent,
  AccessibleSlot as LegacySlot,
} from '@/modules/booking/types/calendarWeek'

export const calendarV055Api = {
  /**
   * Get calendar week snapshot (v0.55 format)
   * CONTRACT: GET /v1/calendar/week/ with tutor_id, week_start
   */
  async getCalendarWeek(
    tutorId: number,
    weekStart: string,
    etag?: string
  ): Promise<CalendarSnapshot> {
    const headers: Record<string, string> = {}
    if (etag) {
      headers['If-None-Match'] = etag
    }

    try {
      const response = await api.get('/v1/calendar/week/', {
        params: { tutor_id: tutorId, week_start: weekStart },
        headers,
      })
      return response.data
    } catch (error) {
      console.warn('[calendarV055Api] Falling back to legacy snapshot:', error)
      const legacy = await calendarWeekApi.getWeekSnapshot({
        page: 0,
        timezone: 'Europe/Kiev',
        includePayments: true,
        includeStats: true,
      })
      return transformLegacySnapshot(legacy.data, tutorId)
    }
  },

  /**
   * Preview reschedule (check conflicts)
   */
  async reschedulePreview(
    eventId: number,
    payload: ReschedulePreviewRequest
  ): Promise<ReschedulePreviewResponse> {
    const response = await api.post(
      `/v1/calendar/events/${eventId}/reschedule/preview`,
      payload
    )
    return response.data
  },

  /**
   * Confirm reschedule
   */
  async rescheduleConfirm(
    eventId: number,
    payload: RescheduleConfirmRequest
  ): Promise<{ success: boolean; event_id: number }> {
    const response = await api.post(
      `/v1/calendar/events/${eventId}/reschedule/confirm`,
      payload
    )
    return response.data
  },

  /**
   * Mark lesson as no-show
   */
  async markNoShow(
    eventId: number,
    payload: NoShowRequest
  ): Promise<{ success: boolean }> {
    const response = await api.post(`/v1/calendar/events/${eventId}/no-show/`, payload)
    return response.data
  },

  /**
   * Block time range for a day
   */
  async blockDayRange(
    dayKey: string,
    payload: BlockRangeRequest
  ): Promise<{ success: boolean; blocked_range_id: number }> {
    const response = await api.post(
      `/v1/calendar/day/${dayKey}/block-range/`,
      payload
    )
    return response.data
  },

  /**
   * Unblock time range
   */
  async unblockRange(rangeId: number): Promise<{ success: boolean }> {
    const response = await api.delete(`/v1/calendar/blocked-ranges/${rangeId}/`)
    return response.data
  }
}

// Helper function to map status
function mapStatus(doneStatus: string): CalendarEventV055['status'] {
  switch (doneStatus) {
    case 'completed': return 'completed'
    case 'no_show': return 'no_show'
    case 'cancelled': return 'cancelled'
    default: return 'scheduled'
  }
}

/**
 * Transform legacy snapshot to v0.55 format
 * Only used as fallback when v0.55 endpoint is not available
 */
function transformLegacySnapshot(snapshot: WeekSnapshot, tutorId: number): CalendarSnapshot {
  const now = new Date()

  // Add defensive checks for all required fields
  if (!snapshot) {
    console.error('[transformLegacySnapshot] No snapshot provided')
    return {
      days: [],
      events: [],
      accessible: [],
      blockedRanges: [],
      dictionaries: {
        noShowReasons: {},
        cancelReasons: {},
        blockReasons: {}
      },
      meta: {
        tutorId,
        weekStart: '',
        weekEnd: '',
        timezone: 'Europe/Kiev',
        currentTime: new Date().toISOString(),
        etag: ''
      }
    }
  }

  const events: CalendarEventV055[] = []
  const eventsByDay = snapshot.events || {}

  Object.entries(eventsByDay).forEach(([dayKey, dayEvents]) => {
    dayEvents.forEach((event: LegacyEvent) => {
      events.push({
        id: event.id,
        start: event.start,
        end: event.end,
        status: mapStatus(event.doneStatus),
        is_first: false,
        student: {
          id: event.orderId ?? 0,
          name: event.clientName || 'Студент',
        },
        lesson_link: snapshot.meta?.zoomLink || '',
        can_reschedule: true,
        can_mark_no_show: true,
      })
    })
  })

  const accessible: AccessibleSlotV055[] = []
  const accessibleByDay = snapshot.accessible || {}

  Object.values(accessibleByDay).forEach((daySlots: LegacySlot[]) => {
    daySlots.forEach(slot => {
      accessible.push({
        id: slot.id,
        start: slot.start,
        end: slot.end,
        is_recurring: (slot.regularity ?? '') === 'once_a_week',
      })
    })
  })

  const days: DaySnapshot[] = (snapshot.days || []).map((day) => {
    const dayEvents = eventsByDay[day.dayKey] || []
    const daySlots = accessibleByDay[day.dayKey] || []
    const availableMinutes = daySlots.reduce((sum, slot) => {
      const start = new Date(slot.start)
      const end = new Date(slot.end)
      const duration = (end.getTime() - start.getTime()) / 60000
      return sum + Math.max(0, duration)
    }, 0)

    return {
      date: day.dayKey,
      dayStatus: 'working',
      eventsCount: dayEvents.length,
      availableMinutes,
      isPast: new Date(day.dayKey) < now,
    }
  })

  const dictionaries: Dictionaries = {
    noShowReasons: snapshot.meta?.classMissedReasons || {},
    cancelReasons: snapshot.meta?.classDeletedReasons || {},
    blockReasons: snapshot.meta?.classDeletedReasons || {},
  }

  const meta: SnapshotMeta = {
    tutorId,
    weekStart: snapshot.week?.weekStart || '',
    weekEnd: snapshot.week?.weekEnd || '',
    timezone: snapshot.week?.timezone || 'Europe/Kiev',
    currentTime: snapshot.week?.currentTime || new Date().toISOString(),
    etag: ''
  }

  return {
    days,
    events,
    accessible,
    blockedRanges: [],
    dictionaries,
    meta
  }
}