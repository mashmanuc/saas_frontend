/**
 * «Запропонувати домашку» (власник 2026-10-19) — один запит, відповідь — пропозиція списку.
 * Сервер read-only: дошку не пише. Без повторів (LAW §12).
 */
import apiClient from '../../utils/apiClient'

// apiClient уже віддає тіло; `data` лишається на випадок глобальної обгортки.
const unwrap = (r) => r?.data ?? r

/** `{title, lesson, date, instruction, items:[{id,text,short,answer}], copy_text, task_count, requested, message}`. */
export function proposeHomework({ boardId, count, exclude = [] }) {
  return apiClient.post('/v1/intents/homework/', { board_id: boardId, count, exclude }).then(unwrap)
}

/**
 * Картка «Домашнє завдання» картинкою (PNG) для месенджера — малює сервер (формули, підпис M4SH).
 * Повертає обіцянку Blob: її можна віддати в `ClipboardItem` одразу, не чекаючи, — натиск не загубиться.
 * `answers` — учитель показав відповіді у вікні: картинка йде з блоком «Відповіді» (власник 20.10).
 */
export function homeworkImage({ boardId, ids, answers = false }) {
  return apiClient.post('/v1/intents/homework/image/', { board_id: boardId, ids, answers }, { responseType: 'blob' })
    .then((r) => (r instanceof Blob ? r : r?.data))
}
