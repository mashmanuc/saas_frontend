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

export interface CardRect extends CardFrame {
  height: number
  rotation?: number
}

/** Порядок видимих шарів, а не лише порядок у масиві assets.
 * HTML-картки живуть над звичайним Konva canvas навіть тоді, коли PDF
 * записаний у масиві пізніше за картку. */
export function isVisuallyAbove(
  selectedRender: 'konva' | 'overlay' | 'media',
  selectedIndex: number,
  candidateRender: 'konva' | 'overlay' | 'media',
  candidateIndex: number,
  nativeFront: boolean,
): boolean {
  const layer = (render: 'konva' | 'overlay' | 'media') =>
    render === 'media' ? 2 : render === 'konva' ? (nativeFront ? 1 : 0) : (nativeFront ? 0 : 1)
  return layer(candidateRender) > layer(selectedRender)
    || (layer(candidateRender) === layer(selectedRender) && candidateIndex > selectedIndex)
}

/** Верхня картка закриває дії нижньої, навіть якщо її тло напівпрозоре. */
export function windowControlsCovered(
  target: CardRect,
  higher: readonly CardRect[],
  zoom: number,
  controlsWidthPx: number,
  controlsHeightPx: number,
): boolean {
  if (zoom <= 0) return false
  const controls = {
    left: target.left + target.width - (WINDOW_CONTROLS_INSET_PX + controlsWidthPx) / zoom,
    top: target.top + WINDOW_CONTROLS_TOP_PX / zoom,
    width: controlsWidthPx / zoom,
    height: controlsHeightPx / zoom,
  }
  return higher.some((asset) => {
    const radians = (asset.rotation ?? 0) * Math.PI / 180
    const cosine = Math.abs(Math.cos(radians))
    const sine = Math.abs(Math.sin(radians))
    const width = asset.width * cosine + asset.height * sine
    const height = asset.width * sine + asset.height * cosine
    const left = asset.left + (asset.width - width) / 2
    const top = asset.top + (asset.height - height) / 2
    return controls.left < left + width && left < controls.left + controls.width
      && controls.top < top + height && top < controls.top + controls.height
  })
}

/** Віконні дії мають залишатися в тому самому візуальному шарі, що й картка. */
export function windowControlsZIndex(render: 'konva' | 'overlay' | 'media', expanded: boolean, nativeFront = false): string {
  if (expanded) return '51'
  if (render === 'media') return '21'
  return render === 'overlay' ? '5' : nativeFront ? '10' : '3'
}

export function windowControlsPlacement(frame: CardFrame): Record<string, string> {
  return {
    left: `${frame.left + frame.width - WINDOW_CONTROLS_INSET_PX}px`,
    top: `${frame.top + WINDOW_CONTROLS_TOP_PX}px`,
    transform: 'translateX(-100%)',
  }
}
