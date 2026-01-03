/**
 * useDragDrop - Composable for drag & drop lesson rescheduling
 * 
 * Implements preview/confirm pattern for safe rescheduling.
 * Always refetches snapshot after confirm.
 * 
 * @module useDragDrop
 */

import { ref } from 'vue'
import { useCalendarWeekStore } from '@/modules/booking/stores/calendarWeekStore'
import { useToast } from '@/composables/useToast'
import type { CalendarEvent, ReschedulePreviewResponse } from '@/modules/booking/types/calendarV055'

interface DragState {
  isDragging: boolean
  draggedEvent: CalendarEvent | null
  previewSlot: { start: string; end: string } | null
  previewResult: ReschedulePreviewResponse | null
}

export const useDragDrop = () => {
  const store = useCalendarWeekStore()
  const toast = useToast()
  
  const state = ref<DragState>({
    isDragging: false,
    draggedEvent: null,
    previewSlot: null,
    previewResult: null
  })

  const isLoading = ref(false)
  const error = ref<string | null>(null)

  /**
   * Start dragging an event
   */
  const startDrag = (event: CalendarEvent) => {
    state.value.isDragging = true
    state.value.draggedEvent = event
    state.value.previewSlot = null
    state.value.previewResult = null
    error.value = null
  }

  /**
   * Update preview slot position during drag
   */
  const updatePreview = (slot: { start: string; end: string }) => {
    state.value.previewSlot = slot
  }

  /**
   * Check if reschedule is allowed (preview)
   */
  const checkPreview = async (): Promise<ReschedulePreviewResponse | null> => {
    if (!state.value.draggedEvent || !state.value.previewSlot) {
      return null
    }

    isLoading.value = true
    error.value = null

    try {
      // Call preview API
      const response = await store.reschedulePreview(
        state.value.draggedEvent.id,
        {
          target_start: state.value.previewSlot.start,
          target_end: state.value.previewSlot.end
        }
      )

      state.value.previewResult = response
      return response
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Preview failed'
      state.value.previewResult = {
        allowed: false,
        conflicts: [{ type: 'booking_exists', reason: error.value }],
        warnings: []
      }
      return null
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Confirm reschedule and refetch snapshot
   */
  const confirmDrop = async (onSuccess?: () => void): Promise<boolean> => {
    if (!state.value.draggedEvent || !state.value.previewSlot) {
      error.value = 'No event or target slot'
      return false
    }

    if (!state.value.previewResult?.allowed) {
      error.value = 'Reschedule not allowed'
      return false
    }

    isLoading.value = true
    error.value = null

    try {
      // Call confirm API and trigger refetch
      await store.rescheduleConfirm(
        state.value.draggedEvent.id,
        {
          target_start: state.value.previewSlot.start,
          target_end: state.value.previewSlot.end
        }
      )

      toast.success('Урок успішно перенесено')

      if (onSuccess) {
        onSuccess()
      }

      cancelDrag()
      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Confirm failed'
      return false
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Cancel drag operation
   */
  const cancelDrag = () => {
    state.value.isDragging = false
    state.value.draggedEvent = null
    state.value.previewSlot = null
    state.value.previewResult = null
    error.value = null
  }

  /**
   * Calculate target slot from mouse position
   */
  const calculateTargetSlot = (
    mouseY: number,
    containerTop: number,
    pxPerMinute: number,
    duration: number
  ): { start: string; end: string } => {
    const minutesFromTop = Math.round((mouseY - containerTop) / pxPerMinute)
    
    // Snap to 5-minute intervals
    const snappedMinutes = Math.round(minutesFromTop / 5) * 5
    
    const startDate = new Date()
    startDate.setHours(0, snappedMinutes, 0, 0)
    
    const endDate = new Date(startDate.getTime() + duration * 60000)
    
    return {
      start: startDate.toISOString(),
      end: endDate.toISOString()
    }
  }

  return {
    // State
    isDragging: () => state.value.isDragging,
    draggedEvent: () => state.value.draggedEvent,
    previewSlot: () => state.value.previewSlot,
    previewResult: () => state.value.previewResult,
    isLoading: () => isLoading.value,
    error: () => error.value,

    // Actions
    startDrag,
    updatePreview,
    checkPreview,
    confirmDrop,
    cancelDrag,
    calculateTargetSlot
  }
}
