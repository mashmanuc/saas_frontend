// Телефон: підготовка фото перед завантаженням (LAW §9 v1.9, 2026-09-26).
//
// Рішення власника: сервер приймає лише JPEG/PNG/WebP, HEIC не конвертує. Тож
// телефон сам готує сумісне фото — розкодовує тим, що вміє браузер (Safari
// розкодовує й HEIC), зменшує й кодує в JPEG.
//
// JPEG перекодовуємо ЗАВЖДИ: так зникають метадані EXIF, серед них GPS-координати
// місця зйомки (фото зі школи не повинно нести її адресу у «Матеріали»).
// Поворот за EXIF браузер уже врахував у пікселях.
// PNG/WebP (здебільшого знімки екрана з текстом) у межах ліміту їдуть як є —
// повторне стиснення в JPEG лише розмило б дрібний текст.

import { PHOTO_MIME_TYPES } from './photoContract'

/**
 * Довша сторона підготовленого фото, px. Підібрано на фото сторінки підручника:
 * дрібний текст (виноски, індекси у формулах) має лишатися читабельним на
 * проєкторі й при наближенні до однієї задачі. Порівняння — у звіті сесії.
 */
export const PHOTO_MAX_SIDE = 3072
export const PHOTO_JPEG_QUALITY = 0.85
/** PNG/WebP, які вже в межах і не більші за це, завантажуємо без змін. */
export const PHOTO_PASSTHROUGH_MAX_BYTES = 3 * 1024 * 1024

export type PhotoPrepareErrorCode = 'undecodable' | 'encode_failed'

export class PhotoPrepareError extends Error {
  readonly code: PhotoPrepareErrorCode
  constructor(code: PhotoPrepareErrorCode) {
    super(code)
    this.code = code
  }
}

export interface PreparedPhoto {
  file: File
  width: number
  height: number
  /** Підготовлено з оригіналу W×H, байтів, тип */
  original: { width: number; height: number; bytes: number; type: string }
  reencoded: boolean
}

export interface PreparePhotoOptions {
  maxSide?: number
  quality?: number
}

/** Розмір без спотворення: довша сторона ≤ maxSide, без збільшення. */
export function targetSize(width: number, height: number, maxSide = PHOTO_MAX_SIDE): { width: number; height: number } {
  const longest = Math.max(width, height)
  if (longest <= maxSide) return { width, height }
  const scale = maxSide / longest
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

/** Чи можна завантажити файл як є: PNG/WebP, у межах розміру й ваги. JPEG — ніколи (EXIF/GPS). */
export function canPassThrough(type: string, bytes: number, width: number, height: number, maxSide = PHOTO_MAX_SIDE): boolean {
  const t = (type || '').toLowerCase()
  if (t === 'image/jpeg' || !PHOTO_MIME_TYPES.has(t)) return false
  return Math.max(width, height) <= maxSide && bytes <= PHOTO_PASSTHROUGH_MAX_BYTES
}

function stamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

interface Decoded { source: HTMLImageElement; width: number; height: number; release: () => void }

/** Розкодувати тим, що вміє браузер. Не зміг (HEIC у Chrome тощо) — undecodable. */
async function decode(file: Blob): Promise<Decoded> {
  const url = URL.createObjectURL(file)
  const img = new Image()
  img.decoding = 'async'
  try {
    img.src = url
    await img.decode()
  } catch {
    URL.revokeObjectURL(url)
    throw new PhotoPrepareError('undecodable')
  }
  if (!img.naturalWidth || !img.naturalHeight) {
    URL.revokeObjectURL(url)
    throw new PhotoPrepareError('undecodable')
  }
  return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) }
}

function canvasOf(width: number, height: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  return c
}

function drawInto(target: HTMLCanvasElement, source: CanvasImageSource): void {
  const ctx = target.getContext('2d')
  if (!ctx) throw new PhotoPrepareError('encode_failed')
  // білий фон: прозорий PNG у JPEG інакше стає чорним
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, target.width, target.height)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, target.width, target.height)
}

/**
 * Зменшення кроками «навпіл», поки різниця більша за вдвічі, і фінальний крок —
 * так дрібний текст різкіший, ніж від одного великого стрибка.
 */
function downscale(source: HTMLImageElement, width: number, height: number, tw: number, th: number): HTMLCanvasElement {
  let current: CanvasImageSource = source
  let cw = width
  let ch = height
  while (cw / 2 >= tw && ch / 2 >= th) {
    const step = canvasOf(Math.round(cw / 2), Math.round(ch / 2))
    drawInto(step, current)
    current = step
    cw = step.width
    ch = step.height
  }
  const out = canvasOf(tw, th)
  drawInto(out, current)
  return out
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new PhotoPrepareError('encode_failed'))), 'image/jpeg', quality)
  })
}

export async function preparePhoto(file: File, options: PreparePhotoOptions = {}): Promise<PreparedPhoto> {
  const maxSide = options.maxSide ?? PHOTO_MAX_SIDE
  const quality = options.quality ?? PHOTO_JPEG_QUALITY
  const decoded = await decode(file)
  try {
    const original = { width: decoded.width, height: decoded.height, bytes: file.size, type: file.type }
    if (canPassThrough(file.type, file.size, decoded.width, decoded.height, maxSide)) {
      return { file, width: decoded.width, height: decoded.height, original, reencoded: false }
    }
    const t = targetSize(decoded.width, decoded.height, maxSide)
    const canvas = downscale(decoded.source, decoded.width, decoded.height, t.width, t.height)
    const blob = await toJpeg(canvas, quality)
    const out = new File([blob], `phone-photo-${stamp()}.jpg`, { type: 'image/jpeg' })
    return { file: out, width: t.width, height: t.height, original, reencoded: true }
  } finally {
    decoded.release()
  }
}
