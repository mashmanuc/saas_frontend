export interface CalendarSlot {
  id: number
  date: string
  start: string
  end: string
  status: 'available' | 'booked' | 'blocked'
  source?: 'template' | 'manual' | 'override'
  template_id?: number
  override_reason?: string
  created_at: string
  updated_at: string
}

export interface CalendarWeekResponse {
  data: {
    accessible: Record<string, CalendarSlot[]>
    events: Record<string, any[]>
  }
  meta?: {
    page: number
    total_pages: number
  }
}

export interface AccessibleSlot {
  id: number
  start: string
  end: string
  status?: 'available' | 'booked' | 'blocked'
  source?: 'template' | 'manual' | 'override'
  template_id?: number
  override_reason?: string
  created_at?: string
  updated_at?: string
}
