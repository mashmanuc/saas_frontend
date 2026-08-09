/**
 * snapshotElement — універсальний thin-adapter capture помічник для widget previews.
 *
 * Ref: saas_docs/domains/winterboard/export/EXPORT_PREPARATION_SSOT.md INV-EP-8
 *
 * Стратегія (three-branch — кожна категорія має свій правильний інструмент):
 *  1. Native canvas (TrigCircle, TrigSolver, GraphCalc, Calculus, Helix, Solid)
 *     → canvas.toBlob('image/png')
 *  2. SVG (Geometry2DRenderer = JSXGraph, Nmt3dRenderer)
 *     → XMLSerializer → blob URL → Image() → drawImage на OffscreenCanvas → toBlob
 *  3. DOM rasterize (nmt_task, future theory/formula cards — будь-який HTML
 *     widget без власного canvas/svg) → html2canvas (lazy-imported).
 *     Industry-standard для DOM screenshot use case. Не намагаємось
 *     "уніфікувати все одним renderer" — DOM rendering і canvas rendering
 *     різні категорії.
 *
 * INV-EP-8 (FE boundary): цей файл = thin adapter без widget-логіки.
 *   - NO state mutation
 *   - NO store imports
 *   - NO widget business calls
 *   - NO commit/dispatch
 *   - Просто DOM query + native browser APIs
 *
 * Abort handling: signal перевіряється на кожному await-кордоні; null при abort.
 */

export interface SnapshotResult {
  blob: Blob
  width: number
  height: number
}

const MAX_DIMENSION = 4096 // мірроир BE-cap у views.py:MAX_PREVIEW_DIMENSION

/**
 * Що НЕ потрапляє у знімок для експорту: службове керування віджета.
 *
 * `[data-export-hide]` — явна позначка для нових віджетів (додав атрибут →
 * елемент зник зі знімка, правити цей файл не треба). Решта — класи наявних
 * контролів, що вже жили в коді до появи цієї позначки.
 */
export const EXPORT_HIDE_SELECTOR = [
  '[data-export-hide]',
  '.gm-hint',      // GeoMASH: підказка поточного інструмента («Drag A/B/D…»)
  '.gm-ctx',       // GeoMASH: контекстне меню (з'являється на правий клік)
].join(',')

/**
 * Знімає PNG snapshot першого canvas/svg всередині rootEl.
 *
 * @returns Blob+розмір або null при failure/abort/нечого знімати
 */
export async function snapshotElement(
  rootEl: HTMLElement | null | undefined,
  signal: AbortSignal,
): Promise<SnapshotResult | null> {
  if (!rootEl) return null
  if (signal.aborted) return null

  // 1. Native canvas — only if it's the primary visual (covers >=50% rootEl).
  //    Без перевірки розміру: dom-widgets з нестандартним child canvas
  //    (наприклад, audio player thumbnail) ловилися б замість DOM rasterize.
  const canvas = rootEl.querySelector('canvas') as HTMLCanvasElement | null
  if (canvas && isPrimaryElement(canvas, rootEl)) {
    return snapshotCanvas(canvas, signal)
  }

  // 2. SVG — only if primary (cover ≥50% rootEl).
  //    Inline KaTeX SVG (sqrt vinculum, viewBox 400000em) — крихітні відносно
  //    nmt_task rootEl → відфільтрується тут → fall through до snapshotDom.
  //    Geometry 2D / NMT3D: JSXGraph / NMT engine рендерять svg що заповнює
  //    stageRef → проходить.
  const svg = rootEl.querySelector('svg') as SVGSVGElement | null
  if (svg && isPrimaryElement(svg, rootEl)) {
    return snapshotSvg(svg, signal)
  }

  // 3. DOM rasterize fallback — для HTML widgets (nmt_task, future theory
  //    blocks). html2canvas + MathJax v2 SVG injection у onclone.
  return snapshotDom(rootEl, signal)
}

/** Перевіряє чи `el` покриває значну частину rootEl (≥50% по обох осях).
 *
 * Захист від помилкового вибору вкладеного дрібного canvas/svg (наприклад,
 * KaTeX inline sqrt SVG з viewBox 400000em всередині nmt_task DOM, або
 * audio_player thumbnail у media widget). Без цього `querySelector`
 * хапає перший знайдений елемент незалежно від розміру → wrong capture path.
 */
