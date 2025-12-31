/**
 * Calendar Types v0.55 - Extended Snapshot
 * Based on TECHNICAL_TASK_FRONTEND v0.55
 */

export interface CalendarSnapshot {
  days: DaySnapshot[]
  events: CalendarEvent[]
  accessible: AccessibleSlot[]
  blockedRanges: BlockedRange[]
  dictionaries: Dictionaries
  meta: SnapshotMeta
}

export interface DaySnapshot {
  date: string              // "2025-12-24" ISO date
  dayStatus: 'working' | 'partial' | 'day_off'
  eventsCount: number
  availableMinutes: number
  isPast: boolean
}

export interface CalendarEvent {
  id: number
  start: string             // "2025-12-24T17:50:00+02:00"
  end: string               // "2025-12-24T18:50:00+02:00"
  status: 'scheduled' | 'completed' | 'no_show' | 'cancelled'
  is_first: boolean         // Перше заняття зі студентом
  student: {
    id: number
    name: string
  }
  lesson_link: string       // Zoom link
  can_reschedule: boolean
  can_mark_no_show: boolean
  durationMin?: number      // Тривалість уроку в хвилинах
  tutorComment?: string     // Коментар тьютора
  studentComment?: string   // Коментар студента
  clientName?: string       // Ім'я студента (альтернатива student.name)
  orderId?: number          // ID замовлення
  paidStatus?: 'paid' | 'unpaid'
  lessonType?: string       // Тип уроку
}

export interface AccessibleSlot {
  id: number
  start: string
  end: string
  is_recurring: boolean     // true = from template, false = manual
}

export interface BlockedRange {
  id: number
  start: string
  end: string
  reason: string
  type: 'manual' | 'system'
}

export interface Dictionaries {
  noShowReasons: Record<number, string>
  cancelReasons: Record<number, string>
  blockReasons: Record<number, string>
  lessonTypes?: Record<string, string>  // F3: Типи уроків
  durations?: number[]                   // Доступні тривалості
}

export interface SnapshotMeta {
  weekStart: string
  weekEnd: string
  timezone: string
  currentTime: string
  etag: string
  tutorId: number
}

// API Request/Response types

export interface ReschedulePreviewRequest {
  target_slot_id?: number
  target_start?: string
  target_end?: string
}

export interface ReschedulePreviewResponse {
  allowed: boolean
  conflicts: Conflict[]
  warnings: string[]
  suggested_alternatives?: Array<{
    slotId: number
    start: string
    end: string
    reason: string
  }>
}

export interface Conflict {
  type: 'booking_exists' | 'blocked_time' | 'outside_availability' | 'overlapping_lesson' | 'slot_not_found' | 'event_not_found' | 'missing_target'
  reason: string
  conflicting_event_id?: number
  event_id?: number
  slot_id?: number
  start?: string
  end?: string
  range_id?: number
}

export interface RescheduleConfirmRequest {
  target_slot_id?: number
  target_start?: string
  target_end?: string
}

export interface NoShowRequest {
  reason_id: number
  comment: string
}

export interface BlockRangeRequest {
  start: string
  end: string
  reason: string
}
