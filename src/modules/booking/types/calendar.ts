export interface CalendarCell {
  startAtUTC: string // ISO 8601
  durationMin: number // 30, 60, 90
  status: 'empty' | 'available' | 'blocked' | 'booked'
  source: 'template' | 'manual' | 'lesson' | null
  booking?: {
    id: number
    student: {
      id: number
      name: string
    }
    lesson_id: number
  }
  isDraft?: boolean
}

export interface WeekViewResponse {
  week_start: string
  timezone: string
  cells: CalendarCell[]
}
