// Regression: queryBridge must subscribe to USER-SCOPED role channels
// (tutor:{id}/student:{id}) that the WS gateway authorizes — never the bare
// roots ('notifications'/'tutor'/'student'/'inquiries'), which the gateway
// denies (spamming "WS subscribe denied" on every reconnect and never
// delivering a single invalidation event).

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSubscribe = vi.fn(() => () => {})
vi.mock('@/services/realtime', () => ({
  realtimeService: { subscribe: (...a: unknown[]) => mockSubscribe(...a) },
}))

import { setupQueryBridge, teardownQueryBridge } from '../queryBridge'

function fakeClient() {
  return { invalidateQueries: vi.fn() } as never
}

describe('setupQueryBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    teardownQueryBridge()
  })

  it('subscribes to the user-scoped role channels, never bare roots', () => {
    setupQueryBridge({ queryClient: fakeClient(), userId: 42 })

    const channels = mockSubscribe.mock.calls.map(c => c[0])
    expect(channels).toContain('tutor:42')
    expect(channels).toContain('student:42')

    // Bare roots are denied by the gateway — must NOT be subscribed.
    for (const bare of ['notifications', 'tutor', 'student', 'inquiries']) {
      expect(channels).not.toContain(bare)
    }
  })

  it('subscribes to nothing when there is no authenticated user', () => {
    setupQueryBridge({ queryClient: fakeClient(), userId: null })
    expect(mockSubscribe).not.toHaveBeenCalled()
  })
})
