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
   */
  private async captureOne(
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