function isPrimaryElement(el: Element, rootEl: HTMLElement): boolean {
  try {
    const er = el.getBoundingClientRect()
    const rr = rootEl.getBoundingClientRect()
    if (rr.width <= 0 || rr.height <= 0) return false
    return er.width >= rr.width * 0.5 && er.height >= rr.height * 0.5
  } catch {
    return false
  }
}

async function snapshotCanvas(
  canvas: HTMLCanvasElement,
  signal: AbortSignal,
): Promise<SnapshotResult | null> {
  if (signal.aborted) return null

  const w = canvas.width
  const h = canvas.height
  if (w <= 0 || h <= 0) return null
  if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
    console.warn(
      '[WB:snapshot] canvas_too_large',
      { width: w, height: h, max: MAX_DIMENSION },
    )
    return null
  }

  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve(null)
      return
    }
    try {
      canvas.toBlob(
        (blob) => {
          if (signal.aborted || !blob) {
            resolve(null)
            return
          }
          resolve({ blob, width: w, height: h })
        },
        'image/png',
      )
    } catch (err) {
      console.warn('[WB:snapshot] canvas_toBlob_failed', err)
      resolve(null)
    }
  })
}

async function snapshotSvg(
  svg: SVGSVGElement,
  signal: AbortSignal,
): Promise<SnapshotResult | null> {
  if (signal.aborted) return null

  // Determine target dimensions
  const rect = svg.getBoundingClientRect()
  let w = Math.round(svg.viewBox?.baseVal?.width || rect.width || 0)
  let h = Math.round(svg.viewBox?.baseVal?.height || rect.height || 0)
  if (w <= 0 || h <= 0) {
    w = Math.round(rect.width)
    h = Math.round(rect.height)
  }
  if (w <= 0 || h <= 0) return null
  if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
    console.warn(
      '[WB:snapshot] svg_too_large',
      { width: w, height: h, max: MAX_DIMENSION },
    )
    return null
  }

  let serialized: string
  try {
    // Клон із ЯВНИМИ розмірами: svg із width='100%' без viewBox (geo2d)
    // після серіалізації не має intrinsic size — Image() дає йому дефолтні
    // 300×150, і drawImage розтягує/обрізає вміст. Живий прояв: ромб на
    // знімку виглядав паралелограмом, частина конструкції зрізана
    // (прогін D-2, 2026-08-04). Живий DOM не мутуємо.
    const clone = svg.cloneNode(true) as SVGSVGElement
    clone.setAttribute('width', String(w))
    clone.setAttribute('height', String(h))
    if (!clone.getAttribute('viewBox')) {
      clone.setAttribute('viewBox', `0 0 ${w} ${h}`)
    }
    // Службові написи всередині сцени (підказки драга) — з клону геть:
    // у презентації віджет статичний, інструкції про перетягування там
    // лише шумлять. Живий DOM недоторканий — ріжемо копію.
    clone.querySelectorAll(EXPORT_HIDE_SELECTOR).forEach((el) => el.remove())
    serialized = new XMLSerializer().serializeToString(clone)
  } catch (err) {
    console.warn('[WB:snapshot] svg_serialize_failed', err)
    return null
  }

  // Гарантуємо, що xmlns присутні (інакше Image() може не зрозуміти).
  if (!serialized.includes('xmlns="http://www.w3.org/2000/svg"')) {
    serialized = serialized.replace(
      '<svg',
      '<svg xmlns="http://www.w3.org/2000/svg"',
    )
  }

  const svgBlob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)
  try {
    const img = await loadImage(url, signal)
    if (!img || signal.aborted) return null

    const offscreen = createCanvas(w, h)
    const ctx = offscreen.getContext('2d')
    if (!ctx) return null
    // Білий фон, бо PNG експорт із прозорим тлом може дати дивне виглядати при composite.
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(img, 0, 0, w, h)

    return await canvasOrOffscreenToBlob(offscreen, w, h, signal)
  } catch (err) {
    console.warn('[WB:snapshot] svg_rasterize_failed', err)
    return null
  } finally {
    URL.revokeObjectURL(url)
  }
}

