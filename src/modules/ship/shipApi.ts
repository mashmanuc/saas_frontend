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


export interface EnrichPatch {
  task_ref: string
  action: 'add_card' | 'add_formula'
  card_data: {
    title: string
    body: string
    badge: string
  }
  latex_valid: boolean
  latex_error: string
  /** A-T1: картка — переказ умови (лексичне покриття ≥70%); галочка знята за замовчуванням. */
  low_value?: boolean
  /** Та сама картка вже запропонована іншій задачі — її task_ref. */
  duplicate_of?: string
  /** Ця картка ВЖЕ лежить в уроці з попереднього запуску. Промпт просить
   *  модель не повторюватись — вона не слухається, тож перевіряє код.
   *  Галочка знята; вибрати все одно можна. */
  already_on_board?: boolean
  /** Початок умови задачі. ID банку («10719») тьютору нічого не каже —
   *  свою задачу він упізнає за текстом. Опційне: старий BE поля не шле. */
  task_title?: string
}

/** A-T1: свідомий пропуск задачі («нема чого додати») — гейт «вміє мовчати». */
export interface EnrichSkip {
  task_ref: string
  reason: string
  /** Початок умови задачі. ID банку («10719») тьютору нічого не каже —
   *  свою задачу він упізнає за текстом. Опційне: старий BE поля не шле. */
  task_title?: string
}

export interface EnrichResponse {
  patches: EnrichPatch[]
  error: string | null
  /** N1 Фаза 4.1: скільки задач реально пройшло LLM (пакетами) з усього уроку. */
  processed_tasks: number
  total_tasks: number
  /** N1 Фаза 4.1.1: рефи задач із пакетів, що впали з помилкою — готово для
   *  майбутньої кнопки «Повторити необроблені» (shipApi.enrich(id, instr, refs)). */
  failed_task_refs: string[]
  /** A-T1: свідомі пропуски моделі. UI-лічильник — зона B-T2. */
  skipped?: EnrichSkip[]
  /**
   * 2026-08-16 (живий випадок власника: «що ти вмієш?» у полі ✨ → 3 списання
   * і 4 випадкові картки): класифікатор упізнав ПИТАННЯ до асистента, а не
   * інструкцію → BE зупинився ДО пакетів (1 списання за класифікацію),
   * patches порожні. UI показує підтвердження «Спитати Інтегралика?» /
   * «Ні, збагатити як є» (повторний виклик із forceFreeform=true).
   */
  kind?: 'question'
}

/** Проміжний стан enrich (GET progress): скільки задач уже пройшло LLM. */
export interface EnrichProgress {
  processed: number
  total: number
  done: boolean
  /** false — BE ще не записав жодного стану (запит щойно стартував) або ключ протух. */
  known: boolean
}

export interface EnrichApplyResponse {
  sections_added: number
  error: string | null
  /** Скільки карток не вдалось прив'язати до своєї задачі (пішли на нову сторінку). */
  unbound_count?: number
  /** Номери сторінок (1-based), куди лягли картки — щоб сказати тьютору, де дивитись. */
  page_numbers?: number[]
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

  /**
   * Фаза 4: mass AI enrichment — sends instruction + optional task_ids,
   * returns array of patches for tutor preview.
   * `progressId` (uuid) — BE під час обробки пакетів пише проміжний стан,
   * який читає `enrichProgress()`; так UI показує чесний «5 з 12».
   */
  enrich(
    artifactId: string,
    instruction: string,
    // Рефи задач (BE робить str()); сюди ж віддаються failed_task_refs для
    // дозбору «Повторити необроблені».
    taskIds?: Array<number | string>,
    progressId?: string,
    /** «Ні, збагатити як є» після kind:'question' — BE пропускає класифікацію
     *  жанру (не платимо за неї вдруге) і йде вільною формою. */
    forceFreeform?: boolean,
  ): Promise<EnrichResponse> {
    const body: Record<string, unknown> = { instruction }
    if (taskIds && taskIds.length) body.task_ids = taskIds
    if (progressId) body.progress_id = progressId
    if (forceFreeform) body.force_freeform = true
    return apiClient
      .post(`${BASE}/artifacts/${artifactId}/enrich/`, body)
      .then((r: any) => r.data ?? r)
  },

  /**
   * Проміжний стан enrich за progressId (пишеться BE після кожного пакета).
   * `known:false` — ще не дійшло до першого пакета або ключ протух. Мережевий
   * збій поллінгу не має ламати сам enrich — тому catch → null.
   */
  enrichProgress(artifactId: string, progressId: string): Promise<EnrichProgress | null> {
    return apiClient
      .get(`${BASE}/artifacts/${artifactId}/enrich/progress/${progressId}/`)
      .then((r: any) => r.data ?? r)
      .catch(() => null)
  },

  /**
   * Фаза 4: apply selected patches to artifact AST.
   */
  enrichApply(artifactId: string, patches: EnrichPatch[]): Promise<EnrichApplyResponse> {
    return apiClient
      .post(`${BASE}/artifacts/${artifactId}/enrich/apply/`, { patches })
      .then((r: any) => r.data ?? r)
  },
}

export default shipApi
