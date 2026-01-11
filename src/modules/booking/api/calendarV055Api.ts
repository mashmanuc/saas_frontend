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
   * Get my calendar (unified for tutor/student) - v0.69.1
   * CONTRACT: GET /v1/calendar/my/ with from, to, tz
   */
  async getMyCalendar(params: {
    from: string
    to: string
    tz?: string
  }): Promise<{
    results: Array<{
      id: number
      start: string
      end: string
      status: string
      tutor: { id: number; name: string } | null
      student: { id: number; name: string } | null
      subject: any | null
      tags: string[]
      permissions: {
        can_message: boolean
        can_join_room: boolean
      }
      room: any | null
    }>
  }> {
    const response = await api.get('/v1/calendar/my/', {
      params: {
        from: params.from,
        to: params.to,
        tz: params.tz || 'Europe/Kiev'
      }
    })
    return response.data || response
  },

  /**
   * Get calendar week snapshot (v0.55 format)
   * CONTRACT: GET /v1/calendar/week/v055/ with tutor_id, week_start
   */
  async getCalendarWeek(
    tutorId: number,
    weekStart: string,
    etag?: string,
    timezone?: string
  ): Promise<CalendarSnapshot> {
    const headers: Record<string, string> = {}
    if (etag) {
      headers['If-None-Match'] = etag
    }

    const params: Record<string, string> = {
      tutorId: String(tutorId),
      weekStart,
    }

    if (timezone) {
      params.timezone = timezone
    }

    console.log('[calendarV055Api] getCalendarWeek request', {
      tutorId,
      weekStart,
      etag: etag || null,
      timezone: timezone || null,
      headers,
    })

    try {
      const response = await api.get('/v1/calendar/week/v055/', {
        params,
        headers,
      }) as CalendarSnapshot
      console.log('[calendarV055Api] getCalendarWeek response', {
        hasResponse: !!response,
        days: (response as any)?.days?.length ?? 0,
        events: Array.isArray((response as any)?.events)
          ? (response as any).events.length
          : Object.values((response as any)?.events || {}).flat().length,
        metaEtag: (response as any)?.meta?.etag || null,
      })
      
      if (!response) {
        throw new Error('API returned empty response')
      }
      
      return response
    } catch (error) {
      throw error
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
  },

  /**
   * Create a new calendar event (lesson)
   * CONTRACT: POST /api/v1/calendar/event/create/
   */
  async createEvent(payload: {
    orderId: number
    start: string
    durationMin: number
    regularity?: string
    tutorComment?: string
    studentComment?: string
    lessonType?: string
    slotId?: number
    notifyStudent?: boolean
    autoGenerateZoom?: boolean
    timezone?: string
  }): Promise<{ id: number; zoomLink?: string; optimisticHash?: string }> {
    const response = await api.post('/v1/calendar/event/create/', payload)
    return response.data
  },

  /**
   * Create a series of recurring calendar events
   * CONTRACT: POST /api/v1/calendar/event/series/create/
   */
  async createEventSeries(payload: {
    orderId: number
    start: string
    durationMin: number
    regularity?: string
    tutorComment?: string
    studentComment?: string
    lessonType?: string
    slotId?: number
    notifyStudent?: boolean
    autoGenerateZoom?: boolean
    timezone?: string
    repeatMode: 'weekly' | 'biweekly'
    repeatCount?: number
    repeatUntil?: string
    skipConflicts?: boolean
  }): Promise<{
    seriesId: number
    createdCount: number
    skippedCount: number
    createdEvents: Array<{ id: number; start: string; end: string }>
    skipped: Array<{ start: string; code: string; message: string; details?: any }>
    warnings: string[]
  }> {
    const response = await api.post('/v1/calendar/event/series/create/', payload)
    return response.data
  },

  /**
   * Update event (v0.55)
   */
  async updateEvent(payload: {
    id: number
    start?: string
    durationMin?: number
    tutorComment?: string
    paidStatus?: 'paid' | 'unpaid'
    doneStatus?: 'done' | 'not_done' | 'not_done_client_missed' | 'done_client_missed'
  }): Promise<{ success: boolean }> {
    const response = await api.post('/v1/calendar/event/update/', payload)
    return response.data || response
  },

  /**
   * Delete event (v0.55)
   */
  async deleteEvent(payload: { id: number }): Promise<{ success: boolean }> {
    const response = await api.post('/v1/calendar/event/delete/', payload)

    return response.data || response
  },

  /**
   * Get event details (v0.55)
   */
  async getEventDetails(id: number): Promise<{
    event: CalendarEventV055
    dictionaries: {
      durations: number[]
      regularities: string[]
      classTypes: string[]
      paidStatuses: string[]
      doneStatuses: string[]
    }
  }> {
    console.log('[calendarV055Api] getEventDetails called for id:', id)
    const payload = await api.get(`/v1/calendar/event/${id}/`)
    console.log('[calendarV055Api] getEventDetails raw payload:', payload)
    
    // Backend returns { status: "success", data: { event, dictionaries } }
    if (payload?.data?.event && payload?.data?.dictionaries) {
      console.log('[calendarV055Api] getEventDetails returning data:', payload.data)
      return payload.data
    }
    
    if ((payload as any)?.event && (payload as any)?.dictionaries) {
      // Already unwrapped
      return payload as unknown as { event: CalendarEventV055; dictionaries: { durations: number[]; regularities: string[]; classTypes: string[]; paidStatuses: string[]; doneStatuses: string[]; }; }
    }
    
    // Fallback if response structure is different
    console.warn('[calendarV055Api] getEventDetails unexpected payload structure:', payload)
    throw new Error('Invalid response structure from getEventDetails')
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

export interface CreateEventSeriesPayload {
  orderId: number
  start: string
  durationMin: number
  regularity?: string
  tutorComment?: string
  studentComment?: string
  lessonType?: string
  slotId?: number
  notifyStudent?: boolean
  autoGenerateZoom?: boolean
  timezone?: string
  repeatMode: 'weekly' | 'biweekly'
  repeatCount?: number
  repeatUntil?: string
  skipConflicts?: boolean
}