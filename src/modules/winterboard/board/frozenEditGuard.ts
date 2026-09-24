/**
 * Дошка з завершеним записом: перша спроба щось змінити → одне питання.
 *
 * Рішення власника 2026-09-24 (рецензія + вибір «спершу 2 кнопки»): замість
 * постійної жовтої смуги `WBFrozenBanner` у шапці лишається «Запис завершено»,
 * а вікно «Запис завершено. Як продовжити?» з'являється лише коли вчитель
 * справді береться змінювати дошку. Кнопки: «Почати новий запис» (одразу, без
 * другого підтвердження) і «Скасувати». «Продовжити без запису» — окремим
 * пакетом бекенду: переходу finalized → idle сервер зараз не має (INV-23).
 *
 * Тут лише ЧИСТІ предикати — кімнату в тестах не змонтувати (див. пам'ять
 * «кімнати не монтуються»), тож правила, що саме вважається спробою змінити,
 * живуть окремо й перевіряються напряму.
 */
import type { WBToolType } from '../types/winterboard'

/** Інструменти, вибір яких нічого не змінює на дошці. */
const VIEW_TOOLS: ReadonlySet<WBToolType> = new Set<WBToolType>(['select', 'laser'])

/** Чи означає вибір цього інструмента намір змінювати дошку. */
export function isEditingTool(tool: WBToolType | string): boolean {
  return !VIEW_TOOLS.has(tool as WBToolType)
}

/** Мінімум полів події, які нам потрібні (DOM-події й тестові об'єкти). */
export interface PointerLike {
  type: string
  button?: number
  pointerType?: string
  isPrimary?: boolean
  touches?: { length: number }
}

/** Події полотна, які перехоплюємо на замороженій дошці. */
export const FROZEN_CANVAS_EVENTS = ['pointerdown', 'mousedown', 'touchstart', 'click', 'dblclick'] as const

/** Лише ця подія відкриває вікно; решта з тієї ж взаємодії тихо гасяться. */
export const FROZEN_PROMPT_EVENT = 'pointerdown'

/**
 * Чи перехопити подію на полотні замороженої дошки.
 *
 * Пропускаємо те, що лише ДИВИТЬСЯ: середня кнопка (пан), права (меню
 * браузера), другий палець (pinch-зум на планшеті). Колесо миші сюди взагалі
 * не потрапляє — масштаб і прокрутка лишаються вільними.
 */
export function shouldInterceptCanvasEvent(e: PointerLike): boolean {
  if (e.type === 'touchstart') return (e.touches?.length ?? 1) <= 1
  if (e.type === 'pointerdown' || e.type === 'mousedown') {
    if (typeof e.button === 'number' && e.button !== 0) return false
    if (e.pointerType === 'touch' && e.isPrimary === false) return false
    return true
  }
  return e.type === 'click' || e.type === 'dblclick'
}
