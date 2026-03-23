import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock realtimeService
const mockSubscribe = vi.fn()
vi.mock('@/services/realtime', () => ({
  realtimeService: {
    subscribe: (...args: any[]) => mockSubscribe(...args),
  },
}))

import {
  recordWsEvent,
  getWsStats,
  resetWsStats,
  attachWsTracker,
  teardownWsTracker,
} from '../wsEventTracker'

describe('wsEventTracker', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    teardownWsTracker()
    resetWsStats()
    mockSubscribe.mockReset()
    mockSubscribe.mockReturnValue(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('records events correctly', () => {
    recordWsEvent()
    recordWsEvent()
    recordWsEvent()

    const stats = getWsStats()
    expect(stats.totalEvents).toBe(3)
    expect(stats.eventsInWindow).toBe(3)
  })

  it('window cleanup removes old events (sliding 5s window)', () => {
    recordWsEvent()
    recordWsEvent()

    // Advance 6 seconds — events should expire from window
    vi.advanceTimersByTime(6_000)

    const stats = getWsStats()
    expect(stats.eventsInWindow).toBe(0) // expired
    expect(stats.totalEvents).toBe(2) // total never resets
  })

  it('storm detection — many events in window', () => {
    // Simulate 8 events in rapid succession (storm scenario)
    for (let i = 0; i < 8; i++) {
      recordWsEvent()
    }

    const stats = getWsStats()
    expect(stats.eventsInWindow).toBe(8)
    expect(stats.eventsInWindow).toBeGreaterThan(6) // storm threshold
  })

  it('attachWsTracker subscribes to 4 channels', () => {
    attachWsTracker()

    expect(mockSubscribe).toHaveBeenCalledTimes(4)
    const channels = mockSubscribe.mock.calls.map((c: any[]) => c[0])
    expect(channels).toContain('notifications')
    expect(channels).toContain('tutor')
    expect(channels).toContain('student')
    expect(channels).toContain('inquiries')
  })

  it('teardown unsubscribes and allows re-attach', () => {
    const unsub1 = vi.fn()
    const unsub2 = vi.fn()
    mockSubscribe.mockReturnValueOnce(unsub1).mockReturnValueOnce(unsub2).mockReturnValue(() => {})

    attachWsTracker()
    teardownWsTracker()

    expect(unsub1).toHaveBeenCalled()
    expect(unsub2).toHaveBeenCalled()

    // Can re-attach after teardown
    mockSubscribe.mockClear()
    mockSubscribe.mockReturnValue(() => {})
    attachWsTracker()
    expect(mockSubscribe).toHaveBeenCalledTimes(4)
  })

  it('reset clears all counters', () => {
    recordWsEvent()
    recordWsEvent()

    resetWsStats()
    const stats = getWsStats()
    expect(stats.eventsInWindow).toBe(0)
    expect(stats.totalEvents).toBe(0)
  })
})
