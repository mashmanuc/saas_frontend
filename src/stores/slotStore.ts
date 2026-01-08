import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { bookingApi } from '@/modules/booking/api/bookingApi'
import { calendarWeekApi } from '@/modules/booking/api/calendarWeekApi'
import { useCalendarWeekStore } from '@/modules/booking/stores/calendarWeekStore'
import type { Slot, SlotEditStrategy, Conflict } from '@/modules/booking/types/slot'
import { useUndoRedo } from '@/composables/useUndoRedo'
import { EditSlotCommand, BatchEditSlotsCommand } from '@/modules/booking/commands/SlotEditCommand'
import type { SlotData } from '@/modules/booking/commands/SlotEditCommand'
import { 
  logSlotEditStart, 
  logSlotEditSuccess, 
  logSlotEditError,
  logSlotBatchEditStart,
  logSlotBatchEditSuccess,
  logSlotBatchEditError,
  logSlotDelete,
  logSlotUndo,
  logSlotRedo
} from '@/services/telemetry'

/**
 * Map frontend SlotEditStrategy to backend API format
 * Frontend: 'override' | 'update_template' | 'update_slot'
 * Backend (single): 'override' | 'template' | 'series'
 * Backend (batch): 'override' | 'template'
 */
function mapStrategyToApi(strategy: SlotEditStrategy): 'override' | 'template' | 'series' {
  if (strategy === 'update_template') {
    return 'template'
  }
  if (strategy === 'update_slot') {
    return 'override'
  }
  return strategy as 'override' | 'template' | 'series'
}

function mapStrategyToBatchApi(strategy: SlotEditStrategy): 'override' | 'template' {
  if (strategy === 'update_template') {
    return 'template'
  }
  // Batch API doesn't support 'series', fallback to 'override'
  return 'override'
}

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

