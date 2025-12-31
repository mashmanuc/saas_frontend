/**
 * Calendar Week Types v0.49.2
 * Based on API_CONTRACTS_v0492.md
 */

export interface WeekSnapshot {
  week: WeekMeta
  days: Day[]
  events: Record<string, CalendarEvent[]>  // key = dayKey
  accessible: Record<string, AccessibleSlot[]>
  orders: Order[]
  meta: MetaData
}

export interface WeekMeta {
  weekStart: string       // "2025-12-22" (ISO date, Monday)
  weekEnd: string         // "2025-12-28"
  timezone: string        // "Europe/Kiev"
  currentTime: string     // "2025-12-24T14:26:00+02:00"
  page: number            // 0 (current), -1 (prev), 1 (next)
}

export interface Day {
  dayKey: string          // "2025-12-24" (canonical key)
  dow: number             // 0-6 (Sunday=0, Monday=1)
  label: string           // "Mon", "Tue"
  day: number             // 24
  month: number           // 12
  year: number            // 2025
}

export interface CalendarEvent {
  id: number
  type: 'class' | 'trial' | 'other'
  start: string           // "2025-12-24T17:50:00+02:00"
  end: string             // "2025-12-24T18:50:00+02:00"
  durationMin: number     // 60
  orderId: number
  clientName: string
  clientPhone: string | null
  paidStatus: 'unpaid' | 'paid'
  doneStatus: 'not_done' | 'done' | 'not_done_client_missed' | 'done_client_missed'
  regularity: 'single' | 'once_a_week' | 'twice_a_week'
  tutorComment: string | null
}

export interface AccessibleSlot {
  id: number
  type: 'available_slot'
  start: string           // "2025-12-24T16:00:00+02:00"
  end: string             // "2025-12-24T17:00:00+02:00"
  regularity: 'single' | 'once_a_week'
}

export interface Order {
  id: number
  clientName: string
  status: number          // 6 = active
  durations: number[]     // [30, 60, 90]
  studentId?: number      // ID студента для пошуку
  lessonsBalance?: number // Баланс уроків студента
  studentPhone?: string   // Телефон для відображення
  studentEmail?: string   // Email для відображення
}

export interface MetaData {
  countHoursOnWeek: number
  tutorReachedFullLoad: boolean
  zoomLink: string
  salary: {
    amount: number
    commonClassesCount: number
  }
  billingPeriodWages: {
    periodStart: string
    periodEnd: string
    totalAmount: number
  }
  classMissedReasons: Record<string, string>
  classDeletedReasons: Record<string, string>
}

// Normalized state types
export interface NormalizedEvents {
  byId: Record<number, CalendarEvent>
  idsByDay: Record<string, number[]>  // dayKey → event IDs
  allIds: number[]
}

export interface NormalizedAccessible {
  byId: Record<number, AccessibleSlot>
  idsByDay: Record<string, number[]>
  allIds: number[]
}

export interface NormalizedOrders {
  byId: Record<number, Order>
  allIds: number[]
}

// Cell types (для сумісності з v0.49.1)
export type CellStatus = 'empty' | 'available' | 'booked' | 'blocked' | 'notAllow'

export interface CalendarCell {
  dayKey: string
  slotIndex: number       // 0-47
  startAtUTC: string      // ISO timestamp
  endAtUTC: string
  status: CellStatus
  eventId?: number        // якщо booked
  slotId?: number         // ID доступного слота (якщо є)
}

// Command payloads
export interface CreateEventPayload {
  orderId: number
  start: string           // ISO 8601 with TZ
  durationMin: number     // 30, 60, 90, 120
  regularity: 'single' | 'once_a_week' | 'twice_a_week'
  tutorComment?: string
  studentComment?: string // Коментар для студента
  lessonType?: string     // Тип уроку (з dictionaries)
  slotId?: number         // ID слота для контексту
  notifyStudent?: boolean
  autoGenerateZoom?: boolean
  timezone?: string
}

export interface UpdateEventPayload {
  id: number
  start?: string
  durationMin?: number
  tutorComment?: string
  paidStatus?: 'paid' | 'unpaid'
  doneStatus?: 'done' | 'not_done' | 'not_done_client_missed' | 'done_client_missed'
}

export interface DeleteEventPayload {
  id: number
}

// Event layout (для overlay рендеру)
export interface EventLayout {
  eventId: number
  dayKey: string
  top: number             // px
  height: number          // px
  left: number            // px (0 для single column)
  width: string           // "100%" або px
}

export interface AvailabilityLayout {
  slotId: number
  dayKey: string
  top: number             // px
  height: number          // px
}

// Bulk update payload (v0.49.3)
export interface BulkUpdatePayload {
  eventIds: number[]
  updates: {
    paidStatus?: 'paid' | 'unpaid'
    doneStatus?: 'done' | 'not_done' | 'not_done_client_missed' | 'done_client_missed'
    tutorComment?: string
  }
}

// Calendar statistics (v0.49.3)
export interface CalendarStats {
  period: {
    start: string
    end: string
  }
  totals: {
    lessons: number
    hours: number
    earnings: number
    students: number
  }
  byWeek: Array<{
    weekStart: string
    lessons: number
    hours: number
    earnings: number
  }>
  topStudents: Array<{
    studentId: number
    studentName: string
    lessonsCount: number
    totalHours: number
  }>
}

// Availability sync result (v0.49.3)
export interface AvailabilitySyncResult {
  slotsGenerated: number
  weeksProcessed: number
  conflicts: any[]
  jobId: string
}
