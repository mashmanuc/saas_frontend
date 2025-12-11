import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  ReconnectStrategy,
  createReconnectStrategy,
  calculateBackoff,
  CONNECTION_STATUS,
  mapToUiStatus,
} from '../../src/core/realtime/reconnect'

describe('ReconnectStrategy', () => {
  let strategy

  beforeEach(() => {
    vi.useFakeTimers()
    strategy = new ReconnectStrategy({
      maxRetries: 3,
      initialDelayMs: 100,
      maxDelayMs: 1000,
      backoffMultiplier: 2,
      jitterFactor: 0, // Disable jitter for predictable tests
    })
  })

  afterEach(() => {
    strategy.abort()
    vi.useRealTimers()
  })

  describe('getNextDelay', () => {
    it('calculates exponential backoff', () => {
      expect(strategy.getNextDelay()).toBe(100) // 100 * 2^0
      
      strategy.retryCount = 1
      expect(strategy.getNextDelay()).toBe(200) // 100 * 2^1
      
      strategy.retryCount = 2
      expect(strategy.getNextDelay()).toBe(400) // 100 * 2^2
    })

    it('caps delay at maxDelayMs', () => {
      strategy.retryCount = 10
      expect(strategy.getNextDelay()).toBe(1000) // Capped at maxDelayMs
    })
  })

  describe('scheduleReconnect', () => {
    it('calls connectFn after delay', async () => {
      const connectFn = vi.fn().mockResolvedValue(undefined)
      
      const promise = strategy.scheduleReconnect(connectFn)
      
      expect(connectFn).not.toHaveBeenCalled()
      
      await vi.advanceTimersByTimeAsync(100)
      
      expect(connectFn).toHaveBeenCalledTimes(1)
      await expect(promise).resolves.toBe(true)
    })

    it('retries on failure', async () => {
      let attempts = 0
      const connectFn = vi.fn().mockImplementation(() => {
        attempts++
        if (attempts < 2) {
          return Promise.reject(new Error('Connection failed'))
        }
        return Promise.resolve()
      })
      
      const promise = strategy.scheduleReconnect(connectFn)
      
      // First attempt fails
      await vi.advanceTimersByTimeAsync(100)
      expect(connectFn).toHaveBeenCalledTimes(1)
      
      // Second attempt succeeds
      await vi.advanceTimersByTimeAsync(200)
      expect(connectFn).toHaveBeenCalledTimes(2)
      
      await expect(promise).resolves.toBe(true)
    })

    it('stops after maxRetries', async () => {
      const connectFn = vi.fn().mockRejectedValue(new Error('Connection failed'))
      const onMaxRetriesReached = vi.fn()
      strategy.onMaxRetriesReached = onMaxRetriesReached
      
      const promise = strategy.scheduleReconnect(connectFn)
      
      // Exhaust all retries
      await vi.advanceTimersByTimeAsync(100) // Attempt 1
      await vi.advanceTimersByTimeAsync(200) // Attempt 2
      await vi.advanceTimersByTimeAsync(400) // Attempt 3
      
      await expect(promise).resolves.toBe(false)
      expect(onMaxRetriesReached).toHaveBeenCalled()
    })

    it('calls onStatusChange callbacks', async () => {
      const connectFn = vi.fn().mockResolvedValue(undefined)
      const onStatusChange = vi.fn()
      strategy.onStatusChange = onStatusChange
      
      const promise = strategy.scheduleReconnect(connectFn)
      
      expect(onStatusChange).toHaveBeenCalledWith('waiting', expect.any(Object))
      
      await vi.advanceTimersByTimeAsync(100)
      
      expect(onStatusChange).toHaveBeenCalledWith('connecting', expect.any(Object))
      expect(onStatusChange).toHaveBeenCalledWith('connected')
      
      await promise
    })
  })

  describe('reset', () => {
    it('resets retry state', () => {
      strategy.retryCount = 5
      strategy.aborted = true
      
      strategy.reset()
      
      expect(strategy.retryCount).toBe(0)
      expect(strategy.aborted).toBe(false)
    })
  })

  describe('abort', () => {
    it('stops pending reconnection', () => {
      const connectFn = vi.fn().mockResolvedValue(undefined)
      
      // Start reconnect (don't await)
      strategy.scheduleReconnect(connectFn)
      
      // Verify timer is set
      expect(strategy.isReconnecting()).toBe(true)
      
      // Abort
      strategy.abort()
      
      // Verify aborted state
      expect(strategy.aborted).toBe(true)
      expect(strategy.isReconnecting()).toBe(false)
      
      // Advance timers - connectFn should not be called
      vi.advanceTimersByTime(1000)
      expect(connectFn).not.toHaveBeenCalled()
    })
  })

  describe('getStatus', () => {
    it('returns current status', () => {
      const status = strategy.getStatus()
      
      expect(status).toEqual({
        attempt: 0,
        maxRetries: 3,
        isReconnecting: false,
        aborted: false,
      })
    })
  })
})

