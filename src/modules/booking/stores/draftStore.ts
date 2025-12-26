// Draft store for managing draft bookings and temporary slot selections
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface DraftSlot {
  id?: number
  date: string
  start: string
  end: string
  duration?: number
  studentId?: number
  notes?: string
}

export interface DraftBooking {
  id: string
  slotId?: number
  studentId?: number
  date: string
  start: string
  end: string
  duration: number
  notes?: string
  createdAt: Date
}

export interface DraftPatch {
  startAtUTC: string
  durationMin: number
  action: 'set_available' | 'set_blocked' | 'set_unavailable'
  originalStatus: string
}

export const useDraftStore = defineStore('draft', () => {
  // State
  const drafts = ref<Map<string, DraftBooking>>(new Map())
  const currentDraft = ref<DraftBooking | null>(null)
  const selectedSlots = ref<DraftSlot[]>([])
  const draftPatchByKey = ref<Map<string, DraftPatch>>(new Map())
  
  // Computed
  const hasDrafts = computed(() => drafts.value.size > 0)
  
  const draftsList = computed(() => {
    return Array.from(drafts.value.values()).sort((a, b) => {
      return b.createdAt.getTime() - a.createdAt.getTime()
    })
  })
  
  const hasCurrentDraft = computed(() => currentDraft.value !== null)
  
  const hasSelectedSlots = computed(() => selectedSlots.value.length > 0)
  
  const isDirty = computed(() => draftPatchByKey.value.size > 0)
  
  // Actions
  function createDraft(data: Omit<DraftBooking, 'id' | 'createdAt'>): DraftBooking {
    const draft: DraftBooking = {
      ...data,
      id: generateDraftId(),
      createdAt: new Date(),
    }
    
    drafts.value.set(draft.id, draft)
    currentDraft.value = draft
    
    return draft
  }
  
  function updateDraft(id: string, updates: Partial<DraftBooking>): void {
    const draft = drafts.value.get(id)
    if (!draft) return
    
    const updated = { ...draft, ...updates }
    drafts.value.set(id, updated)
    
    if (currentDraft.value?.id === id) {
      currentDraft.value = updated
    }
  }
  
  function deleteDraft(id: string): void {
    drafts.value.delete(id)
    
    if (currentDraft.value?.id === id) {
      currentDraft.value = null
    }
  }
  
  function setCurrentDraft(draft: DraftBooking | null): void {
    currentDraft.value = draft
  }
  
  function clearCurrentDraft(): void {
    currentDraft.value = null
  }
  
  function addSelectedSlot(slot: DraftSlot): void {
    const exists = selectedSlots.value.find(s => 
      s.date === slot.date && s.start === slot.start
    )
    
    if (!exists) {
      selectedSlots.value.push(slot)
    }
  }
  
  function removeSelectedSlot(date: string, start: string): void {
    selectedSlots.value = selectedSlots.value.filter(s => 
      !(s.date === date && s.start === start)
    )
  }
  
  function clearSelectedSlots(): void {
    selectedSlots.value = []
  }
  
  function selectSlots(slots: DraftSlot[]): void {
    selectedSlots.value = [...slots]
  }
  
  function clearAllDrafts(): void {
    drafts.value.clear()
    currentDraft.value = null
    selectedSlots.value = []
  }
  
  function generateDraftId(): string {
    return `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
  
  // Draft patch methods for compatibility with tests
  function addPatch(cell: any, action: 'set_available' | 'set_blocked' | 'set_unavailable'): void {
    const patch: DraftPatch = {
      startAtUTC: cell.startAtUTC,
      durationMin: cell.durationMin || 30,
      action,
      originalStatus: cell.status || 'empty',
    }
    draftPatchByKey.value.set(cell.startAtUTC, patch)
  }
  
  function removePatch(key: string): void {
    draftPatchByKey.value.delete(key)
  }
  
  function clearAllPatches(): void {
    draftPatchByKey.value.clear()
  }
  
  function getPatch(key: string): DraftPatch | undefined {
    return draftPatchByKey.value.get(key)
  }
  
  function getAllPatches(): DraftPatch[] {
    return Array.from(draftPatchByKey.value.values())
  }
  
  async function applyPatches(): Promise<{
    summary: { total: number; applied: number; rejected: number }
    applied: any[]
    rejected: any[]
  }> {
    const patches = getAllPatches()
    return {
      summary: {
        total: patches.length,
        applied: 0,
        rejected: 0,
      },
      applied: [],
      rejected: [],
    }
  }
  
  function $reset(): void {
    drafts.value.clear()
    currentDraft.value = null
    selectedSlots.value = []
    draftPatchByKey.value.clear()
  }
  
  return {
    // State
    drafts,
    currentDraft,
    selectedSlots,
    draftPatchByKey,
    
    // Computed
    hasDrafts,
    draftsList,
    hasCurrentDraft,
    hasSelectedSlots,
    isDirty,
    
    // Actions
    createDraft,
    updateDraft,
    deleteDraft,
    setCurrentDraft,
    clearCurrentDraft,
    addSelectedSlot,
    removeSelectedSlot,
    clearSelectedSlots,
    selectSlots,
    clearAllDrafts,
    addPatch,
    removePatch,
    clearAllPatches,
    getPatch,
    getAllPatches,
    applyPatches,
    $reset,
  }
})
