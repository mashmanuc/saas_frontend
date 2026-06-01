/**
 * contentRendererMathJaxV2 — паралельна реалізація LaTeX-рендеру через
 * MathJax 3 SVG (browser bundle). Цей файл живе ПОРЯД з `contentRenderer.ts`
 * (v1 KaTeX htmlAndMathml), НЕ замінює його.
 *
 * Призначення:
 *   v1 → editor render (KaTeX HTML+MathML, native browser font rendering).
 *   v2 → export snapshot render. Дає справжні <svg> з path glyphs які
 *        html2canvas рендерить надійно.
 *
 * Browser MathJax (NOT mathjax-full):
 *   Перша спроба (PR-2 fix-up 2026-05-25 v1 attempt) використала
 *   `mathjax-full` через ESM dynamic imports — це Node-only package з
 *   CommonJS `require()`. У Vite/браузері кидав `ReferenceError: require
 *   is not defined` на КОЖНОМУ формулі (verified у production logs).
 *
 *   Правильний шлях для браузера — pre-built bundle `mathjax/es5/tex-svg.js`
 *   завантажуваний через <script> tag, exposes `window.MathJax`. Це
 *   official MathJax-supported browser path.
 *
 * SVG normalization (P0 #2):
 *   Сирий MathJax SVG може мати viewBox/width у em-одиницях що при
 *   serialize-and-load дають огромні pixel sizes (KaTeX має приклад
 *   width="400em" для sqrt vinculum → 6400px). normalizeMathJaxSvg() пере-
 *   обчислює width/height у px + clamp до MAX_SVG_DIMENSION_PX.
 */

const MAX_SVG_DIMENSION_PX = 2048 // safe ceiling; html2canvas + browser SVG
                                  // render comfortably у цьому range.

// MathJax browser script load promise (singleton).
let mjLoadPromise: Promise<void> | null = null

interface MathJaxBrowserApi {
  tex2svg(
    formula: string,
    options?: { display?: boolean },
  ): HTMLElement
  startup?: { document?: { clear?: () => void } }
}

/** Завантажити MathJax 3 tex-svg browser bundle один раз з CDN.
 *
 * Чому CDN, не npm `mathjax` package:
 *   Vite pre-bundling NPM-резолвить `mathjax/es5/tex-svg.js` через
 *   `mathjax-full` (його CommonJS залежність) → optimizeDeps chunk
 *   містить `require()` calls → у browser ESM context: `ReferenceError:
 *   require is not defined`. Verified via stack trace 2026-05-25:
 *     `at .../mathjax-full/js/components/version.js`
 *     `at .../mathjax-full/js/mathjax.js`
 *   Навіть після `npm uninstall mathjax-full`, Vite старі chunks тримав.
 *
 *   CDN load обходить Vite resolution цілком. Script тег → стандартний
 *   browser global script execution → window.MathJax populated correctly.
 *
 * MathJax config MUST be set BEFORE the script loads (script reads
 * config during startup). Це promise-based singleton.
 */
const MATHJAX_CDN_URL = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js'
const MATHJAX_LOAD_TIMEOUT_MS = 15_000

function loadMathJaxBundle(): Promise<void> {
  if (mjLoadPromise) return mjLoadPromise
  mjLoadPromise = new Promise<void>((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('MathJax requires browser env'))
      return
    }
    const w = window as unknown as {
      MathJax?: MathJaxBrowserApi & Record<string, unknown>
    }
    if (w.MathJax && typeof w.MathJax.tex2svg === 'function') {
      resolve()
      return
    }
    // Configure BEFORE script load.
    w.MathJax = ({
      ...(w.MathJax ?? {}),
      tex: {
        packages: { '[+]': ['noerrors', 'noundefined'] },
      },
      svg: {
        fontCache: 'none', // standalone SVG, no <defs> dep
      },
      startup: {
        typeset: false, // ми робимо рендер вручну через tex2svg
      },
      options: {
        skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre'],
        renderActions: {},
      },
    }) as unknown as MathJaxBrowserApi & Record<string, unknown>

    const script = document.createElement('script')
    script.src = MATHJAX_CDN_URL
    script.async = true
    const timeoutId = setTimeout(() => {
      reject(new Error(`MathJax CDN load timeout (${MATHJAX_LOAD_TIMEOUT_MS}ms)`))
    }, MATHJAX_LOAD_TIMEOUT_MS)
    script.onload = () => {
      clearTimeout(timeoutId)
      // tex-svg.js script populates window.MathJax with API including tex2svg.
      // У деяких випадках це async — поллемо коротко.
      const checkReady = () => {
        const mj = (window as unknown as { MathJax?: MathJaxBrowserApi }).MathJax
        if (mj && typeof mj.tex2svg === 'function') {
          resolve()
          return true
        }
        return false
      }
      if (checkReady()) return
      // Wait up to 2 seconds for MathJax startup.
      const startTime = Date.now()
      const pollInterval = setInterval(() => {
        if (checkReady()) {
          clearInterval(pollInterval)
        } else if (Date.now() - startTime > 2000) {
          clearInterval(pollInterval)
          reject(new Error('MathJax loaded but tex2svg not ready after 2s'))
        }
      }, 50)
    }
    script.onerror = () => {
      clearTimeout(timeoutId)
      reject(new Error(`MathJax CDN load failed: ${MATHJAX_CDN_URL}`))
    }
    document.head.appendChild(script)
  })
  return mjLoadPromise
}

