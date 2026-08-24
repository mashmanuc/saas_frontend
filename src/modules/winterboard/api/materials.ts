import apiClient from '@/utils/apiClient'

/**
 * API витягу матеріалів тьютора (Фаза 6-4). Дзеркалить BE-контракт 6-1/6-1b/6-2.
 *
 * ⚠️ `apiClient` уже віддає ТІЛО відповіді, не `.data.data` — жодних
 * розгортань тут немає (FRONTEND_CONVENTIONS).
 */

const BASE = '/v1/winterboard/materials'

// ── Типи, дзеркальні до BE ────────────────────────────────────────────────

/** `text_layer` — з текстового шару файлу; решта — машинне читання. */
export type MaterialSource = 'text_layer' | 'vision' | 'ocr'

/**
 * `verified` буває ЛИШЕ у `text_layer`. Vision дав 96.9 %, OCR — 98.87 %,
 * і жодне з них не 100 (C2). Слова «перевірено» в UI бути не може.
 */
export type MaterialEvidence = 'verified' | 'inferred'

export type WarningCode =
  | 'script_collapsed'          // дефект: письмо розпізналось латиницею-двійником
  | 'fraction_glued_in_table'   // дефект: дріб у комірці втратив риску
  | 'formula_block'             // НЕ дефект: мітка «теорія, у генерацію не піде»

export interface MaterialWarning {
  code: WarningCode
  block_index: number | null
  detail: string
  /** До 120 символів САМЕ зіпсованого місця — щоб показати, де саме. */
  sample?: string
  line?: number
}

export interface MaterialPage {
  page_no: number
  text: string
  source: MaterialSource
  evidence: MaterialEvidence
  status: 'pending' | 'done' | 'failed'
  error: string
  model: string
  tokens: number
  warnings: MaterialWarning[]
  blocks_count: number
  /** true для всього, що не `text_layer` — навіть із порожніми `warnings`. */
  needs_review: boolean
  confirmed_at: string | null
  updated_at: string
}

export interface CostEstimate {
  kind: string
  total_pages: number
  vision_calls: number
  ocr_calls: number
  total_calls: number
  text_layer_pages: number
  cached_pages: number
  skipped_pages: number[]
  blocked_pages: Array<{ page_no: number; reason: string; detail: string }>
  max_pages: number
  billing_key: string
  ocr_enabled: boolean
  upper_bound: boolean
  error: string
}

export interface ExtractResponse {
  asset_id: number
  name: string
  content_type: string
  pages: MaterialPage[]
  cost_estimate: CostEstimate
}

/** 200 — витяг зроблено синхронно; 202 — задача пішла в чергу. */
export interface ExtractReport {
  asset_id: number
  total_pages: number
  vision_calls: number
  ocr_calls: number
  total_calls: number
  text_layer_pages: number
  cached_pages: number
  skipped_pages: number[]
  message: string
  error: string
  pages: Array<{
    page_no: number
    source: MaterialSource
    evidence: MaterialEvidence
    status: string
    chars: number
    warnings: MaterialWarning[]
    needs_review: boolean
  }>
}

export interface ExtractQueued {
  task_id: string
  asset_id: number
  cost_estimate: CostEstimate
}

export interface ConfirmResult {
  asset_id: number
  confirmed_pages: number[]
  /** Завжди false. Підтвердження = «я прочитав», не «модель не помилилась». */
  evidence_changed: boolean
}

// ── Методи ────────────────────────────────────────────────────────────────

export default {
  /**
   * Чи ввімкнено читання матеріалів на цьому сервері.
   *
   * Джерело правди — ОДНЕ, серверне (`MATERIAL_EXTRACT_ENABLED`). FE своїх
   * прапорців тут не заводить: два вимикачі рано чи пізно розійдуться.
   */
  status(): Promise<{ enabled: boolean; ocr: boolean }> {
    return apiClient.get(`${BASE}/status/`)
  },

  /** Сторінки витягу + ціна наперед. 403 — прапорець вимкнено на сервері. */
  read(assetId: number): Promise<ExtractResponse> {
    return apiClient.get(`${BASE}/${assetId}/extract/`)
  },

  /** Запуск. Може повернути готовий звіт (200) або задачу в черзі (202). */
  extract(assetId: number, pages?: number[], force = false):
  Promise<ExtractReport | ExtractQueued> {
    return apiClient.post(`${BASE}/${assetId}/extract/`, { pages, force })
  },

  /** Тьютор підтверджує, що ПРОЧИТАВ сторінки. `evidence` не змінюється. */
  confirm(assetId: number, pages: number[]): Promise<ConfirmResult> {
    return apiClient.post(`${BASE}/${assetId}/extract/confirm/`, { pages })
  },

  /** Скинути кеш витягу (перечитати заново — знову за гроші). */
  reset(assetId: number): Promise<{ asset_id: number; deleted: number }> {
    return apiClient.delete(`${BASE}/${assetId}/extract/`)
  },
}
