/**
 * Відеофрагмент із фото-станів запису: аналіз діапазону (прогноз тривалості) і експорт у MP4.
 *
 * Кодування — WebCodecs `VideoEncoder` (H.264), файл складаємо самі (`mp4.ts`): не в реальному часі, як
 * `MediaRecorder`, і без його зламаної тривалості. Немає WebCodecs/H.264 — експорт недоступний із причиною
 * (ТЗ §4: чесно, без обіцянок), а перегляд і кроки працюють.
 * Файл лишається на пристрої: тут лише Blob, жодних запитів на сервер, крім читання самих фото.
 */
import { buildMp4, type Mp4Sample } from './mp4'
import { disposeTransition, drawTransition, planTransition, type TransitionPlan } from './transition'
import type { TransitionKind } from './types'

export const CLIP = {
  fps: 30,
  width: 1280,
  height: 720,
  holdStartMs: 1000,
  holdAfterMs: 450,
  holdEndMs: 2000,
  /** Тимчасові стелі пілота (ТЗ §4) */
  maxSources: 60,
  maxMs: 5 * 60 * 1000,
  bitrate: 6_000_000,
  keyEveryS: 2,
  background: '#121212',
} as const

const CODECS = ['avc1.640028', 'avc1.4d0028', 'avc1.42e01f']

export interface ClipStep {
  from: number
  to: number
  kind: TransitionKind
  reason: string
  durationMs: number
}

export interface ClipAnalysis {
  steps: ClipStep[]
  /** Скільки кроків із новим написаним / стиранням (без «лише світло») */
  realSteps: number
  lightOnly: number
  estimatedMs: number
  crop: { x: number; y: number; w: number; h: number }
}

export type ClipProgress = (done: number, total: number) => void

/** Завантажити фото так, щоб можна було читати пікселі (CORS: сховище віддає дозвіл для m4sh.org). */
export function loadImage(url: string, signal?: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    const abort = () => { img.src = ''; reject(new DOMException('aborted', 'AbortError')) }
    signal?.addEventListener('abort', abort, { once: true })
    img.onload = () => { signal?.removeEventListener('abort', abort); resolve(img) }
    img.onerror = () => { signal?.removeEventListener('abort', abort); reject(new Error(`load_failed:${url}`)) }
    img.src = url
  })
}

/** Білі поля знімка «Дзеркала» (дошка ширша за 16:9 вписана з полями) — обрізати, щоб у ролику не було смуг. */
export function contentCrop(img: CanvasImageSource, w: number, h: number): ClipAnalysis['crop'] {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0)
  let d: Uint8ClampedArray
  try { d = ctx.getImageData(0, 0, w, h).data } catch { return { x: 0, y: 0, w, h } } finally { c.width = 0; c.height = 0 }
  const white = (i: number) => d[i] > 245 && d[i + 1] > 245 && d[i + 2] > 245
  const rowWhite = (y: number) => { let n = 0; for (let x = 0; x < w; x++) if (white((y * w + x) * 4)) n++; return n / w >= 0.97 }
  const colWhite = (x: number) => { let n = 0; for (let y = 0; y < h; y++) if (white((y * w + x) * 4)) n++; return n / h >= 0.97 }
  let y0 = 0, y1 = h, x0 = 0, x1 = w
  while (y0 < y1 - 1 && rowWhite(y0)) y0++
  while (y1 - 1 > y0 && rowWhite(y1 - 1)) y1--
  while (x0 < x1 - 1 && colWhite(x0)) x0++
  while (x1 - 1 > x0 && colWhite(x1 - 1)) x1--
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

const frames = (ms: number) => Math.max(1, Math.ceil((ms / 1000) * CLIP.fps))

function stepFrames(s: ClipStep): number {
  if (s.kind === 'snap') return 1 + frames(CLIP.holdAfterMs)
  return frames(s.durationMs) + (s.kind === 'light_only' ? 0 : frames(CLIP.holdAfterMs))
}

/** Прогноз: проаналізувати всі пари діапазону (лише підсумок, без важких буферів). */
export async function analyzeRange(urls: string[], onProgress?: ClipProgress, signal?: AbortSignal): Promise<ClipAnalysis> {
  if (urls.length < 2) throw new Error('need_two')
  if (urls.length > CLIP.maxSources) throw new Error('too_many_sources')
  let prev = await loadImage(urls[0], signal)
  const crop = contentCrop(prev, prev.naturalWidth, prev.naturalHeight)
  const steps: ClipStep[] = []
  for (let i = 1; i < urls.length; i++) {
    const next = await loadImage(urls[i], signal)
    const plan = await planTransition(prev, next, { signal })
    steps.push({ from: i - 1, to: i, kind: plan.kind, reason: plan.reason, durationMs: plan.durationMs })
    disposeTransition(plan)
    prev = next
    onProgress?.(i, urls.length - 1)
  }
  const total = frames(CLIP.holdStartMs) + steps.reduce((s, x) => s + stepFrames(x), 0) + frames(CLIP.holdEndMs)
  return {
    steps,
    realSteps: steps.filter((s) => s.kind !== 'light_only').length,
    lightOnly: steps.filter((s) => s.kind === 'light_only').length,
    estimatedMs: Math.round((total / CLIP.fps) * 1000),
    crop,
  }
}

