import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NETWORK_STATUS } from '../../src/composables/useNetworkHealth'

// Mock realtimeService
vi.mock('../../src/services/realtime', () => ({
  realtimeService: {
    on: vi.fn(() => vi.fn()),
    send: vi.fn(),
    status: 'closed',
  },
}))

describe('Network Health', () => {
  describe('NETWORK_STATUS', () => {
    it('has all expected statuses', () => {
      expect(NETWORK_STATUS.EXCELLENT).toBe('excellent')
      expect(NETWORK_STATUS.GOOD).toBe('good')
      expect(NETWORK_STATUS.FAIR).toBe('fair')
      expect(NETWORK_STATUS.POOR).toBe('poor')
      expect(NETWORK_STATUS.OFFLINE).toBe('offline')
    })
  })
})
