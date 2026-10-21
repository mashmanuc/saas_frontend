/**
 * Одна панель кнопок картки (власник 2026-10-21: «Чому не можна зробити в одну панельку? У нас на карті є одна
 * панель, яка вскривається. Одна панель, яка згортає і хрестик. І ще третя у нас получилась панель» → «Роби»).
 *
 * Панель виділення (`WBSelectionToolbar`, над карткою) дає місце; полотно (`WBCanvas`) ставить туди групу картки
 * «✍ 💡 ⚠ │ A− 100% A+ │ — ⛶» (`WBCardWindowControls`). На самій картці тоді кнопок немає — нічого не закриває
 * текст на будь-якому масштабі дошки. Немає панелі виділення (планшет, розгорнута картка) — група, як і була, у
 * шапці картки, але одним рядком.
 *
 * Панель виділення живе в кімнаті, полотно — у своєму компоненті; спільне місце — один стан на застосунок
 * (на сторінці одна дошка).
 */
import { shallowRef, type ShallowRef } from 'vue'

export interface CardControlsDock {
  /** Вузол у панелі виділення, куди ставиться група картки. */
  el: HTMLElement
  /** Картка, для якої панель виділення зараз показана. */
  assetId: string
}

const dock: ShallowRef<CardControlsDock | null> = shallowRef(null)

/** Полотно: де зараз місце для групи картки (null — панелі виділення немає). */
export function useCardControlsDock(): Readonly<ShallowRef<CardControlsDock | null>> {
  return dock
}

/** Панель виділення: віддати місце під групу картки або (null) забрати своє. */
export function setCardControlsDock(next: CardControlsDock | null, owner?: HTMLElement | null): void {
  if (next === null && owner && dock.value?.el !== owner) return   // чуже місце не чіпаємо
  dock.value = next
}

/** Чи стоїть група картки в панелі виділення. */
export function isDockedFor(current: CardControlsDock | null, assetId: string | null | undefined,
  expanded: boolean): boolean {
  return !!current && !!assetId && !expanded && current.assetId === assetId && current.el.isConnected
}
