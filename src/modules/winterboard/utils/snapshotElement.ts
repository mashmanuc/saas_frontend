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

/** Обгортка картки — зменшеної копії самої себе (`composables/cardZoom`, WBOverlayLayer і WBCanvas). */
const CARD_ZOOM_SELECTOR = '.wb-card-zoom'

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
 * Позначка кореня віджета: знімати гілкою DOM (html2canvas + MathJax v2 замість KaTeX), навіть
 * якщо всередині великий SVG — для віджетів, де формули KaTeX (HTML) лежать поверх рисунка SVG.
 * Гілка SVG їх би загубила, а foreignObject на KaTeX ламається мовчки (перевірено 2026-05-25).
 * Як і `[data-export-hide]`, — загальна позначка: новий віджет ставить атрибут, цей файл не правиться.
 */
export const EXPORT_DOM_ATTR = 'data-export-dom'
/**
 * Бажана ширина знімка гілки DOM (логічна ширина віджета, px): знімок не дрібніє разом із масштабом
 * дошки. Масштаб html2canvas — не менше 1 і не більше 4, межа MAX_DIMENSION — як для решти гілок.
 */
export const EXPORT_WIDTH_ATTR = 'data-export-width'

/**
 * Рядок, який у знімку має вміститись у свою рамку (логічні px): `data-export-fit-width` /
 * `data-export-fit-height`. У знімку формули малює MathJax — його гліфи трохи ширші й вищі за
 * KaTeX, тож рядок, підігнаний на екрані впритул, у PDF вилазив би. Підганяємо в КЛОНІ, після
 * підстановки MathJax (fitExportRows). Загальна позначка, як `[data-export-hide]`.
 */
export const EXPORT_FIT_WIDTH_ATTR = 'data-export-fit-width'
export const EXPORT_FIT_HEIGHT_ATTR = 'data-export-fit-height'
/** Клас, яким у клоні замінюємо `.katex` навколо MathJax (без CSS KaTeX). */
export const EXPORT_MATH_CLASS = 'wb-export-math'

/**
 * SVG MathJax у знімку — як задумав MathJax, незалежно від CSS сторінки:
 *  - розміри в `ex` → в `em` (MathJax рахує 1ex = 0,5em; справжній ex шрифту різний — у KaTeX_Main
 *    0,43em, у системних інший — і формула виходила то дрібнішою, то більшою за свій рядок);
 *  - рядковий svg (глобальний preflight `svg { display: block }` ставив формулу вгору контейнера,
 *    вище за текст рядка), зсув базової лінії — один раз.
 */
export function settleMathJaxSvg(svg: SVGSVGElement): void {
  const em = (v: string | null) => {
    const m = /^(-?[\d.]+)ex$/.exec((v ?? '').trim())
    return m ? `${Number(m[1]) / 2}em` : null
  }
  for (const attr of ['width', 'height']) {
    const v = em(svg.getAttribute(attr))
    if (v) svg.setAttribute(attr, v)
  }
  const va = em(svg.style.verticalAlign)
  if (va) svg.style.verticalAlign = va
  // Зсув базової лінії — лише на svg, як у MathJax: копія на контейнері (renderLatexToSvgV2)
  // опускала формулу вдвічі, і текст рядка стояв вище за неї.
  if (svg.parentElement) svg.parentElement.style.verticalAlign = ''
  svg.style.display = 'inline'
}

/** Стискає (transform: scale) кожен позначений рядок до його рамки за фактичним розміром. */
export function fitExportRows(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>(`[${EXPORT_FIT_WIDTH_ATTR}]`).forEach((el) => {
    const maxW = Number(el.getAttribute(EXPORT_FIT_WIDTH_ATTR))
    const maxH = Number(el.getAttribute(EXPORT_FIT_HEIGHT_ATTR))
    el.style.transform = 'none'
    const w = el.offsetWidth
    // Висота математики — за самим SVG MathJax (контейнер ще й висота рядка); у клоні предки ще
    // з transform, тож ділимо на їхній масштаб. Залишки KaTeX — за strut.
    const rectW = el.getBoundingClientRect().width
    const k0 = w > 0 && rectW > 0 ? rectW / w : 1
    let h = 0
    el.querySelectorAll('mjx-container > svg').forEach((m) => { h = Math.max(h, m.getBoundingClientRect().height / k0) })
    el.querySelectorAll<HTMLElement>('.katex-html .strut').forEach((m) => { h = Math.max(h, m.offsetHeight) })
    const k = Math.min(1, w > 0 && maxW > 0 ? maxW / w : 1, h > 0 && maxH > 0 ? maxH / h : 1)
    if (k < 1) el.style.transform = `scale(${k})`
  })
}

