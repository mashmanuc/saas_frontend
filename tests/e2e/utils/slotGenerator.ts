import { test, expect } from '@playwright/test'
import { Slot } from '@/modules/booking/types/slot'

interface SlotGeneratorOptions {
  id?: string
  date?: string
  start?: string
  end?: string
  status?: 'available' | 'booked' | 'blocked'
  source?: 'template' | 'manual' | 'override'
  templateId?: string
  overrideReason?: string
}

export function generateSlot(options: SlotGeneratorOptions = {}): Slot {
  const defaultSlot: Slot = {
    id: options.id || 'slot-' + Math.random().toString(36).substr(2, 9),
    date: options.date || '2024-12-25',
    start: options.start || '09:00',
    end: options.end || '10:00',
    status: options.status || 'available',
    source: options.source || 'template',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  if (options.templateId) {
    defaultSlot.templateId = options.templateId
  }

  if (options.overrideReason) {
    defaultSlot.overrideReason = options.overrideReason
  }

  return defaultSlot
}

export function generateConflict(overrides: Partial<any> = {}): any {
  return {
    type: 'slot_overlap',
    severity: 'error',
    message: 'This time conflicts with another slot',
    slotId: 'conflict-slot',
    ...overrides
  }
}

export function generateMultipleSlots(count: number, baseOptions: SlotGeneratorOptions = {}): Slot[] {
  const slots: Slot[] = []
  const baseDate = baseOptions.date || '2024-12-25'
  
  for (let i = 0; i < count; i++) {
    const date = new Date(baseDate)
    date.setDate(date.getDate() + i)
    
    slots.push(generateSlot({
      ...baseOptions,
      id: `slot-${i + 1}`,
      date: date.toISOString().split('T')[0],
      start: `${9 + i}:00`,
      end: `${10 + i}:00`
    }))
  }
  
  return slots
}
