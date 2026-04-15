/**
 * Phase ops-only migration: SessionWriteLock
 *
 * Серіалізує write-операції до `WBSession` на клієнті так, щоб backend
 * ніколи не отримував одночасні `POST /replay/batch/` на ту саму сесію.
 * Це усуває 409 session_locked від select_for_update(skip_locked=True).
 *
 * **Must-have (advisor):** timeout / cancel safety — lock НІКОЛИ не може
 * зависнути. Якщо попередня задача застрягла у retry/network ≥ 5с —
 * наступна все одно стартує. Попередня відбувається у background, її
 * release не змусить наступну чекати.
 *
 * Usage:
 *   const lock = createSessionWriteLock()
 *   await lock.run(() => api.recordOperationsBatch(sid, ops))
 *
 * Один instance на сесію (створюється у composable при init).
 */

const LOCK_TIMEOUT_MS = 5_000

export interface SessionWriteLock {
  run<T>(task: () => Promise<T>): Promise<T>
}

export function createSessionWriteLock(): SessionWriteLock {
  let current: Promise<unknown> = Promise.resolve()

  async function run<T>(task: () => Promise<T>): Promise<T> {
    const prev = current

    // Захист від зависшої попередньої task: не чекаємо довше LOCK_TIMEOUT_MS.
    // Якщо попередня дійсно зависла — її completion просто не блокує нашу.
    const waitForPrev = Promise.race([
      prev.then(
        () => undefined,
        () => undefined, // prev rejection не повинен ламати наступну task
      ),
      new Promise<void>((resolve) => setTimeout(resolve, LOCK_TIMEOUT_MS)),
    ])

    // Беремо lock "у черзі" — current тримає проміс який резолвиться
    // коли наша task завершиться. Наступний run() чекатиме цю current.
    let release: () => void
    const ourTurn = new Promise<void>((r) => {
      release = r
    })
    current = ourTurn

    try {
      await waitForPrev
      return await task()
    } finally {
      release!()
    }
  }

  return { run }
}