/** Помножити розмір svg (`width`/`height` і зсув базової лінії) на k, хоч би в чому він був заданий. */
function scaleSvgSize(svg: SVGSVGElement, k: number): void {
  const mul = (v: string | null) => {
    const m = /^(-?[\d.]+)([a-z%]*)$/i.exec((v ?? '').trim())
    return m ? `${Number(m[1]) * k}${m[2]}` : null
  }
  for (const attr of ['width', 'height']) {
    const v = mul(svg.getAttribute(attr))
    if (v) svg.setAttribute(attr, v)
  }
  const va = mul(svg.style.verticalAlign)
  if (va) svg.style.verticalAlign = va
}

/**
 * Формула в знімку не ширша за місце, яке їй дає верстка (клітинка варіанта, рядок, сам віджет).
 *
 * На екрані KaTeX переносить довгу формулу на другий рядок; у знімку формула — один SVG MathJax,
 * перенести його не можна. У вузькій клітинці (варіант задачі НМТ `x ∈ [1; 50)`) він виходив за
 * межу й обрізався — у PDF губився зміст (рев'ю Феї 2026-10-13). Межа — найближчий правий край
 * вмісту серед предків до кореня знімка: предки, що ростуть разом із формулою, межі не дають.
 * Рядки з власною підгонкою (`data-export-fit-width`, fitExportRows) не чіпаємо.
 */
export function fitMathToContainers(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>(`.${EXPORT_MATH_CLASS}`).forEach((host) => {
    if (host.closest(`[${EXPORT_FIT_WIDTH_ATTR}]`)) return
    const box = host.getBoundingClientRect()
    if (box.width <= 0) return
    let limit = Infinity
    for (let a: HTMLElement | null = host.parentElement; a; a = a === root ? null : a.parentElement) {
      const r = a.getBoundingClientRect()
      if (r.width <= 0) continue
      const cs = getComputedStyle(a)
      // Відступи — у CSS px, прямокутник — з урахуванням transform предків (масштаб дошки).
      const sx = a.offsetWidth > 0 ? r.width / a.offsetWidth : 1
      const inset = (parseFloat(cs.paddingRight) || 0) + (parseFloat(cs.borderRightWidth) || 0)
      limit = Math.min(limit, r.right - inset * sx)
    }
    const room = limit - box.left
    if (!(room > 0) || box.width <= room + 0.5) return
    const k = room / box.width
    host.querySelectorAll<SVGSVGElement>('mjx-container > svg').forEach((svg) => scaleSvgSize(svg, k))
  })
}

/** Яку гілку знімка взяти для кореня (без побічних дій — і для тестів). */
export function snapshotBranch(rootEl: HTMLElement): 'canvas' | 'svg' | 'dom' {
  if (rootEl.hasAttribute(EXPORT_DOM_ATTR)) return 'dom'
  const canvas = rootEl.querySelector('canvas') as HTMLCanvasElement | null
  if (canvas && isPrimaryElement(canvas, rootEl)) return 'canvas'
  const svg = rootEl.querySelector('svg') as SVGSVGElement | null
  if (svg && isPrimaryElement(svg, rootEl)) return 'svg'
  return 'dom'
}

/** Масштаб html2canvas для бажаної ширини: [1; 4]; без атрибута — 1. */
export function domExportScale(rootEl: HTMLElement, onScreenWidth: number): number {
  const want = Number(rootEl.getAttribute(EXPORT_WIDTH_ATTR))
  if (!Number.isFinite(want) || want <= 0 || onScreenWidth <= 0) return 1
  return Math.min(4, Math.max(1, want / onScreenWidth))
}

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

  // 0. Явна позначка [data-export-dom] — одразу DOM (формули KaTeX поверх рисунка SVG).
  // 1. Native canvas — only if it's the primary visual (covers >=50% rootEl).
  //    Без перевірки розміру: dom-widgets з нестандартним child canvas
  //    (наприклад, audio player thumbnail) ловилися б замість DOM rasterize.
  // 2. SVG — only if primary (cover ≥50% rootEl).
  //    Inline KaTeX SVG (sqrt vinculum, viewBox 400000em) — крихітні відносно
  //    nmt_task rootEl → відфільтрується тут → fall through до snapshotDom.
  //    Geometry 2D / NMT3D: JSXGraph / NMT engine рендерять svg що заповнює
  //    stageRef → проходить.
  // 3. DOM rasterize fallback — для HTML widgets (nmt_task, future theory
  //    blocks). html2canvas + MathJax v2 SVG injection у onclone.
  const branch = snapshotBranch(rootEl)
  if (branch === 'canvas') return snapshotCanvas(rootEl.querySelector('canvas') as HTMLCanvasElement, signal)
  if (branch === 'svg') return snapshotSvg(rootEl.querySelector('svg') as SVGSVGElement, signal)
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

/**
 * html2canvas міряє базову лінію шрифту в ЖИВОМУ документі: рядок тексту + картинка 1×1 з
 * `vertical-align: baseline` (FontMetrics.parseMetrics). Глобальний preflight (`src/assets/main.css`:
 * `img { display: block }`) зносить ту картинку на наступний рядок — базова лінія виходить на
 * ~пів рядка нижчою, і ВЕСЬ текст DOM-знімка малюється на ~7 px нижче, ніж на екрані (поруч
 * із формулами MathJax, які стоять правильно, це видно одразу). На час знімка повертаємо саме
 * цій картинці (її data-URI з html2canvas) рядкову поведінку; більше нічого не чіпаємо.
 */
