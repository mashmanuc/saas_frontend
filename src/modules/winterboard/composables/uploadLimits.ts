/**
 * Спільна логіка лімітів/помилок аплоаду для сайдбарів матеріалів.
 *
 * 2026-07-26: до цього useContentSidebar і useGroupSidebar мали ДВІ незалежні
 * копії обробки помилок, обидві мапили лише 507/429 і зливали решту в загальний
 * `upload_failed` — включно з `file_too_large`, який бекенд присилає з цифрами.
 * Юзер бачив «Помилка завантаження файлу» і не мав шансів дізнатись, що файл
 * просто на пів мегабайта завеликий. Тепер логіка одна на двох.
 *
 * ⚠️ Ліміти — ДЗЕРКАЛО бекенду, НЕ джерело істини. SSOT: `MAX_UPLOAD_SIZE_BYTES`
 * у backend/config/settings.py (читають ContentItemUploadView + LibraryAssetsView).
 * Тут лише pre-flight UX: не гнати десятки МБ по мережі, щоб отримати 400, і не
 * малювати фальшиве «Обробка…» на файл, який не долетить. Якщо значення
 * розійдуться — істина за бекендом, ми просто покажемо його відповідь.
 */

/** МБ на файл, за типом контенту. Дзеркало backend MAX_UPLOAD_SIZE_BYTES. */
export const UPLOAD_SIZE_LIMITS_MB: Record<string, number> = {
  image: 50, pdf: 50, audio: 50, video: 50, presentation: 50, document: 50,
}

const DEFAULT_LIMIT_MB = 50

export type UploadErrorInfo = {
  key: string
  params: Record<string, string | number>
}

/**
 * Pre-flight: чи влізає файл. Повертає готову помилку або null якщо все гаразд.
 */
export function checkUploadSize(file: File, contentType: string): UploadErrorInfo | null {
  const limitMb = UPLOAD_SIZE_LIMITS_MB[contentType] ?? DEFAULT_LIMIT_MB
  if (file.size <= limitMb * 1024 * 1024) return null
  return {
    key: 'file_too_large',
    params: { actual: (file.size / 1024 / 1024).toFixed(1), limit: limitMb },
  }
}

/**
 * Розбір помилки аплоаду з бекенду → i18n-ключ + параметри для t().
 * Бекенд на завеликий файл віддає {error:'file_too_large', limit_mb, actual_mb}.
 */
export function parseUploadError(e: unknown): UploadErrorInfo {
  const err = e as {
    response?: {
      status?: number
      data?: { error?: string; limit_mb?: number; actual_mb?: number }
    }
  }
  const status = err?.response?.status
  const body = err?.response?.data
  const code = body?.error

  if (status === 507) return { key: 'quota_exceeded', params: {} }
  if (status === 429) return { key: 'rate_limited', params: {} }
  if (code === 'file_too_large') {
    return {
      key: 'file_too_large',
      params: { actual: body?.actual_mb ?? '?', limit: body?.limit_mb ?? '?' },
    }
  }
  return { key: 'upload_failed', params: {} }
}
