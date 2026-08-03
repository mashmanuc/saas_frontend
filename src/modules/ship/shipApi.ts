/**
 * North Ship API (Фаза 3) — рендер AST-уроку в презентацію.
 *
 * Знімки сцен сюди НЕ передаються: вони вже завантажені тим самим капчером,
 * що годує PDF-експорт (`uploadExportPreview` → WBExportPreparation).
 * Статус читається існуючим `winterboardApi.getExport` — окремого polling-
 * ендпоінта немає навмисно.
 *
 * Усе за флагом FEATURE_SHIP на бекенді: вимкнений → 404.
 */
import apiClient from '@/utils/apiClient'

const BASE = '/v1/ship'

export interface ShipArtifactInfo {
  id: string
  type: string
  title: string
  sections: number
}

export interface ShipRenderResponse {
  id: string
  status: string
  format: string
  file_url: string | null
  /** Заповнюється лише полінгом WBExport — сам запуск помилки не повертає. */
  error?: string | null
  poll_url: string
}

export const shipApi = {
  /**
   * Чи має ця дошка AST-урок. `null` = немає (404) або ship вимкнено —
   * для FE це одне й те саме: кнопки презентації просто не буде.
   */
  getSessionArtifact(sessionId: string): Promise<ShipArtifactInfo | null> {
    return apiClient
      .get(`${BASE}/sessions/${sessionId}/artifact/`)
      .then((r: any) => r.data ?? r)
      .catch(() => null)
  },

  renderPptx(artifactId: string, idempotencyKey?: string): Promise<ShipRenderResponse> {
    const headers: Record<string, string> = {}
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey
    return apiClient
      .post(`${BASE}/artifacts/${artifactId}/render/pptx/`, {}, { headers })
      .then((r: any) => r.data ?? r)
  },
}

export default shipApi
