/**
 * snapshotElement — універсальний thin-adapter capture помічник для widget previews.
 *
 * Ref: saas_docs/domains/winterboard/export/EXPORT_PREPARATION_SSOT.md INV-EP-8
 *
 * Стратегія:
 *  1. Native canvas (TrigCircle, TrigSolver, GraphCalc, Calculus, Helix, Solid)
 *     → canvas.toBlob('image/png')
 *  2. SVG (Geometry2DRenderer = JSXGraph, Nmt3dRenderer)
 *     → XMLSerializer → blob URL → Image() → drawImage на OffscreenCanvas → toBlob
 *  3. Інше — повертає null (BE намалює placeholder per INV-EP-7)
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

  // 1. Native canvas (включаючи WebGL — Three.js renderer.domElement)
  const canvas = rootEl.querySelector('canvas') as HTMLCanvasElement | null
  if (canvas) return snapshotCanvas(canvas, signal)

  // 2. SVG (JSXGraph або native SVG engine)
  const svg = rootEl.querySelector('svg') as SVGSVGElement | null
  if (svg) return snapshotSvg(svg, signal)

  // No canvas/svg yet — INV-EP-7: BE renders placeholder.
  return null
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
    serialized = new XMLSerializer().serializeToString(svg)
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
