/**
 * Тап олівцем по картці виділяє її — LAW §9 v1.35.
 *
 * Прохід «очима вчителя 60 років» (2026-10-19, №21): олівець увімкнений одразу, вчитель
 * натискає на задачу — нічого, ні рамки, ні кнопок. ✍ 💡 ⚠ з'являються лише на виділеній
 * картці, а виділяє лише «стрілочка», про яку новачок не знає.
 *
 * Правило: жест олівця чи маркера БЕЗ жодного руху (тап) штриха не малює ніколи, тож він
 * вільний. Тап по картці, на якій є ✍ або 💡 ⚠, — виділяє її; повторний тап по ній же —
 * знімає; тап повз такі картки — знімає виділення. Жест із рухом (зокрема крапка пером) —
 * штрих, як і був.
 *
 * Картки при олівці «прозорі» для дотику (малюємо поверх них), тож DOM-ціль тут нічого не
 * скаже: влучання — за рамкою картки з даних дошки, верхня за тим самим порядком шарів, що
 * малює дошка (`isVisuallyAbove`).
 */
import { isVisuallyAbove } from './windowControlsPlacement'

export type TapCardRender = 'konva' | 'overlay' | 'media'

export interface TapCard {
  id: string
  render: TapCardRender
  /** Позиція в `page.assets[]` — порядок у межах одного шару. */
  index: number
  x: number
  y: number
  w: number
  /** Видима висота: для карток, що підганяють висоту під вміст, — підігнана. */
  h: number
  /** Градуси, обертання навколо центру — як у Konva-проксі й HTML-оверлея. */
  rotation?: number
}

function contains(card: TapCard, point: { x: number; y: number }): boolean {
  const cx = card.x + card.w / 2
  const cy = card.y + card.h / 2
  const rad = (-(card.rotation ?? 0) * Math.PI) / 180
  const dx = point.x - cx
  const dy = point.y - cy
  const lx = dx * Math.cos(rad) - dy * Math.sin(rad)
  const ly = dx * Math.sin(rad) + dy * Math.cos(rad)
  return Math.abs(lx) <= card.w / 2 && Math.abs(ly) <= card.h / 2
}

/** Верхня видима картка під точкою аркуша, або null. */
export function topCardAt(
  point: { x: number; y: number },
  cards: readonly TapCard[],
  nativeFront: boolean,
): TapCard | null {
  let top: TapCard | null = null
  for (const card of cards) {
    if (!contains(card, point)) continue
    if (!top || isVisuallyAbove(top.render, top.index, card.render, card.index, nativeFront)) top = card
  }
  return top
}

/**
 * Нове виділення після тапу, або null — нічого не міняти.
 * `tappedId` — верхня картка під тапом; `tappedHasTaskActions` — на ній є ✍ або 💡 ⚠.
 */
export function penTapSelection(
  tappedId: string | null,
  tappedHasTaskActions: boolean,
  selectedIds: readonly string[],
): string[] | null {
  if (tappedId && tappedHasTaskActions) {
    return selectedIds.length === 1 && selectedIds[0] === tappedId ? [] : [tappedId]
  }
  return selectedIds.length ? [] : null
}
