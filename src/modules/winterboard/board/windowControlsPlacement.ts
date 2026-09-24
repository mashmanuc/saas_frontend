/**
 * Де стоїть група віконних дій «— ⛶ ×» відносно виділеної картки.
 *
 * INV-WIN-6 (TLV2-05B.2): одна група, прив'язана до ПРАВОГО ВЕРХНЬОГО кута
 * картки, без залежності від висоти картки.
 *
 * Історія:
 *   - до 2026-09-23 — всередині кута плашкою з рамкою (відступ 6 px), лягала на
 *     криву графіка (FIRST USER GATE, крок 4);
 *   - 2026-09-23 (c5149ea8) — зовні праворуч / над кутом; власник 2026-09-24:
 *     «кнопки закрити і згорнути як апендицити».
 *   - 2026-09-24 — у ШАПЦІ картки: той самий правий верхній кут, але в смузі
 *     з назвою, компактно й без рамки (WBCardWindowControls `--header`), як
 *     кнопки вікна. Смуга з назвою вмісту не несе — кнопки нічого не закривають.
 *
 * Координати — px відносно `.wb-canvas` (ті самі, що `getOverlayStyle`).
 */

/** Відступ групи від правого краю картки всередину шапки. */
export const WINDOW_CONTROLS_INSET_PX = 4
/** Відступ від верхнього краю картки — група сідає в рядок шапки. */
export const WINDOW_CONTROLS_TOP_PX = 2

export interface CardFrame {
  left: number
  top: number
  width: number
}

export function windowControlsPlacement(frame: CardFrame): Record<string, string> {
  return {
    left: `${frame.left + frame.width - WINDOW_CONTROLS_INSET_PX}px`,
    top: `${frame.top + WINDOW_CONTROLS_TOP_PX}px`,
    transform: 'translateX(-100%)',
  }
}