describe('createReconnectStrategy', () => {
  it('creates strategy with callbacks', () => {
    const onReconnect = vi.fn()
    const onMaxRetriesReached = vi.fn()
    const onStatusChange = vi.fn()
    
    const strategy = createReconnectStrategy({
      onReconnect,
      onMaxRetriesReached,
      onStatusChange,
      maxRetries: 10,
    })
    
    expect(strategy.onReconnect).toBe(onReconnect)
    expect(strategy.onMaxRetriesReached).toBe(onMaxRetriesReached)
    expect(strategy.onStatusChange).toBe(onStatusChange)
    expect(strategy.options.maxRetries).toBe(10)
  })
})

describe('calculateBackoff', () => {
  it('calculates correct backoff', () => {
    expect(calculateBackoff(0)).toBe(1000)
    expect(calculateBackoff(1)).toBe(2000)
    expect(calculateBackoff(2)).toBe(4000)
    expect(calculateBackoff(3)).toBe(8000)
  })

  it('respects maxDelayMs', () => {
    expect(calculateBackoff(10, { maxDelayMs: 5000 })).toBe(5000)
  })

  it('uses custom options', () => {
    expect(calculateBackoff(0, { initialDelayMs: 500 })).toBe(500)
    expect(calculateBackoff(1, { initialDelayMs: 500, multiplier: 3 })).toBe(1500)
  })
})

describe('CONNECTION_STATUS', () => {
  it('has all expected statuses', () => {
    expect(CONNECTION_STATUS.CONNECTED).toBe('connected')
    expect(CONNECTION_STATUS.CONNECTING).toBe('connecting')
    expect(CONNECTION_STATUS.DISCONNECTED).toBe('disconnected')
    expect(CONNECTION_STATUS.RECONNECTING).toBe('reconnecting')
    expect(CONNECTION_STATUS.SYNCING).toBe('syncing')
    expect(CONNECTION_STATUS.FAILED).toBe('failed')
  })
})

describe('mapToUiStatus', () => {
  it('maps strategy statuses to UI statuses', () => {
    expect(mapToUiStatus('connected')).toBe(CONNECTION_STATUS.CONNECTED)
    expect(mapToUiStatus('connecting')).toBe(CONNECTION_STATUS.CONNECTING)
    expect(mapToUiStatus('waiting')).toBe(CONNECTION_STATUS.RECONNECTING)
    expect(mapToUiStatus('failed')).toBe(CONNECTION_STATUS.RECONNECTING)
    expect(mapToUiStatus('max_retries_reached')).toBe(CONNECTION_STATUS.FAILED)
    expect(mapToUiStatus('aborted')).toBe(CONNECTION_STATUS.FAILED)
    expect(mapToUiStatus('unknown')).toBe(CONNECTION_STATUS.DISCONNECTED)
  })
})
