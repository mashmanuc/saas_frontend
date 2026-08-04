/**
 * Хвиля 5: запис живого об'єкта в AST уроку (TASK_LIVE_OBJECTS_IN_DECK §1).
 *
 * Коли тьютор тисне «Побудувати» на задачі — companion-об'єкт з'являється на
 * дошці, а сюди летить подія «створено навчальний об'єкт»: BE вставляє
 * scene-секцію в AST поруч із задачею. Далі все вже працює саме собою:
 * експорт презентації знаходить секцію і бере знімок за asset_id.
 *
 * Канал СВІДОМО вузький: ЛИШЕ подія створення, ЛИШЕ в артефакт цього уроку.
 * Це НЕ синхронізація дошки — стан/операції/снапшоти сюди не течуть.
 *
 * Fire-and-forget: помилка запису не блокує дошку (console.warn, не тиша).
 * Дошки без артефакта (звичайні, не згенеровані уроки) визначаються одним
 * GET і кешуються — далі виклики зникають без мережі.
 */
import apiClient from '@/utils/apiClient'

const BASE = '/v1/ship'

/** sessionId → чи має сесія артефакт (false кешується теж). */
const artifactPresence = new Map<string, boolean | Promise<boolean>>()

async function hasArtifact(sessionId: string): Promise<boolean> {
  const cached = artifactPresence.get(sessionId)
  if (cached !== undefined) return cached

  const probe = apiClient
    .get(`${BASE}/sessions/${sessionId}/artifact/`)
    .then(() => true)
    // 404 = немає артефакта АБО ship вимкнено — для запису це одне й те саме.
    .catch(() => false)
  artifactPresence.set(sessionId, probe)
  const result = await probe
  artifactPresence.set(sessionId, result)
  return result
}

/**
 * Витягує AST-`state` з data companion-а.
 *
 * graph_calculator — єдиний тип з envelope `{version, state, meta}`: у AST їде
 * внутрішній state (та сама форма, що й у Фазі 0). Решта companion-типів
 * тримають data плоско (assetEquality.ts §3.7.4-3.7.10) — їде data цілком.
 */
function extractSceneState(
  kind: string,
  data: Record<string, unknown>,
): Record<string, unknown> {
  if (kind === 'graph_calculator') {
    const state = (data as { state?: unknown }).state
    return state && typeof state === 'object' ? (state as Record<string, unknown>) : {}
  }
  return data
}

export interface CompanionSceneRecord {
  sessionId: string
  assetId: string
  kind: string
  data: Record<string, unknown>
  /**
   * `nmt_task.data.externalId` задачі-джерела ЯК Є — це NMTProblem.external_id
   * (рядок 'nmt-sc-427'), НЕ pk. У pk його резолвить BE — тут БД немає.
   */
  problemExternalId?: string
}

export function recordCompanionScene(record: CompanionSceneRecord): void {
  const { sessionId, assetId, kind, data, problemExternalId } = record
  if (!sessionId || !assetId || !kind) return

  void (async () => {
    try {
      if (!(await hasArtifact(sessionId))) return
      await apiClient.post(`${BASE}/sessions/${sessionId}/scenes/`, {
        kind,
        asset_id: assetId,
        state: extractSceneState(kind, data),
        ...(problemExternalId ? { problem_external_id: problemExternalId } : {}),
      })
    } catch (e) {
      // Не мовчати (LAW §12) — але й не заважати малювати.
      console.warn('[ship] scene record failed', { sessionId, assetId, kind }, e)
    }
  })()
}

/** Для тестів: скинути кеш наявності артефактів. */
export function _resetSceneRecorderCache(): void {
  artifactPresence.clear()
}
