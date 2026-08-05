/**
 * exportPreviewService — orchestration layer для widget preview capture у export.
 *
 * Ref: saas_docs/domains/winterboard/export/EXPORT_PREPARATION_SSOT.md
 *
 * Жорсткі гарантії (PR-2 reviewer guards):
 *   1. Export orchestration isolation — service опитує widget'и через
 *      registry, не торкається widget runtime безпосередньо.
 *   2. Timeout isolation — один зависший widget повертає null, інші
 *      продовжують (DEFAULT_TIMEOUT_MS=10000).
 *   3. Parallelism bounds — pLimit(MAX_CONCURRENT_CAPTURES=4) щоб не
 *      прибити weak ноутбуки 30-ма паралельними canvas-snapshot-ами.
 *   4. Capture cancellation — AbortSignal propagates: dialog close →
 *      controller.abort() → всі in-flight captures + uploads abort.
 *   5. INV-EP-8: capture functions = thin adapter only. Service цього
 *      НЕ enforces у runtime (це responsibility widget автора + reviewer),
 *      але цей файл сам нічого з widget runtime не імпортує.
 *
 * Lifecycle:
 *   - Widget mount → useExportCapture(assetId, captureFn) → register
 *   - Widget unmount → unregister (auto via composable cleanup)
 *   - Export click → captureAll(assetIds, signal) → uploadAll(...)
 */
import { winterboardApi } from '../api/winterboardApi'

/** Capture function shape. Returns Blob+dims or null on failure/abort. */
export type WidgetCaptureFn = (signal: AbortSignal) => Promise<{
  blob: Blob
  width: number
  height: number
} | null>

export interface CapturedPreview {
  assetId: string
  blob: Blob
  width: number
  height: number
}

export interface CaptureResult {
  captured: Map<string, CapturedPreview>
  failed: string[] // assetIds, для UI попередження "N widgets не вдалося"
  skipped: string[] // assetIds без зареєстрованих capture (legacy, BE → placeholder)
}

export interface UploadResult {
  uploaded: number
  failed: number
  reused: number
}

// ── Tunables ─────────────────────────────────────────────────────────────
const DEFAULT_TIMEOUT_MS = 10_000
const MAX_CONCURRENT_CAPTURES = 4
const MAX_CONCURRENT_UPLOADS = 4
// Bumps with snapshotElement.ts capture strategy changes.
const WIDGET_SCHEMA_VERSION = 1

// ── Порожній знімок: самоперевірка замість таймінг-здогаду ───────────────
//
// Вимір 2026-08-05 (сесія 3c01bb13, 96 прев'ю одним заходом): 7 знімків
// вийшли ОДНОКОЛІРНИМИ — біла пляма замість об'єкта. Ключове: той самий
// тип (`geometry_2d_v2`) в тому ж заході дав і 429 кольорів, і 1. Отже це
// не «формат не підтримується», а ГОНКА: capture-функція зареєстрована
// (`hasCapture` = true), але полотно ще не намальоване — vendor-бандл
// geo2d, WebGL, canvas малюють асинхронно.
//
// Чекати «N кадрів» — здогад про таймінг чужого рендерера. Тому знімок
// ПЕРЕВІРЯЄТЬСЯ і перезнімається: критерій — сам результат, а не час.
const BLANK_RETRIES = 2
const BLANK_RETRY_DELAY_MS = 160
// Скільки пікселів дивимось: суцільний скан 1600×1200 — це 2 млн операцій
// на віджет, а однорідність видно і на сітці.
const BLANK_SAMPLE_STEP = 7

/**
 * Чи знімок порожній — тобто має ЄДИНИЙ унікальний колір.
 *
 * Той самий критерій, яким порожнечу міряли на боці BE, тож FE і BE
 * говорять про одне й те саме. Помилка декодування — НЕ «порожній»:
 * інакше збій читання тихо викинув би живий знімок.
 */
async function isBlankBlob(blob: Blob): Promise<boolean> {
  try {
    const bitmap = await createImageBitmap(blob)
    const width = Math.max(1, bitmap.width)
    const height = Math.max(1, bitmap.height)
    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return false
    ctx.drawImage(bitmap, 0, 0)
    const { data } = ctx.getImageData(0, 0, width, height)
    bitmap.close?.()

    const step = BLANK_SAMPLE_STEP * 4
    let first: number | null = null
    for (let i = 0; i < data.length; i += step) {
      // Прозорий піксель = «нічого не намальовано», рахуємо як тло.
      const packed = data[i + 3] === 0
        ? -1
        : (data[i] << 16) | (data[i + 1] << 8) | data[i + 2]
      if (first === null) first = packed
      else if (packed !== first) return false
    }
    return true
  } catch (err) {
    console.warn('[WB:export-prep] blank_check_failed', err)
    return false
  }
}

/** Пауза + кадр відмальовки: даємо рендереру шанс домалювати. */
function waitForRepaint(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      } else {
        resolve()
      }
    }, delayMs)
  })
}

// ── Minimal concurrency limiter (≈15 LOC, no dep) ────────────────────────
function makeLimiter(maxConcurrent: number) {
  let active = 0
  const queue: Array<() => void> = []

  function next(): void {
    if (queue.length === 0 || active >= maxConcurrent) return
    active++
    const job = queue.shift()!
    job()
  }

  return async function run<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      queue.push(async () => {
        try {
          resolve(await fn())
        } catch (err) {
          reject(err)
        } finally {
          active--
          next()
        }
      })
      next()
    })
  }
}

// ── Service singleton ────────────────────────────────────────────────────
class ExportPreviewService {
  private registry = new Map<string, WidgetCaptureFn>()

  // For tests/debug.
  get registeredAssetIds(): string[] {
    return Array.from(this.registry.keys())
  }

