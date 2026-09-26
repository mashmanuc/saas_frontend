// Розміщення ПЕРЕВІРЕНОГО зображення на дошці (LAW §9 v1.9, 2026-09-26).
//
// Навмисно не знає, звідки картинка: фото з телефона вчителя (пульт спершу сам
// перевіряє актив бібліотеки), а згодом — схвалена вчителем робота учня
// (Classroom Inbox). Сюди приходить уже розв'язане зображення: URL і природні
// розміри. Запис — лише штатним шляхом кімнати (handleAssetAdd → op asset_add).

import type { WBAsset } from '../types/winterboard'

export interface ResolvedImage {
  src: string
  naturalWidth: number
  naturalHeight: number
}

export interface PlaceImageInput {
  id: string
  image: ResolvedImage
  /** Центр видимої частини аркуша в координатах дошки */
  center: { x: number; y: number }
  /** Найбільша рамка в координатах дошки (зазвичай частка видимої області) */
  maxSize: { w: number; h: number }
}

/** Частка видимої області, яку займає нове зображення: видно цілком, з полями. */
export const PLACED_IMAGE_VIEW_FRACTION = 0.8

/**
 * Рамка без спотворення пропорцій: вписуємо в maxSize, але не збільшуємо понад
 * природний розмір (дрібна картинка не розпливається).
 */
export function fitImageSize(image: ResolvedImage, maxSize: { w: number; h: number }): { w: number; h: number } {
  const nw = Math.max(1, image.naturalWidth)
  const nh = Math.max(1, image.naturalHeight)
  const scale = Math.min(1, maxSize.w / nw, maxSize.h / nh)
  return { w: Math.max(1, Math.round(nw * scale)), h: Math.max(1, Math.round(nh * scale)) }
}

export function buildPlacedImageAsset(input: PlaceImageInput): WBAsset {
  const { w, h } = fitImageSize(input.image, input.maxSize)
  return {
    id: input.id,
    type: 'image',
    src: input.image.src,
    x: Math.round(input.center.x - w / 2),
    y: Math.round(input.center.y - h / 2),
    w,
    h,
    rotation: 0,
    locked: false,
  } as WBAsset
}

/** Природні розміри зображення за URL (EXIF-поворот браузер уже врахував). */
export function loadImageDimensions(
  src: string,
  timeoutMs = 20_000,
): Promise<{ naturalWidth: number; naturalHeight: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    let done = false
    const timer = setTimeout(() => finish(new Error('image_load_timeout')), timeoutMs)
    function finish(err: Error | null): void {
      if (done) return
      done = true
      clearTimeout(timer)
      img.onload = null
      img.onerror = null
      if (err) reject(err)
      else if (!img.naturalWidth || !img.naturalHeight) reject(new Error('image_empty'))
      else resolve({ naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight })
    }
    img.onload = () => finish(null)
    img.onerror = () => finish(new Error('image_load_failed'))
    img.src = src
  })
}
