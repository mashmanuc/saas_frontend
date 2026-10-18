/**
 * Де відкрити список біля кнопки, щоб він увесь був досяжний (власник 2026-10-18).
 *
 * «Надіслати на сторінку» завжди відкривався вниз на 280 px: коли об'єкт стоїть низько, панель
 * біля нижнього краю екрана, і нижні сторінки опинялись за краєм — не догорнути. Власник:
 * «щоб список скролився і виїжджав до самого верху, якщо знаходиться в самому низу».
 *
 * Правило: якщо внизу вистачає місця на весь список — вниз; інакше туди, де місця більше
 * (біля низу — вгору, аж до верху екрана). Висота — не більша за вільне місце на обраному
 * боці, решту гортає прокрутка.
 */

export interface PopoverAnchor {
  /** Верх і низ кнопки у координатах вікна. */
  top: number
  bottom: number
}

export interface PopoverPlacement {
  /** Вниз: `top` від верху вікна. Вгору: `bottom` від низу вікна. */
  top?: number
  bottom?: number
  maxHeight: number
}

export const POPOVER_GAP = 6
export const POPOVER_EDGE = 8

export function placeListPopover(anchor: PopoverAnchor, viewportH: number, neededH: number): PopoverPlacement {
  const below = Math.max(0, viewportH - anchor.bottom - POPOVER_GAP - POPOVER_EDGE)
  const above = Math.max(0, anchor.top - POPOVER_GAP - POPOVER_EDGE)
  if (below >= neededH || below >= above) {
    return { top: anchor.bottom + POPOVER_GAP, maxHeight: below }
  }
  return { bottom: viewportH - anchor.top + POPOVER_GAP, maxHeight: above }
}

/** Висота списку сторінок «Надіслати на сторінку»: рядок 32 px + проміжок 2 px, поля 4 px. */
export function sendToPageListHeight(pageCount: number): number {
  return pageCount * 32 + Math.max(0, pageCount - 1) * 2 + 8
}
