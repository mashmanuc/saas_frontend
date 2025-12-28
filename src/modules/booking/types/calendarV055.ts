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
  new_start: string
  new_end: string
}

export interface ReschedulePreviewResponse {
  allowed: boolean
  conflicts: Conflict[]
  warnings: string[]
}

export interface Conflict {
  type: 'booking_exists' | 'blocked_time' | 'outside_availability'
  reason: string
  conflicting_event_id?: number
}

export interface RescheduleConfirmRequest {
  new_start: string
  new_end: string
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
