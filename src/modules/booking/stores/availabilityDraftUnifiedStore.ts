/**
 * Unified Availability Draft Store
 * Single source of truth for all draft availability changes
 * Replaces both availabilityDraftStore and useSlotEditor draft state
 * 
 * Reference: backend/docs/plan/v0.59.1/IMPLEMENTATION_REPORT_draft_only_flow.md
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { calendarAvailabilityApi } from '@/modules/booking/api/calendarAvailabilityApi'
import type {
  DraftSlot as CalendarDraftSlot,
  ConflictEntry,
  WorkloadProgress,
  CreateDraftResponse,
  ApplyDraftResponse,
} from '@/modules/booking/api/calendarAvailabilityApi'
import { useCalendarWeekStore } from './calendarWeekStore'

export type AvailabilityMode = 'idle' | 'edit' | 'applying'

interface DraftChange {
  id: string
  type: 'add' | 'remove'
  slotId?: number
  start?: string
  end?: string
  status?: 'available' | 'blocked'
  tempId?: string
}

export const useAvailabilityDraftUnifiedStore = defineStore('availabilityDraftUnified', () => {
  const calendarStore = useCalendarWeekStore()

  // --- State ---
  const mode = ref<AvailabilityMode>('idle')
  const weekStart = ref<string | null>(null)
  const timezone = ref<string | null>(null)
  const token = ref<string | null>(null)

  const changes = ref<DraftChange[]>([])
  const workloadProgress = ref<WorkloadProgress | null>(null)
  const conflicts = ref<ConflictEntry[]>([])
  const error = ref<string | null>(null)
  const isLoading = ref(false)
  const isSaving = ref(false)

  // History stack (для undo/redo)
  const history = ref<DraftChange[][]>([[]])
  const historyIndex = ref(0)

  // --- Computed ---
  const isEditMode = computed(() => mode.value === 'edit')
  const hasChanges = computed(() => changes.value.length > 0)
  const hasConflicts = computed(() => conflicts.value.length > 0)
  const canUndo = computed(() => historyIndex.value > 0)
  const canRedo = computed(() => historyIndex.value < history.value.length - 1)

  const toAdd = computed(() => changes.value.filter(c => c.type === 'add'))
  const toRemove = computed(() => changes.value.filter(c => c.type === 'remove'))
  const removedIds = computed(() => toRemove.value.map(c => c.slotId!).filter(Boolean))
  const changeCount = computed(() => changes.value.length)

  const addedSlots = computed(() => toAdd.value)
  const removedSlots = computed(() => toRemove.value)

  // Backward compatibility: expose slots as CalendarDraftSlot[] for CalendarBoardV2
  const slots = computed(() => {
    return changes.value.map(change => {
      if (change.type === 'add') {
        return {
          slotId: null,
          start: change.start!,
          end: change.end!,
          status: change.status ?? 'available',
          tempId: change.tempId,
        } as CalendarDraftSlot
      }
      return {
        slotId: change.slotId!,
        action: 'remove' as const,
        start: change.start || '',
        end: change.end || '',
      } as CalendarDraftSlot
    })
  })

  const hoursDelta = computed(() => {
    const added = toAdd.value.reduce((sum, change) => {
      if (!change.start || !change.end) return sum
      const start = new Date(change.start)
      const end = new Date(change.end)
      return sum + (end.getTime() - start.getTime()) / (1000 * 60 * 60)
    }, 0)

    const removed = toRemove.value.reduce((sum, change) => {
      if (!change.start || !change.end) return sum
      const start = new Date(change.start)
      const end = new Date(change.end)
      return sum + (end.getTime() - start.getTime()) / (1000 * 60 * 60)
    }, 0)

    return added - removed
  })

  // --- Actions ---
  function enterEditMode(initialWeekStart: string, tz?: string) {
    mode.value = 'edit'
    weekStart.value = initialWeekStart
    timezone.value = tz || Intl.DateTimeFormat().resolvedOptions().timeZone
    resetState()
  }

  function resetState() {
    changes.value = []
    history.value = [[]]
    historyIndex.value = 0
    conflicts.value = []
    error.value = null
    token.value = null
    calendarStore.clearDeletedSlots()
  }

  function exitMode() {
    mode.value = 'idle'
    weekStart.value = null
    timezone.value = null
    resetState()
  }

  function generateId(): string {
    return `draft-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  function addSlot(start: string, end: string, status: 'available' | 'blocked' = 'available') {
    const change: DraftChange = {
      id: generateId(),
      type: 'add',
      start,
      end,
      status,
      tempId: generateId(),
    }

    pushChange(change)
    return change
  }

  function markSlotForDeletion(slotId: number, start?: string, end?: string) {
    const change: DraftChange = {
      id: generateId(),
      type: 'remove',
      slotId,
      start,
      end,
    }

    pushChange(change)
    calendarStore.markSlotAsDeleted(slotId)
  }

  function toggleSlot(slotId: number, start: string, end: string) {
    const existing = changes.value.find(c => c.slotId === slotId && c.type === 'remove')

    if (existing) {
      const index = changes.value.indexOf(existing)
      changes.value.splice(index, 1)
      calendarStore.clearDeletedSlots()
    } else {
      markSlotForDeletion(slotId, start, end)
    }

    saveHistorySnapshot()
  }

  function removeSlot(slotId?: number, tempId?: string) {
    if (tempId) {
      const index = changes.value.findIndex(c => c.tempId === tempId)
      if (index !== -1) {
        changes.value.splice(index, 1)
        saveHistorySnapshot()
      }
    } else if (slotId) {
      const existing = changes.value.find(c => c.slotId === slotId)
      if (existing) {
        existing.type = 'remove'
      } else {
        markSlotForDeletion(slotId)
      }
      saveHistorySnapshot()
    }
  }

  function pushChange(change: DraftChange) {
    changes.value = [...changes.value, change]
    saveHistorySnapshot()
  }

  function saveHistorySnapshot() {
    history.value = history.value.slice(0, historyIndex.value + 1)
    history.value.push(JSON.parse(JSON.stringify(changes.value)))
    historyIndex.value++

    if (history.value.length > 50) {
      history.value.shift()
      historyIndex.value--
    }
  }

  function undo() {
    if (historyIndex.value === 0) return
    historyIndex.value--
    changes.value = JSON.parse(JSON.stringify(history.value[historyIndex.value]))
  }

  function redo() {
    if (historyIndex.value >= history.value.length - 1) return
    historyIndex.value++
    changes.value = JSON.parse(JSON.stringify(history.value[historyIndex.value]))
  }

  async function createDraft(weekStartOverride?: string): Promise<CreateDraftResponse> {
    const effectiveWeekStart = weekStartOverride || weekStart.value
    if (!effectiveWeekStart) {
      throw new Error('weekStart is not set')
    }

    isLoading.value = true
    error.value = null

    try {
      const payload: CalendarDraftSlot[] = changes.value.map(change => {
        if (change.type === 'add') {
          return {
            slotId: null,
            start: change.start!,
            end: change.end!,
            status: change.status ?? 'available',
            tempId: change.tempId,
          }
        }
        return {
          slotId: change.slotId!,
          action: 'remove' as const,
          start: change.start || '',
          end: change.end || '',
        }
      })

      console.log('[availabilityDraftUnifiedStore] createDraft payload:', {
        weekStart: effectiveWeekStart,
        slots: payload,
      })

      const response = await calendarAvailabilityApi.createDraft({
        weekStart: effectiveWeekStart,
        slots: payload,
      })

      if (!response || !response.token) {
        throw new Error('Draft API response is missing token')
      }

      token.value = response.token
      conflicts.value = response.conflicts

      return response
    } catch (err: any) {
      error.value = err.response?.data?.detail || err.message || 'Failed to create draft'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function applyDraft(force = false, weekStartOverride?: string): Promise<ApplyDraftResponse> {
    if (!token.value) {
      await createDraft(weekStartOverride)
    }

    if (!token.value) {
      throw new Error('No draft token available')
    }

    isSaving.value = true
    mode.value = 'applying'
    error.value = null

    try {
      const response = await calendarAvailabilityApi.applyDraft(token.value, { force })

      if (response.status === 'applied') {
        workloadProgress.value = response.workloadProgress || null
        exitMode()
      } else if (response.status === 'conflicts') {
        conflicts.value = response.conflicts || []
      }

      return response
    } catch (err: any) {
      error.value = err.response?.data?.detail || err.message || 'Failed to apply draft'

      if (err.response?.status === 409 && err.response?.data?.conflicts) {
        conflicts.value = err.response.data.conflicts
      }

      throw err
    } finally {
      isSaving.value = false
      if (mode.value === 'applying') {
        mode.value = 'edit'
      }
    }
  }

  async function deleteDraft() {
    if (!token.value) {
      return
    }

    try {
      await calendarAvailabilityApi.deleteDraft(token.value)
      exitMode()
    } catch (err: any) {
      console.error('Failed to delete draft:', err)
      exitMode()
    }
  }

  async function loadWorkloadProgress() {
    try {
      const response = await calendarAvailabilityApi.getWorkloadTarget()
      workloadProgress.value = {
        currentHours: 0,
        targetHours: response?.targetHours ?? 20,
        minHours: response?.minHours ?? 10,
        status: 'needs_more',
      }
    } catch (err: any) {
      console.error('Failed to load workload progress:', err)
      workloadProgress.value = {
        currentHours: 0,
        targetHours: 20,
        minHours: 10,
        status: 'needs_more',
      }
    }
  }

  function loadFromSlots(slots: CalendarDraftSlot[], options?: { weekStart?: string; timezone?: string }) {
    const newChanges: DraftChange[] = []

    slots.forEach(slot => {
      if (slot.slotId && slot.action === 'remove') {
        newChanges.push({
          id: generateId(),
          type: 'remove',
          slotId: slot.slotId,
          start: slot.start,
          end: slot.end,
        })
      } else if (slot.start && slot.end) {
        newChanges.push({
          id: generateId(),
          type: 'add',
          start: slot.start,
          end: slot.end,
          status: slot.status || 'available',
          tempId: slot.tempId || generateId(),
        })
      }
    })

    changes.value = newChanges
    if (options?.weekStart) weekStart.value = options.weekStart
    if (options?.timezone) timezone.value = options.timezone
    saveHistorySnapshot()
  }

  return {
    // State
    mode,
    weekStart,
    timezone,
    token,
    changes,
    workloadProgress,
    conflicts,
    error,
    isLoading,
    isSaving,
    history,
    historyIndex,

    // Computed
    isEditMode,
    hasChanges,
    hasConflicts,
    canUndo,
    canRedo,
    toAdd,
    toRemove,
    changeCount,
    removedIds,
    addedSlots,
    removedSlots,
    slots,
    hoursDelta,

    // Actions
    enterEditMode,
    exitMode,
    resetState,
    addSlot,
    markSlotForDeletion,
    toggleSlot,
    removeSlot,
    undo,
    redo,
    createDraft,
    applyDraft,
    deleteDraft,
    loadWorkloadProgress,
    loadFromSlots,
  }
})
