/**
 * appFatalError — спільний прапорець «застосунок у нерятівному стані».
 *
 * 2026-07-26: до цього існували ДВА непов'язані механізми, і між ними була дірка:
 *   1) компонент упав під час рендеру → `onErrorCaptured` → AppErrorBoundary ✅
 *   2) lazy-chunk сторінки не завантажився (стара вкладка після деплою — файл із
 *      старим хешем уже видалений з CDN) → Vue Router ловить це на СВОЄМУ рівні
 *      (`router.onError`), ДО монтування компонента, тому `onErrorCaptured` фізично
 *      не бачить цей збій → auto-reload раз, а якщо не помогло — мовчазний
 *      `console.error` і застрягла сторінка ❌
 *
 * Цей модуль закриває дірку #2: `router.onError` виставляє прапорець, а
 * AppErrorBoundary його читає і показує вже готову брендовану сторінку.
 *
 * ⚠️ УМИСНО БЕЗ ЗАЛЕЖНОСТЕЙ (лише `ref` з vue — ні i18n, ні notify, ні сторів):
 * AppErrorBoundary самодостатній за дизайном, щоб рендеритись навіть коли впало
 * саме оточення. Імпорт сюди чогось важкого зламає цю гарантію.
 */
import { ref } from 'vue'

/** @typedef {'crash' | 'stale-version'} FatalErrorKind */

/** null = все гаразд; інакше — вид збою (визначає текст на сторінці). */
export const appFatalError = ref(null)

/**
 * Позначити застосунок як нерятівний. Перший виклик виграє — далі no-op, щоб
 * каскад помилок не перемикав текст уже показаної сторінки.
 * @param {FatalErrorKind} kind
 */
export function reportFatalError(kind) {
  if (appFatalError.value) return
  appFatalError.value = kind
}
