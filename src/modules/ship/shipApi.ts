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

export interface ShipTheme {
  name: string
  /** Підпис із бекенду. FE перекриває його своїм i18n, коли ключ є. */
  label: string
}

export interface ShipThemeList {
  default: string
  themes: ShipTheme[]
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

  /**
   * Теми оформлення для пікера. Порожній список = ship вимкнено або мережа
   * лягла: діалог просто не покаже вибір і відрендерить темою за умовчанням.
   */
  getThemes(): Promise<ShipThemeList | null> {
    return apiClient
      .get(`${BASE}/themes/`)
      .then((r: any) => r.data ?? r)
      .catch(() => null)
  },

  renderPptx(
    artifactId: string,
    options: { theme?: string; solutions?: boolean; idempotencyKey?: string } = {},
  ): Promise<ShipRenderResponse> {
    const headers: Record<string, string> = {}
    if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey
    const body: Record<string, unknown> = {}
    if (options.theme) body.theme = options.theme
    // «Слайди розбору після задач» (D-2): кадри-розкриття з наявного
    // solution/answer банку — колода довшає, тож рішення за тьютором.
    if (options.solutions) body.solutions = true
    return apiClient
      .post(`${BASE}/artifacts/${artifactId}/render/pptx/`, body, { headers })
      .then((r: any) => r.data ?? r)
  },
}

export default shipApi
