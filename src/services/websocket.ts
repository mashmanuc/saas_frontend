import { realtimeService } from './realtime'
import { useCalendarStore } from '@/modules/booking/stores/calendarStore'
import { useAuthStore } from '@/modules/auth/store/authStore'

export interface WebSocketEvent {
  channel: string
  event: string
  data: any
  timestamp?: string
}

export interface SlotBookedEvent {
  slot_id: number
  booking_id: string
  student: {
    id: number
    name: string
    avatar?: string
  }
  timestamp: string
}

export interface AvailabilityUpdatedEvent {
  tutor_slug: string
  week_start: string
  timestamp: string
}

export interface BookingEvent {
  booking_id: string
  status: string
  time_slot?: {
    id: number
    start_datetime: string
    end_datetime: string
  }
  tutor?: { name: string }
  student?: { name: string }
  confirmed_at?: string
  cancelled_at?: string
  cancelled_by?: string
  timestamp: string
}

class WebSocketService {
  private initialized = false
  private subscriptions: Map<string, Set<(data: any) => void>> = new Map()

  init() {
    if (this.initialized) return
    
    const authStore = useAuthStore()
    
    realtimeService.init({
      tokenProvider: () => authStore.token,
      heartbeatInterval: 25000,
      logger: console
    })

    realtimeService.on('status', (status) => {
      console.log('[websocket] Status:', status)
    })

    realtimeService.on('error', (error) => {
      console.error('[websocket] Error:', error)
    })

    realtimeService.on('auth_required', () => {
      console.warn('[websocket] Auth required, reconnecting...')
      authStore.refreshToken?.()
    })

    this.initialized = true
  }

  connect() {
    this.init()
    return realtimeService.connect()
  }

  disconnect() {
    return realtimeService.disconnect()
  }

  subscribe(channel: string, handler: (data: any) => void) {
    this.init()
    
    const handlers = this.subscriptions.get(channel) || new Set()
    handlers.add(handler)
    this.subscriptions.set(channel, handlers)

    return realtimeService.subscribe(channel, handler)
  }

  unsubscribe(channel: string, handler: (data: any) => void) {
    const handlers = this.subscriptions.get(channel)
    if (handlers) {
      handlers.delete(handler)
      if (handlers.size === 0) {
        this.subscriptions.delete(channel)
      }
    }
    return realtimeService.unsubscribe(channel, handler)
  }

  subscribeTutorSlots(tutorId: number, handler: (event: WebSocketEvent) => void) {
    const channel = `tutor:${tutorId}:slots`
    return this.subscribe(channel, (data) => {
      const calendarStore = useCalendarStore()
      
      if (data.event === 'slot.booked') {
        const eventData = data.data as SlotBookedEvent
        calendarStore.updateSlotStatus(eventData.slot_id, 'booked')
        handler({ channel, event: data.event, data: eventData })
      } else if (data.event === 'slot.blocked') {
        calendarStore.updateSlotStatus(data.data.slot_id, 'blocked')
        handler({ channel, event: data.event, data: data.data })
      } else if (data.event === 'slot.released') {
        calendarStore.updateSlotStatus(data.data.slot_id, 'available')
        handler({ channel, event: data.event, data: data.data })
      } else if (data.event === 'slot.created') {
        handler({ channel, event: data.event, data: data.data })
      }
    })
  }

  subscribeStudentAvailability(studentId: number, tutorSlug: string, handler: (event: WebSocketEvent) => void) {
    const channel = `student:${studentId}:availability:${tutorSlug}`
    return this.subscribe(channel, (data) => {
      if (data.event === 'availability.updated') {
        const eventData = data.data as AvailabilityUpdatedEvent
        handler({ channel, event: data.event, data: eventData })
      } else if (data.event === 'slot.unavailable') {
        handler({ channel, event: data.event, data: data.data })
      }
    })
  }

  subscribeMatchUpdates(matchId: string, handler: (event: WebSocketEvent) => void) {
    const channel = `match:${matchId}`
    return this.subscribe(channel, (data) => {
      if (data.event === 'booking.created') {
        const eventData = data.data as BookingEvent
        handler({ channel, event: data.event, data: eventData })
      } else if (data.event === 'booking.confirmed') {
        const eventData = data.data as BookingEvent
        handler({ channel, event: data.event, data: eventData })
      } else if (data.event === 'booking.cancelled') {
        const eventData = data.data as BookingEvent
        handler({ channel, event: data.event, data: eventData })
      }
    })
  }

  subscribeStudentBookings(studentId: number, handler: (event: WebSocketEvent) => void) {
    const channel = `student:${studentId}:bookings`
    return this.subscribe(channel, (data) => {
      if (data.event === 'booking.confirmed') {
        const eventData = data.data as BookingEvent
        handler({ channel, event: data.event, data: eventData })
      } else if (data.event === 'booking.cancelled') {
        const eventData = data.data as BookingEvent
        handler({ channel, event: data.event, data: eventData })
      }
    })
  }

  getStatus() {
    return realtimeService.getState()
  }
}

export const websocketService = new WebSocketService()
export default websocketService
