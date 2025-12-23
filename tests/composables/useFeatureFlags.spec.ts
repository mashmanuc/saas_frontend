import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useFeatureFlags } from '@/composables/useFeatureFlags'

describe('useFeatureFlags', () => {
  beforeEach(() => {
    // Reset flags to default state
    const { setFlag } = useFeatureFlags()
    setFlag('ENABLE_V045_CALENDAR_SYNC', false)
    setFlag('ENABLE_V046_CALENDAR_CLICK_MODE', false)
  })

  describe('isV045CalendarSyncEnabled', () => {
    it('returns false when env var is not set', () => {
      const { isV045CalendarSyncEnabled } = useFeatureFlags()

      expect(isV045CalendarSyncEnabled.value).toBe(false)
    })

    it('returns true when env var is "true"', () => {
      const { setFlag, isV045CalendarSyncEnabled } = useFeatureFlags()
      setFlag('ENABLE_V045_CALENDAR_SYNC', true)

      expect(isV045CalendarSyncEnabled.value).toBe(true)
    })
  })

  describe('isV046CalendarClickMode', () => {
    it('returns false when env var is not set', () => {
      const { isV046CalendarClickMode } = useFeatureFlags()

      expect(isV046CalendarClickMode.value).toBe(false)
    })

    it('returns true when env var is "true"', () => {
      const { setFlag, isV046CalendarClickMode } = useFeatureFlags()
      setFlag('ENABLE_V046_CALENDAR_CLICK_MODE', true)

      expect(isV046CalendarClickMode.value).toBe(true)
    })
  })

  describe('setFlag', () => {
    it('updates flag value', () => {
      const { setFlag, getFlag } = useFeatureFlags()

      setFlag('ENABLE_V046_CALENDAR_CLICK_MODE', true)

      expect(getFlag('ENABLE_V046_CALENDAR_CLICK_MODE')).toBe(true)
    })

    it('can toggle flag value', () => {
      const { setFlag, getFlag } = useFeatureFlags()

      setFlag('ENABLE_V046_CALENDAR_CLICK_MODE', true)
      expect(getFlag('ENABLE_V046_CALENDAR_CLICK_MODE')).toBe(true)

      setFlag('ENABLE_V046_CALENDAR_CLICK_MODE', false)
      expect(getFlag('ENABLE_V046_CALENDAR_CLICK_MODE')).toBe(false)
    })
  })

  describe('getFlag', () => {
    it('returns false for non-existent flag', () => {
      const { getFlag } = useFeatureFlags()

      expect(getFlag('NON_EXISTENT_FLAG' as any)).toBe(false)
    })

    it('returns current flag value', () => {
      const { setFlag, getFlag } = useFeatureFlags()
      setFlag('ENABLE_V046_CALENDAR_CLICK_MODE', true)

      expect(getFlag('ENABLE_V046_CALENDAR_CLICK_MODE')).toBe(true)
    })
  })

  describe('flags computed', () => {
    it('returns all flags as object', () => {
      const { flags } = useFeatureFlags()

      expect(flags.value).toHaveProperty('ENABLE_V044_CALENDAR_SYNC')
      expect(flags.value).toHaveProperty('ENABLE_V045_CALENDAR_SYNC')
      expect(flags.value).toHaveProperty('ENABLE_V046_CALENDAR_CLICK_MODE')
    })
  })

  describe('fetchFlags', () => {
    it('fetches flags from env vars', async () => {
      import.meta.env.VITE_ENABLE_V046_CALENDAR_CLICK_MODE = 'true'

      const { fetchFlags, isV046CalendarClickMode } = useFeatureFlags()

      await fetchFlags()

      expect(isV046CalendarClickMode.value).toBe(true)
    })
  })
})
