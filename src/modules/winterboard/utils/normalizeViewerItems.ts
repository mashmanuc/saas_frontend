// WB: normalizeViewerItems — інваріантний шар перетворення контент-даних у ViewerSlide[].
// Ref: PLAN.md v2.1 §1.2

import type { ViewerSlide } from '../types/winterboard'
import type { ContentItemDetail } from '../../learning-content/types/learningContent'

export type { ViewerSlide }

/**
 * Перетворює content_json.slides (будь-який формат бекенду) → Array<ViewerSlide>.
 * Формат бекенду: { "1": { image_url }, "2": { image_url }, ... } (1-based ключі)
 */
export function normalizeSlides(raw: unknown): ViewerSlide[] {
  if (!raw || typeof raw !== 'object') return []
  return Object.entries(raw as Record<string, { image_url?: string }>)
    .map(([key, val]) => ({
      index: parseInt(key, 10) - 1,  // конвертуємо в 0-based
      url: val?.image_url ?? '',
    }))
    .filter(s => s.url)
    .sort((a, b) => a.index - b.index)
}

/**
 * Перетворює content_json.pages → Array<ViewerSlide>.
 * Формат бекенду: { "1": { thumbnail_url }, "2": { thumbnail_url }, ... } (1-based ключі)
 */
export function normalizePages(raw: unknown): ViewerSlide[] {
  if (!raw || typeof raw !== 'object') return []
  return Object.entries(raw as Record<string, { thumbnail_url?: string }>)
    .map(([key, val]) => ({
      index: parseInt(key, 10) - 1,  // 0-based
      url: val?.thumbnail_url ?? '',
    }))
    .filter(p => p.url)
    .sort((a, b) => a.index - b.index)
}

/**
 * Диспетчер: визначає тип контенту і повертає нормалізований ViewerSlide[].
 * Інваріант: ViewerSlide[] — єдина структура, яку бачить Viewer.
 */
export function buildViewerItems(detail: ContentItemDetail): ViewerSlide[] {
  const cj = (detail as any).content_json ?? {}
  const type = (detail as any).type ?? ''

  if (type === 'presentation') {
    return normalizeSlides(cj.slides)
  }
  if (type === 'pdf' || type === 'document') {
    return normalizePages(cj.pages)
  }
  return []
}
