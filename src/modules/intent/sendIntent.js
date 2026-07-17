// ⚠️ UIA — спільний submit для ВСІХ Producer'ів (Закон №6).
// Перша абстракція, що ЗАРОБИЛА право на існування (Rule #0): 2 реальні читачі — button + text.
// Producer організовує захоплення вводу та формує Intent; sendIntent лише доставляє його
// в єдиний ingress. НЕ знає підсистем, НЕ виконує. Видаляється разом з модулем intent.
import apiClient from '../../utils/apiClient'

export const INTENT_VERSION = 1 // F6 — версія контракту (адитивна еволюція)

/**
 * @param {string} verb      — платформний примітив, напр. 'CREATE'
 * @param {Array<{type:string, params?:object}>} objects — семантичні обʼєкти ('Board')
 * @param {string} clientId  — провенанс джерела: 'ui.button' | 'text' | 'ui.hotkey' | …
 */
export async function sendIntent(verb, objects, clientId) {
  const res = await apiClient.post('/v1/intents/', {
    v: INTENT_VERSION,
    verb,
    objects,
    provenance: { client_id: clientId },
  })
  return res?.data ?? res
}

/**
 * AI-Producer #1: parse-крок (parse ≠ execute). Фраза → пропозиція Intent
 * {status: propose|clarify|none, verb, objects, risk, explain, candidates?, pick_template?}.
 * Нічого не виконує — виконання йде звичайним sendIntent після Resolution Policy на FE.
 */
export async function parseAi(phrase, boardId = null, history = [], boardSummary = null, tools = null) {
  const res = await apiClient.post('/v1/intents/ai/parse/', {
    phrase,
    context: {
      board_id: boardId,
      board_summary: boardSummary, // Phase 2.6 «зір»: read-only стан відкритої дошки
      tools,                       // Phase 2.7: каталог доступних інструментів дошки
    },
    history, // Phase 2: останні ≤6 реплік діалогу (user/assistant) для follow-up'ів
  })
  return res?.data ?? res
}
