import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Mock apiClient
vi.mock('../../src/utils/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
  },
}))

// Mock realtimeService
vi.mock('../../src/services/realtime', () => ({
  realtimeService: {
    subscribe: vi.fn(() => vi.fn()),
    on: vi.fn(() => vi.fn()),
  },
}))

import { useFeatureFlagsStore } from '../../src/stores/featureFlagsStore'
import { apiClient } from '../../src/utils/apiClient'
import { realtimeService } from '../../src/services/realtime'

describe('featureFlagsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('initial state', () => {
    it('has default flags', () => {
      const store = useFeatureFlagsStore()
      
      expect(store.flags).toBeDefined()
      expect(store.flags.chat_attachments).toBe(true)
      expect(store.flags.experimental_ai_assistant).toBe(false)
    })

    it('starts with loading false', () => {
      const store = useFeatureFlagsStore()
      expect(store.loading).toBe(false)
    })
  })

  describe('isEnabled getter', () => {
    it('returns flag value', () => {
      const store = useFeatureFlagsStore()
      
      expect(store.isEnabled('chat_attachments')).toBe(true)
      expect(store.isEnabled('experimental_ai_assistant')).toBe(false)
    })

    it('returns false for unknown flags', () => {
      const store = useFeatureFlagsStore()
      
      expect(store.isEnabled('unknown_flag')).toBe(false)
    })
  })

  describe('enabledFeatures getter', () => {
    it('returns array of enabled feature names', () => {
      const store = useFeatureFlagsStore()
      
      const enabled = store.enabledFeatures
      expect(Array.isArray(enabled)).toBe(true)
      expect(enabled).toContain('chat_attachments')
      expect(enabled).not.toContain('experimental_ai_assistant')
    })
  })

  describe('fetchFlags', () => {
    it('fetches flags from API', async () => {
      apiClient.get.mockResolvedValue({
        data: {
          flags: {
            chat_reactions: true,
            new_feature: true,
          },
        },
      })
      
      const store = useFeatureFlagsStore()
      await store.fetchFlags()
      
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/feature-flags/')
      expect(store.flags.chat_reactions).toBe(true)
      expect(store.flags.new_feature).toBe(true)
      // Default flags should be preserved
      expect(store.flags.chat_attachments).toBe(true)
    })

    it('handles API error gracefully', async () => {
      apiClient.get.mockRejectedValue(new Error('Network error'))
      
      const store = useFeatureFlagsStore()
      await store.fetchFlags()
      
      expect(store.error).toBe('Network error')
      // Should keep default flags
      expect(store.flags.chat_attachments).toBe(true)
    })

    it('sets loading state correctly', async () => {
      apiClient.get.mockImplementation(() => new Promise(resolve => {
        setTimeout(() => resolve({ data: { flags: {} } }), 100)
      }))
      
      const store = useFeatureFlagsStore()
      const promise = store.fetchFlags()
      
      expect(store.loading).toBe(true)
      
      await promise
      
      expect(store.loading).toBe(false)
    })
  })

  describe('cache', () => {
    it('saves flags to localStorage', async () => {
      apiClient.get.mockResolvedValue({
        data: { flags: { test_flag: true } },
      })
      
      const store = useFeatureFlagsStore()
      await store.fetchFlags()
      
      const cached = JSON.parse(localStorage.getItem('feature_flags_cache'))
      expect(cached.flags.test_flag).toBe(true)
      expect(cached.timestamp).toBeDefined()
    })

    it('loads flags from localStorage', () => {
      localStorage.setItem('feature_flags_cache', JSON.stringify({
        flags: { cached_flag: true },
        timestamp: Date.now(),
      }))
      
      const store = useFeatureFlagsStore()
      store.loadFromCache()
      
      expect(store.flags.cached_flag).toBe(true)
    })

    it('detects stale cache', () => {
      const store = useFeatureFlagsStore()
      
      // No lastFetched = stale
      expect(store.isCacheStale).toBe(true)
      
      // Recent fetch = not stale
      store.lastFetched = Date.now()
      expect(store.isCacheStale).toBe(false)
      
      // Old fetch = stale
      store.lastFetched = Date.now() - 10 * 60 * 1000 // 10 minutes ago
      expect(store.isCacheStale).toBe(true)
    })
  })

  describe('subscribeToUpdates', () => {
    it('subscribes to realtime channel', () => {
      const store = useFeatureFlagsStore()
      store.subscribeToUpdates()
      
      expect(realtimeService.subscribe).toHaveBeenCalledWith(
        'feature-flags',
        expect.any(Function)
      )
    })

    it('subscribes to status events for reconnect', () => {
      const store = useFeatureFlagsStore()
      store.subscribeToUpdates()
      
      expect(realtimeService.on).toHaveBeenCalledWith(
        'status',
        expect.any(Function)
      )
    })
  })

  describe('handleFlagUpdate', () => {
    it('updates flags from realtime event', () => {
      const store = useFeatureFlagsStore()
      
      store.handleFlagUpdate({ new_realtime_flag: true })
      
      expect(store.flags.new_realtime_flag).toBe(true)
    })

    it('ignores invalid payloads', () => {
      const store = useFeatureFlagsStore()
      const originalFlags = { ...store.flags }
      
      store.handleFlagUpdate(null)
      store.handleFlagUpdate('invalid')
      
      expect(store.flags).toEqual(originalFlags)
    })
  })

  describe('check method', () => {
    it('is shorthand for isEnabled', () => {
      const store = useFeatureFlagsStore()
      
      expect(store.check('chat_attachments')).toBe(store.isEnabled('chat_attachments'))
    })
  })

  describe('dispose', () => {
    it('cleans up subscription', () => {
      const unsubscribe = vi.fn()
      realtimeService.subscribe.mockReturnValue(unsubscribe)
      
      const store = useFeatureFlagsStore()
      store.subscribeToUpdates()
      store.dispose()
      
      expect(unsubscribe).toHaveBeenCalled()
    })
  })
})
