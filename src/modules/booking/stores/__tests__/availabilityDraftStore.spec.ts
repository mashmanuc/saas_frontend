/**
 * Unit tests for availabilityDraftStore
 * Reference: backend/docs/plan/v0.55.7/frontend_task.md
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAvailabilityDraftStore } from '../availabilityDraftStore'
import { calendarAvailabilityApi } from '@/modules/booking/api/calendarAvailabilityApi'

vi.mock('@/modules/booking/api/calendarAvailabilityApi')

describe('availabilityDraftStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('Mode management', () => {
    it('should start in idle mode', () => {
      const store = useAvailabilityDraftStore()
      expect(store.mode).toBe('idle')
      expect(store.isEditMode).toBe(false)
    })

    it('should enter edit mode', () => {
      const store = useAvailabilityDraftStore()
      store.enterMode()
      
      expect(store.mode).toBe('edit')
      expect(store.isEditMode).toBe(true)
      expect(store.slots).toEqual([])
    })

    it('should exit mode and reset state', () => {
      const store = useAvailabilityDraftStore()
      store.enterMode()
      store.addSlot('2025-01-29T17:00:00Z', '2025-01-29T18:00:00Z')
      
      store.exitMode()
      
      expect(store.mode).toBe('idle')
      expect(store.slots).toEqual([])
      expect(store.draftToken).toBeNull()
    })
  })

  describe('Slot operations', () => {
    it('should add a new slot', () => {
      const store = useAvailabilityDraftStore()
      store.enterMode()
      
      const slot = store.addSlot('2025-01-29T17:00:00Z', '2025-01-29T18:00:00Z')
      
      expect(slot).toHaveProperty('tempId')
      expect(slot.start).toBe('2025-01-29T17:00:00Z')
      expect(slot.end).toBe('2025-01-29T18:00:00Z')
      expect(slot.status).toBe('available')
      expect(store.slots).toHaveLength(1)
      expect(store.hasChanges).toBe(true)
    })

    it('should remove slot by tempId', () => {
      const store = useAvailabilityDraftStore()
      store.enterMode()
      
      const slot = store.addSlot('2025-01-29T17:00:00Z', '2025-01-29T18:00:00Z')
      expect(store.slots).toHaveLength(1)
      
      store.removeSlot(undefined, slot.tempId)
      expect(store.slots).toHaveLength(0)
    })

    it('should mark existing slot for removal', () => {
      const store = useAvailabilityDraftStore()
      store.enterMode()
      
      store.removeSlot(123)
      
      expect(store.slots).toHaveLength(1)
      expect(store.slots[0].slotId).toBe(123)
      expect(store.slots[0].action).toBe('remove')
    })

    it('should toggle slot removal', () => {
      const store = useAvailabilityDraftStore()
      store.enterMode()
      
      store.toggleSlot(123, '2025-01-29T17:00:00Z', '2025-01-29T18:00:00Z')
      expect(store.slots).toHaveLength(1)
      expect(store.slots[0].action).toBe('remove')
      
      store.toggleSlot(123, '2025-01-29T17:00:00Z', '2025-01-29T18:00:00Z')
      expect(store.slots).toHaveLength(0)
    })
  })

  describe('Computed properties', () => {
    it('should calculate addedSlots correctly', () => {
      const store = useAvailabilityDraftStore()
      store.enterMode()
      
      store.addSlot('2025-01-29T17:00:00Z', '2025-01-29T18:00:00Z')
      store.addSlot('2025-01-29T19:00:00Z', '2025-01-29T20:00:00Z')
      store.removeSlot(123)
      
      expect(store.addedSlots).toHaveLength(2)
    })

    it('should calculate removedSlots correctly', () => {
      const store = useAvailabilityDraftStore()
      store.enterMode()
      
      store.addSlot('2025-01-29T17:00:00Z', '2025-01-29T18:00:00Z')
      store.removeSlot(123)
      store.removeSlot(456)
      
      expect(store.removedSlots).toHaveLength(2)
    })

    it('should calculate hoursDelta correctly', () => {
      const store = useAvailabilityDraftStore()
      store.enterMode()
      
      // Add 2 hours
      store.addSlot('2025-01-29T17:00:00Z', '2025-01-29T19:00:00Z')
      
      expect(store.hoursDelta).toBe(2)
    })
  })

  describe('History and undo/redo', () => {
    it('should update undo state on slot changes', () => {
      const store = useAvailabilityDraftStore()
      store.enterMode()
      
      expect(store.canUndo).toBe(false)
      expect(store.canRedo).toBe(false)
      
      store.addSlot('2025-01-29T17:00:00Z', '2025-01-29T18:00:00Z')
      expect(store.canUndo).toBe(true)
      expect(store.canRedo).toBe(false)
      
      store.addSlot('2025-01-29T19:00:00Z', '2025-01-29T20:00:00Z')
      expect(store.canUndo).toBe(true)
      expect(store.canRedo).toBe(false)
    })

    it('should undo changes', () => {
      const store = useAvailabilityDraftStore()
      store.enterMode()
      
      store.addSlot('2025-01-29T17:00:00Z', '2025-01-29T18:00:00Z')
      expect(store.slots).toHaveLength(1)
      
      store.undo()
      expect(store.slots).toHaveLength(0)
      expect(store.canUndo).toBe(false)
      expect(store.canRedo).toBe(true)
    })

    it('should redo changes', () => {
      const store = useAvailabilityDraftStore()
      store.enterMode()
      
      store.addSlot('2025-01-29T17:00:00Z', '2025-01-29T18:00:00Z')
      store.undo()
      
      expect(store.canRedo).toBe(true)
      store.redo()
      
      expect(store.slots).toHaveLength(1)
      expect(store.canUndo).toBe(true)
      expect(store.canRedo).toBe(false)
    })

    it('should truncate history after new action', () => {
      const store = useAvailabilityDraftStore()
      store.enterMode()
      
      store.addSlot('2025-01-29T17:00:00Z', '2025-01-29T18:00:00Z')
      store.addSlot('2025-01-29T19:00:00Z', '2025-01-29T20:00:00Z')
      store.undo()
      
      // New action should truncate redo history
      store.addSlot('2025-01-29T21:00:00Z', '2025-01-29T22:00:00Z')
      
      expect(store.canRedo).toBe(false)
      expect(store.canUndo).toBe(true)
    })
  })

  describe('API integration', () => {
    it('should create draft via API', async () => {
      const store = useAvailabilityDraftStore()
      store.enterMode()
      store.addSlot('2025-01-29T17:00:00Z', '2025-01-29T18:00:00Z')
      
      const mockResponse = {
        token: 'draft_123',
        expiresAt: '2025-01-28T23:59:59Z',
        conflicts: [],
        summary: {
          addedSlots: 1,
          removedSlots: 0,
          hoursDelta: 1,
        },
      }
      
      vi.mocked(calendarAvailabilityApi.createDraft).mockResolvedValue(mockResponse)
      
      const result = await store.createDraft('2025-01-27')
      
      expect(result).toEqual(mockResponse)
      expect(store.draftToken).toBe('draft_123')
      expect(calendarAvailabilityApi.createDraft).toHaveBeenCalledWith({
        weekStart: '2025-01-27',
        slots: expect.any(Array),
      })
    })

    it('should apply draft via API', async () => {
      const store = useAvailabilityDraftStore()
      store.enterMode()
      store.draftToken = 'draft_123'
      
      const mockResponse = {
        status: 'applied' as const,
        appliedAt: '2025-01-27T22:10:00Z',
        workloadProgress: {
          currentHours: 15,
          targetHours: 16,
          minHours: 10,
          status: 'needs_more' as const,
        },
      }
      
      vi.mocked(calendarAvailabilityApi.applyDraft).mockResolvedValue(mockResponse)
      
      const result = await store.applyDraft()
      
      expect(result.status).toBe('applied')
      expect(store.mode).toBe('idle')
      expect(calendarAvailabilityApi.applyDraft).toHaveBeenCalledWith('draft_123', { force: false })
    })

    it('should handle conflicts on apply', async () => {
      const store = useAvailabilityDraftStore()
      store.enterMode()
      store.draftToken = 'draft_123'
      
      const mockResponse = {
        status: 'conflicts' as const,
        conflicts: [
          {
            type: 'event_overlap' as const,
            slot: { start: '2025-01-29T17:00:00Z', end: '2025-01-29T18:00:00Z' },
            event: { id: 10, studentName: 'John', start: '2025-01-29T17:00:00Z', end: '2025-01-29T18:00:00Z' },
          },
        ],
      }
      
      vi.mocked(calendarAvailabilityApi.applyDraft).mockResolvedValue(mockResponse)
      
      const result = await store.applyDraft()
      
      expect(result.status).toBe('conflicts')
      expect(store.conflicts).toHaveLength(1)
      expect(store.hasConflicts).toBe(true)
      expect(store.mode).toBe('edit') // Should stay in edit mode
    })

    it('should check conflicts', async () => {
      const store = useAvailabilityDraftStore()
      store.enterMode()
      store.addSlot('2025-01-29T17:00:00Z', '2025-01-29T18:00:00Z')
      
      const mockResponse = {
        conflicts: [],
      }
      
      vi.mocked(calendarAvailabilityApi.checkConflicts).mockResolvedValue(mockResponse)
      
      await store.checkConflicts('2025-01-27')
      
      expect(store.conflicts).toEqual([])
      expect(calendarAvailabilityApi.checkConflicts).toHaveBeenCalled()
    })

    it('should delete draft', async () => {
      const store = useAvailabilityDraftStore()
      store.enterMode()
      store.draftToken = 'draft_123'
      
      vi.mocked(calendarAvailabilityApi.deleteDraft).mockResolvedValue()
      
      await store.deleteDraft()
      
      expect(store.mode).toBe('idle')
      expect(calendarAvailabilityApi.deleteDraft).toHaveBeenCalledWith('draft_123')
    })
  })

  describe('Error handling', () => {
    it('should handle create draft error', async () => {
      const store = useAvailabilityDraftStore()
      store.enterMode()
      
      const error = new Error('Network error')
      vi.mocked(calendarAvailabilityApi.createDraft).mockRejectedValue(error)
      
      await expect(store.createDraft('2025-01-27')).rejects.toThrow('Network error')
      expect(store.error).toBeTruthy()
    })

    it('should handle apply draft error', async () => {
      const store = useAvailabilityDraftStore()
      store.enterMode()
      store.draftToken = 'draft_123'
      
      const error = new Error('Server error')
      vi.mocked(calendarAvailabilityApi.applyDraft).mockRejectedValue(error)
      
      await expect(store.applyDraft()).rejects.toThrow('Server error')
      expect(store.error).toBeTruthy()
    })
  })
})
