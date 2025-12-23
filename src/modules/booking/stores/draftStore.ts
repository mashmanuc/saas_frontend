import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { CalendarCell } from '@/modules/booking/types/calendar'
import { availabilityApi } from '@/modules/booking/api/availabilityApi'
import { useCalendarStore } from './calendarStore'

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

export interface DraftPatch {
  startAtUTC: string // ISO 8601 — canonical key
  durationMin: number
  action: 'set_available' | 'set_blocked' | 'clear'
  originalStatus?: string
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
      durationMin: cell.durationMin,
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
    
    const idempotencyKey = generateUUID()
    
    const result = await availabilityApi.bulkApply({
      patches: patches.map(p => ({
        startAtUTC: p.startAtUTC,
        durationMin: p.durationMin,
        action: p.action,
      })),
    }, idempotencyKey)
    
    for (const applied of result.applied) {
      removePatch(applied.startAtUTC)
    }
    
    const calendarStore = useCalendarStore()
    const weekRange = calendarStore.currentWeekRange
    await calendarStore.loadWeekView({
      tutorId: undefined,
      weekStart: weekRange.start.toISOString().split('T')[0],
      timezone: 'Europe/Kiev',
    })
    
    return result
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
  }
})
