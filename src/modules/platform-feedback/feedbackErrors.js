/**
 * «Ідеї та відгуки»: відмова сервера → зрозумілий текст для людини (ключ перекладу).
 *
 * Скарга тестувальника 2026-10-11: «Не можу надіслати коментар». На проді (FrontendError,
 * користувач 242, 3 спроби) сервер відповів 400 — коментар коротший за 2 символи, — а сторінка
 * не показала причину: помилка обробника дійшла до AppErrorBoundary і замінила весь застосунок
 * екраном «Щось пішло не так», набраний текст пропав. Тепер відмова — повідомлення в самій формі.
 */

/** Те саме правило, що на сервері: `FeedbackCommentCreateSerializer.content` (min_length=2, max_length=2000). */
export const COMMENT_MIN_LENGTH = 2
export const COMMENT_MAX_LENGTH = 2000

/**
 * Довжина так, як її рахує сервер (Python `len` — кодові точки): емодзі «👍» — один символ,
 * хоча в JS `'👍'.length === 2`. Пробіли з країв сервер відкидає (DRF `trim_whitespace`).
 */
export function commentLength(text) {
  return Array.from((text || '').trim()).length
}

/** Код помилки з відповіді: `{error: 'thread_locked'}` або `{error: {code, detail, fields}}`. */
function errorBody(err) {
  const e = err?.response?.data?.error
  if (typeof e === 'string') return { code: e, fields: err?.response?.data?.fields || {} }
  if (e && typeof e === 'object') return { code: e.code || '', fields: e.fields || {} }
  return { code: '', fields: err?.response?.data?.fields || {} }
}

/** Чому не надіслався коментар. */
export function commentErrorKey(err) {
  const status = err?.response?.status
  const { code, fields } = errorBody(err)
  if (status === 400 && fields && fields.content) return 'feedback.comments.errors.tooShort'
  if (status === 423) return code === 'thread_terminal' ? 'feedback.comments.terminal' : 'feedback.comments.locked'
  if (status === 429) return 'feedback.comments.errors.rateLimit'
  if (status === 404) return 'feedback.comments.errors.notFound'
  return 'feedback.comments.errors.generic'
}
