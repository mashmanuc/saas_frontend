// WB: useUploadQueue — глобальний concurrency-limit для image uploads.
//
// Призначення: під час швидкої вставки 10+ картинок (Ctrl+V × N) frontend
// не повинен паралельно надсилати N запитів `presign` — це гарантовано
// тригерить rate limit (429) на бекенді. Замість цього обмежуємо число
// одночасно активних uploads до MAX_CONCURRENT, решта чекає у черзі.
//
// Архітектура: module-level state (singleton). Це навмисно — semaphore
// має бути ОДИН на весь застосунок, інакше різні composable instances
// не координуватимуться між собою і ламатимуть rate limit.
//
// Cancellation: через стандартний AbortSignal. Викликач може передати signal,
// якщо abort трапився поки слот чекає — резолв миттєво відхиляється з
// AbortError (DOMException). Активні uploads НЕ переривають network запит,
// але retry loop у uploadFileToStorage перевіряє signal перед кожним attempt.

import { ref, readonly, computed } from 'vue'

const MAX_CONCURRENT = 3

let active = 0
const waiting: Array<() => void> = []

// Reactive state для UI: показ "Uploading X / Y" в WBUploadIndicator.
const _activeRef = ref(0)
const _waitingRef = ref(0)

function _syncRefs() {
  _activeRef.value = active
  _waitingRef.value = waiting.length
}

/** Reactive view на стан черги — для показу прогресу в UI. */
export function useUploadQueueState() {
  return {
    active: readonly(_activeRef),
    waiting: readonly(_waitingRef),
    /** Скільки uploads "в роботі" (active + waiting). */
    inFlight: computed(() => _activeRef.value + _waitingRef.value),
    max: MAX_CONCURRENT,
  }
}

/**
 * Sentinel error для скасованих uploads. Не WBUploadError, бо queue
 * не залежить від upload domain. handleImagePaste розрізняє через .name.
 */
export class UploadAbortedError extends Error {
  constructor(message = 'Upload aborted') {
    super(message)
    this.name = 'UploadAbortedError'
  }
}

/**
 * Виконує `fn` з гарантією, що одночасно активних не більше MAX_CONCURRENT.
 * Якщо ліміт досягнуто — чекає у черзі (FIFO). Слот звільняється завжди:
 * як на success, так і на throw.
 *
 * Якщо переданий `signal` спрацьовує під час очікування — викидається
 * UploadAbortedError, слот не займається. Якщо `signal` спрацьовує під час
 * виконання `fn` — це справа самого `fn` (через свій signal handler).
 */
export async function withUploadSlot<T>(
  fn: () => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  if (signal?.aborted) {
    throw new UploadAbortedError('Aborted before slot acquisition')
  }

  if (active >= MAX_CONCURRENT) {
    await new Promise<void>((resolve, reject) => {
      let released = false
      const onAbort = () => {
        if (released) return
        released = true
        // Видаляємо себе з waiting (не блокуємо інших)
        const idx = waiting.indexOf(release)
        if (idx >= 0) waiting.splice(idx, 1)
        _syncRefs()
        reject(new UploadAbortedError('Aborted while waiting for slot'))
      }
      const release = () => {
        if (released) return
        released = true
        signal?.removeEventListener('abort', onAbort)
        if (signal?.aborted) {
          reject(new UploadAbortedError('Aborted before slot acquisition'))
        } else {
          resolve()
        }
      }
      signal?.addEventListener('abort', onAbort, { once: true })
      waiting.push(release)
      _syncRefs()
    })
  }

  active++
  _syncRefs()
  try {
    return await fn()
  } finally {
    active--
    const next = waiting.shift()
    if (next) next()
    _syncRefs()
  }
}

/** Для тестів і діагностики. */
export function _getQueueState() {
  return { active, waiting: waiting.length, max: MAX_CONCURRENT }
}

/** Для тестів — скинути стан. */
export function _resetQueue(): void {
  active = 0
  waiting.length = 0
  _syncRefs()
}