/** Чи вміє браузер кодувати H.264 через WebCodecs; codec — перший придатний. */
export async function clipExportSupport(): Promise<{ ok: boolean; codec?: string }> {
  const VE = (globalThis as { VideoEncoder?: typeof VideoEncoder }).VideoEncoder
  if (!VE || typeof (globalThis as { VideoFrame?: unknown }).VideoFrame === 'undefined') return { ok: false }
  for (const codec of CODECS) {
    try {
      const r = await VE.isConfigSupported({
        codec, width: CLIP.width, height: CLIP.height, bitrate: CLIP.bitrate, framerate: CLIP.fps, avc: { format: 'avc' },
      })
      if (r.supported) return { ok: true, codec }
    } catch {
      // непідтримуваний рядок кодека — пробуємо наступний
    }
  }
  return { ok: false }
}

/**
 * Зібрати MP4: на кожен крок — кадри переходу, після справжнього кроку — пауза на точному фото.
 * Пікселі фото, яке не вдалося завантажити, не пропускаємо мовчки — помилка (ТЗ §3 «Правдивість»).
 */
export async function exportClip(
  urls: string[], analysis: ClipAnalysis, codec: string, onProgress?: ClipProgress, signal?: AbortSignal,
): Promise<Blob> {
  const { crop } = analysis
  const out = document.createElement('canvas')
  out.width = CLIP.width
  out.height = CLIP.height
  const octx = out.getContext('2d')!
  const scale = Math.min(CLIP.width / crop.w, CLIP.height / crop.h)
  const dw = Math.round(crop.w * scale)
  const dh = Math.round(crop.h * scale)
  const dx = Math.round((CLIP.width - dw) / 2)
  const dy = Math.round((CLIP.height - dh) / 2)
  let work: HTMLCanvasElement | null = null
  let wctx: CanvasRenderingContext2D | null = null

  const samples: Mp4Sample[] = []
  let avcC: Uint8Array | null = null
  let failure: unknown = null
  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      const desc = meta?.decoderConfig?.description
      if (desc && !avcC) {
        avcC = desc instanceof ArrayBuffer ? new Uint8Array(desc.slice(0)) : new Uint8Array((desc as ArrayBufferView).buffer.slice(0))
      }
      const data = new Uint8Array(chunk.byteLength)
      chunk.copyTo(data)
      samples.push({ data, duration: 1000, key: chunk.type === 'key' })
    },
    error: (e) => { failure = e },
  })
  encoder.configure({
    codec, width: CLIP.width, height: CLIP.height, bitrate: CLIP.bitrate, framerate: CLIP.fps,
    avc: { format: 'avc' }, latencyMode: 'quality',
  })

  const totalFrames = Math.round((analysis.estimatedMs / 1000) * CLIP.fps)
  let n = 0
  const emit = async (src: CanvasImageSource) => {
    if (signal?.aborted) throw new DOMException('aborted', 'AbortError')
    if (failure) throw failure
    octx.fillStyle = CLIP.background
    octx.fillRect(0, 0, CLIP.width, CLIP.height)
    octx.drawImage(src, crop.x, crop.y, crop.w, crop.h, dx, dy, dw, dh)
    const frame = new VideoFrame(out, { timestamp: Math.round((n * 1_000_000) / CLIP.fps), duration: Math.round(1_000_000 / CLIP.fps) })
    encoder.encode(frame, { keyFrame: n % (CLIP.keyEveryS * CLIP.fps) === 0 })
    frame.close()
    n++
    if (n % 15 === 0) onProgress?.(n, totalFrames)
    while (encoder.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 0))
  }
  const hold = async (src: CanvasImageSource, ms: number) => { for (let i = 0; i < frames(ms); i++) await emit(src) }

  try {
    let prev = await loadImage(urls[0], signal)
    work = document.createElement('canvas')
    work.width = prev.naturalWidth
    work.height = prev.naturalHeight
    wctx = work.getContext('2d')!
    await hold(prev, CLIP.holdStartMs)
    for (const step of analysis.steps) {
      const next = await loadImage(urls[step.to], signal)
      const plan: TransitionPlan = await planTransition(prev, next, { signal })
      try {
        if (plan.kind === 'snap') {
          await emit(next)
        } else {
          if (work.width !== plan.width || work.height !== plan.height) { work.width = plan.width; work.height = plan.height }
          const nf = frames(plan.durationMs)
          for (let f = 1; f <= nf; f++) {
            drawTransition(plan, (f / CLIP.fps) * 1000, wctx)
            await emit(work)
          }
        }
        if (plan.kind !== 'light_only') await hold(next, CLIP.holdAfterMs)
      } finally {
        disposeTransition(plan)
      }
      prev = next
    }
    await hold(prev, CLIP.holdEndMs)
    await encoder.flush()
    if (failure) throw failure
    if (!avcC) throw new Error('encoder_no_config')
    onProgress?.(totalFrames, totalFrames)
    const mp4 = buildMp4({ width: CLIP.width, height: CLIP.height, timescale: CLIP.fps * 1000, avcC, samples })
    return new Blob([mp4 as BlobPart], { type: 'video/mp4' })
  } finally {
    if (encoder.state !== 'closed') encoder.close()
    for (const c of [out, work]) if (c) { c.width = 0; c.height = 0 }
  }
}
