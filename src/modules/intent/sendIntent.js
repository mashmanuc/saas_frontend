// ⚠️ UIA — спільний submit для ВСІХ Producer'ів (Закон №6).
// Перша абстракція, що ЗАРОБИЛА право на існування (Rule #0): 2 реальні читачі — button + text.
// Producer організовує захоплення вводу та формує Intent; sendIntent лише доставляє його
// в єдиний ingress. НЕ знає підсистем, НЕ виконує. Видаляється разом з модулем intent.
import apiClient from '../../utils/apiClient'
import { i18n } from '@/i18n'

export const INTENT_VERSION = 1 // F6 — версія контракту (адитивна еволюція)

/**
 * @param {string} verb      — платформний примітив, напр. 'CREATE'
 * @param {Array<{type:string, params?:object}>} objects — семантичні обʼєкти ('Board')
 * @param {string} clientId  — провенанс джерела: 'ui.button' | 'text' | 'ui.hotkey' | …
 */
export async function sendIntent(verb, objects, clientId) {
  // Вісь UI Locale потрібна і виконавчому шляху. EN_GUIDE має нуль дій;
  // сервер відріже будь-який submit, якщо UI випадково покаже заборонену
  // команду. Це defense-in-depth, не заміна серверної авторизації.
  const locale = i18n.global.locale.value || 'uk'
  const res = await apiClient.post('/v1/intents/', {
    v: INTENT_VERSION,
    verb,
    objects,
    provenance: { client_id: clientId, locale },
  })
  return res?.data ?? res
}

/**
 * AI-Producer #1: parse-крок (parse ≠ execute). Фраза → пропозиція Intent
 * {status: propose|clarify|none, verb, objects, risk, explain, candidates?, pick_template?}.
 * Нічого не виконує — виконання йде звичайним sendIntent після Resolution Policy на FE.
 */
export async function parseAi(phrase, boardId = null, history = [], boardSummary = null, tools = null, locale = null, conversationId = null, page = null) {
  const res = await apiClient.post('/v1/intents/ai/parse/', {
    phrase,
    context: {
      board_id: boardId,
      board_summary: boardSummary, // Phase 2.6 «зір»: read-only стан відкритої дошки
      tools,                       // Phase 2.7: каталог доступних інструментів дошки
      locale,                      // Вісь 1 — UI Locale (BE resolve_runtime_context будує Вісь 2+3)
      // Фаза 2 «пам'ять чату»: ключ РОЗМОВИ. Свідомо не board_id — той буває
      // null, доки дошки ще немає, а саме в перших репліках тьютор і
      // проговорює мету. Сервер за цим ключем тримає згорнутий стан старших
      // реплік; хвіст `history` і далі шлемо дослівно.
      conversation_id: conversationId,
      // E3 (2026-08-28, живий випадок власника на /tutor/schedule): без цього
      // поля Інтегралик поза дошкою не знає НІЧОГО про місце розмови, тож на
      // «яка вкладка відкрита» відповідав єдиним, що мав, — «не бачу дошки».
      // Питання було не про дошку. Маршрут у палітри був завжди (useRoute),
      // просто не доїжджав до моделі.
      page,
    },
    history, // Phase 2: останні ≤6 реплік діалогу (user/assistant) для follow-up'ів
  })
  return res?.data ?? res
}