// ── DOM rasterize (html2canvas) ─────────────────────────────────────────
//
// Для HTML widgets без власного canvas/svg (nmt_task, future theory/formula
// blocks, generic HTML cards). Третій fallback у snapshotElement chain.
//
// Чому html2canvas:
//   - foreignObject + Image() pipeline failed silently на Tailwind/flex/
//     KaTeX MathML/scoped CSS combinations (verified 2026-05-25 E2E).
//   - html2canvas — industry-standard для DOM screenshot use case.
//     Працює через walking DOM + drawing primitives, не через
//     foreignObject. Reliable across Chrome/Firefox/Safari.
//   - ~46 KB gz; lazy-imported тільки при export (zero idle cost).
//
// Architectural invariants preserved:
//   - INV-EP-2: BE still composit only. No widget logic on server.
//   - INV-EP-6: FE = canonical renderer.
//   - INV-EP-8: snapshotElement залишається thin adapter — delegate
//     до html2canvas без widget-specific logic.
async function snapshotDom(
  rootEl: HTMLElement,
  signal: AbortSignal,
): Promise<SnapshotResult | null> {
  if (signal.aborted) return null

  const rect = rootEl.getBoundingClientRect()
  const w = Math.round(rect.width)
  const h = Math.round(rect.height)
  if (w <= 0 || h <= 0) return null
  if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
    console.warn('[WB:snapshot] dom_too_large', { width: w, height: h, max: MAX_DIMENSION })
    return null
  }

  // PRE-PHASE: render all KaTeX math у source DOM through MathJax v2 → SVG.
  // Why: KaTeX HTML uses inline-SVG with viewBox=400000em (sqrt vinculum,
  // delimiters) + CSS `border-bottom` (fraction bar) — html2canvas misses
  // these primitives reliably. MathJax 3 SVG output produces standalone
  // <svg> with full path glyphs that html2canvas captures cleanly.
  // v1 KaTeX rendering у editor untouched — v2 only kicks у at export.
  // Ref: contentRendererMathJaxV2.ts.
  const mathReplacements = new Map<Element, string>()
  try {
    const katexSpans = Array.from(rootEl.querySelectorAll('.katex'))
    if (katexSpans.length > 0) {
      const { renderLatexToSvgV2 } = await import(
        '../../learning-content/utils/contentRendererMathJaxV2'
      )
      // Process всі math елементи паралельно. MathJax warmup happens once
      // through getMathJax() cache.
      await Promise.all(
        katexSpans.map(async (span) => {
          const annotation = span.querySelector(
            'annotation[encoding="application/x-tex"]',
          )
          const latex = annotation?.textContent?.trim() ?? ''
          if (!latex) return
          // KaTeX adds `.katex-display` class on root span у display mode.
          // Check both span itself + its closest ancestor.
          const isDisplay =
            span.classList.contains('katex-display') ||
            !!span.closest('.katex-display') ||
            !!span.closest('.lc-display-math')
          try {
            const svgStr = await renderLatexToSvgV2(latex, isDisplay)
            if (svgStr) mathReplacements.set(span, svgStr)
          } catch {
            // Individual formula failure → don't block other math.
            // Fall through: cloned .katex stays as-is (html2canvas does
            // partial render — better than nothing).
          }
        }),
      )
    }
  } catch (err) {
    console.warn('[WB:snapshot] mathjax_v2_prerender_failed', err)
    // Continue — html2canvas with raw KaTeX is better than abort.
  }
  if (signal.aborted) return null

  // Lazy import — html2canvas (~46 KB gz) loaded only when first DOM
  // widget is captured. Idle bundle unaffected.
  let html2canvas: typeof import('html2canvas').default
  try {
    html2canvas = (await import('html2canvas')).default
  } catch (err) {
    console.warn('[WB:snapshot] dom_lib_load_failed', err)
    return null
  }
  if (signal.aborted) return null

  let canvas: HTMLCanvasElement
  try {
    canvas = await html2canvas(rootEl, {
      backgroundColor: '#ffffff',
      // pixelRatio>1 покращує текст, але збільшує blob.size; 1 безпечно
      // тримається у 2 MB cap для типового nmt_task (~800×400).
      scale: 1,
      // Не пробуємо завантажувати cross-origin зображення (CORS-протекція
      // блокує canvas tainting — toBlob потім кине SecurityError).
      useCORS: false,
      allowTaint: false,
      // Прибрати лишній whitespace навколо — capture точно по bbox rootEl.
      width: w,
      height: h,
      // Без логів html2canvas (вони noisy).
      logging: false,
      // KaTeX `htmlAndMathml` mode emits BOTH visible `.katex-html` AND
      // hidden `.katex-mathml` (accessibility layer with native <math>).
      // html2canvas chokes on <math>; strip from clone. Then, for each
      // pre-rendered MathJax SVG (built у PRE-PHASE above), replace the
      // entire `.katex` span у clone with the SVG. Live DOM stays intact —
      // editor accessibility preserved (this is pure capture-layer concern).
      onclone: (_clonedDoc, clonedEl) => {
        // 0) Прибрати керування з КЛОНУ (жива дошка не змінюється).
        //    У презентації віджет — статична картинка, тож підказки драга
        //    («Drag A/B/D · C = D + (B−A)»), панелі вимірів і кнопки на
        //    ній нічого не пояснюють, лише шумлять (issue власника
        //    2026-08-09). Позначка одна для всіх віджетів — щоб новий
        //    віджет не мусив правити цей файл: [data-export-hide].
        clonedEl.querySelectorAll(EXPORT_HIDE_SELECTOR).forEach((el) => el.remove())

        // 2) Replace each cloned .katex span з pre-rendered MathJax SVG.
        //    Walk source + clone у parallel по індексу (cloneNode preserves
        //    DOM order, querySelectorAll is document-order).
        if (mathReplacements.size === 0) return
        const sourceKatex = Array.from(rootEl.querySelectorAll('.katex'))
        const clonedKatex = Array.from(clonedEl.querySelectorAll('.katex'))
        const len = Math.min(sourceKatex.length, clonedKatex.length)
        for (let i = 0; i < len; i++) {
          const svg = mathReplacements.get(sourceKatex[i])
          if (svg) {
            clonedKatex[i].innerHTML = svg
          }
        }
      },
    })
  } catch (err) {
    console.warn('[WB:snapshot] dom_html2canvas_failed', err)
    return null
  }
  if (signal.aborted) return null

  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => {
        if (signal.aborted || !blob) {
          resolve(null)
          return
        }
        resolve({ blob, width: w, height: h })
      }, 'image/png')
    } catch (err) {
      console.warn('[WB:snapshot] dom_toBlob_failed', err)
      resolve(null)
    }
  })
}

