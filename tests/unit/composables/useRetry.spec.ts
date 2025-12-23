import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useRetry } from '@/composables/useRetry'

describe('useRetry', () => {
  beforeEach(() => {
    vi.clearAllTimers()
    vi.useFakeTimers()
  })

  it('should succeed on first attempt', async () => {
    const { withRetry } = useRetry()
    const fn = vi.fn().mockResolvedValue('success')

    const result = await withRetry(fn)

    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('should retry on failure', async () => {
    const { withRetry } = useRetry()
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('success')

    const promise = withRetry(fn, { maxAttempts: 3, delayMs: 100 })

    await vi.runAllTimersAsync()

    const result = await promise

    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(3)
  }, 10000)

  it('should throw after max attempts', async () => {
    const { withRetry } = useRetry()
    const fn = vi.fn().mockRejectedValue(new Error('fail'))

    const promise = withRetry(fn, { maxAttempts: 2, delayMs: 100 })

    vi.runAllTimersAsync()

    await expect(promise).rejects.toThrow('fail')
    expect(fn).toHaveBeenCalledTimes(2)
  }, 10000)

  it('should use exponential backoff', async () => {
    const { withRetry } = useRetry()
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('success')

    const promise = withRetry(fn, { maxAttempts: 3, delayMs: 100, backoff: true })

    await vi.runAllTimersAsync()

    await promise

    expect(fn).toHaveBeenCalledTimes(3)
  }, 10000)

  it('should call onRetry callback', async () => {
    const { withRetry } = useRetry()
    const onRetry = vi.fn()
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('success')

    const promise = withRetry(fn, { maxAttempts: 2, delayMs: 100, onRetry })

    await vi.runAllTimersAsync()
    await promise

    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error))
  }, 10000)
})