export const HTML2CANVAS_PROBE_SRC = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
export const FONT_PROBE_STYLE_ATTR = 'data-snapshot-font-probe'

export function fixFontProbe(doc: Document = document): () => void {
  const style = doc.createElement('style')
  style.setAttribute(FONT_PROBE_STYLE_ATTR, '')
  style.textContent = `img[src="${HTML2CANVAS_PROBE_SRC}"] { display: inline !important; }`
  doc.head.appendChild(style)
  return () => style.remove()
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

  // Картка — зменшена копія самої себе (обгортка `scale()` на масштабі дошки, composables/cardZoom: картка задачі,
  // картка конспекту): знімаємо в пікселях КАРТКИ, а в клоні обгортку розгортаємо. Інакше html2canvas малював текст
  // повного розміру в зменшеній рамці — у PDF каша (стенд 2026-10-21, 1366×768).
  const zoomed = rootEl.closest(CARD_ZOOM_SELECTOR) !== null
  const rect = rootEl.getBoundingClientRect()
  const w = Math.round(zoomed ? rootEl.offsetWidth : rect.width)
  const h = Math.round(zoomed ? rootEl.offsetHeight : rect.height)
  if (w <= 0 || h <= 0) return null
  if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
    console.warn('[WB:snapshot] dom_too_large', { width: w, height: h, max: MAX_DIMENSION })
    return null
  }
  // Бажана ширина знімка ([data-export-width]) — у межах MAX_DIMENSION.
  const scale = Math.min(domExportScale(rootEl, w), MAX_DIMENSION / w, MAX_DIMENSION / h)

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
  const restoreProbe = fixFontProbe(rootEl.ownerDocument)
  try {
    canvas = await html2canvas(rootEl, {
      backgroundColor: '#ffffff',
      // pixelRatio>1 покращує текст, але збільшує blob.size; 1 безпечно
      // тримається у 2 MB cap для типового nmt_task (~800×400). Більше — лише
      // на прохання віджета ([data-export-width]).
      scale,
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
        // Обгортка зменшеної копії в КЛОНІ — без масштабу: картка в клоні у своїх пікселях (жива дошка не змінюється)
        const zoomLayer = clonedEl.closest<HTMLElement>(CARD_ZOOM_SELECTOR)
        if (zoomLayer) zoomLayer.style.transform = 'none'

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
        //    MathJax кладемо НЕ всередину `.katex`: CSS KaTeX (`.katex svg { position: absolute;
        //    width: 100%; height: inherit }`) стискав і зсував його SVG (у PDF «−3» дрібніше за «1»,
        //    формула вища за текст рядка). Клас знімаємо, розмір шрифту переносимо з живого `.katex`.
        if (mathReplacements.size > 0) {
          const sourceKatex = Array.from(rootEl.querySelectorAll<HTMLElement>('.katex'))
          const clonedKatex = Array.from(clonedEl.querySelectorAll<HTMLElement>('.katex'))
          const len = Math.min(sourceKatex.length, clonedKatex.length)
          for (let i = 0; i < len; i++) {
            const svg = mathReplacements.get(sourceKatex[i])
            if (!svg) continue
            const host = clonedKatex[i]
            const cs = getComputedStyle(sourceKatex[i])
            host.className = EXPORT_MATH_CLASS
            host.style.fontSize = cs.fontSize
            host.style.lineHeight = cs.lineHeight
            host.style.whiteSpace = 'nowrap'
            host.innerHTML = svg
            // MathML для читачів екрана — на картинці зайвий (без CSS MathJax займав місце).
            host.querySelectorAll('mjx-assistive-mml').forEach((el) => el.remove())
            host.querySelectorAll<SVGSVGElement>('mjx-container > svg').forEach((svg) => {
              settleMathJaxSvg(svg)
              // html2canvas малює svg окремою картинкою, де `currentColor` не успадковує колір
              // рядка й стає чорним (у PDF сірий рядок ОДЗ виходив чорним) — колір явно, з живої формули.
              svg.style.color = cs.color
            })
          }
        }

        // 3) Формула не ширша за свою клітинку (варіант задачі НМТ): у знімку її не перенести.
        fitMathToContainers(clonedEl)
        // 4) Рядки з позначкою — у свою рамку за розміром MathJax (не KaTeX з екрана).
        fitExportRows(clonedEl)
      },
    })
  } catch (err) {
    console.warn('[WB:snapshot] dom_html2canvas_failed', err)
    return null
  } finally {
    restoreProbe()
  }
  if (signal.aborted) return null

  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => {
        if (signal.aborted || !blob) {
          resolve(null)
          return
        }
        resolve({ blob, width: canvas.width, height: canvas.height })
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
