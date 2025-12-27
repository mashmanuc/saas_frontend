import { ref } from 'vue'
import { bookingApi } from '@/modules/booking/api/booking'
import { useToast } from '@/composables/useToast'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useCalendarWeekStore } from '@/modules/booking/stores/calendarWeekStore'
import type { Slot, SlotEditStrategy, Conflict } from '@/modules/booking/types/slot'
import type { AccessibleSlot } from '@/modules/booking/types/calendarWeek'

export function useSlotEditor() {
  const { t } = useI18n()
  const toast = useToast()
  const calendarStore = useCalendarWeekStore()
  const { accessibleById, weekMeta } = storeToRefs(calendarStore)
  
  const isLoading = ref(false)
  const currentSlot = ref<Slot | null>(null)
  
  /**
   * Edit a slot with conflict detection
   */
  async function editSlot(
    slotId: string,
    newStart: string,
    newEnd: string,
    strategy: SlotEditStrategy = 'override',
    overrideReason?: string
  ): Promise<Slot> {
    isLoading.value = true
    
    console.log('[useSlotEditor] editSlot called:', { slotId, newStart, newEnd, strategy, overrideReason })
    
    // Optimistic update: update slot immediately
    const slotIdNum = parseInt(slotId)
    const existingSlot = accessibleById.value?.[slotIdNum]
    let previousSlot: AccessibleSlot | undefined
    
    if (existingSlot) {
      previousSlot = { ...existingSlot }
      const date = existingSlot.start.slice(0, 10)
      const offset = existingSlot.start.length > 19 ? existingSlot.start.slice(19) : ''
      
      const updatedSlot: AccessibleSlot = {
        ...existingSlot,
        start: `${date}T${newStart}:00${offset}`,
        end: `${date}T${newEnd}:00${offset}`
      }
      
      calendarStore.removeOptimisticSlot(slotIdNum)
      calendarStore.addOptimisticSlot(updatedSlot)
    }
    
    try {
      const response = await bookingApi.editSlot(slotId, {
        start_time: newStart,
        end_time: newEnd,
        strategy,
        override_reason: overrideReason
      })
      
      console.log('[useSlotEditor] editSlot response:', response)
      toast.success(t('availability.slotEditor.saveSuccess'))
      return response
      
    } catch (error: any) {
      console.error('[useSlotEditor] editSlot error:', error)
      
      // Revert optimistic update if we had one
      if (previousSlot) {
        calendarStore.removeOptimisticSlot(previousSlot.id)
        calendarStore.addOptimisticSlot(previousSlot)
      } else {
        const currentPage = weekMeta.value?.page ?? 0
        calendarStore.fetchWeek(currentPage)
      }
      
      if (error.status === 409) {
        toast.error(t('availability.slotEditor.conflictError'))
        throw new ConflictError(error.data.conflicts)
      } else {
        toast.error(t('availability.slotEditor.saveError'))
        throw error
      }
    } finally {
      isLoading.value = false
    }
  }
  
  /**
   * Detect conflicts before saving
   */
  async function detectConflicts(
    slotId: string,
    slotDate: string,
    newStart: string,
    newEnd: string
  ): Promise<Conflict[]> {
    try {
      const response = await bookingApi.checkSlotConflicts({
        date: slotDate,
        start_time: newStart,
        end_time: newEnd,
        exclude_slot_id: parseInt(slotId)
      })
      
      // Response is already unwrapped by axios interceptor
      return Array.isArray(response) ? response : (response?.conflicts || [])
      
    } catch (error) {
      console.error('Failed to detect conflicts:', error)
      return []
    }
  }
  
  /**
   * Delete a slot
   */
  async function deleteSlot(slotId: number): Promise<void> {
    isLoading.value = true
    
    try {
      await bookingApi.deleteSlot(slotId)
      toast.success(t('availability.slotEditor.deleteSuccess'))
      
    } catch (error) {
      toast.error(t('availability.slotEditor.deleteError'))
      throw error
    } finally {
      isLoading.value = false
    }
  }
  
  /**
   * Batch edit multiple slots
   */
  async function batchEditSlots(
    slotIds: number[],
    startTime?: string,
    endTime?: string,
    strategy: SlotEditStrategy = 'override',
    overrideReason?: string
  ): Promise<{ updated_count: number; updated_slots: any[]; warnings: string[]; conflicts: string[] }> {
    isLoading.value = true
    
    try {
      const response = await bookingApi.batchEditSlots({
        slots: slotIds,
        start_time: startTime,
        end_time: endTime,
        strategy,
        override_reason: overrideReason
      })
      
      if (response.conflicts.length > 0) {
        toast.warning(
          t('availability.slotEditor.batchPartialSuccess', {
            success: response.updated_count,
            error: response.conflicts.length
          })
        )
      } else {
        toast.success(t('availability.slotEditor.batchSuccess'))
      }
      
      return response
      
    } catch (error) {
      toast.error(t('availability.slotEditor.batchError'))
      throw error
    } finally {
      isLoading.value = false
    }
  }
  
  return {
    isLoading,
    currentSlot,
    editSlot,
    detectConflicts,
    deleteSlot,
    batchEditSlots
  }
}

class ConflictError extends Error {
  conflicts: Conflict[]
  
  constructor(conflicts: Conflict[]) {
    super('Slot edit conflicts detected')
    this.conflicts = conflicts
  }
}
