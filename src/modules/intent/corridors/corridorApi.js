/**
 * Коридори Інтегралика — REST (ТЗ 2026-09-17 §3.5, §4).
 *
 * Сервер — джерело правди: реєстр предметів і мов, рішення «Авто» і зафіксований
 * вибір учителя. Клієнт не шле ні `allowed_tools`, ні профіль прав (§3.2).
 * 404 = rollout-гейт вимкнений для цього акаунта — штатний стан, не помилка.
 */
import apiClient from '../../../utils/apiClient'

const unwrap = (r) => r?.data ?? r

export function fetchCorridorRegistry(locale = 'uk') {
  return apiClient.get('/v1/intents/corridors/', { params: { locale } }).then(unwrap)
}

export function resolveCorridor({ boardId, boardSummary = null, conversationId = null, locale = 'uk' }) {
  return apiClient.post('/v1/intents/corridors/resolve/', {
    board_id: boardId,
    board_summary: boardSummary,
    conversation_id: conversationId,
    locale,
  }).then(unwrap)
}

export function getAssistantContext(sessionId) {
  return apiClient.get(`/v1/winterboard/sessions/${sessionId}/assistant-context/`).then(unwrap)
}

/** body: {subject?: id|'auto', content_language?: 'uk'|'en'|'auto', source: 'explicit_palette'|'explicit_remote'} */
export function patchAssistantContext(sessionId, body) {
  return apiClient.patch(`/v1/winterboard/sessions/${sessionId}/assistant-context/`, body).then(unwrap)
}
