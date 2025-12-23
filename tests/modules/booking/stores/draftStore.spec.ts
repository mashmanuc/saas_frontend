import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useDraftStore } from '@/modules/booking/stores/draftStore'
import type { CalendarCell } from '@/modules/booking/types/calendar'

describe('draftStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  const mockCell: CalendarCell = {
    startAtUTC: '2024-12-23T10:00:00Z',
    durationMin: 30,
    status: 'empty',
    source: null,
  }

  describe('addPatch', () => {
    it('adds a patch to the store', () => {
      const store = useDraftStore()

      store.addPatch(mockCell, 'set_available')

      expect(store.draftPatchByKey.size).toBe(1)
      expect(store.isDirty).toBe(true)
    })

    it('uses UTC key as canonical identifier', () => {
      const store = useDraftStore()

      store.addPatch(mockCell, 'set_available')

      const patch = store.getPatch('2024-12-23T10:00:00Z')
      expect(patch).toBeDefined()
      expect(patch?.startAtUTC).toBe('2024-12-23T10:00:00Z')
    })

    it('stores original status', () => {
      const store = useDraftStore()
      const cell: CalendarCell = {
        ...mockCell,
        status: 'available',
      }

      store.addPatch(cell, 'set_blocked')

      const patch = store.getPatch(cell.startAtUTC)
      expect(patch?.originalStatus).toBe('available')
    })

    it('overwrites existing patch for same key', () => {
      const store = useDraftStore()

      store.addPatch(mockCell, 'set_available')
      store.addPatch(mockCell, 'set_blocked')

      expect(store.draftPatchByKey.size).toBe(1)
      const patch = store.getPatch(mockCell.startAtUTC)
      expect(patch?.action).toBe('set_blocked')
    })
  })

  describe('removePatch', () => {
    it('removes a patch by key', () => {
      const store = useDraftStore()

      store.addPatch(mockCell, 'set_available')
      expect(store.draftPatchByKey.size).toBe(1)

      store.removePatch(mockCell.startAtUTC)
      expect(store.draftPatchByKey.size).toBe(0)
      expect(store.isDirty).toBe(false)
    })

    it('does nothing if key does not exist', () => {
      const store = useDraftStore()

      store.removePatch('non-existent-key')
      expect(store.draftPatchByKey.size).toBe(0)
    })
  })

  describe('clearAllPatches', () => {
    it('clears all patches', () => {
      const store = useDraftStore()

      store.addPatch(mockCell, 'set_available')
      store.addPatch(
        { ...mockCell, startAtUTC: '2024-12-23T11:00:00Z' },
        'set_blocked'
      )

      expect(store.draftPatchByKey.size).toBe(2)

      store.clearAllPatches()

      expect(store.draftPatchByKey.size).toBe(0)
      expect(store.isDirty).toBe(false)
    })
  })

  describe('getPatch', () => {
    it('returns patch for existing key', () => {
      const store = useDraftStore()

      store.addPatch(mockCell, 'set_available')

      const patch = store.getPatch(mockCell.startAtUTC)
      expect(patch).toBeDefined()
      expect(patch?.action).toBe('set_available')
    })

    it('returns undefined for non-existent key', () => {
      const store = useDraftStore()

      const patch = store.getPatch('non-existent-key')
      expect(patch).toBeUndefined()
    })
  })

  describe('getAllPatches', () => {
    it('returns all patches as array', () => {
      const store = useDraftStore()

      store.addPatch(mockCell, 'set_available')
      store.addPatch(
        { ...mockCell, startAtUTC: '2024-12-23T11:00:00Z' },
        'set_blocked'
      )

      const patches = store.getAllPatches()
      expect(patches).toHaveLength(2)
      expect(patches[0].action).toBeDefined()
      expect(patches[1].action).toBeDefined()
    })

    it('returns empty array when no patches', () => {
      const store = useDraftStore()

      const patches = store.getAllPatches()
      expect(patches).toHaveLength(0)
    })
  })

  describe('isDirty', () => {
    it('is false when no patches', () => {
      const store = useDraftStore()

      expect(store.isDirty).toBe(false)
    })

    it('is true when patches exist', () => {
      const store = useDraftStore()

      store.addPatch(mockCell, 'set_available')

      expect(store.isDirty).toBe(true)
    })

    it('becomes false after clearing patches', () => {
      const store = useDraftStore()

      store.addPatch(mockCell, 'set_available')
      expect(store.isDirty).toBe(true)

      store.clearAllPatches()
      expect(store.isDirty).toBe(false)
    })
  })

  describe('applyPatches', () => {
    it('returns empty result when no patches', async () => {
      const store = useDraftStore()

      const result = await store.applyPatches()

      expect(result.summary.total).toBe(0)
      expect(result.applied).toHaveLength(0)
      expect(result.rejected).toHaveLength(0)
    })

    // Note: Full applyPatches testing requires mocking availabilityApi and calendarStore
    // which is beyond scope of v0.46.0 Foundation (implemented in v0.46.1)
  })
})
