/**
 * Розкладка вікна Інтегралика на різних екранах — TABLET 2А + 3А + 3Б
 * (рішення власника 2026-09-27: «1А, 2А, 3А+Б»; знахідки — `feedback/TABLET_ISSUES_2026-09-27.md`).
 *
 * БУЛО: ширше за 640 px вікно всюди «як на комп'ютері» — 600 px по центру. На планшеті
 * воно закривало майже всю дошку, а екранна клавіатура ховала під собою поле введення
 * (підйом над клавіатурою працював лише на телефоні).
 *
 * Тут лише рішення (чисті функції, під тестами); `CommandPalette.vue` їх застосовує.
 */

/** 'float' — плаваюче вікно (комп'ютер); 'sheet' — лист знизу; 'dock' — панель праворуч. */
export type PaletteLayout = 'float' | 'sheet' | 'dock'

export interface PaletteLayoutInput {
  /** Ширина до 640 px (телефон). */
  narrow: boolean
  /** Основний ввід — дотик: `(hover: none) and (pointer: coarse)`. */
  touch: boolean
  /** Ширина від 1024 px (планшет в альбомній орієнтації або комп'ютер). */
  wide: boolean
  /** Відкрита дошка. */
  onBoard: boolean
  /** Відкрита екранна клавіатура. */
  keyboard: boolean
}

export function resolvePaletteLayout(i: PaletteLayoutInput): PaletteLayout {
  if (i.narrow) return 'sheet'
  // Планшет на дошці: в альбомі — панель праворуч (дошку видно й її можна чіпати),
  // у портреті — лист знизу, як на телефоні.
  if (i.touch && i.onBoard) return i.wide ? 'dock' : 'sheet'
  // Плаваюче вікно на сенсорному екрані з відкритою клавіатурою — лист над нею,
  // інакше поле введення опиниться під клавішами.
  if (i.touch && i.keyboard) return 'sheet'
  return 'float'
}

/**
 * Висота екранної клавіатури з VisualViewport: скільки layout-вʼюпорту знизу не видно.
 * Менше 90 px — це рядок адреси браузера, не клавіатура.
 */
export function keyboardInset(innerHeight: number, vvHeight: number, vvOffsetTop: number): number {
  const inset = Math.round(innerHeight - vvHeight - vvOffsetTop)
  return inset > 90 ? inset : 0
}

/** Ширина панелі праворуч. */
export const DOCK_WIDTH = 380

export interface DockBox {
  /** Відступ панелі згори (px від верху layout-вʼюпорту). */
  top: number
  /** Відступ панелі знизу. */
  bottom: number
}

/**
 * Де стоїть панель праворуч: на висоту полотна дошки (шапка з «Зберегти як урок» і
 * нижня смуга з масштабом лишаються відкритими), а з відкритою клавіатурою — рівно у
 * видимій частині над нею.
 *
 * @param canvas прямокутник полотна дошки (`#wb-canvas`) або null
 * @param kbInset висота клавіатури з `keyboardInset`
 * @param vvOffsetTop на скільки браузер прокрутив видиму частину (VisualViewport.offsetTop)
 */
export function dockBox(
  canvas: { top: number; bottom: number } | null,
  innerHeight: number,
  kbInset: number,
  vvOffsetTop = 0,
): DockBox {
  if (kbInset > 0) {
    return { top: Math.max(0, Math.round(vvOffsetTop)), bottom: kbInset }
  }
  const top = canvas ? Math.max(0, Math.round(canvas.top)) : 0
  const bottom = canvas ? Math.max(0, Math.round(innerHeight - canvas.bottom)) : 0
  return { top, bottom }
}

/**
 * Чи ставити курсор у поле самому (TABLET 3Б). На сенсорному екрані фокус відкриває
 * клавіатуру, яка закриває більшу частину екрана, — навіть коли людина хотіла говорити.
 * Там поле отримує фокус лише від дотику.
 */
export function shouldAutofocus(touch: boolean): boolean {
  return !touch
}
