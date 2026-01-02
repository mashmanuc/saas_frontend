/**
 * Availability Draft Store v0.55.7
 * Manages draft availability slots with undo/redo support
 * 
 * Reference: backend/docs/plan/v0.55.7/frontend_task.md
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { calendarAvailabilityApi } from '@/modules/booking/api/calendarAvailabilityApi'
import type {
  DraftSlot,
  ConflictEntry,
  WorkloadProgress,
  CreateDraftResponse,
  ApplyDraftResponse,
} from '@/modules/booking/api/calendarAvailabilityApi'

export type AvailabilityMode = 'idle' | 'edit'

interface DraftState {
  mode: AvailabilityMode
  draftToken: string | null
  slots: DraftSlot[]
  workloadProgress: WorkloadProgress | null
  conflicts: ConflictEntry[]
  isSaving: boolean
  isLoading: boolean
  error: string | null
  history: DraftSlot[][]
  historyIndex: number
}

export const useAvailabilityDraftStore = defineStore('availabilityDraft', () => {
  // State
  const mode = ref<AvailabilityMode>('idle')
  const draftToken = ref<string | null>(null)
  const slots = ref<DraftSlot[]>([])
  const workloadProgress = ref<WorkloadProgress | null>(null)
  const conflicts = ref<ConflictEntry[]>([])
  const isSaving = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const history = ref<DraftSlot[][]>([])
  const historyIndex = ref(-1)

  // Computed
  const isEditMode = computed(() => mode.value === 'edit')
  const hasChanges = computed(() => slots.value.length > 0)
  const hasConflicts = computed(() => conflicts.value.length > 0)
  const canUndo = computed(() => historyIndex.value > 0)
  const canRedo = computed(() => historyIndex.value < history.value.length - 1)
  
  const addedSlots = computed(() => 
    slots.value.filter(s => !s.slotId || s.action !== 'remove')
  )
  
  const removedSlots = computed(() => 
    slots.value.filter(s => s.slotId && s.action === 'remove')
  )
  
  const hoursDelta = computed(() => {
    const added = addedSlots.value.reduce((sum, slot) => {
      const start = new Date(slot.start)
      const end = new Date(slot.end)
      return sum + (end.getTime() - start.getTime()) / (1000 * 60 * 60)
    }, 0)
    
    const removed = removedSlots.value.reduce((sum, slot) => {
      const start = new Date(slot.start)
      const end = new Date(slot.end)
      return sum + (end.getTime() - start.getTime()) / (1000 * 60 * 60)
    }, 0)
    
    return added - removed
  })

  // Actions
  function enterMode() {
    mode.value = 'edit'
    slots.value = []
    conflicts.value = []
    error.value = null
    history.value = [[]]
    historyIndex.value = 0
  }

  function exitMode() {
    mode.value = 'idle'
    draftToken.value = null
    slots.value = []
    conflicts.value = []
    error.value = null
    history.value = []
    historyIndex.value = -1
  }

  function generateTempId(): string {
    return `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  function addSlot(start: string, end: string, status: 'available' | 'blocked' = 'available') {
    console.log('[availabilityDraftStore] addSlot called:', { start, end, status })
    console.log('[availabilityDraftStore] slots.value before:', JSON.parse(JSON.stringify(slots.value)))
    
    const newSlot: DraftSlot = {
      tempId: generateTempId(),
      start,
      end,
      status,
    }
    
    slots.value.push(newSlot)
    console.log('[availabilityDraftStore] slots.value after push:', JSON.parse(JSON.stringify(slots.value)))
    
    saveToHistory()
    
    console.log('[availabilityDraftStore] Returning newSlot:', newSlot)
    return newSlot
  }

  function removeSlot(slotId?: number, tempId?: string) {
    if (tempId) {
      // Remove draft slot
      const index = slots.value.findIndex(s => s.tempId === tempId)
      if (index !== -1) {
        slots.value.splice(index, 1)
        saveToHistory()
      }
    } else if (slotId) {
      // Mark existing slot for removal
      const existing = slots.value.find(s => s.slotId === slotId)
      if (existing) {
        existing.action = 'remove'
      } else {
        slots.value.push({
          slotId,
          action: 'remove',
          start: '', // Will be filled from backend
          end: '',
        })
      }
      saveToHistory()
    }
  }

  function toggleSlot(slotId: number, start: string, end: string) {
    const existing = slots.value.find(s => s.slotId === slotId)
    
    if (existing) {
      // Remove from draft
      const index = slots.value.indexOf(existing)
      slots.value.splice(index, 1)
    } else {
      // Add to removal list
      slots.value.push({
        slotId,
        action: 'remove',
        start,
        end,
      })
    }
    
    saveToHistory()
  }

  function saveToHistory() {
    // Truncate history after current index
    history.value = history.value.slice(0, historyIndex.value + 1)
    
    // Add current state
    history.value.push(JSON.parse(JSON.stringify(slots.value)))
    historyIndex.value++
    
    // Limit history size
    if (history.value.length > 50) {
      history.value.shift()
      historyIndex.value--
    }
  }

  function undo() {
    if (canUndo.value) {
      historyIndex.value--
      slots.value = JSON.parse(JSON.stringify(history.value[historyIndex.value]))
    }
  }

  function redo() {
    if (canRedo.value) {
      historyIndex.value++
      slots.value = JSON.parse(JSON.stringify(history.value[historyIndex.value]))
    }
  }

  async function createDraft(weekStart: string): Promise<CreateDraftResponse> {
    isLoading.value = true
    error.value = null
    
    try {
      console.log('[availabilityDraftStore] createDraft payload weekStart:', weekStart)
      console.log('[availabilityDraftStore] createDraft payload slots:', JSON.parse(JSON.stringify(slots.value)))
      const response = await calendarAvailabilityApi.createDraft({
        weekStart,
        slots: slots.value,
      })

      if (!response || !response.token) {
        throw new Error('Draft API response is missing token')
      }
      
      draftToken.value = response.token
      conflicts.value = response.conflicts
      
      return response
    } catch (err: any) {
      error.value = err.response?.data?.detail || err.message || 'Failed to create draft'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function applyDraft(force = false): Promise<ApplyDraftResponse> {
    if (!draftToken.value) {
      throw new Error('No draft token available')
    }
    
    isSaving.value = true
    error.value = null
    
    try {
      const response = await calendarAvailabilityApi.applyDraft(draftToken.value, { force })
      
      if (response.status === 'applied') {
        workloadProgress.value = response.workloadProgress || null
        exitMode()
      } else if (response.status === 'conflicts') {
        conflicts.value = response.conflicts || []
      }
      
      return response
    } catch (err: any) {
      error.value = err.response?.data?.detail || err.message || 'Failed to apply draft'
      
      // Handle 409 conflicts
      if (err.response?.status === 409 && err.response?.data?.conflicts) {
        conflicts.value = err.response.data.conflicts
      }
      
      throw err
    } finally {
      isSaving.value = false
    }
  }

  async function deleteDraft() {
    if (!draftToken.value) {
      return
    }
    
    try {
      await calendarAvailabilityApi.deleteDraft(draftToken.value)
      exitMode()
    } catch (err: any) {
      console.error('Failed to delete draft:', err)
      // Don't throw - allow user to exit anyway
      exitMode()
    }
  }

  async function checkConflicts(weekStart?: string) {
    isLoading.value = true
    error.value = null
    
    try {
      const response = await calendarAvailabilityApi.checkConflicts({
        weekStart,
        slots: slots.value.map(s => ({
          start: s.start,
          end: s.end,
          slotId: s.slotId,
        })),
      })
      
      conflicts.value = response.conflicts
      return response
    } catch (err: any) {
      error.value = err.response?.data?.detail || err.message || 'Failed to check conflicts'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function loadWorkloadProgress() {
    try {
      const response = await calendarAvailabilityApi.getWorkloadTarget()
      workloadProgress.value = {
        currentHours: 0, // Will be calculated from snapshot
        targetHours: response?.targetHours ?? 20,
        minHours: response?.minHours ?? 10,
        status: 'needs_more',
      }
    } catch (err: any) {
      console.error('Failed to load workload progress:', err)
      // Set fallback values to prevent undefined errors
      workloadProgress.value = {
        currentHours: 0,
        targetHours: 20,
        minHours: 10,
        status: 'needs_more',
      }
    }
  }

  function reset() {
    exitMode()
  }

  return {
    // State
    mode,
    draftToken,
    slots,
    workloadProgress,
    conflicts,
    isSaving,
    isLoading,
    error,
    
    // Computed
    isEditMode,
    hasChanges,
    hasConflicts,
    canUndo,
    canRedo,
    addedSlots,
    removedSlots,
    hoursDelta,
    
    // Actions
    enterMode,
    exitMode,
    addSlot,
    removeSlot,
    toggleSlot,
    undo,
    redo,
    createDraft,
    applyDraft,
    deleteDraft,
    checkConflicts,
    loadWorkloadProgress,
    reset,
  }
})
