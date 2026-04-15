/**
 * Phase ops-only: SessionWriteLock invariant tests.
 *
 * Verifies:
 *  1. Sequential execution — tasks run in enqueue order
 *  2. Mutual exclusion — no two tasks run concurrently
 *  3. Timeout safety — hung task ≥5s doesn't block next task forever
 *  4. Exception isolation — rejected task doesn't kill next task
 */
import { describe, it, expect, vi } from 'vitest'
import { createSessionWriteLock } from '../composables/useSessionWriteLock'

function deferred<T = void>(): {
  promise: Promise<T>
  resolve: (v: T) => void
  reject: (e: unknown) => void
} {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('SessionWriteLock', () => {
  it('executes sequential tasks in FIFO order', async () => {
    const lock = createSessionWriteLock()
    const log: number[] = []

    await Promise.all([
      lock.run(async () => {
        await new Promise((r) => setTimeout(r, 20))
        log.push(1)
      }),
      lock.run(async () => {
        await new Promise((r) => setTimeout(r, 5))
        log.push(2)
      }),
      lock.run(async () => {
        log.push(3)
      }),
    ])

    expect(log).toEqual([1, 2, 3])
  })

  it('guarantees mutual exclusion — no two tasks run simultaneously', async () => {
    const lock = createSessionWriteLock()
    let activeCount = 0
    let maxActiveCount = 0

    async function task() {
      activeCount++
      maxActiveCount = Math.max(maxActiveCount, activeCount)
      await new Promise((r) => setTimeout(r, 10))
      activeCount--
    }

    const tasks = Array.from({ length: 10 }, () => lock.run(task))
    await Promise.all(tasks)

    expect(maxActiveCount).toBe(1)
  })

  it('does not block the next task forever if previous one hangs (5s timeout safety)', async () => {
    vi.useFakeTimers()
    const lock = createSessionWriteLock()
    const never = deferred<void>()
    const log: string[] = []

    // First task never resolves
    const hungTask = lock.run(async () => {
      log.push('hung:start')
      await never.promise
      log.push('hung:end')
    })

    // Second task enqueued
    const nextTask = lock.run(async () => {
      log.push('next:start')
      log.push('next:end')
    })

    // Advance 5s timer — timeout kicks in, next task starts
    await vi.advanceTimersByTimeAsync(5_100)

    // Cleanup: we don't await hungTask (it never ends); ensure nextTask finished
    await nextTask
    expect(log).toContain('next:start')
    expect(log).toContain('next:end')

    // Resolve hung to avoid leaked promise warning
    never.resolve()
    vi.useRealTimers()

    // Silence hungTask rejection if any
    await hungTask.catch(() => {})
  })

  it('isolates exceptions — next task runs even if previous rejects', async () => {
    const lock = createSessionWriteLock()
    const log: string[] = []

    const first = lock.run(async () => {
      log.push('first:before')
      throw new Error('boom')
    })

    const second = lock.run(async () => {
      log.push('second')
    })

    await expect(first).rejects.toThrow('boom')
    await second
    expect(log).toEqual(['first:before', 'second'])
  })
})
