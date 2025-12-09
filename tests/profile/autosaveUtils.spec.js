import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { buildDirtyPayload, hasDirtyChanges, createAutosaveScheduler } from '../../src/modules/profile/utils/autosave'

const snapshot = {
  user: { first_name: 'Ada', last_name: 'Lovelace', timezone: 'Europe/Kyiv' },
  profile: { headline: 'Math genius', bio: 'Invented algorithms', subjects: ['Math'] },
  subjects: ['Math'],
}

const baseForm = {
  first_name: 'Ada',
  last_name: 'Lovelace',
  timezone: 'Europe/Kyiv',
  headline: 'Math genius',
  bio: 'Invented algorithms',
}

describe('autosave utils', () => {
  describe('buildDirtyPayload & hasDirtyChanges', () => {
    it('returns empty payload when values match snapshot (dirty → clean)', () => {
      const payload = buildDirtyPayload({
        snapshot,
        form: { ...baseForm },
        subjects: [...snapshot.subjects],
        role: 'tutor',
        timezoneFallback: 'Europe/Kyiv',
      })

      expect(hasDirtyChanges(payload)).toBe(false)
    })

    it('includes only changed sections without merging other fields', () => {
      const payload = buildDirtyPayload({
        snapshot,
        form: { ...baseForm, first_name: 'Grace' },
        subjects: ['Math', 'Physics'],
        role: 'tutor',
        timezoneFallback: 'Europe/Kyiv',
      })

      expect(payload).toEqual({
        user: {
          first_name: 'Grace',
          last_name: 'Lovelace',
          timezone: 'Europe/Kyiv',
        },
        tutor_profile: {
          headline: 'Math genius',
          bio: 'Invented algorithms',
          subjects: ['Math', 'Physics'],
        },
      })
    })
  })

  describe('createAutosaveScheduler', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('invokes handler only after debounce delay', async () => {
      const handler = vi.fn()
      const scheduler = createAutosaveScheduler(handler, 800)

      scheduler.schedule({ user: { first_name: 'Ada' } })
      expect(handler).not.toHaveBeenCalled()

      vi.advanceTimersByTime(799)
      expect(handler).not.toHaveBeenCalled()

      vi.advanceTimersByTime(1)
      await Promise.resolve()
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('cancels pending calls when schedule invoked with clean payload', async () => {
      const handler = vi.fn()
      const scheduler = createAutosaveScheduler(handler, 200)

      scheduler.schedule({ user: { first_name: 'Grace' } })
      scheduler.schedule(null)

      vi.runAllTimers()
      await Promise.resolve()
      expect(handler).toHaveBeenCalledTimes(1)
    })
  })
})
