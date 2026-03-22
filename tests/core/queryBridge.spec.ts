import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setupQueryBridge, teardownQueryBridge, EVENT_INVALIDATION_MAP } from '@/services/queryBridge'

// Mock realtimeService
vi.mock('@/services/realtime', () => ({
  realtimeService: {
    subscribe: vi.fn(() => vi.fn()),
  },
}))

describe('queryBridge', () => {
  let mockQueryClient: any

  beforeEach(async () => {
    mockQueryClient = {
      invalidateQueries: vi.fn(),
    }
    teardownQueryBridge()
    const { realtimeService } = await import('@/services/realtime')
    vi.mocked(realtimeService.subscribe).mockClear()
    vi.mocked(realtimeService.subscribe).mockReturnValue(vi.fn())
  })

  it('subscribes to expected channels on setup', async () => {
    const { realtimeService } = await import('@/services/realtime')
    setupQueryBridge({ queryClient: mockQueryClient })

    expect(realtimeService.subscribe).toHaveBeenCalledWith('notifications', expect.any(Function))
    expect(realtimeService.subscribe).toHaveBeenCalledWith('tutor', expect.any(Function))
    expect(realtimeService.subscribe).toHaveBeenCalledWith('student', expect.any(Function))
    expect(realtimeService.subscribe).toHaveBeenCalledWith('inquiries', expect.any(Function))
    expect(realtimeService.subscribe).toHaveBeenCalledTimes(4)
  })

  it('invalidates correct keys for relation.updated', async () => {
    const { realtimeService } = await import('@/services/realtime')
    let handler: (data: any) => void = () => {}
    vi.mocked(realtimeService.subscribe).mockImplementation((_ch: string, h: any) => {
      handler = h
      return vi.fn()
    })

    setupQueryBridge({ queryClient: mockQueryClient })
    handler({ type: 'relation.updated' })

    expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['relations'] })
    expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['limits'] })
    expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['user-context'] })
  })

  it('invalidates correct keys for billing.updated', async () => {
    const { realtimeService } = await import('@/services/realtime')
    let handler: (data: any) => void = () => {}
    vi.mocked(realtimeService.subscribe).mockImplementation((_ch: string, h: any) => {
      handler = h
      return vi.fn()
    })

    setupQueryBridge({ queryClient: mockQueryClient })
    handler({ type: 'billing.updated' })

    expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['billing'] })
    expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['user-context'] })
  })

  it('invalidates correct keys for inquiry.created', async () => {
    const { realtimeService } = await import('@/services/realtime')
    let handler: (data: any) => void = () => {}
    vi.mocked(realtimeService.subscribe).mockImplementation((_ch: string, h: any) => {
      handler = h
      return vi.fn()
    })

    setupQueryBridge({ queryClient: mockQueryClient })
    handler({ type: 'inquiry.created' })

    expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['inquiries'] })
    expect(mockQueryClient.invalidateQueries).toHaveBeenCalledTimes(1)
  })

  it('invalidates correct keys for dashboard.changed', async () => {
    const { realtimeService } = await import('@/services/realtime')
    let handler: (data: any) => void = () => {}
    vi.mocked(realtimeService.subscribe).mockImplementation((_ch: string, h: any) => {
      handler = h
      return vi.fn()
    })

    setupQueryBridge({ queryClient: mockQueryClient })
    handler({ type: 'dashboard.changed' })

    expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['student-dashboard'] })
    expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['tutor-dashboard'] })
  })

  it('supports "event" field as well as "type"', async () => {
    const { realtimeService } = await import('@/services/realtime')
    let handler: (data: any) => void = () => {}
    vi.mocked(realtimeService.subscribe).mockImplementation((_ch: string, h: any) => {
      handler = h
      return vi.fn()
    })

    setupQueryBridge({ queryClient: mockQueryClient })
    handler({ event: 'limits.changed' })

    expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['limits'] })
    expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['user-context'] })
  })

  it('ignores unknown event types', async () => {
    const { realtimeService } = await import('@/services/realtime')
    let handler: (data: any) => void = () => {}
    vi.mocked(realtimeService.subscribe).mockImplementation((_ch: string, h: any) => {
      handler = h
      return vi.fn()
    })

    setupQueryBridge({ queryClient: mockQueryClient })
    handler({ type: 'some.unknown.event' })

    expect(mockQueryClient.invalidateQueries).not.toHaveBeenCalled()
  })

  it('ignores events without type or event field', async () => {
    const { realtimeService } = await import('@/services/realtime')
    let handler: (data: any) => void = () => {}
    vi.mocked(realtimeService.subscribe).mockImplementation((_ch: string, h: any) => {
      handler = h
      return vi.fn()
    })

    setupQueryBridge({ queryClient: mockQueryClient })
    handler({})
    handler(null)
    handler({ data: 'something' })

    expect(mockQueryClient.invalidateQueries).not.toHaveBeenCalled()
  })

  it('teardown unsubscribes all channels', async () => {
    const { realtimeService } = await import('@/services/realtime')
    const mockUnsub = vi.fn()
    vi.mocked(realtimeService.subscribe).mockReturnValue(mockUnsub)

    setupQueryBridge({ queryClient: mockQueryClient })
    teardownQueryBridge()

    // 4 channels = 4 unsubscribe calls
    expect(mockUnsub).toHaveBeenCalledTimes(4)
  })

  it('EVENT_INVALIDATION_MAP covers all expected events', () => {
    const expectedEvents = [
      'relation.updated', 'relation.created',
      'limits.changed', 'billing.updated',
      'inquiry.updated', 'inquiry.created',
      'dashboard.changed',
    ]
    for (const event of expectedEvents) {
      expect(EVENT_INVALIDATION_MAP[event]).toBeDefined()
      expect(EVENT_INVALIDATION_MAP[event].length).toBeGreaterThan(0)
    }
  })

  it('handles channel subscription errors gracefully', async () => {
    const { realtimeService } = await import('@/services/realtime')
    vi.mocked(realtimeService.subscribe).mockImplementation((channel: string) => {
      if (channel === 'student') throw new Error('Channel not available')
      return vi.fn()
    })

    // Should not throw
    expect(() => setupQueryBridge({ queryClient: mockQueryClient })).not.toThrow()
    // Should have tried all 4 channels
    expect(realtimeService.subscribe).toHaveBeenCalledTimes(4)
  })
})
