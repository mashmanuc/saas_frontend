import { ref } from 'vue'
import api from '@/utils/apiClient'
import { useToast } from '@/composables/useToast'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useCalendarWeekStore } from '@/modules/booking/stores/calendarWeekStore'
import type { Slot, SlotEditStrategy, Conflict } from '@/modules/booking/types/slot'
import type { AccessibleSlot } from '@/modules/booking/types/calendarWeek'
import { calendarAccessibleSlotsApi } from '@/modules/booking/api/calendarAccessibleSlotsApi'
import type { AccessibleSlot as AccessibleSlotV055 } from '@/modules/booking/types/calendarV055'

export function useSlotEditor() {
  const { t } = useI18n()
  const toast = useToast()
  const calendarStore = useCalendarWeekStore()
  const { accessible } = storeToRefs(calendarStore)
  
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
  ): Promise<AccessibleSlotV055> {
    isLoading.value = true
    
    console.log('[useSlotEditor] editSlot called:', { slotId, newStart, newEnd, strategy, overrideReason })
    
    // Optimistic update: remove slot temporarily
    const slotIdNum = parseInt(slotId)
    calendarStore.removeOptimisticSlot(slotIdNum)
    
    try {
      // Call v0.55.7 CalendarAccessibleSlot API
      const updatedSlot = await calendarAccessibleSlotsApi.updateSlot(
        slotIdNum,
        {
          start: newStart,
          end: newEnd
        }
      )
      
      console.log('[useSlotEditor] editSlot response:', updatedSlot)
      
      // Refresh snapshot to get updated data
      if (calendarStore.currentTutorId && calendarStore.currentWeekStart) {
        await calendarStore.fetchWeekSnapshot(
          calendarStore.currentTutorId,
          calendarStore.currentWeekStart,
          true // force refresh
        )
      }
      
      toast.success(t('calendar.slotEditor.saveSuccess'))
      
      // Convert to AccessibleSlotV055 format
      return {
        id: updatedSlot.id,
        start: updatedSlot.start,
        end: updatedSlot.end,
        is_recurring: updatedSlot.is_recurring
      }
      
    } catch (error: any) {
      console.error('[useSlotEditor] editSlot error:', error)
      
      // Revert optimistic update - refresh snapshot
      if (calendarStore.currentTutorId && calendarStore.currentWeekStart) {
        await calendarStore.fetchWeekSnapshot(
          calendarStore.currentTutorId,
          calendarStore.currentWeekStart,
          true
        )
      }
      
      if (error.status === 409 || error.response?.status === 409) {
        toast.error(t('calendar.slotEditor.conflictError'))
        throw new ConflictError(error.data?.conflicts || [])
      } else if (error.status === 400 || error.response?.status === 400) {
        toast.error(t('calendar.slotEditor.validationError'))
        throw error
      } else {
        toast.error(t('calendar.slotEditor.saveError'))
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
      // Call v0.55 API endpoint for conflict detection
      const response = await api.post('/v1/booking/slots/check-conflicts/', {
        date: slotDate,
        start_time: newStart,
        end_time: newEnd,
        exclude_slot_id: parseInt(slotId)
      })
      
      // Response is already unwrapped by axios interceptor
      const data = response as any
      return Array.isArray(data) ? data : (data?.conflicts || [])
      
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
    
    console.log('[useSlotEditor] deleteSlot called:', slotId)
    
    // Optimistic update: remove slot immediately
    calendarStore.removeOptimisticSlot(slotId)
    
    try {
      // Call v0.55.7 CalendarAccessibleSlot API
      await calendarAccessibleSlotsApi.deleteSlot(slotId)
      
      console.log('[useSlotEditor] deleteSlot success')
      
      // Refresh snapshot to get updated data
      if (calendarStore.currentTutorId && calendarStore.currentWeekStart) {
        await calendarStore.fetchWeekSnapshot(
          calendarStore.currentTutorId,
          calendarStore.currentWeekStart,
          true // force refresh
        )
      }
      
      toast.success(t('calendar.slotEditor.deleteSuccess'))
      
    } catch (error: any) {
      console.error('[useSlotEditor] deleteSlot error:', error)
      
      // Revert optimistic update on error
      if (calendarStore.currentTutorId && calendarStore.currentWeekStart) {
        await calendarStore.fetchWeekSnapshot(
          calendarStore.currentTutorId,
          calendarStore.currentWeekStart,
          true
        )
      }
      
      if (error.status === 409 || error.response?.status === 409) {
        toast.error(t('calendar.slotEditor.deleteConflictError'))
      } else {
        toast.error(t('calendar.slotEditor.deleteError'))
      }
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
      // Call v0.55 API endpoint for batch editing
      const response = await api.post('/v1/booking/slots/batch-edit/', {
        slots: slotIds,
        start_time: startTime,
        end_time: endTime,
        strategy,
        override_reason: overrideReason
      })
      
      // Refresh snapshot to get updated data
      if (calendarStore.currentTutorId && calendarStore.currentWeekStart) {
        await calendarStore.fetchWeekSnapshot(calendarStore.currentTutorId, calendarStore.currentWeekStart)
      }
      
      const data = response as any
      
      if (data.conflicts && data.conflicts.length > 0) {
        toast.warning(
          t('calendar.slotEditor.batchPartialSuccess', {
            success: data.updated_count,
            error: data.conflicts.length
          })
        )
      } else {
        toast.success(t('calendar.slotEditor.batchSuccess'))
      }
      
      return {
        updated_count: data.updated_count || 0,
        updated_slots: data.updated_slots || [],
        warnings: data.warnings || [],
        conflicts: data.conflicts || []
      }
      
    } catch (error) {
      toast.error(t('calendar.slotEditor.batchError'))
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
