/**
 * Фон сторінки — фото (власник 2026-09-28, «так, фото фоном — роби»).
 *
 * Фото заповнює всю сторінку (краї знімка обрізаються, без порожніх смуг) і лежить позаду всіх
 * написів і об'єктів. Записується штатною дією сторінки `background_update { background }`
 * (сервер уже складає її в `page.background`, chunk_store), тож фон бачать учень (через стан
 * сервера), Replay і перезавантаження. Попередній фон сторінки зберігаємо в `prev` — його
 * повертає «Прибрати фон».
 */
import type { WBImageBackground, WBPageBackground, WBPdfBackground } from '../types/winterboard'

const PATTERNS: ReadonlySet<string> = new Set(['white', 'grid', 'dots', 'lined'])

/** Адреса картинки фону: лише http(s) або шлях сайту — не data:/blob: (їх не побачить учень). */
export function isSafeBackgroundUrl(url: unknown): url is string {
  return typeof url === 'string' && url.length > 0 && url.length <= 2048
    && (/^https?:\/\//i.test(url) || (url.startsWith('/') && !url.startsWith('//')))
}

export function isImageBackground(bg: unknown): bg is WBImageBackground {
  return !!bg && typeof bg === 'object' && (bg as { type?: unknown }).type === 'image'
    && isSafeBackgroundUrl((bg as { url?: unknown }).url)
}

type NonImageBackground = Exclude<WBPageBackground, WBImageBackground>

function normalizeNonImage(raw: unknown): NonImageBackground | null {
  if (typeof raw === 'string') return PATTERNS.has(raw) ? (raw as NonImageBackground) : null
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (o.type === 'pdf' && typeof o.url === 'string' && typeof o.assetId === 'string') {
    return { type: 'pdf', url: o.url, assetId: o.assetId } as WBPdfBackground
  }
  return null
}

/**
 * Фон з операції чи стану — лише відомі значення; невідоме → null (не застосовувати).
 * Для фото: адреса — http(s) або шлях сайту; `prev` — лише не-фото фон.
 */
export function normalizePageBackground(raw: unknown): WBPageBackground | null {
  if (raw && typeof raw === 'object' && (raw as { type?: unknown }).type === 'image') {
    const o = raw as Record<string, unknown>
    if (!isSafeBackgroundUrl(o.url)) return null
    const bg: WBImageBackground = { type: 'image', url: o.url }
    if (typeof o.assetId === 'string' && o.assetId) bg.assetId = o.assetId
    if (typeof o.requestId === 'string' && o.requestId) bg.requestId = o.requestId
    const prev = normalizeNonImage(o.prev)
    if (prev) bg.prev = prev
    return bg
  }
  return normalizeNonImage(raw)
}

/** Поставити фото фоном: попередній (не-фото) фон — у `prev`, щоб «Прибрати фон» його повернув. */
export function withImageBackground(
  current: WBPageBackground | undefined,
  image: { url: string; assetId?: string; requestId?: string },
): WBImageBackground {
  const prev: NonImageBackground = isImageBackground(current)
    ? (current.prev ?? 'white')
    : (normalizeNonImage(current) ?? 'white')
  return {
    type: 'image',
    url: image.url,
    ...(image.assetId ? { assetId: image.assetId } : {}),
    ...(image.requestId ? { requestId: image.requestId } : {}),
    prev,
  }
}

/** «Прибрати фон»: повертаємо фон, що був до фото (або білий). */
export function withoutImageBackground(current: WBPageBackground | undefined): WBPageBackground {
  return isImageBackground(current) ? (current.prev ?? 'white') : (current ?? 'white')
}

/**
 * Кадр джерела, що заповнює сторінку без спотворення: зберігаємо пропорції, зайве з країв
 * обрізаємо (як шпалери на телефоні). Результат — `crop` для Konva Image.
 */
export function coverCrop(
  imgW: number, imgH: number, pageW: number, pageH: number,
): { x: number; y: number; width: number; height: number } {
  if (!(imgW > 0 && imgH > 0 && pageW > 0 && pageH > 0)) return { x: 0, y: 0, width: imgW, height: imgH }
  const scale = Math.max(pageW / imgW, pageH / imgH)
  const width = pageW / scale
  const height = pageH / scale
  return { x: (imgW - width) / 2, y: (imgH - height) / 2, width, height }
}
