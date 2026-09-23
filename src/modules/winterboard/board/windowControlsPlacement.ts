/**
 * Де стоїть група віконних дій «— ⛶ ×» відносно виділеної картки.
 *
 * INV-WIN-6 (TLV2-05B.2): одна група, прив'язана до ПРАВОГО ВЕРХНЬОГО кута
 * картки, без залежності від висоти картки. Раніше група стояла всередині кута
 * (відступ 6 px) і лягала просто на вміст: на графіку від Інтегралика кнопки
 * закривали верхній правий кут кривої (FIRST USER GATE 2026-09-23, крок 4).
 *
 * Тепер той самий кут, але ЗОВНІ, у порядку:
 *   1. праворуч від кута — якщо до краю поля є місце на найширшу групу;
 *   2. над кутом — якщо над карткою є місце на висоту групи;
 *   3. всередині кута — як було (картка впритул до правого й верхнього краю).
 *
 * Координати — px відносно `.wb-canvas` (ті самі, що `getOverlayStyle`).
 */

/** Відступ усередину кута — запасний варіант, старе положення. */
export const WINDOW_CONTROLS_INSET_PX = 6
/** Проміжок між карткою і групою зовні. */
export const WINDOW_CONTROLS_GAP_PX = 6
/** Найширша група: «A− 100% A+» + «—» + «⛶» + «×». З запасом — щоб не мірити DOM. */
export const WINDOW_CONTROLS_MAX_W_PX = 200
/** Висота групи: кнопка 24 + padding 2×2 + рамка 2 = 30, з запасом. */
export const WINDOW_CONTROLS_H_PX = 32

export interface CardFrame {
  left: number
  top: number
  width: number
}

export function windowControlsPlacement(frame: CardFrame, fieldWidth: number): Record<string, string> {
  const right = frame.left + frame.width
  const gap = WINDOW_CONTROLS_GAP_PX

  if (fieldWidth > 0 && fieldWidth - (right + gap) >= WINDOW_CONTROLS_MAX_W_PX) {
    return { left: `${right + gap}px`, top: `${frame.top}px` }
  }
  const above = frame.top - gap - WINDOW_CONTROLS_H_PX
  if (above >= 0) {
    return { left: `${right}px`, top: `${above}px`, transform: 'translateX(-100%)' }
  }
  return {
    left: `${right - WINDOW_CONTROLS_INSET_PX}px`,
    top: `${frame.top + WINDOW_CONTROLS_INSET_PX}px`,
    transform: 'translateX(-100%)',
  }
}
