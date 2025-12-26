// Types for slot editing
export interface Slot {
  id: string
  date: string
  start: string
  end: string
  status: 'available' | 'booked' | 'blocked'
  source: 'template' | 'manual' | 'override'
  templateId?: string
  overrideReason?: string
  createdAt: string
  updatedAt: string
}

export type SlotEditStrategy = 'override' | 'update_template' | 'update_slot'

export interface Conflict {
  type: 'slot_overlap' | 'booked_overlap' | 'template_overlap'
  severity: 'error' | 'warning'
  message: string
  slotId?: string
  lessonId?: string
  studentName?: string
}

export interface SlotEditRequest {
  start_time: string
  end_time: string
  strategy: SlotEditStrategy
}

export interface ConflictCheckRequest {
  start_time: string
  end_time: string
}

export interface ConflictCheckResponse {
  has_conflicts: boolean
  conflicts: Conflict[]
}

export interface BatchEditRequest {
  updates: Array<{
    id: string
    start_time: string
    end_time: string
    strategy?: SlotEditStrategy
  }>
}

export interface BatchEditResponse {
  success_count: number
  error_count: number
  results: any[]
}
