/**
 * Unit tests for useRateLimitCountdown - Phase 2.3
 * 
 * Tests 429 retry-after countdown logic
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useRateLimitCountdown } from '../useRateLimitCountdown'

describe('useRateLimitCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should start countdown from Retry-After header', () => {
    const { isRateLimited, remainingSeconds, startCountdown } = useRateLimitCountdown()
    
    const error = {
      response: {
        headers: { 'retry-after': '10' },
        data: {}
      }
    }
    
    startCountdown(error)
    
    expect(isRateLimited.value).toBe(true)
    expect(remainingSeconds.value).toBe(10)
  })

  it('should prioritize header over body retry_after', () => {
    const { remainingSeconds, startCountdown } = useRateLimitCountdown()
    
    const error = {
      response: {
        headers: { 'retry-after': '5' },
        data: { retry_after: 10 }
      }
    }
    
    startCountdown(error)
    
    expect(remainingSeconds.value).toBe(5)
  })

  it('should fallback to body retry_after if header missing', () => {
    const { remainingSeconds, startCountdown } = useRateLimitCountdown()
    
    const error = {
      response: {
        headers: {},
        data: { retry_after: 15 }
      }
    }
    
    startCountdown(error)
    
    expect(remainingSeconds.value).toBe(15)
  })

  it('should use default 60s if no retry-after provided', () => {
    const { remainingSeconds, startCountdown } = useRateLimitCountdown()
    
    const error = {
      response: {
        headers: {},
        data: {}
      }
    }
    
    startCountdown(error)
    
    expect(remainingSeconds.value).toBe(60)
  })

  it('should countdown every second', () => {
    const { remainingSeconds, startCountdown } = useRateLimitCountdown()
    
    const error = {
      response: {
        headers: { 'retry-after': '3' },
        data: {}
      }
    }
    
    startCountdown(error)
    
    expect(remainingSeconds.value).toBe(3)
    
    vi.advanceTimersByTime(1000)
    expect(remainingSeconds.value).toBe(2)
    
    vi.advanceTimersByTime(1000)
    expect(remainingSeconds.value).toBe(1)
    
    vi.advanceTimersByTime(1000)
    expect(remainingSeconds.value).toBe(0)
  })

  it('should stop countdown when reaching 0', () => {
    const { isRateLimited, canRetry, remainingSeconds, startCountdown } = useRateLimitCountdown()
    
    const error = {
      response: {
        headers: { 'retry-after': '1' },
        data: {}
      }
    }
    
    startCountdown(error)
    
    expect(isRateLimited.value).toBe(true)
    expect(canRetry.value).toBe(false)
    
    vi.advanceTimersByTime(1000)
    
    expect(remainingSeconds.value).toBe(0)
    expect(isRateLimited.value).toBe(false)
    expect(canRetry.value).toBe(true)
  })

  it('should allow manual reset', () => {
    const { isRateLimited, remainingSeconds, startCountdown, reset } = useRateLimitCountdown()
    
    const error = {
      response: {
        headers: { 'retry-after': '10' },
        data: {}
      }
    }
    
    startCountdown(error)
    expect(isRateLimited.value).toBe(true)
    
    reset()
    
    expect(remainingSeconds.value).toBeNull()
    expect(isRateLimited.value).toBe(false)
  })
})
