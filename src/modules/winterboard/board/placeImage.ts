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

/** Частка видимої частини аркуша, яку займає нове зображення: видно цілком, з полями. */
export const PLACED_IMAGE_VIEW_FRACTION = 0.8

export interface PlacementView {
  /** Розмір полотна на екрані, px */
  containerW: number
  containerH: number
  zoom: number
  /** Зсув сцени: екран = дошка × zoom + offset (store.stageOrigin) */
  offset: { x: number; y: number }
  /** Аркуш у координатах дошки; null — межі невідомі */
  page: { w: number; h: number } | null
}

/**
 * Центр і найбільша рамка для нового зображення — у ВИДИМІЙ ЧАСТИНІ АРКУША
 * (перетин екрана з аркушем), а не всього екрана: інакше на проєкторі 4:3
 * портретне фото вилазило за нижній край аркуша (рецензія 2026-09-26).
 * Аркуш не видно зовсім — беремо видиму область.
 */
export function placementFrame(v: PlacementView): { center: { x: number; y: number }; maxSize: { w: number; h: number } } {
  const zoom = v.zoom || 1
  let x0 = -v.offset.x / zoom
  let y0 = -v.offset.y / zoom
  let x1 = x0 + v.containerW / zoom
  let y1 = y0 + v.containerH / zoom
  if (v.page) {
    const ix0 = Math.max(x0, 0)
    const iy0 = Math.max(y0, 0)
    const ix1 = Math.min(x1, v.page.w)
    const iy1 = Math.min(y1, v.page.h)
    if (ix1 > ix0 && iy1 > iy0) { x0 = ix0; y0 = iy0; x1 = ix1; y1 = iy1 }
  }
  return {
    center: { x: (x0 + x1) / 2, y: (y0 + y1) / 2 },
    maxSize: { w: (x1 - x0) * PLACED_IMAGE_VIEW_FRACTION, h: (y1 - y0) * PLACED_IMAGE_VIEW_FRACTION },
  }
}

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

function loadOnce(src: string, crossOrigin: boolean, timeoutMs: number): Promise<{ naturalWidth: number; naturalHeight: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    if (crossOrigin) img.crossOrigin = 'anonymous'
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

/**
 * Природні розміри зображення за URL (EXIF-поворот браузер уже врахував).
 * Вантажимо так само, як полотно (crossOrigin='anonymous'), щоб не лишити в кеші
 * відповідь без CORS; не вийшло — ще раз без нього, як useContentDrop. Це не
 * повтор того самого запиту, а інший режим (LAW §12).
 */
export async function loadImageDimensions(
  src: string,
  timeoutMs = 20_000,
): Promise<{ naturalWidth: number; naturalHeight: number }> {
  try {
    return await loadOnce(src, true, timeoutMs)
  } catch (err) {
    if (err instanceof Error && err.message === 'image_load_timeout') throw err
    return loadOnce(src, false, timeoutMs)
  }
}
