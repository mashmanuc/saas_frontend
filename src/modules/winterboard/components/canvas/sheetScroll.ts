/**
 * Геометрія смуг прокрутки аркуша — чисті функції (WBSheetScrollbars).
 * scroll — скільки аркуша сховано зліва/згори (як scrollLeft), 0…content−view.
 */

/** Мінімальна довжина повзунка, щоб його можна було вхопити. */
export const MIN_THUMB_PX = 28

/** Розмір і положення повзунка на доріжці. */
export function scrollThumb(
  scroll: number, content: number, view: number, track: number,
): { size: number; pos: number } {
  if (content <= view || track <= 0) return { size: track, pos: 0 }
  const size = Math.min(track, Math.max(MIN_THUMB_PX, (view / content) * track))
  const maxScroll = content - view
  const ratio = Math.min(1, Math.max(0, scroll / maxScroll))
  return { size, pos: ratio * (track - size) }
}

/** Новий scroll після того, як повзунок зсунули на `delta` px від старту. */
export function scrollFromThumbDelta(
  startScroll: number, delta: number, content: number, view: number, track: number,
): number {
  const maxScroll = Math.max(0, content - view)
  const { size } = scrollThumb(startScroll, content, view, track)
  const free = track - size
  if (free <= 0 || maxScroll === 0) return startScroll
  const next = startScroll + (delta * maxScroll) / free
  return Math.min(maxScroll, Math.max(0, next))
}