/** Render LaTeX → standalone SVG string з нормалізованими розмірами.
 *
 * @param formula raw LaTeX (без `$`-обгорток)
 * @param displayMode true = block-mode (centered, larger), false = inline
 * @returns clean `<svg>` HTML string (без оточуючих `<mjx-container>`) або
 *   fallback `<span class="lc-formula-error">` при failure
 */
export async function renderLatexToSvgV2(
  formula: string,
  displayMode: boolean,
): Promise<string> {
  if (!formula || !formula.trim()) return ''
  try {
    await loadMathJaxBundle()
    const w = window as unknown as { MathJax: MathJaxBrowserApi }
    const container = w.MathJax.tex2svg(formula, { display: displayMode })

    // tex2svg returns <mjx-container><svg>...</svg></mjx-container>.
    // ПОВЕРТАЄМО ЦІЛИЙ container, не голий svg — у container є inline-block /
    // vertical-align CSS (інжектиться MathJax script у document head при
    // завантаженні). Голий svg → inline-flow → всі формули колапсують у
    // одну baseline точку (verified 2026-05-25 у nmt_task PDF).
    //
    // Нормалізуємо ВНУТРІШНІЙ svg (clamp dimensions, strip insane em sizes),
    // повертаємо container.outerHTML.
    const svg = container.querySelector('svg') as SVGSVGElement | null
    if (!svg) {
      throw new Error('MathJax output без <svg>')
    }
    normalizeMathJaxSvg(svg)
    container.style.display = container.style.display || 'inline-block'
    const svgVA = svg.style.verticalAlign
    if (svgVA && !container.style.verticalAlign) {
      container.style.verticalAlign = svgVA
    }
    return container.outerHTML
  } catch (err) {
    console.warn('[WB:mathjax-v2] render_failed', { formula, err })
    return `<span class="lc-formula-error">${escapeHtml(formula)}</span>`
  }
}

/** SVG normalization — ONLY clamp at safety limit, don't override
 *  MathJax's natural ex-based dimensions.
 *
 * MathJax емітить SVG з трьома взаємокалібровaними штуками:
 *   - width="X.XXXex" (relative to font-size's `ex` unit = ~0.5em)
 *   - height="Y.YYYex"
 *   - style="vertical-align: -Z.ZZZex" — на сам <svg>
 * І ці три значення RAZOM визначають де SVG-внутрішній baseline (Y=0
 * у viewBox) опиняється відносно baseline тексту. Якщо змінити width/
 * height на px (інша одиниця), співвідношення ламається → math floats.
 *
 * Тому: НЕ rewrite-имо нативні ex-розміри. Тільки clamp якщо реально
 * патологічно великі (захист від KaTeX 400em-style attacks).
 *
 * P0 #2 KaTeX inline `<svg viewBox="0 0 400000 1080">` тут не релевантний —
 * це KaTeX HTML inline SVG; MathJax заміняє цілий .katex span цілком у
 * onclone, тож тих svg-ів у фінальному snapshot DOM не лишається.
 */
function normalizeMathJaxSvg(svg: SVGSVGElement): void {
  const FONT_SIZE_PX = 16
  const widthAttr = svg.getAttribute('width') || ''
  const heightAttr = svg.getAttribute('height') || ''
  const widthPx = parseEmToPx(widthAttr, FONT_SIZE_PX)
  const heightPx = parseEmToPx(heightAttr, FONT_SIZE_PX)

  // Тільки якщо WIDTH або HEIGHT перевищує safety cap (>2048 px) — clamp.
  // Більшість MathJax math has < 200 px dimensions → залишаємо ex-units
  // як є, MathJax baseline calibration працює природно.
  if (widthPx > MAX_SVG_DIMENSION_PX || heightPx > MAX_SVG_DIMENSION_PX) {
    const scale = MAX_SVG_DIMENSION_PX / Math.max(widthPx, heightPx)
    const newW = Math.max(1, Math.round(widthPx * scale))
    const newH = Math.max(1, Math.round(heightPx * scale))
    svg.setAttribute('width', String(newW))
    svg.setAttribute('height', String(newH))
    svg.style.width = `${newW}px`
    svg.style.height = `${newH}px`
    // vertical-align ламається при scaling — best-effort proportional shift.
    const va = parseEmToPx(svg.style.verticalAlign || '', FONT_SIZE_PX)
    if (va !== 0) {
      svg.style.verticalAlign = `${Math.round(va * scale)}px`
    }
  }
  // Else: leave всі MathJax-калібровані values недоторканими.
}

function parseEmToPx(value: string, fontSizePx: number): number {
  const num = parseFloat(value)
  if (!isFinite(num)) return 0
  if (value.endsWith('ex')) return Math.round(num * fontSizePx * 0.5)
  if (value.endsWith('em')) return Math.round(num * fontSizePx)
  if (value.endsWith('px')) return Math.round(num)
  // pt, pc, etc — rare, treat as px.
  return Math.round(num)
}

/** Self-contained escapeHtml (don't import from v1, keep v2 independent). */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
