import { realtimeService } from './realtime'
import { useCalendarWeekStore } from '@/modules/booking/stores/calendarWeekStore'
import { useAuthStore } from '@/modules/auth/store/authStore'
import { WebSocketReconnectManager } from './websocketReconnect'

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
  private reconnectManager: WebSocketReconnectManager | null = null

  init() {
    if (this.initialized) return
    
    const authStore = useAuthStore()
    
    realtimeService.init({
      tokenProvider: () => authStore.access,
      heartbeatInterval: 25000,
      logger: console
    })

    // Initialize reconnect manager
    this.reconnectManager = new WebSocketReconnectManager(
      {
        maxRetries: 10,
        initialDelay: 1000,
        maxDelay: 30000,
        backoffMultiplier: 2,
      },
      async () => {
        await realtimeService.connect()
      },
      (metrics) => {
        console.warn('[websocket] Disconnect metrics:', metrics)
        // Send to telemetry if available
        if (typeof window !== 'undefined' && (window as any).telemetry) {
          (window as any).telemetry.track('websocket.long_disconnect', metrics)
        }
      }
    )

    realtimeService.on('status', (status) => {
      console.log('[websocket] Status:', status)
      
      if (status === 'connected' && this.reconnectManager) {
        this.reconnectManager.onConnect()
      } else if (status === 'disconnected' && this.reconnectManager) {
        this.reconnectManager.onDisconnect()
      }
    })

    realtimeService.on('error', (error) => {
      console.error('[websocket] Error:', error)
    })

    realtimeService.on('auth_required', async () => {
      console.warn('[websocket] Auth required, refreshing token...')
      try {
        await authStore.refreshAccess()
      } catch (error) {
        console.error('[websocket] Token refresh failed:', error)
      }
    })

    this.initialized = true
  }

  connect() {
    this.init()
    return realtimeService.connect()
  }

  disconnect() {
    if (this.reconnectManager) {
      this.reconnectManager.stopReconnect()
    }
    return realtimeService.disconnect()
  }

  getConnectionMetrics() {
    return this.reconnectManager?.getMetrics() || null
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
      const calendarWeekStore = useCalendarWeekStore()
      
      // Map legacy slot events to new calendar week events
      if (data.event === 'slot.booked') {
        const eventData = data.data as SlotBookedEvent
        // New store uses handleEventCreated instead of updateSlotStatus
        calendarWeekStore.handleEventCreated(eventData)
        handler({ channel, event: data.event, data: eventData })
      } else if (data.event === 'slot.blocked') {
        // Blocked slots are handled through availability updates in new API
        handler({ channel, event: data.event, data: data.data })
      } else if (data.event === 'slot.released') {
        // Released slots trigger week refresh by refetching
        calendarWeekStore.fetchWeek(0)
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