export const useSlotStore = defineStore('slots', () => {
  // State
  const slots = ref<Record<string, CalendarSlot[]>>({})
  const editingSlot = ref<Slot | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const draftSchedule = ref<Record<number, { start: string; end: string }[]> | null>(null)
  const hasTemplateChanges = ref(false)
  
  // Undo/Redo
  const undoRedo = useUndoRedo()

  // Computed
  const allSlots = computed(() => {
    const allSlotsArray: CalendarSlot[] = []
    Object.values(slots.value).forEach(dateSlots => {
      allSlotsArray.push(...dateSlots)
    })
    return allSlotsArray
  })

  const availableSlots = computed(() => {
    return allSlots.value.filter(slot => slot.status === 'available')
  })

  const bookedSlots = computed(() => {
    return allSlots.value.filter(slot => slot.status === 'booked')
  })

  // Actions
  async function loadSlots(params: { page: number } = { page: 0 }) {
    isLoading.value = true
    error.value = null
    
    try {
      // Використовуємо calendarWeekStore замість прямого виклику API
      const calendarStore = useCalendarWeekStore()
      
      // Якщо snapshot ще не завантажений, завантажуємо його
      if (!calendarStore.snapshot && calendarStore.currentTutorId && calendarStore.currentWeekStart) {
        await calendarStore.fetchWeekSnapshot(calendarStore.currentTutorId, calendarStore.currentWeekStart)
      }
      
      // Читаємо accessible слоти зі store (вже синхронізовані через адаптери)
      const accessibleById = calendarStore.accessibleById
      const accessibleIdsByDay = calendarStore.accessibleIdsByDay
      
      // Конвертуємо у формат slotStore
      const normalizedSlots: Record<string, CalendarSlot[]> = {}
      
      for (const [dayKey, slotIds] of Object.entries(accessibleIdsByDay)) {
        normalizedSlots[dayKey] = (slotIds as number[]).map(id => {
          const slot = accessibleById[id]
          return {
            id: slot.id,
            date: dayKey,
            start: slot.start,
            end: slot.end,
            status: 'available' as const,
            source: 'template' as const,
            template_id: null,
            override_reason: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        }).filter(Boolean) as CalendarSlot[]
      }
      
      slots.value = normalizedSlots
      return slots.value
    } catch (err: any) {
      error.value = err.message || 'Failed to load slots'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function updateSlot(
    slotId: string,
    data: {
      start_time: string
      end_time: string
      strategy: SlotEditStrategy
      override_reason?: string
    },
    options: { enableUndo?: boolean; optimistic?: boolean } = { enableUndo: true, optimistic: true }
  ): Promise<Slot> {
    const startTime = Date.now()
    isLoading.value = true
    error.value = null
    
    logSlotEditStart(slotId, data.strategy)

    try {
      // Get old data for undo and optimistic update
      const oldSlot = findSlotById(parseInt(slotId))
      
      // Optimistic update: apply changes immediately to local state
      if (options.optimistic && oldSlot) {
        const optimisticSlot: CalendarSlot = {
          ...oldSlot,
          start: data.start_time,
          end: data.end_time,
          override_reason: data.override_reason,
          updated_at: new Date().toISOString()
        }
        refreshSlot(optimisticSlot)
        console.info('[SlotStore] Optimistic update applied for slot', slotId)
      }
      
      if (options.enableUndo && oldSlot) {
        const oldData: SlotData = {
          start_time: oldSlot.start,
          end_time: oldSlot.end,
          strategy: 'override',
          override_reason: oldSlot.override_reason
        }
        
        const command = new EditSlotCommand(slotId, oldData, data)
        const updatedSlot = await undoRedo.executeCommand(command)
        
        // Update local state with server response (replaces optimistic update)
        refreshSlot(updatedSlot)
        
        const duration = Date.now() - startTime
        logSlotEditSuccess(slotId, data.strategy, duration, true)
        
        return updatedSlot
      } else {
        // Execute without undo support
        const apiPayload = {
          start_time: data.start_time,
          end_time: data.end_time,
          strategy: mapStrategyToApi(data.strategy),
          override_reason: data.override_reason
        }
        const response = await bookingApi.editSlot(slotId, apiPayload)
        const updatedSlot = response.slot || response
        refreshSlot(updatedSlot)
        
        const duration = Date.now() - startTime
        logSlotEditSuccess(slotId, data.strategy, duration, options.optimistic || false)
        
        return updatedSlot
      }
    } catch (err: any) {
      const duration = Date.now() - startTime
      logSlotEditError(slotId, data.strategy, duration, err.message)
      
      // Revert optimistic update on error
      if (options.optimistic) {
        const oldSlot = findSlotById(parseInt(slotId))
        if (oldSlot) {
          refreshSlot(oldSlot)
          console.warn('[SlotStore] Optimistic update reverted due to error')
        }
      }
      
      error.value = err.message || 'Failed to update slot'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function deleteSlot(slotId: number): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      await bookingApi.deleteSlot(slotId)
      
      // Remove from local state
      removeSlotFromState(slotId)
      
      logSlotDelete(slotId)
    } catch (err: any) {
      error.value = err.message || 'Failed to delete slot'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function batchUpdateSlots(
    slotIds: number[],
    data: {
      start_time?: string
      end_time?: string
      strategy: SlotEditStrategy
      override_reason?: string
    },
    options: { enableUndo?: boolean } = { enableUndo: true }
  ) {
    const startTime = Date.now()
    isLoading.value = true
    error.value = null
    
    logSlotBatchEditStart(slotIds.length, data.strategy)

    try {
      if (options.enableUndo) {
        // Collect old data for undo
        const oldDataMap = new Map<number, SlotData>()
        slotIds.forEach(id => {
          const oldSlot = findSlotById(id)
          if (oldSlot) {
            oldDataMap.set(id, {
              start_time: oldSlot.start,
              end_time: oldSlot.end,
              strategy: 'override',
              override_reason: oldSlot.override_reason
            })
          }
        })
        
        const command = new BatchEditSlotsCommand(slotIds, oldDataMap, data)
        const response = await undoRedo.executeCommand(command)
        
        // Update local state
        response.updated_slots.forEach((slot: any) => {
          refreshSlot(slot)
        })
        
        const duration = Date.now() - startTime
        logSlotBatchEditSuccess(
          slotIds.length, 
          data.strategy, 
          duration, 
          response.updated_count,
          response.conflicts?.length || 0
        )
        
        return response
      } else {
        // Execute without undo support
        const apiPayload = {
          slot_ids: slotIds,
          start_time: data.start_time || '',
          end_time: data.end_time || '',
          strategy: mapStrategyToBatchApi(data.strategy),
          override_reason: data.override_reason
        }
        const response = await bookingApi.batchEditSlots(apiPayload)
        
        response.updated_slots.forEach((slot: any) => {
          refreshSlot(slot)
        })
        
        const duration = Date.now() - startTime
        logSlotBatchEditSuccess(
          slotIds.length, 
          data.strategy, 
          duration, 
          response.updated_count,
          response.conflicts?.length || 0
        )
        
        return response
      }
    } catch (err: any) {
      const duration = Date.now() - startTime
      logSlotBatchEditError(slotIds.length, data.strategy, duration, err.message)
      
      error.value = err.message || 'Failed to batch update slots'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  function refreshSlot(updatedSlot: any) {
    let slotDate: string
    
    if (updatedSlot.date) {
      slotDate = updatedSlot.date
    } else if (updatedSlot.start_time || updatedSlot.start) {
      const dateStr = updatedSlot.start_time || updatedSlot.start
      try {
        slotDate = new Date(dateStr).toISOString().slice(0, 10)
      } catch (e) {
        console.error('[SlotStore] Invalid date format:', dateStr)
        return
      }
    } else {
      console.error('[SlotStore] No date information in updatedSlot:', updatedSlot)
      return
    }

    if (!slots.value[slotDate]) {
      slots.value[slotDate] = []
    }

    const slotIndex = slots.value[slotDate].findIndex(
      s => s.id === parseInt(updatedSlot.id)
    )

    const normalizedSlot: CalendarSlot = {
      id: parseInt(updatedSlot.id),
      date: slotDate,
      start: updatedSlot.start_time || updatedSlot.start,
      end: updatedSlot.end_time || updatedSlot.end,
      status: updatedSlot.status || 'available',
      source: updatedSlot.source,
      template_id: updatedSlot.template_id,
      override_reason: updatedSlot.override_reason,
      created_at: updatedSlot.created_at || new Date().toISOString(),
      updated_at: updatedSlot.updated_at || new Date().toISOString()
    }

    if (slotIndex >= 0) {
      slots.value[slotDate][slotIndex] = normalizedSlot
    } else {
      slots.value[slotDate].push(normalizedSlot)
    }
  }

  function removeSlotFromState(slotId: number) {
    Object.keys(slots.value).forEach(date => {
      slots.value[date] = slots.value[date].filter(s => s.id !== slotId)
      
      // Clean up empty date entries
      if (slots.value[date].length === 0) {
        delete slots.value[date]
      }
    })
  }

  function getSlotsForDate(date: string): CalendarSlot[] {
    return slots.value[date] || []
  }

  function getSlotsForDay(dayOfWeek: number): CalendarSlot[] {
    const daySlots: CalendarSlot[] = []
    
    Object.entries(slots.value).forEach(([dateStr, dateSlots]) => {
      const date = new Date(dateStr)
      const slotDay = date.getDay() === 0 ? 7 : date.getDay() // ISO 8601
      
      if (slotDay === dayOfWeek) {
        daySlots.push(...dateSlots)
      }
    })
    
    return daySlots
  }
  
  function findSlotById(slotId: number): CalendarSlot | undefined {
    for (const dateSlots of Object.values(slots.value)) {
      const slot = dateSlots.find(s => s.id === slotId)
      if (slot) return slot
    }
    return undefined
  }
  
  async function undoLastAction() {
    if (!undoRedo.canUndo.value) {
      throw new Error('Nothing to undo')
    }
    
    isLoading.value = true
    try {
      const result = await undoRedo.undo()
      logSlotUndo()
      
      // Apply local snapshot immediately without network call
      if (result) {
        if (Array.isArray(result)) {
          result.forEach(slot => refreshSlot(slot))
        } else {
          refreshSlot(result)
        }
      }
      
      // No background network validation - trust local snapshots
      console.info('[SlotStore] Undo applied from local snapshot')
    } finally {
      isLoading.value = false
    }
  }
  
  async function redoLastAction() {
    if (!undoRedo.canRedo.value) {
      throw new Error('Nothing to redo')
    }
    
    isLoading.value = true
    try {
      const result = await undoRedo.redo()
      logSlotRedo()
      
      // Apply local snapshot immediately without network call
      if (result) {
        if (Array.isArray(result)) {
          result.forEach(slot => refreshSlot(slot))
        } else {
          refreshSlot(result)
        }
      }
      
      // No background network validation - trust local snapshots
      console.info('[SlotStore] Redo applied from local snapshot')
    } finally {
      isLoading.value = false
    }
  }

  function setEditingSlot(slot: Slot | null) {
    editingSlot.value = slot
  }

  function clearError() {
    error.value = null
  }

  function setDraftSchedule(schedule: Record<number, { start: string; end: string }[]> | null) {
    draftSchedule.value = schedule
    hasTemplateChanges.value = schedule !== null
  }

  function clearDraftSchedule() {
    draftSchedule.value = null
    hasTemplateChanges.value = false
  }

  function $reset() {
    slots.value = {}
    editingSlot.value = null
    isLoading.value = false
    error.value = null
    draftSchedule.value = null
    hasTemplateChanges.value = false
    undoRedo.clear()
  }

  return {
    // State
    slots,
    editingSlot,
    isLoading,
    error,
    draftSchedule,
    hasTemplateChanges,
    
    // Computed
    allSlots,
    availableSlots,
    bookedSlots,
    
    // Undo/Redo
    canUndo: undoRedo.canUndo,
    canRedo: undoRedo.canRedo,
    lastCommand: undoRedo.lastCommand,
    
    // Actions
    loadSlots,
    updateSlot,
    deleteSlot,
    batchUpdateSlots,
    refreshSlot,
    removeSlotFromState,
    getSlotsForDate,
    getSlotsForDay,
    findSlotById,
    setEditingSlot,
    clearError,
    undoLastAction,
    redoLastAction,
    setDraftSchedule,
    clearDraftSchedule,
    $reset,
  }
})
