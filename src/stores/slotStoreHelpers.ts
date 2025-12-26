import type { CalendarSlot } from './slotStore'

/**
 * Helper to create optimistic slot for create operation
 */
export function createOptimisticSlot(
  date: string,
  start: string,
  end: string,
  tempId: number = Date.now()
): CalendarSlot {
  return {
    id: tempId,
    date,
    start,
    end,
    status: 'available',
    source: 'manual',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
}

/**
 * Helper to create optimistic slot for block operation
 */
export function createOptimisticBlockedSlot(slot: CalendarSlot): CalendarSlot {
  return {
    ...slot,
    status: 'blocked',
    updated_at: new Date().toISOString()
  }
}

/**
 * Helper to revert optimistic update
 */
export function revertOptimisticSlot(
  slots: Record<string, CalendarSlot[]>,
  date: string,
  slotId: number
): Record<string, CalendarSlot[]> {
  const dateSlots = slots[date] || []
  return {
    ...slots,
    [date]: dateSlots.filter(s => s.id !== slotId)
  }
}

/**
 * Helper to replace optimistic slot with server response
 */
export function replaceOptimisticSlot(
  slots: Record<string, CalendarSlot[]>,
  date: string,
  tempId: number,
  serverSlot: CalendarSlot
): Record<string, CalendarSlot[]> {
  const dateSlots = slots[date] || []
  return {
    ...slots,
    [date]: dateSlots.map(s => s.id === tempId ? serverSlot : s)
  }
}