  register(assetId: string, fn: WidgetCaptureFn): void {
    if (!assetId) return
    this.registry.set(assetId, fn)
  }

  unregister(assetId: string): void {
    if (!assetId) return
    this.registry.delete(assetId)
  }

  hasCapture(assetId: string): boolean {
    return this.registry.has(assetId)
  }

  /**
   * Capture одного widget з timeout + abort propagation.
   * Per-widget try/catch — НЕ кидає в caller. null = failure (BE placeholder).
   *
   * Порожній (одноколірний) знімок вважається НЕВДАЛИМ і перезнімається
   * (`BLANK_RETRIES`). Якщо порожній і після спроб — повертаємо null, тобто
   * НЕ вантажимо: у колоді буде чесний підпис-заповнювач, а не біла пляма.
   * Принцип той самий, що всюди в North Ship: не вийшло → нічого, ніколи
   * не імітація.
   */
  private async captureOne(
    assetId: string,
    signal: AbortSignal,
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
  ): Promise<CapturedPreview | null> {
    for (let attempt = 0; attempt <= BLANK_RETRIES; attempt++) {
      const shot = await this.captureAttempt(assetId, signal, timeoutMs)
      if (!shot) return null
      if (!(await isBlankBlob(shot.blob))) return shot

      if (attempt === BLANK_RETRIES || signal.aborted) {
        console.warn('[WB:export-prep] capture_blank_giving_up', { assetId })
        return null
      }
      console.warn('[WB:export-prep] capture_blank_retry', { assetId, attempt })
      await waitForRepaint(BLANK_RETRY_DELAY_MS)
    }
    return null
  }

  private async captureAttempt(
    assetId: string,
    signal: AbortSignal,
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
  ): Promise<CapturedPreview | null> {
    const fn = this.registry.get(assetId)
    if (!fn) return null
    if (signal.aborted) return null

    // Власний AbortController для timeout. Зв'язаний з зовнішнім signal:
    // якщо outer abort'ує — наш inner теж abort'ається.
    const inner = new AbortController()
    const onOuterAbort = () => inner.abort()
    signal.addEventListener('abort', onOuterAbort, { once: true })

    const timer = setTimeout(() => inner.abort(), timeoutMs)

    try {
      const result = await fn(inner.signal)
      if (!result || inner.signal.aborted) return null
      if (!result.blob || result.width <= 0 || result.height <= 0) return null
      return {
        assetId,
        blob: result.blob,
        width: result.width,
        height: result.height,
      }
    } catch (err) {
      // INV-EP-3: failure must not propagate.
      console.warn('[WB:export-prep] capture_failed', { assetId, err })
      return null
    } finally {
      clearTimeout(timer)
      signal.removeEventListener('abort', onOuterAbort)
    }
  }

  /**
   * Bulk capture з bounded parallelism.
   *
   * @param assetIds список widget asset IDs для capture
   * @param signal abort signal — закриття діалогу / cancel прерве все
   * @param opts.timeoutMs per-widget timeout (default 10s)
   * @param opts.maxConcurrent parallel cap (default 4)
   */
  async captureAll(
    assetIds: string[],
    signal: AbortSignal,
    opts: { timeoutMs?: number; maxConcurrent?: number; onProgress?: (done: number, total: number) => void } = {},
  ): Promise<CaptureResult> {
    const captured = new Map<string, CapturedPreview>()
    const failed: string[] = []
    const skipped: string[] = []

    // Розділяємо registered / unregistered одразу (нема сенсу пускати в pipeline).
    const targets: string[] = []
    for (const id of assetIds) {
      if (!id) continue
      if (this.registry.has(id)) targets.push(id)
      else skipped.push(id)
    }

    if (targets.length === 0) {
      return { captured, failed, skipped }
    }

    const limit = makeLimiter(opts.maxConcurrent ?? MAX_CONCURRENT_CAPTURES)
    let done = 0
    const total = targets.length

    await Promise.all(
      targets.map((assetId) =>
        limit(async () => {
          if (signal.aborted) return
          const result = await this.captureOne(assetId, signal, opts.timeoutMs)
          if (result) captured.set(assetId, result)
          else failed.push(assetId)
          done++
          opts.onProgress?.(done, total)
        }),
      ),
    )

    return { captured, failed, skipped }
  }

  /**
   * Upload зкаптурених preview's до бекенда з bounded parallelism.
   * Failures silent — INV-EP-3.
   */
  async uploadAll(
    sessionId: string,
    captures: Map<string, CapturedPreview>,
    signal: AbortSignal,
    opts: { maxConcurrent?: number } = {},
  ): Promise<UploadResult> {
    if (captures.size === 0) return { uploaded: 0, failed: 0, reused: 0 }

    const limit = makeLimiter(opts.maxConcurrent ?? MAX_CONCURRENT_UPLOADS)
    let uploaded = 0
    let failed = 0
    let reused = 0

    await Promise.all(
      Array.from(captures.values()).map((cap) =>
        limit(async () => {
          if (signal.aborted) {
            failed++
            return
          }
          const res = await winterboardApi.uploadExportPreview(
            sessionId,
            {
              assetId: cap.assetId,
              blob: cap.blob,
              width: cap.width,
              height: cap.height,
              widgetSchemaVersion: WIDGET_SCHEMA_VERSION,
            },
            signal,
          )
          if (res == null) {
            failed++
          } else {
            uploaded++
            if (res.reused) reused++
          }
        }),
      ),
    )

    return { uploaded, failed, reused }
  }

  /** Test helper — повне очищення registry. Не використовувати у production code. */
  _resetForTests(): void {
    this.registry.clear()
  }
}

export const exportPreviewService = new ExportPreviewService()
