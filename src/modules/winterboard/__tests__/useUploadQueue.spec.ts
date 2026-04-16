// WB: Unit tests для useUploadQueue (concurrency semaphore + AbortSignal)
// Ref: plan lazy-kindling-simon.md

import { describe, it, expect, beforeEach } from 'vitest'
import {
  withUploadSlot,
  UploadAbortedError,
  _getQueueState,
  _resetQueue,
} from '../composables/useUploadQueue'

describe('useUploadQueue', () => {
  beforeEach(() => {
    _resetQueue()
  })

  it('виконує fn негайно якщо active < MAX_CONCURRENT', async () => {
    const result = await withUploadSlot(async () => 'ok')
    expect(result).toBe('ok')
    expect(_getQueueState().active).toBe(0)
  })

  it('звільняє слот після успіху', async () => {
    await withUploadSlot(async () => 1)
    await withUploadSlot(async () => 2)
    await withUploadSlot(async () => 3)
    expect(_getQueueState().active).toBe(0)
    expect(_getQueueState().waiting).toBe(0)
  })

  it('звільняє слот навіть на throw', async () => {
    await expect(
      withUploadSlot(async () => { throw new Error('boom') }),
    ).rejects.toThrow('boom')
    expect(_getQueueState().active).toBe(0)
  })

  it('обмежує одночасно активних до MAX_CONCURRENT (3)', async () => {
    let peakActive = 0
    const tasks: Array<Promise<void>> = []
    const releases: Array<() => void> = []

    // 6 завдань, кожне блокується ручним release — щоб виміряти максимальну
    // одночасну активність.
    for (let i = 0; i < 6; i++) {
      tasks.push(
        withUploadSlot(async () => {
          peakActive = Math.max(peakActive, _getQueueState().active)
          await new Promise<void>((resolve) => releases.push(resolve))
        }),
      )
    }

    // Дамо мікротаскам стартувати
    await new Promise((r) => setTimeout(r, 0))

    // У черзі — 3 чекають
    expect(_getQueueState().active).toBe(3)
    expect(_getQueueState().waiting).toBe(3)

    // Звільняємо по одному
    releases[0]()
    await new Promise((r) => setTimeout(r, 0))
    expect(_getQueueState().active).toBe(3) // інший зайшов
    expect(_getQueueState().waiting).toBe(2)

    // Звільняємо решту
    while (releases.length) {
      releases.shift()!()
      await new Promise((r) => setTimeout(r, 0))
    }
    await Promise.all(tasks)

    expect(peakActive).toBe(3)
    expect(_getQueueState().active).toBe(0)
  })

  it('FIFO порядок: перший waiting запускається першим', async () => {
    const order: number[] = []
    const releases: Array<() => void> = []
    const tasks: Array<Promise<void>> = []

    for (let i = 0; i < 6; i++) {
      tasks.push(
        withUploadSlot(async () => {
          order.push(i)
          await new Promise<void>((resolve) => releases.push(resolve))
        }),
      )
    }
    await new Promise((r) => setTimeout(r, 0))

    // Перші 3 стартували
    expect(order).toEqual([0, 1, 2])

    // Звільняємо по одному — мають заходити 3, 4, 5 у такому порядку
    releases[0]()
    await new Promise((r) => setTimeout(r, 0))
    releases[1]()
    await new Promise((r) => setTimeout(r, 0))
    releases[2]()
    await new Promise((r) => setTimeout(r, 0))

    expect(order).toEqual([0, 1, 2, 3, 4, 5])

    // Cleanup
    while (releases.length) releases.shift()!()
    await Promise.all(tasks)
  })

  it('обробляє одночасні викликати з throws без втрати слотів', async () => {
    const tasks = [
      withUploadSlot(async () => { throw new Error('1') }).catch(() => null),
      withUploadSlot(async () => { throw new Error('2') }).catch(() => null),
      withUploadSlot(async () => { throw new Error('3') }).catch(() => null),
      withUploadSlot(async () => { throw new Error('4') }).catch(() => null),
    ]
    await Promise.all(tasks)
    expect(_getQueueState().active).toBe(0)
    expect(_getQueueState().waiting).toBe(0)
  })

  // ─── AbortSignal ────────────────────────────────────────────────────────

  it('signal aborted ДО виклику → миттєво throw UploadAbortedError', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(
      withUploadSlot(async () => 'ok', controller.signal),
    ).rejects.toBeInstanceOf(UploadAbortedError)
    expect(_getQueueState().active).toBe(0)
  })

  it('signal abort під час очікування у waiting → видаляє з черги, інші проходять', async () => {
    const releases: Array<() => void> = []
    // Заповнити 3 active слоти
    const blockers = [0, 1, 2].map(() =>
      withUploadSlot(async () => {
        await new Promise<void>((r) => releases.push(r))
      }),
    )
    await new Promise((r) => setTimeout(r, 0))
    expect(_getQueueState().active).toBe(3)

    // Запустити 4-й через signal — він стане у чергу
    const controller = new AbortController()
    const aborted = withUploadSlot(async () => 'should-not-run', controller.signal).catch((e) => e)
    await new Promise((r) => setTimeout(r, 0))
    expect(_getQueueState().waiting).toBe(1)

    // Abort — має видалити з черги
    controller.abort()
    const result = await aborted
    expect(result).toBeInstanceOf(UploadAbortedError)
    expect(_getQueueState().waiting).toBe(0)

    // Звільнити active — пайплайн чистий
    releases.forEach((r) => r())
    await Promise.all(blockers)
    expect(_getQueueState().active).toBe(0)
  })

  it('hard stop сценарій: 6 завдань, abort усього batch після 1-го виконання', async () => {
    const controller = new AbortController()
    const releases: Array<() => void> = []
    const completed: number[] = []
    const aborted: number[] = []

    const tasks = Array.from({ length: 6 }, (_, i) =>
      withUploadSlot(async () => {
        await new Promise<void>((r) => releases.push(r))
        completed.push(i)
      }, controller.signal).catch((e) => {
        if (e instanceof UploadAbortedError) aborted.push(i)
        else throw e
      }),
    )

    await new Promise((r) => setTimeout(r, 0))
    // 3 active, 3 waiting
    expect(_getQueueState().active).toBe(3)
    expect(_getQueueState().waiting).toBe(3)

    // Перший завершується
    releases[0]()
    await new Promise((r) => setTimeout(r, 0))

    // Hard stop: abort batch — pending мають отримати UploadAbortedError
    controller.abort()
    // Звільняємо інших активних щоб тести не висіли
    while (releases.length) releases.shift()!()
    await Promise.all(tasks)

    // Pending (ті що чекали в waiting на момент abort) — мають бути aborted
    expect(aborted.length).toBeGreaterThanOrEqual(2) // мінімум 2 з 3 waiting
    expect(_getQueueState().active).toBe(0)
    expect(_getQueueState().waiting).toBe(0)
  })
})
