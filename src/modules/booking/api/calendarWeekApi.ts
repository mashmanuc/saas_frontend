import api from '@/utils/apiClient'
import type {
  WeekSnapshot,
  CreateEventPayload,
  UpdateEventPayload,
  DeleteEventPayload,
  CalendarEvent,
} from '../types/calendarWeek'

// API interceptor повертає res.data напряму, тому типи без обгортки
type WeekSnapshotResponse = WeekSnapshot

type CreateEventResponse = { id: number }

type DeleteEventResponse = []

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
   * Отримати week snapshot
   */
  async getWeekSnapshot(params: {
    page?: number
    timezone?: string
  }): Promise<WeekSnapshot> {
    console.log('[calendarWeekApi] Fetching week snapshot:', params)
    
    const response = await api.get<WeekSnapshotResponse>('/calendar/week/', {
      params: {
        page: params.page ?? 0,
        timezone: params.timezone ?? 'Europe/Kiev',
      },
    }) as unknown as WeekSnapshotResponse
    
    console.log('[calendarWeekApi] Snapshot received:', {
      daysCount: response.days.length,
      eventsCount: Object.values(response.events).flat().length,
      accessibleCount: Object.values(response.accessible).flat().length,
      ordersCount: response.orders.length,
    })
    
    return response
  },

  /**
   * Створити урок
   */
  async createEvent(payload: CreateEventPayload): Promise<number> {
    console.log('[calendarWeekApi] Creating event:', payload)
    
    const response = await api.post<CreateEventResponse>('/calendar/event/create/', payload) as unknown as CreateEventResponse
    
    console.log('[calendarWeekApi] Event created:', response.id)
    
    return response.id
  },

  /**
   * Видалити урок
   */
  async deleteEvent(payload: DeleteEventPayload): Promise<void> {
    console.log('[calendarWeekApi] Deleting event:', payload.id)
    
    await api.post<DeleteEventResponse>('/calendar/event/delete/', payload)
    
    console.log('[calendarWeekApi] Event deleted')
  },

  /**
   * Оновити урок
   */
  async updateEvent(payload: UpdateEventPayload): Promise<void> {
    console.log('[calendarWeekApi] Updating event:', payload)
    
    await api.post<DeleteEventResponse>('/calendar/event/update/', payload)
    
    console.log('[calendarWeekApi] Event updated')
  },

  /**
   * Отримати деталі уроку
   */
  async getEventDetails(id: number): Promise<EventDetailsResponse> {
    console.log('[calendarWeekApi] Fetching event details:', id)
    
    const response = await api.get<EventDetailsResponse>(`/calendar/event/${id}/`) as unknown as EventDetailsResponse
    
    return response
  },
}
