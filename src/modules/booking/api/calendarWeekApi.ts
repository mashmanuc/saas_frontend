import api from '@/utils/apiClient'
import type {
  WeekSnapshot,
  CreateEventPayload,
  UpdateEventPayload,
  DeleteEventPayload,
  CalendarEvent,
  BulkUpdatePayload,
  CalendarStats,
  AvailabilitySyncResult,
} from '../types/calendarWeek'

// API interceptor повертає res.data напряму, тому типи без обгортки
type WeekSnapshotResponse = WeekSnapshot

type CreateEventResponse = { 
  id: number
  zoomLink?: string
  notificationSent: boolean
}

type DeleteEventResponse = []

type BulkUpdateResponse = {
  updated: number
  failed: number
  errors: any[]
}

type StatsResponse = CalendarStats

type SyncResponse = AvailabilitySyncResult

type EventDetailsResponse = {
  event: CalendarEvent
  dictionaries: {
    durations: number[]
    regularities: string[]
    classTypes: string[]
    paidStatuses: string[]
    doneStatuses: string[]
  }
}

export const calendarWeekApi = {
  /**
   * Отримати week snapshot з ETag кешуванням
   */
  async getWeekSnapshot(params: {
    page?: number
    timezone?: string
    includePayments?: boolean
    includeStats?: boolean
    etag?: string
  }): Promise<{ data: WeekSnapshot; etag: string; cached: boolean }> {
    console.log('[calendarWeekApi] Fetching week snapshot:', params)
    
    const headers: Record<string, string> = {
      'Accept-Encoding': 'gzip, br'
    }
    
    if (params.etag) {
      headers['If-None-Match'] = params.etag
    }
    
    try {
      const response = await api.get<WeekSnapshotResponse>('/v1/calendar/week/', {
        params: {
          page: params.page ?? 0,
          timezone: params.timezone ?? 'Europe/Kiev',
          includePayments: params.includePayments ?? true,
          includeStats: params.includeStats ?? true,
        },
        headers,
      })
      
      const etag = (response as any).headers?.['etag'] || ''
      const data = response as unknown as WeekSnapshotResponse
      
      console.log('[calendarWeekApi] Snapshot received:', {
        daysCount: data.days.length,
        eventsCount: Object.values(data.events).flat().length,
        etag,
      })
      
      return {
        data,
        etag,
        cached: false
      }
    } catch (error: any) {
      // Handle 304 Not Modified
      if (error.response?.status === 304) {
        console.log('[calendarWeekApi] Snapshot not modified (304)')
        return {
          data: null as any,
          etag: params.etag || '',
          cached: true
        }
      }
      throw error
    }
  },

  /**
   * Створити урок
   */
  async createEvent(payload: CreateEventPayload & {
    notifyStudent?: boolean
    autoGenerateZoom?: boolean
  }): Promise<CreateEventResponse> {
    console.log('[calendarWeekApi] Creating event:', payload)
    
    const response = await api.post<any>('/v1/calendar/event/create/', payload) as unknown as CreateEventResponse
    
    console.log('[calendarWeekApi] Event created:', response)
    
    return response
  },

  /**
   * Видалити урок
   */
  async deleteEvent(payload: DeleteEventPayload): Promise<void> {
    console.log('[calendarWeekApi] Deleting event:', payload.id)
    
    await api.post<DeleteEventResponse>('/v1/calendar/event/delete/', payload)
    
    console.log('[calendarWeekApi] Event deleted')
  },

  /**
   * Оновити урок
   */
  async updateEvent(payload: UpdateEventPayload & {
    paidStatus?: 'paid' | 'unpaid'
    doneStatus?: 'done' | 'not_done' | 'not_done_client_missed' | 'done_client_missed'
    notifyStudent?: boolean
  }): Promise<void> {
    console.log('[calendarWeekApi] Updating event:', payload)
    
    await api.post<DeleteEventResponse>('/v1/calendar/event/update/', payload)
    
    console.log('[calendarWeekApi] Event updated')
  },

  /**
   * Масове оновлення подій
   */
  async bulkUpdateEvents(payload: BulkUpdatePayload): Promise<BulkUpdateResponse> {
    console.log('[calendarWeekApi] Bulk updating events:', payload)
    
    const response = await api.post<BulkUpdateResponse>('/v1/calendar/event/bulk-update/', payload) as unknown as BulkUpdateResponse
    
    console.log('[calendarWeekApi] Bulk update completed:', response)
    
    return response
  },

  /**
   * Отримати деталі уроку
   */
  async getEventDetails(id: number): Promise<EventDetailsResponse> {
    console.log('[calendarWeekApi] Fetching event details:', id)
    
    const response = await api.get<EventDetailsResponse>(`/v1/calendar/event/${id}/`) as unknown as EventDetailsResponse
    
    return response
  },

  /**
   * Отримати статистику
   */
  async getStats(params: {
    startDate?: string
    endDate?: string
    groupBy?: 'day' | 'week' | 'month'
  }): Promise<StatsResponse> {
    console.log('[calendarWeekApi] Fetching stats:', params)
    
    const response = await api.get<StatsResponse>('/v1/calendar/stats/', { params }) as unknown as StatsResponse
    
    return response
  },

  /**
   * Синхронізувати доступність
   */
  async syncAvailability(params: {
    weeksAhead?: number
    regenerate?: boolean
  }): Promise<SyncResponse> {
    console.log('[calendarWeekApi] Syncing availability:', params)
    
    const response = await api.post<SyncResponse>('/v1/calendar/availability/sync/', params) as unknown as SyncResponse
    
    return response
  },
}