function loadImage(url: string, signal: AbortSignal): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve(null)
      return
    }
    const img = new Image()
    img.onload = () => resolve(signal.aborted ? null : img)
    img.onerror = () => resolve(null)
    const onAbort = () => {
      img.src = '' // прервати завантаження
      resolve(null)
    }
    signal.addEventListener('abort', onAbort, { once: true })
    img.src = url
  })
}

function createCanvas(w: number, h: number): HTMLCanvasElement | OffscreenCanvas {
  // Перевага OffscreenCanvas (не торкається DOM, не блокує main thread layout),
  // fallback на HTMLCanvasElement якщо OffscreenCanvas недоступний.
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(w, h) as unknown as HTMLCanvasElement
  }
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

async function canvasOrOffscreenToBlob(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  width: number,
  height: number,
  signal: AbortSignal,
): Promise<SnapshotResult | null> {
  if (signal.aborted) return null

  // OffscreenCanvas має convertToBlob(); HTMLCanvasElement має toBlob().
  if ('convertToBlob' in canvas && typeof canvas.convertToBlob === 'function') {
    try {
      const blob = await (canvas as OffscreenCanvas).convertToBlob({ type: 'image/png' })
      if (signal.aborted || !blob) return null
      return { blob, width, height }
    } catch (err) {
      console.warn('[WB:snapshot] offscreen_convertToBlob_failed', err)
      return null
    }
  }
  return new Promise((resolve) => {
    ;(canvas as HTMLCanvasElement).toBlob((blob) => {
      if (signal.aborted || !blob) {
        resolve(null)
        return
      }
      resolve({ blob, width, height })
    }, 'image/png')
  })
}
