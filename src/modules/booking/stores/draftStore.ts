import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { CalendarCell } from '@/modules/booking/types/calendar'
import { useCalendarStore } from './calendarStore'
import { availabilityApi } from '@/modules/booking/api/availabilityApi'
import { useAvailabilityStore } from './availabilityStore'

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

export interface DraftPatch {
  startAtUTC: string // ISO 8601 — canonical key
  action: 'set_available' | 'set_blocked'
  originalStatus: CalendarCell['status']
}

export const useDraftStore = defineStore('draft', () => {
  // State
  const draftPatchByKey = ref<Map<string, DraftPatch>>(new Map())
  const isDirty = computed(() => draftPatchByKey.value.size > 0)
  
  // Actions
  function addPatch(cell: CalendarCell, action: DraftPatch['action']) {
    const key = cell.startAtUTC // Canonical UTC key
    
    draftPatchByKey.value.set(key, {
      startAtUTC: cell.startAtUTC,
      action,
      originalStatus: cell.status,
    })
  }
  
  function removePatch(key: string) {
    draftPatchByKey.value.delete(key)
  }
  
  function clearAllPatches() {
    draftPatchByKey.value.clear()
  }
  
  function getPatch(key: string): DraftPatch | undefined {
    return draftPatchByKey.value.get(key)
  }
  
  function getAllPatches(): DraftPatch[] {
    return Array.from(draftPatchByKey.value.values())
  }
  
  async function applyPatches() {
    const patches = getAllPatches()
    
    if (patches.length === 0) {
      return { applied: [], rejected: [], summary: { total: 0, applied: 0, rejected: 0 } }
    }
    
    const result = await availabilityApi.bulkApply({ changes: patches })
    
    for (const applied of result.applied) {
      removePatch(applied.startAtUTC)
    }
    
    const calendarStore = useCalendarStore()
    await calendarStore.loadWeekView({
      tutorId: undefined,
      weekStart: calendarStore.currentWeekRange.start.toISOString().split('T')[0],
      timezone: calendarStore.settings?.timezone || 'Europe/Kiev',
    })
    
    return result
  }
  
  async function saveAsTemplate(timezone: string = 'Europe/Kiev') {
    const patches = getAllPatches()
    
    if (patches.length === 0) {
      throw new Error('No patches to save')
    }
    
    // Group patches by weekday and time
    const weeklySlots: Array<{weekday: number, start: string, end: string}> = []
    const slotsByDay = new Map<number, Array<{start: Date, action: string}>>()
    
    for (const patch of patches) {
      const date = new Date(patch.startAtUTC)
      const weekday = (date.getUTCDay() + 6) % 7 // Convert Sunday=0 to Monday=0
      
      if (!slotsByDay.has(weekday)) {
        slotsByDay.set(weekday, [])
      }
      
      slotsByDay.get(weekday)!.push({
        start: date,
        action: patch.action,
      })
    }
    
    // Convert to template format (merge consecutive available slots)
    for (const [weekday, slots] of slotsByDay.entries()) {
      const availableSlots = slots
        .filter(s => s.action === 'set_available')
        .sort((a, b) => a.start.getTime() - b.start.getTime())
      
      // Merge consecutive 30-min slots into ranges
      let currentStart: Date | null = null
      let currentEnd: Date | null = null
      
      for (const slot of availableSlots) {
        if (!currentStart) {
          currentStart = slot.start
          currentEnd = new Date(slot.start.getTime() + 30 * 60 * 1000)
        } else if (slot.start.getTime() === currentEnd!.getTime()) {
          // Consecutive slot, extend the range
          currentEnd = new Date(slot.start.getTime() + 30 * 60 * 1000)
        } else {
          // Gap found, save current range and start new one
          weeklySlots.push({
            weekday,
            start: formatTime(currentStart),
            end: formatTime(currentEnd!),
          })
          currentStart = slot.start
          currentEnd = new Date(slot.start.getTime() + 30 * 60 * 1000)
        }
      }
      
      // Save last range
      if (currentStart && currentEnd) {
        weeklySlots.push({
          weekday,
          start: formatTime(currentStart),
          end: formatTime(currentEnd),
        })
      }
    }
    
    // Save template via availabilityStore
    const availabilityStore = useAvailabilityStore()
    const result = await availabilityStore.saveTemplate({
      weekly_slots: weeklySlots,
      timezone,
      auto_generate: true,
    })
    
    // Clear patches after successful save
    clearAllPatches()
    
    return result
  }
  
  function formatTime(date: Date): string {
    const hours = date.getUTCHours().toString().padStart(2, '0')
    const minutes = date.getUTCMinutes().toString().padStart(2, '0')
    return `${hours}:${minutes}`
  }
  
  return {
    // State
    draftPatchByKey,
    isDirty,
    
    // Actions
    addPatch,
    removePatch,
    clearAllPatches,
    getPatch,
    getAllPatches,
    applyPatches,
    saveAsTemplate,
  }
})
