// cardCanvas.js — полотно картки на масштабі дошки (коло, «Похідна/∫», графік).
//
// Власник 2026-10-01: на 35 % картка кола перетворювалась на кашу підписів —
// вендор брав розмір з ЕКРАНА (`getBoundingClientRect`), а шрифт лишав повним, тож
// на малому масштабі коло стискалось, а підписи ні. Як роблять Miro, FigJam,
// Excalidraw: масштаб дошки зменшує об'єкт цілком, як картинку; вигляд картки від
// масштабу не залежить.
//
// Тому:
//  • розмітка — у пікселях КАРТКИ: `clientWidth` не змінюється від `transform:
//    scale()` предка (WBCanvas масштабує картку обгорткою);
//  • логічне полотно = картка × dpr — рівно таке, як було на 100 %: уся математика
//    вендора й збережене вікно (`viewport.scale` у цих пікселях) лишаються ті самі;
//  • фізична роздільність = логічна × масштаб показу (`setTransform`) — на проекторі
//    (масштаб 2–3) картка чітка, на 35 % не тримає зайвих пікселів;
//  • екранні пікселі вказівника → логічні: `toCanvasPx`.

/** Стеля сторони фізичного полотна: 4096 px (пам'ять GPU на слабких ноутбуках). */
export const CARD_CANVAS_MAX_SIDE = 4096
/** Нижня межа роздільності відносно 100 % — дрібніше картку ніхто не читає. */
const MIN_RESOLUTION = 0.25

/**
 * Підганяє полотно під картку й повертає логічні розміри.
 * @returns {{ dpr: number, lw: number, lh: number, view: number }}
 *   dpr — щільність пікселів (≤ 2), lw/lh — логічне полотно (як на 100 %),
 *   view — скільки екранних пікселів займає піксель картки (масштаб показу).
 */
export function fitCardCanvas(container, canvas, ctx) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const rect = container.getBoundingClientRect()
  // happy-dom і display:none дають clientWidth 0 — тоді як раніше, з прямокутника.
  const w = Math.max(40, container.clientWidth || rect.width || 0)
  const h = Math.max(40, container.clientHeight || rect.height || 0)
  const view = rect.width > 0 ? rect.width / w : 1
  const lw = w * dpr
  const lh = h * dpr
  const k = Math.min(Math.max(view, MIN_RESOLUTION), CARD_CANVAS_MAX_SIDE / Math.max(lw, lh))
  const bw = Math.max(1, Math.round(lw * k))
  const bh = Math.max(1, Math.round(lh * k))
  if (canvas.width !== bw || canvas.height !== bh) {
    canvas.width = bw
    canvas.height = bh
  }
  canvas.style.width = w + 'px'
  canvas.style.height = h + 'px'
  // Після зміни розміру контекст скинуто — трансформацію ставимо щоразу.
  if (ctx && typeof ctx.setTransform === 'function') ctx.setTransform(bw / lw, 0, 0, bh / lh, 0, 0)
  return { dpr, lw, lh, view }
}

/** Скільки логічних пікселів полотна в одному екранному (для вказівника й зсуву). */
export function toCanvasPx(canvas, lw, fallback) {
  const r = canvas.getBoundingClientRect()
  return r.width > 0 && lw > 0 ? lw / r.width : fallback
}
