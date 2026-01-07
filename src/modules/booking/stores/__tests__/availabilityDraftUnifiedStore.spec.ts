/**
 * Unit tests for availabilityDraftUnifiedStore
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAvailabilityDraftUnifiedStore } from '../availabilityDraftUnifiedStore'
import { calendarAvailabilityApi } from '@/modules/booking/api/calendarAvailabilityApi'

vi.mock('@/modules/booking/api/calendarAvailabilityApi', () => ({
  calendarAvailabilityApi: {
    createDraft: vi.fn(),
    applyDraft: vi.fn(),
    deleteDraft: vi.fn(),
    getWorkloadTarget: vi.fn(),
  },
}))

vi.mock('../calendarWeekStore', () => ({
  useCalendarWeekStore: vi.fn(() => ({
    markSlotAsDeleted: vi.fn(),
    clearDeletedSlots: vi.fn(),
  })),
}))

describe('availabilityDraftUnifiedStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('Mode management', () => {
    it('should enter edit mode', () => {
      const store = useAvailabilityDraftUnifiedStore()
      store.enterEditMode('2024-01-01', 'Europe/Kiev')

      expect(store.mode).toBe('edit')
      expect(store.weekStart).toBe('2024-01-01')
      expect(store.timezone).toBe('Europe/Kiev')
      expect(store.changes).toEqual([])
    })

    it('should exit mode and reset state', () => {
      const store = useAvailabilityDraftUnifiedStore()
      store.enterEditMode('2024-01-01')
      store.addSlot('2024-01-01T10:00:00Z', '2024-01-01T11:00:00Z')

      store.exitMode()

      expect(store.mode).toBe('idle')
      expect(store.weekStart).toBeNull()
      expect(store.changes).toEqual([])
    })
  })

  describe('Slot operations', () => {
    it('should add slot to draft', () => {
      const store = useAvailabilityDraftUnifiedStore()
      store.enterEditMode('2024-01-01')

      const change = store.addSlot('2024-01-01T10:00:00Z', '2024-01-01T11:00:00Z', 'available')

      expect(store.changes).toHaveLength(1)
      expect(store.hasChanges).toBe(true)
      expect(change.type).toBe('add')
      expect(change.start).toBe('2024-01-01T10:00:00Z')
      expect(change.end).toBe('2024-01-01T11:00:00Z')
    })

    it('should mark slot for deletion', () => {
      const store = useAvailabilityDraftUnifiedStore()
      store.enterEditMode('2024-01-01')

      store.markSlotForDeletion(123, '2024-01-01T10:00:00Z', '2024-01-01T11:00:00Z')

      expect(store.changes).toHaveLength(1)
      expect(store.toRemove).toHaveLength(1)
      expect(store.removedIds).toContain(123)
    })

    it('should toggle slot deletion', () => {
      const store = useAvailabilityDraftUnifiedStore()
      store.enterEditMode('2024-01-01')

      store.toggleSlot(123, '2024-01-01T10:00:00Z', '2024-01-01T11:00:00Z')
      expect(store.removedIds).toContain(123)

      store.toggleSlot(123, '2024-01-01T10:00:00Z', '2024-01-01T11:00:00Z')
      expect(store.removedIds).not.toContain(123)
    })
  })

  describe('Computed properties', () => {
    it('should compute toAdd and toRemove correctly', () => {
      const store = useAvailabilityDraftUnifiedStore()
      store.enterEditMode('2024-01-01')

      store.addSlot('2024-01-01T10:00:00Z', '2024-01-01T11:00:00Z')
      store.addSlot('2024-01-01T12:00:00Z', '2024-01-01T13:00:00Z')
      store.markSlotForDeletion(123)

      expect(store.toAdd).toHaveLength(2)
      expect(store.toRemove).toHaveLength(1)
      expect(store.changeCount).toBe(3)
    })

    it('should compute slots for backward compatibility', () => {
      const store = useAvailabilityDraftUnifiedStore()
      store.enterEditMode('2024-01-01')

      store.addSlot('2024-01-01T10:00:00Z', '2024-01-01T11:00:00Z')
      store.markSlotForDeletion(123, '2024-01-01T10:00:00Z', '2024-01-01T11:00:00Z')

      expect(store.slots).toHaveLength(2)
      expect(store.slots[0]).toHaveProperty('start')
      expect(store.slots[0]).toHaveProperty('end')
    })

    it('should compute hoursDelta correctly', () => {
      const store = useAvailabilityDraftUnifiedStore()
      store.enterEditMode('2024-01-01')

      store.addSlot('2024-01-01T10:00:00Z', '2024-01-01T12:00:00Z')
      store.markSlotForDeletion(123, '2024-01-01T14:00:00Z', '2024-01-01T15:00:00Z')

      expect(store.hoursDelta).toBe(1)
    })
  })

  describe('History (undo/redo)', () => {
    it('should support undo', () => {
      const store = useAvailabilityDraftUnifiedStore()
      store.enterEditMode('2024-01-01')

      store.addSlot('2024-01-01T10:00:00Z', '2024-01-01T11:00:00Z')
      expect(store.changes).toHaveLength(1)

      store.undo()
      expect(store.changes).toHaveLength(0)
    })

    it('should support redo', () => {
      const store = useAvailabilityDraftUnifiedStore()
      store.enterEditMode('2024-01-01')

      store.addSlot('2024-01-01T10:00:00Z', '2024-01-01T11:00:00Z')
      store.undo()
      expect(store.changes).toHaveLength(0)

      store.redo()
      expect(store.changes).toHaveLength(1)
    })

    it('should track canUndo and canRedo', () => {
      const store = useAvailabilityDraftUnifiedStore()
      store.enterEditMode('2024-01-01')

      expect(store.canUndo).toBe(false)
      expect(store.canRedo).toBe(false)

      store.addSlot('2024-01-01T10:00:00Z', '2024-01-01T11:00:00Z')
      expect(store.canUndo).toBe(true)

      store.undo()
      expect(store.canRedo).toBe(true)
    })
  })

  describe('Draft API operations', () => {
    it('should create draft', async () => {
      const mockResponse = {
        token: 'test-token',
        expiresAt: '2024-01-01T12:00:00Z',
        conflicts: [],
        summary: { addedSlots: 1, removedSlots: 0, hoursDelta: 1 },
      }
      vi.mocked(calendarAvailabilityApi.createDraft).mockResolvedValue(mockResponse)

      const store = useAvailabilityDraftUnifiedStore()
      store.enterEditMode('2024-01-01')
      store.addSlot('2024-01-01T10:00:00Z', '2024-01-01T11:00:00Z')

      const response = await store.createDraft()

      expect(response.token).toBe('test-token')
      expect(store.token).toBe('test-token')
    })

    it('should apply draft', async () => {
      const mockCreateResponse = {
        token: 'test-token',
        expiresAt: '2024-01-01T12:00:00Z',
        conflicts: [],
        summary: { addedSlots: 1, removedSlots: 0, hoursDelta: 1 },
      }
      const mockApplyResponse = {
        status: 'applied' as const,
        workloadProgress: {
          currentHours: 20,
          targetHours: 20,
          minHours: 10,
          status: 'ok' as const,
        },
      }
      vi.mocked(calendarAvailabilityApi.createDraft).mockResolvedValue(mockCreateResponse)
      vi.mocked(calendarAvailabilityApi.applyDraft).mockResolvedValue(mockApplyResponse)

      const store = useAvailabilityDraftUnifiedStore()
      store.enterEditMode('2024-01-01')
      store.addSlot('2024-01-01T10:00:00Z', '2024-01-01T11:00:00Z')

      const response = await store.applyDraft(false, '2024-01-01')

      expect(response.status).toBe('applied')
      expect(store.mode).toBe('idle')
    })

    it('should handle conflicts on apply', async () => {
      const mockCreateResponse = {
        token: 'test-token',
        expiresAt: '2024-01-01T12:00:00Z',
        conflicts: [],
        summary: { addedSlots: 1, removedSlots: 0, hoursDelta: 1 },
      }
      const mockApplyResponse = {
        status: 'conflicts' as const,
        conflicts: [
          {
            type: 'event_overlap' as const,
            slot: {
              slotId: 123,
              start: '2024-01-01T10:00:00Z',
              end: '2024-01-01T11:00:00Z',
            },
          },
        ],
      }
      vi.mocked(calendarAvailabilityApi.createDraft).mockResolvedValue(mockCreateResponse)
      vi.mocked(calendarAvailabilityApi.applyDraft).mockResolvedValue(mockApplyResponse)

      const store = useAvailabilityDraftUnifiedStore()
      store.enterEditMode('2024-01-01')
      store.addSlot('2024-01-01T10:00:00Z', '2024-01-01T11:00:00Z')

      const response = await store.applyDraft(false, '2024-01-01')

      expect(response.status).toBe('conflicts')
      expect(store.conflicts).toHaveLength(1)
    })

    it('should delete draft', async () => {
      vi.mocked(calendarAvailabilityApi.deleteDraft).mockResolvedValue()

      const store = useAvailabilityDraftUnifiedStore()
      store.enterEditMode('2024-01-01')
      store.token = 'test-token'

      await store.deleteDraft()

      expect(calendarAvailabilityApi.deleteDraft).toHaveBeenCalledWith('test-token')
      expect(store.mode).toBe('idle')
    })
  })

  describe('loadFromSlots', () => {
    it('should load changes from slots', () => {
      const store = useAvailabilityDraftUnifiedStore()
      store.enterEditMode('2024-01-01')

      const slots = [
        {
          slotId: null,
          start: '2024-01-01T10:00:00Z',
          end: '2024-01-01T11:00:00Z',
          status: 'available' as const,
        },
        {
          slotId: 123,
          action: 'remove' as const,
          start: '2024-01-01T12:00:00Z',
          end: '2024-01-01T13:00:00Z',
        },
      ]

      store.loadFromSlots(slots, { weekStart: '2024-01-01', timezone: 'Europe/Kiev' })

      expect(store.changes).toHaveLength(2)
      expect(store.toAdd).toHaveLength(1)
      expect(store.toRemove).toHaveLength(1)
      expect(store.weekStart).toBe('2024-01-01')
      expect(store.timezone).toBe('Europe/Kiev')
    })
  })
})
