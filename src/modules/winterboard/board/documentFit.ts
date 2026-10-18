/**
 * «⇕ На всю висоту аркуша» для документа з «Матеріалів» (власник 2026-10-18).
 *
 * Учитель щоразу вручну розтягував PDF так, щоб сторінка займала всю висоту аркуша і читалась
 * найкраще, а праворуч лишалось місце для роботи з витягнутими задачами. Тут — лише розрахунок:
 * документ біля лівого краю, на всю висоту аркуша з невеликим полем, ширина — за пропорцією
 * сторінки (рамка вікна сторінку не вписує, а розтягує, тож пропорцію задає саме вона).
 * Зберігає `WBCanvas` тим самим `asset-update`, що й ручне розтягування.
 */

/** Шапка й нижня панель вікна документа (`DocumentViewerAsset.vue`). */
export const DOC_VIEWER_HEADER_H = 28
export const DOC_VIEWER_FOOTER_H = 32
/** Рамка сторінки всередині вікна: по 1 точці з кожного боку. */
const DOC_VIEWER_SIDE = 2

/** Поле від краю аркуша. */
export const DOC_FIT_MARGIN = 16

/** Пропорції за замовчуванням, поки сторінка не завантажилась: A4 стоячи і слайд 4:3. */
export const A4_PORTRAIT_ASPECT = 210 / 297
export const SLIDE_ASPECT = 4 / 3

export interface DocFitInput {
  sheetW: number
  sheetH: number
  /** Ширина / висота сторінки документа. */
  pageAspect: number
  margin?: number
}

export interface DocFitRect {
  x: number
  y: number
  w: number
  h: number
}

export function fitDocumentToSheetHeight({ sheetW, sheetH, pageAspect, margin = DOC_FIT_MARGIN }: DocFitInput): DocFitRect {
  const aspect = Number.isFinite(pageAspect) && pageAspect > 0 ? pageAspect : A4_PORTRAIT_ASPECT
  const chrome = DOC_VIEWER_HEADER_H + DOC_VIEWER_FOOTER_H
  let h = sheetH - 2 * margin
  let w = Math.round((h - chrome) * aspect) + DOC_VIEWER_SIDE
  const maxW = sheetW - 2 * margin
  if (w > maxW) {
    // Широка сторінка (слайд на вузькому аркуші): упираємось у ширину, висоту — за пропорцією.
    w = maxW
    h = Math.round((w - DOC_VIEWER_SIDE) / aspect) + chrome
  }
  return { x: margin, y: margin, w, h: Math.round(h) }
}

/** Пропорція сторінки: з завантаженої картинки сторінки, інакше — за типом матеріалу. */
export function documentPageAspect(
  image: { naturalWidth?: number; naturalHeight?: number } | null | undefined,
  contentType: string | undefined,
): number {
  const nw = image?.naturalWidth ?? 0
  const nh = image?.naturalHeight ?? 0
  if (nw > 0 && nh > 0) return nw / nh
  return contentType === 'presentation' ? SLIDE_ASPECT : A4_PORTRAIT_ASPECT
}
