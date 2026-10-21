/**
 * Чіткість полотен дошки (Konva.pixelRatio).
 *
 * Власник 2026-10-21, мультиборд (вбудований Android-браузер великої сенсорної панелі): «зробив 5 сторінок записів
 * і дошка почала притормажувати — штрихи запізнюватись». Замір на копії його дошки (екран 1920×1080 при подвійній
 * щільності, лише сенсор, процесор ×6): кожен шар дошки малювався в 4K (3187×1792 на полотні), після кожного штриха
 * шар з усіма штрихами сторінки перемальовувався цілком — із 12 штрихів дошка прийняла 4, затримка дотику до 0,56 с.
 *
 * Велика сенсорна панель (лише дотик, ширина від LARGE_PANEL_MIN_CSS_WIDTH) малює в 1× — учетверо менше точок;
 * урок видно з парти так само. Ноутбуки, планшети й телефони — як було: щільність екрана, але не більше 2×.
 */

/** Ширина (CSS px), з якої сенсорний екран без миші вважаємо великою панеллю (iPad ≤ 1366, мультиборд — 1920). */
export const LARGE_PANEL_MIN_CSS_WIDTH = 1600

export interface PixelRatioEnv {
  /** window.devicePixelRatio */
  dpr: number
  /** Ширина екрана в CSS px. */
  cssWidth: number
  /** Лише дотик: головний вказівник грубий і жодного точного (миша, перо-тачпад) немає. */
  touchOnly: boolean
}

export function boardPixelRatio(env: PixelRatioEnv): number {
  const r = Math.min(Math.max(env.dpr || 1, 1), 2)
  if (env.touchOnly && env.cssWidth >= LARGE_PANEL_MIN_CSS_WIDTH) return 1
  return r
}

export function currentBoardPixelRatio(): number {
  if (typeof window === 'undefined') return 1
  const mm = (q: string) => typeof window.matchMedia === 'function' && window.matchMedia(q).matches
  return boardPixelRatio({
    dpr: window.devicePixelRatio || 1,
    cssWidth: Math.max(window.screen?.width || 0, window.innerWidth || 0),
    touchOnly: mm('(pointer: coarse)') && !mm('(any-pointer: fine)'),
  })
}
