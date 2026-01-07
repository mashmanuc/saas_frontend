import { ref, computed } from 'vue'
import api from '@/utils/apiClient'
import { useToast } from '@/composables/useToast'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useCalendarWeekStore } from '@/modules/booking/stores/calendarWeekStore'
import { useAvailabilityDraftUnifiedStore } from '@/modules/booking/stores/availabilityDraftUnifiedStore'
import type { Slot, SlotEditStrategy, Conflict } from '@/modules/booking/types/slot'
import type { AccessibleSlot } from '@/modules/booking/types/calendarWeek'
import { calendarAccessibleSlotsApi } from '@/modules/booking/api/calendarAccessibleSlotsApi'
import type { AccessibleSlot as AccessibleSlotV055 } from '@/modules/booking/types/calendarV055'
import type { DraftSlot } from '@/modules/booking/api/availabilityApi'
import type { DraftSlot as CalendarDraftSlot } from '@/modules/booking/api/calendarAvailabilityApi'

const isLoading = ref(false)
const currentSlot = ref<Slot | null>(null)

export function useSlotEditor() {
  const { t } = useI18n()
  const toast = useToast()
  const calendarStore = useCalendarWeekStore()
  const draftStore = useAvailabilityDraftUnifiedStore()
  const { accessible } = storeToRefs(calendarStore)
  
  const hasUnsavedChanges = computed(() => draftStore.hasChanges)
  const draftState = computed(() => ({
    toAdd: draftStore.toAdd.map(c => ({
      slotId: null,
      start: c.start,
      end: c.end,
      status: c.status || 'available'
    })),
    toRemove: draftStore.removedIds,
    hasChanges: draftStore.hasChanges,
    currentToken: draftStore.token,
    weekStartOverride: draftStore.weekStart,
    timezoneOverride: draftStore.timezone
  }))
  
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
   * Mark slot for deletion (draft-only, no immediate DELETE)
   */
  function markSlotForDeletion(slotId: number): void {
    console.log('[useSlotEditor] markSlotForDeletion called:', slotId)
    draftStore.markSlotForDeletion(slotId)
    console.log('[useSlotEditor] Slot marked for deletion:', {
      slotId,
      toRemove: draftStore.removedIds,
      hasChanges: draftStore.hasChanges
    })
  }
  
  /**
   * Add new slot to draft (for future use)
   */
  function addSlotToDraft(slot: DraftSlot): void {
    console.log('[useSlotEditor] addSlotToDraft called:', slot)
    if (slot.start && slot.end) {
      draftStore.addSlot(slot.start, slot.end, slot.status || 'available')
    }
  }

  /**
   * Clear all draft changes
   */
  function clearDraft(): void {
    console.log('[useSlotEditor] clearDraft called')
    draftStore.resetState()
  }

  function loadDraftFromSlots(slots: CalendarDraftSlot[], options?: { weekStart?: string; timezone?: string }) {
    draftStore.loadFromSlots(slots, options)
  }
  
  /**
   * Apply all draft changes (toAdd + toRemove)
   */
  async function applyDraft(force: boolean = false, options?: { weekStart?: string; timezone?: string }): Promise<void> {
    if (!draftStore.hasChanges) {
      console.log('[useSlotEditor] No changes to apply')
      return
    }
    
    const effectiveWeekStart = options?.weekStart || draftStore.weekStart || calendarStore.currentWeekStart
    
    if (!effectiveWeekStart) {
      toast.error(t('calendar.slotEditor.noWeekStart'))
      return
    }
    
    isLoading.value = true
    
    try {
      console.log('[useSlotEditor] Applying draft:', {
        weekStart: effectiveWeekStart,
        changesCount: draftStore.changeCount,
        toAdd: draftStore.toAdd.length,
        toRemove: draftStore.toRemove.length
      })
      
      const applyResponse = await draftStore.applyDraft(force, effectiveWeekStart)
      
      console.log('[useSlotEditor] Draft applied:', applyResponse)
      
      if (applyResponse.status === 'conflicts') {
        console.warn('[useSlotEditor] Conflicts detected:', applyResponse.conflicts)
        throw new DraftConflictError(applyResponse.conflicts || [])
      }
      
      if (calendarStore.currentTutorId && calendarStore.currentWeekStart) {
        await calendarStore.fetchWeekSnapshot(
          calendarStore.currentTutorId,
          calendarStore.currentWeekStart,
          true
        )
      }
      
      toast.success(t('calendar.slotEditor.applySuccess'))
      
    } catch (error: any) {
      console.error('[useSlotEditor] applyDraft error:', error)
      
      if (error instanceof DraftConflictError) {
        throw error
      }
      
      if (error.status === 409 || error.response?.status === 409) {
        const conflicts = error.data?.conflicts || error.response?.data?.conflicts || []
        throw new DraftConflictError(conflicts)
      }
      
      toast.error(t('calendar.slotEditor.applyError'))
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
    draftState,
    hasUnsavedChanges,
    editSlot,
    detectConflicts,
    markSlotForDeletion,
    addSlotToDraft,
    loadDraftFromSlots,
    clearDraft,
    applyDraft,
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

class DraftConflictError extends Error {
  conflicts: any[]
  
  constructor(conflicts: any[]) {
    super('Draft application conflicts detected')
    this.conflicts = conflicts
  }
}
