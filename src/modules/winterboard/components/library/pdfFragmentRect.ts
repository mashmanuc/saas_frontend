// «✂️ Взяти фрагмент» (TZ_PDF_FRAGMENT_2026-10-13): рамка в частках сторінки й місце фрагмента на дошці.
// Чисті функції — без DOM, щоб правило було перевірене тестами.

/**
 * З чого можна вирізати фрагмент: PDF і PDF-версія Word / PowerPoint (сервер — `FRAGMENT_SOURCE_TYPES`).
 * Новий вид документа = рядок тут і там.
 */
export const CUT_CONTENT_TYPES: readonly string[] = ['pdf', 'document', 'presentation']

/** Рамка в частках сторінки PDF 0…1 (так, як сторінку показує її картинка). */
export interface FragRect { x: number; y: number; w: number; h: number }

/** Сторона рамки — не менше 1 % сторінки (те саме правило на сервері). */
export const MIN_SIDE = 0.01

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

/** Два кути в будь-якому порядку → рамка в межах сторінки. */
export function normRect(x0: number, y0: number, x1: number, y1: number): FragRect {
  const ax = clamp01(Math.min(x0, x1)), bx = clamp01(Math.max(x0, x1))
  const ay = clamp01(Math.min(y0, y1)), by = clamp01(Math.max(y0, y1))
  return { x: ax, y: ay, w: bx - ax, h: by - ay }
}

export interface ViewerBox { x: number; y: number; w: number; h: number }
export interface Placement { x: number; y: number; w: number; h: number }

/** Рамка вікна PDF: сторінка — на всю ширину вікна мінус 1 px з кожного боку (DocumentViewerAsset). */
const VIEWER_SIDE_INSET = 2
export const FRAGMENT_MIN_W = 240
const GAP = 24
const STACK_GAP = 16

/**
 * Де й якого розміру покласти фрагмент (ТЗ §2.2): удвічі більший, ніж ділянка у вікні PDF, не ширший за
 * половину сторінки дошки й не вужчий за 240; праворуч від вікна PDF, наступні — стовпчиком униз.
 * `stackY` — скільки вже зайнято під попередніми фрагментами цього вікна.
 */
export function fragmentPlacement(
  viewer: ViewerBox, rect: FragRect, pxW: number, pxH: number, pageW: number, stackY: number,
): Placement {
  const shown = rect.w * Math.max(1, viewer.w - VIEWER_SIDE_INSET)
  const w = Math.round(Math.max(FRAGMENT_MIN_W, Math.min(pageW / 2, shown * 2)))
  const h = Math.round(w * (pxH > 0 && pxW > 0 ? pxH / pxW : rect.h / rect.w))
  const right = viewer.x + viewer.w + GAP
  const x = right + w <= pageW ? right : Math.max(0, pageW - w - GAP)
  return { x: Math.round(x), y: Math.round(viewer.y + stackY), w, h }
}

/**
 * Чи можна ставити результат (ТЗ §2.2): та сама дошка й сторінка, що в момент «Додати», і вікно PDF на ній є.
 * Інакше — не ставимо на чужу сторінку: файл уже в «Матеріалах».
 */
export function sameSpot(
  at: { boardId: string; pageId: string }, now: { boardId: string; pageId: string }, viewerOnPage: boolean,
): boolean {
  return Boolean(at.boardId) && at.boardId === now.boardId && Boolean(at.pageId) && at.pageId === now.pageId && viewerOnPage
}

/** Наступний зсув стовпчика після покладеного фрагмента. */
export function nextStackY(stackY: number, placed: Placement): number {
  return stackY + placed.h + STACK_GAP
}
