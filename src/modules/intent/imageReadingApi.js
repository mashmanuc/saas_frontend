/**
 * Коректор розпізнаного — REST (ТЗ `saas_docs/domains/intent/TZ_IMAGE_READING_CORRECTOR_2026-10-08.md` §4).
 *
 * Сервер — джерело правди: що прочитано, чиє виправлення діє, хто має право.
 * Клієнт шле лише `board_id` (сесія дошки) і `object_id` (виділена картинка) —
 * адресу картинки сервер бере з канонічного стану дошки сам (К1), тож її тут немає.
 *
 * Без повторів (LAW §12): кожна дія — один запит, відповідь — єдиний стан блока.
 */
import apiClient from '../../utils/apiClient'

const BASE = '/v1/intents/image-reading/'

// apiClient уже віддає тіло; `data` лишається на випадок глобальної обгортки.
const unwrap = (r) => r?.data ?? r

const ids = ({ boardId, objectId }) => ({ board_id: boardId, object_id: objectId })

/** Що прочитано: `{status, segments, model, read_at, can_edit}`. Безкоштовно. */
export function fetchImageReading(ref) {
  // Запит іде на кожне виділення картинки — без глобальної смуги завантаження,
  // блок показує власний стан.
  return apiClient.get(BASE, { params: ids(ref), meta: { skipLoader: true } }).then(unwrap)
}

/** Прочитати моделлю (платна дія). `force` — «Прочитати заново». */
export function readImage(ref, { force = false } = {}) {
  const body = force ? { ...ids(ref), force: true } : ids(ref)
  return apiClient.post(`${BASE}read/`, body).then(unwrap)
}

/** Зберегти виправлення — УСІ сегменти разом (сервер замінює прочитане вчителя цілим). */
export function saveImageReading(ref, segments) {
  return apiClient.put(BASE, { ...ids(ref), segments }).then(unwrap)
}

/** «Прочитано правильно». */
export function confirmImageReading(ref) {
  return apiClient.post(`${BASE}confirm/`, ids(ref)).then(unwrap)
}

/** Прибрати своє виправлення — назад до прочитаного моделлю. */
export function revertImageReading(ref) {
  return apiClient.delete(BASE, { params: ids(ref) }).then(unwrap)
}
