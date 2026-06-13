// WB: useImageUpload — composable for image upload via presigned URL flow
// Ref: TASK_BOARD_PHASES.md A2.1, ManifestWinterboard_v2.md LAW-08, LAW-18
// Flow: validate → presign → S3 PUT → confirm → add asset to store

import { ref, readonly } from 'vue'
import type { WBAsset } from '../types/winterboard'
import { winterboardApi } from '../api/winterboardApi'
import type { WBPresignResponse } from '../api/winterboardApi'
import { trackEvent } from '@/utils/telemetryAgent'

// ─── Constants ──────────────────────────────────────────────────────────────

const LOG = '[WB:ImageUpload]'
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB (matches backend WB_MAX_ASSET_SIZE)
// 'image/svg+xml' видалено 2026-06-13 (stored-XSS guard, P1-2): SVG може містити
// <script>/on*, зберігався as-is на images.m4sh.org. BE-гейт (presign ChoiceField)
// авторитетний; цей список — рання FE-відмова drag-drop/paste. Растр-only.
const SUPPORTED_FORMATS = ['image/png', 'image/jpeg', 'image/webp']
const DEFAULT_ASSET_SIZE = 300 // Default width/height for dropped images
const WB_MAX_IMAGE_DIMENSION = 4096  // px — absolute limit, upload blocked (A15)
const WB_WARN_IMAGE_DIMENSION = 2048 // px — warn threshold, upload continues (A15)
const WB_MAX_FILE_SIZE_MB = 10       // MB — matches MAX_FILE_SIZE and backend WB_MAX_ASSET_SIZE

// ─── Validation ─────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean
  error?: string
}

/**
 * Validate a file for image upload.
 * Checks: file type (PNG, JPEG, WebP, SVG) and size (max 10MB).
 */
export function validateFile(file: File): ValidationResult {
  if (!SUPPORTED_FORMATS.includes(file.type)) {
    return {
      valid: false,
      error: `Unsupported format: ${file.type || 'unknown'}. Supported: PNG, JPEG, WebP, SVG.`,
    }
  }

  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1)
    return {
      valid: false,
      error: `File too large: ${sizeMB}MB. Maximum: 10MB.`,
    }
  }

  if (file.size === 0) {
    return { valid: false, error: 'File is empty.' }
  }

  return { valid: true }
}

// ─── Dimension Validation (A15) ────────────────────────────────────────────

/**
 * Obtain image pixel dimensions by creating a temporary object URL from a File.
 * Used for pre-upload dimension validation. Resolves on load, rejects on error.
 */
async function getFileDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('[WB:ImageUpload] Cannot read image dimensions'))
    }
    img.src = url
  })
}

export interface ImageValidationResult {
  valid: boolean
  blocked: boolean
  warning?: string
  info?: string
}

/**
 * Pre-upload validation: checks file size (MB) and, for raster images, pixel dimensions.
 * - Blocks if file > WB_MAX_FILE_SIZE_MB
 * - Blocks if max(width, height) > WB_MAX_IMAGE_DIMENSION
 * - Warns if max(width, height) > WB_WARN_IMAGE_DIMENSION
 * - SVG and non-image types skip dimension check entirely.
 */
export async function validateImageFile(file: File): Promise<ImageValidationResult> {
  const sizeMB = file.size / (1024 * 1024)
  if (sizeMB > WB_MAX_FILE_SIZE_MB) {
    return {
      valid: false,
      blocked: true,
      warning: `File too large: ${sizeMB.toFixed(1)} MB. Maximum: ${WB_MAX_FILE_SIZE_MB} MB`,
    }
  }

  // Skip dimension check for non-raster types
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    return { valid: true, blocked: false }
  }

  try {
    const { width, height } = await getFileDimensions(file)
    const maxDim = Math.max(width, height)

    if (maxDim > WB_MAX_IMAGE_DIMENSION) {
      return {
        valid: false,
        blocked: true,
        warning: `Image too large: ${width}×${height}px. Maximum dimension: ${WB_MAX_IMAGE_DIMENSION}px`,
      }
    }

    if (maxDim > WB_WARN_IMAGE_DIMENSION) {
      return {
        valid: true,
        blocked: false,
        warning: `Large image (${width}×${height}px). Will be optimized automatically on upload.`,
        info: `Recommended max: ${WB_WARN_IMAGE_DIMENSION}px`,
      }
    }

    return { valid: true, blocked: false }
  } catch {
    // Cannot read dimensions — do not block the upload
    return { valid: true, blocked: false }
  }
}

// ─── File → Data URL ────────────────────────────────────────────────────────

/**
 * Convert a File to a base64 data URL string.
 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('[WB:ImageUpload] FileReader result is not a string'))
      }
    }
    reader.onerror = () => {
      reject(new Error(`[WB:ImageUpload] Failed to read file: ${file.name}`))
    }
    reader.readAsDataURL(file)
  })
}

// ─── Image dimensions ───────────────────────────────────────────────────────

/**
 * Load an image from a data URL and return its natural dimensions.
 */
function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = () => {
      reject(new Error('[WB:ImageUpload] Failed to load image for dimensions'))
    }
    img.src = dataUrl
  })
}

// ─── ID generator ───────────────────────────────────────────────────────────

function generateAssetId(): string {
  return `asset-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

// ─── Create WBAsset from file ───────────────────────────────────────────────

/**
 * Create a WBAsset from a validated File.
 * Converts to data URL, reads dimensions, and scales to fit DEFAULT_ASSET_SIZE.
 *
 * @param file - Validated image file
 * @param dropX - X position on canvas (default: center)
 * @param dropY - Y position on canvas (default: center)
 * @returns WBAsset or null if processing fails
 */
async function createAssetFromFile(
  file: File,
  dropX: number = 100,
  dropY: number = 100,
): Promise<WBAsset | null> {
  try {
    const dataUrl = await fileToDataUrl(file)
    const dims = await getImageDimensions(dataUrl)

    // Scale to fit within DEFAULT_ASSET_SIZE while preserving aspect ratio
    let w = dims.width
    let h = dims.height
    const maxDim = Math.max(w, h)
    if (maxDim > DEFAULT_ASSET_SIZE) {
      const scale = DEFAULT_ASSET_SIZE / maxDim
      w = Math.round(w * scale)
      h = Math.round(h * scale)
    }

    return {
      id: generateAssetId(),
      type: 'image',
      src: dataUrl,
      x: dropX,
      y: dropY,
      w,
      h,
      rotation: 0,
    }
  } catch (error) {
    console.error('[WB:ImageUpload] createAssetFromFile failed:', error)
    return null
  }
}

// ─── Handlers ───────────────────────────────────────────────────────────────

/**
 * Handle drag & drop event — extract image files, validate, create WBAsset.
 *
 * @param event - DragEvent from the canvas drop handler
 * @param canvasX - X position on canvas where the drop occurred
 * @param canvasY - Y position on canvas where the drop occurred
 * @returns WBAsset or null if no valid image found
 */
export async function handleDrop(
  event: DragEvent,
  canvasX: number = 100,
  canvasY: number = 100,
): Promise<WBAsset | null> {
  const files = event.dataTransfer?.files
  if (!files || files.length === 0) return null

  // Take the first image file
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const validation = validateFile(file)
    if (!validation.valid) {
      console.warn('[WB:ImageUpload] Drop rejected:', validation.error)
      continue
    }
    return createAssetFromFile(file, canvasX, canvasY)
  }

  return null
}

/**
 * Handle paste event — extract image from clipboard, validate, create WBAsset.
 *
 * @param event - ClipboardEvent from paste handler
 * @param canvasX - X position on canvas (default: center)
 * @param canvasY - Y position on canvas (default: center)
 * @returns WBAsset or null if no valid image found in clipboard
 */
export async function handlePaste(
  event: ClipboardEvent,
  canvasX: number = 100,
  canvasY: number = 100,
): Promise<WBAsset | null> {
  const items = event.clipboardData?.items
  if (!items) return null

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (item.kind !== 'file') continue

    const file = item.getAsFile()
    if (!file) continue

    const validation = validateFile(file)
    if (!validation.valid) {
      console.warn('[WB:ImageUpload] Paste rejected:', validation.error)
      continue
    }

    return createAssetFromFile(file, canvasX, canvasY)
  }

  return null
}

// ─── Upload Error ───────────────────────────────────────────────────────────

export type WBUploadErrorCode =
  | 'validation_failed'
  | 'presign_failed'
  | 'upload_failed'
  | 'confirm_failed'
  | 'quota_exceeded'   // permanent (storage/asset count quota) — НЕ retry
  | 'rate_limited'     // transient (DRF throttle window) — retry дозволений
  | 'unknown_429'      // 429 з body.error не у whitelist — НЕ retry (safe default)
  | 'network_error'
  | 'cancelled'        // зовнішня cancellation через AbortSignal

/** Деталі від backend для UX (показ X/Y MB у toast). */
export interface WBUploadErrorDetails {
  current?: number
  limit?: number
  current_bytes?: number
  limit_bytes?: number
  detail?: string
}

export class WBUploadError extends Error {
  code: WBUploadErrorCode
  details?: WBUploadErrorDetails
  constructor(code: WBUploadErrorCode, message: string, details?: WBUploadErrorDetails) {
    super(message)
    this.name = 'WBUploadError'
    this.code = code
    this.details = details
  }
}

// ─── 429 classification ─────────────────────────────────────────────────────

/**
 * Permanent backend quota codes — explicit whitelist (НЕ підрядок "quota",
 * щоб майбутні warning-codes типу "quota_warning" або "quota_soft_limit"
 * випадково не блокували retry).
 *
 * Backend контракт зафіксований у:
 *   backend/apps/winterboard/api/views.py:1442-1466
 *   backend/apps/winterboard/tests/test_assets.py:170,188
 */
const PERMANENT_QUOTA_CODES = new Set<string>(['quota_exceeded', 'storage_quota_exceeded'])

/**
 * Розрізняє три типи 429:
 *   1. Permanent quota → exact match у PERMANENT_QUOTA_CODES → НЕ retry
 *   2. Transient throttle → відсутній body.error (DRF UserRateThrottle) → retry
 *   3. Невідомий 429 → body.error є, але не у whitelist → НЕ retry (safe default,
 *      щоб не спамити запитами при невідомому permanent стані).
 *
 * Якщо у майбутньому backend додасть нові transient коди — їх треба явно
 * замапити сюди, а не покладатись на fallback.
 */
function classify429(err: unknown): 'quota_exceeded' | 'rate_limited' | 'unknown_429' {
  // P0 fix (ASSET_LIFECYCLE_SSOT Phase 0): body.error може бути string
  // ('quota_exceeded' з presign quota check) АБО object ({code, detail} з
  // деяких throttle відповідей). Прямий .toLowerCase() на object кидав
  // TypeError і ламав весь recovery-шлях (BACKLOG_PASTE_STORM_HANDLING P0).
  // Нормалізуємо до code-рядка типобезпечно; класифікаційна семантика для
  // існуючих кейсів (string / відсутній error) НЕ змінюється.
  const data = (err as { response?: { data?: { error?: unknown } } })?.response?.data
  const rawError = data?.error

  // error відсутній → DRF UserRateThrottle (форма {detail: "..."}) → transient
  if (rawError == null || rawError === '') {
    return 'rate_limited'
  }

  let errorCode = ''
  if (typeof rawError === 'string') {
    errorCode = rawError.toLowerCase()
  } else if (typeof rawError === 'object' && 'code' in rawError) {
    errorCode = String((rawError as { code?: unknown }).code ?? '').toLowerCase()
  }

  if (errorCode && PERMANENT_QUOTA_CODES.has(errorCode)) {
    return 'quota_exceeded'
  }
  // error присутній, але code не у whitelist (або object без code) →
  // safe default: не retry (узгоджено з документованою unknown_429 поведінкою).
  return 'unknown_429'
}

/** Витягнути details з 429-помилки backend для UX. */
function extractErrorDetails(err: unknown): WBUploadErrorDetails | undefined {
  const data = (err as { response?: { data?: WBUploadErrorDetails } })?.response?.data
  if (!data) return undefined
  const { current, limit, current_bytes, limit_bytes, detail } = data
  if (current == null && limit == null && current_bytes == null && limit_bytes == null && !detail) {
    return undefined
  }
  return { current, limit, current_bytes, limit_bytes, detail }
}

// ─── Retry helpers ──────────────────────────────────────────────────────────

const MAX_RETRIES_TRANSIENT = 3       // rate_limited, network_error
const MAX_RETRIES_UNKNOWN_429 = 1     // CDN/edge throttle без body.error — 1 спроба максимум
const RETRY_DELAYS_MS = [1000, 2000, 4000] // exponential backoff
const RETRY_JITTER_MS = 200

/**
 * Скільки retries дозволено для коду. 0 — не retry зовсім.
 *
 * - rate_limited / network_error: 3 (transient, типово відновлюються)
 * - unknown_429: 1 (CDN/проксі може дати 429 без body — даємо ОДИН шанс,
 *   щоб не втратити upload, але й не спамити при справжньому permanent стані)
 * - усі інші (quota_exceeded, presign/upload/confirm_failed, cancelled,
 *   validation_failed): 0 — або юзерська помилка, або quota що не зміниться.
 */
function _maxRetriesFor(code: WBUploadErrorCode): number {
  if (code === 'rate_limited' || code === 'network_error') return MAX_RETRIES_TRANSIENT
  if (code === 'unknown_429') return MAX_RETRIES_UNKNOWN_429
  return 0
}

function _backoffDelay(attempt: number): number {
  const base = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)]
  const jitter = (Math.random() - 0.5) * 2 * RETRY_JITTER_MS
  return Math.max(0, base + jitter)
}

/**
 * Sleep що ловить abort. Повертає `true` якщо abort трапився, `false` якщо
 * нормально проспали. Викидати не може — викликач сам вирішує що робити.
 */
function _sleepWithAbort(ms: number, signal?: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal?.aborted) { resolve(true); return }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve(false)
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      resolve(true)
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

// ─── Presigned Upload Flow ──────────────────────────────────────────────────

/**
 * Перевіряє чи помилка від axios/xhr — це AbortError. Тоді ми НЕ кидаємо
 * presign_failed/upload_failed, а cancelled — щоб retry-loop правильно зрозумів.
 */
function _isAbortError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === 'AbortError') return true
  const e = err as { name?: string; code?: string; message?: string }
  if (e?.name === 'AbortError' || e?.name === 'CanceledError') return true
  if (e?.code === 'ERR_CANCELED') return true // axios v1
  return false
}

/**
 * Один прохід presign → S3 PUT → confirm. Без retry.
 * Зовнішнє API (`uploadFileToStorage`) обгортає це у retry loop.
 *
 * `signal` прокидається у всі три API виклики, щоб реальний HTTP request
 * перервався при abort (інакше PUT/POST долетить до S3/R2 навіть після
 * quota_exceeded → orphan у storage). Sync prefix теж перевіряє signal перед
 * кожним кроком — захист від abort що прилетів між мікротасками.
 */
async function _attemptUpload(
  sessionId: string,
  file: File,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal,
): Promise<{ assetId: string; assetUrl: string }> {
  // Step 1: Presign
  if (signal?.aborted) {
    throw new WBUploadError('cancelled', 'Aborted before presign')
  }
  let presign: WBPresignResponse
  try {
    presign = await winterboardApi.presignUpload(sessionId, {
      filename: file.name || `upload-${Date.now()}.${file.type.split('/')[1] || 'png'}`,
      content_type: file.type,
      file_size: file.size,
    }, signal)
    console.info(`${LOG} Presign OK`, { assetId: presign.asset_id, size: file.size })
  } catch (err: unknown) {
    if (_isAbortError(err)) {
      throw new WBUploadError('cancelled', 'Presign aborted')
    }
    const status = (err as { response?: { status?: number } })?.response?.status
    if (status === 429) {
      const code = classify429(err)
      const details = extractErrorDetails(err)
      const msg = code === 'quota_exceeded'
        ? 'Asset or storage quota exceeded'
        : code === 'rate_limited'
          ? 'Rate limit reached, please retry'
          : 'Request rejected (429)'
      throw new WBUploadError(code, msg, details)
    }
    console.error(`${LOG} Presign failed`, err)
    throw new WBUploadError('presign_failed', 'Failed to get upload URL')
  }

  // Step 2: Upload to presigned URL (S3/R2 only).
  // Local backend: пропускаємо PUT — Django dev server не приймає PUT на /media/,
  // файл піде у multipart-confirm нижче.
  if (signal?.aborted) {
    throw new WBUploadError('cancelled', 'Aborted before S3 PUT')
  }
  if (!presign.is_local) {
    try {
      await winterboardApi.uploadToPresigned(presign.upload_url, file, onProgress, signal)
      console.info(`${LOG} S3 PUT OK`, { assetId: presign.asset_id })
    } catch (err) {
      if (_isAbortError(err)) {
        throw new WBUploadError('cancelled', 'S3 PUT aborted')
      }
      console.error(`${LOG} S3 PUT failed`, err)
      throw new WBUploadError('upload_failed', 'Failed to upload file to storage')
    }
  }

  // Step 3: Confirm — для local передаємо файл у тому ж POST (multipart),
  // BE збереже у MEDIA_ROOT і позначить asset confirmed. Для S3 — порожній POST (HEAD).
  if (signal?.aborted) {
    throw new WBUploadError('cancelled', 'Aborted before confirm')
  }
  try {
    const confirm = await winterboardApi.confirmUpload(
      sessionId,
      presign.asset_id,
      presign.is_local ? file : undefined,
      signal,
    )
    console.info(`${LOG} Confirm OK`, { assetId: presign.asset_id, url: confirm.asset_url })
    return { assetId: presign.asset_id, assetUrl: confirm.asset_url }
  } catch (err) {
    if (_isAbortError(err)) {
      throw new WBUploadError('cancelled', 'Confirm aborted')
    }
    console.error(`${LOG} Confirm failed`, err)
    throw new WBUploadError('confirm_failed', 'Failed to confirm upload')
  }
}

/**
 * Full presigned upload flow з автоматичним retry на transient помилках.
 *
 * Per-code retry budget (`_maxRetriesFor`):
 *   rate_limited / network_error: 3 спроби (exp backoff 1s/2s/4s + jitter)
 *   unknown_429: 1 спроба (CDN edge case)
 *   усі решта: 0 (fail immediately)
 *
 * Permanent помилки (quota_exceeded, presign/upload/confirm_failed)
 * пробрасуються одразу без повтору.
 *
 * Cancellation: `signal` перевіряється перед кожною спробою, у sync prefix
 * `_attemptUpload`, прокидається у API виклики (axios/xhr), і під час backoff
 * sleep. При abort кидається WBUploadError('cancelled') — `handleImagePaste`
 * ловить як silent skip.
 */
export async function uploadFileToStorage(
  sessionId: string,
  file: File,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal,
): Promise<{ assetId: string; assetUrl: string }> {
  let attempt = 0
  const retriesUsedForCode: Partial<Record<WBUploadErrorCode, number>> = {}
  const startedAt = Date.now()

  // Telemetry: start (один раз на upload, незалежно від retry)
  trackEvent('wb.upload.start', {
    session_id: sessionId,
    content_type: file.type,
  }, {
    file_size: file.size,
  })

  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (signal?.aborted) {
      const err = new WBUploadError('cancelled', 'Upload cancelled before attempt')
      trackEvent('wb.upload.cancelled', { session_id: sessionId, code: 'cancelled' })
      throw err
    }

    try {
      const result = await _attemptUpload(sessionId, file, onProgress, signal)
      trackEvent('wb.upload.success', {
        session_id: sessionId,
        asset_id: result.assetId,
      }, {
        duration_ms: Date.now() - startedAt,
        attempts: attempt + 1,
        file_size: file.size,
      })
      return result
    } catch (err) {
      // Cancelled з нижнього шару (API abort, sync prefix) — пробрасуємо як є.
      if (err instanceof WBUploadError && err.code === 'cancelled') {
        trackEvent('wb.upload.cancelled', { session_id: sessionId, code: 'cancelled' })
        throw err
      }
      if (signal?.aborted) {
        trackEvent('wb.upload.cancelled', { session_id: sessionId, code: 'cancelled' })
        throw new WBUploadError('cancelled', 'Upload cancelled during attempt')
      }

      const code = err instanceof WBUploadError ? err.code : 'network_error'
      const budget = _maxRetriesFor(code)
      const usedForCode = retriesUsedForCode[code] ?? 0

      if (usedForCode >= budget) {
        // Final failure (нема retry-бюджету) — fire telemetry і throw
        trackEvent('wb.upload.failure', {
          session_id: sessionId,
          code,
        }, {
          duration_ms: Date.now() - startedAt,
          attempts: attempt + 1,
        })
        throw err
      }

      // Резервуємо retry slot для цього КОНКРЕТНОГО коду.
      // Кожен код має власний бюджет — не сумарний (інакше unknown_429 з'їсть
      // бюджет після rate_limited).
      retriesUsedForCode[code] = usedForCode + 1
      attempt++

      const delay = _backoffDelay(attempt - 1)
      trackEvent('wb.upload.retry', {
        session_id: sessionId,
        code,
      }, {
        attempt: usedForCode + 1,
        budget,
        delay_ms: Math.round(delay),
      })
      console.warn(
        `${LOG} Retry ${usedForCode + 1}/${budget} after ${Math.round(delay)}ms (${code})`,
      )
      const aborted = await _sleepWithAbort(delay, signal)
      if (aborted) {
        trackEvent('wb.upload.cancelled', { session_id: sessionId, code: 'cancelled' })
        throw new WBUploadError('cancelled', 'Upload cancelled during backoff')
      }
    }
  }
}

// ─── Optimistic paste API (P0 UX 2026-04-28) ────────────────────────────────
//
// Splits the existing presign+PUT+confirm flow into two awaitable stages,
// so callers can render an asset on canvas immediately after presign (which
// returns asset_id + final CDN url у <200ms у нормі) і виконувати S3 PUT +
// confirm у фоні. Це усуває 1-2с delay між Ctrl+V і появою картинки.
//
// Інваріанти збережені:
//   - presign + confirm використовують той самий asset_id з BE → жодних
//     orphan WBAsset records.
//   - Якщо confirm fails → asset_id вже існує у BE з status='pending'; FE
//     має емітнути asset_delete або позначити status='error' для retry.
//   - signal прокидається у всі шари (presign, PUT, confirm) — однаковий
//     контракт abort як у uploadFileToStorage.

/** Result of the synchronous presign stage — used to render placeholder asset. */
export interface PresignedAssetMeta {
  /** BE-assigned asset_id — used as canvas asset.id (INV-14 stable). */
  assetId: string
  /** Eventual final CDN URL — valid in BE/replay even before S3 PUT completes
   *  (record exists; file uploads in background). */
  assetUrl: string
  /** Local mode: skip S3 PUT, pass file through to confirm step instead. */
  isLocal: boolean
  /** Internal: pre-resolved presigned PUT URL (S3/R2). */
  uploadUrl: string
}

/**
 * Stage 1 of optimistic upload: presign only.
 *
 * Returns BE-assigned asset_id and CDN URL synchronously (within network
 * latency). Caller can then render асset на canvas з blob: URL для preview
 * і викликати uploadAndConfirm() у фоні.
 *
 * Throws WBUploadError на network/quota/rate_limit. Не retry — caller
 * вирішує політику (для optimistic paste — single attempt, на fail просто
 * показуємо error без блокування інших pasted assets).
 */
export async function presignOnly(
  sessionId: string,
  file: File,
  signal?: AbortSignal,
): Promise<PresignedAssetMeta> {
  if (signal?.aborted) {
    throw new WBUploadError('cancelled', 'Aborted before presign')
  }
  try {
    const presign = await winterboardApi.presignUpload(sessionId, {
      filename: file.name || `upload-${Date.now()}.${file.type.split('/')[1] || 'png'}`,
      content_type: file.type,
      file_size: file.size,
    }, signal)
    console.info(`${LOG} Presign OK (optimistic)`, { assetId: presign.asset_id, size: file.size })
    return {
      assetId: presign.asset_id,
      assetUrl: presign.asset_url,
      isLocal: !!presign.is_local,
      uploadUrl: presign.upload_url,
    }
  } catch (err: unknown) {
    if (_isAbortError(err)) {
      throw new WBUploadError('cancelled', 'Presign aborted')
    }
    const httpStatus = (err as { response?: { status?: number } })?.response?.status
    if (httpStatus === 429) {
      const code = classify429(err)
      const details = extractErrorDetails(err)
      const msg = code === 'quota_exceeded'
        ? 'Asset or storage quota exceeded'
        : code === 'rate_limited'
          ? 'Rate limit reached, please retry'
          : 'Request rejected (429)'
      throw new WBUploadError(code, msg, details)
    }
    console.error(`${LOG} Presign failed`, err)
    throw new WBUploadError('presign_failed', 'Failed to get upload URL')
  }
}

/**
 * Stage 2 of optimistic upload: S3 PUT + confirm.
 *
 * Викликається ПІСЛЯ presignOnly() — використовує meta.uploadUrl для PUT,
 * meta.assetId для confirm. Одна спроба (no retry loop) — caller отримує
 * простий fail/success і сам показує retry UI.
 *
 * При абortі через signal — кидає WBUploadError('cancelled').
 */
export async function uploadAndConfirm(
  sessionId: string,
  file: File,
  meta: PresignedAssetMeta,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal,
): Promise<{ assetUrl: string }> {
  // Step 2: S3 PUT (skip у local mode — файл піде через multipart confirm)
  if (signal?.aborted) {
    throw new WBUploadError('cancelled', 'Aborted before S3 PUT')
  }
  if (!meta.isLocal) {
    try {
      await winterboardApi.uploadToPresigned(meta.uploadUrl, file, onProgress, signal)
      console.info(`${LOG} S3 PUT OK (optimistic)`, { assetId: meta.assetId })
    } catch (err) {
      if (_isAbortError(err)) {
        throw new WBUploadError('cancelled', 'S3 PUT aborted')
      }
      console.error(`${LOG} S3 PUT failed`, err)
      throw new WBUploadError('upload_failed', 'Failed to upload file to storage')
    }
  }

  // Step 3: Confirm
  if (signal?.aborted) {
    throw new WBUploadError('cancelled', 'Aborted before confirm')
  }
  try {
    const confirm = await winterboardApi.confirmUpload(
      sessionId,
      meta.assetId,
      meta.isLocal ? file : undefined,
      signal,
    )
    console.info(`${LOG} Confirm OK (optimistic)`, { assetId: meta.assetId, url: confirm.asset_url })
    return { assetUrl: confirm.asset_url }
  } catch (err) {
    if (_isAbortError(err)) {
      throw new WBUploadError('cancelled', 'Confirm aborted')
    }
    console.error(`${LOG} Confirm failed`, err)
    throw new WBUploadError('confirm_failed', 'Failed to confirm upload')
  }
}

// ─── Composable ─────────────────────────────────────────────────────────────

export type WBUploadState = 'idle' | 'validating' | 'uploading' | 'confirming' | 'done' | 'error'

/**
 * Composable for image upload functionality.
 * Provides reactive state (progress, status, error) and handlers for drop/paste.
 *
 * Usage:
 * ```ts
 * const { uploadImage, uploadProgress, uploadState, uploadError, handleDrop, handlePaste } = useImageUpload(sessionId)
 * ```
 */
export function useImageUpload(sessionId: () => string | null) {
  const uploadProgress = ref(0)
  const uploadState = ref<WBUploadState>('idle')
  const uploadError = ref<string | null>(null)
  const uploadWarning = ref<string | null>(null)

  function reset(): void {
    uploadProgress.value = 0
    uploadState.value = 'idle'
    uploadError.value = null
    uploadWarning.value = null
  }

  /**
   * Upload a single image file via presigned URL flow.
   * Returns WBAsset ready to be added to the store, or null on failure.
   */
  async function uploadImage(
    file: File,
    dropX: number = 100,
    dropY: number = 100,
  ): Promise<WBAsset | null> {
    const sid = sessionId()
    if (!sid) {
      uploadError.value = 'No active session'
      uploadState.value = 'error'
      return null
    }

    reset()
    uploadState.value = 'validating'

    // Dimension and size pre-validation (A15)
    const dimValidation = await validateImageFile(file)
    if (dimValidation.blocked) {
      uploadError.value = dimValidation.warning ?? 'Image validation failed'
      uploadState.value = 'error'
      return null
    }
    if (dimValidation.warning) {
      uploadWarning.value = dimValidation.warning
    }

    // Validate
    const validation = validateFile(file)
    if (!validation.valid) {
      uploadError.value = validation.error ?? 'Validation failed'
      uploadState.value = 'error'
      return null
    }

    uploadState.value = 'uploading'

    try {
      const { assetId, assetUrl } = await uploadFileToStorage(
        sid,
        file,
        (percent) => { uploadProgress.value = percent },
      )

      uploadState.value = 'confirming'
      uploadProgress.value = 100

      // Get image dimensions for proper sizing
      const dims = await getImageDimensions(assetUrl).catch(() => ({
        width: DEFAULT_ASSET_SIZE,
        height: DEFAULT_ASSET_SIZE,
      }))

      // Scale to fit within DEFAULT_ASSET_SIZE
      let w = dims.width
      let h = dims.height
      const maxDim = Math.max(w, h)
      if (maxDim > DEFAULT_ASSET_SIZE) {
        const scale = DEFAULT_ASSET_SIZE / maxDim
        w = Math.round(w * scale)
        h = Math.round(h * scale)
      }

      const asset: WBAsset = {
        id: assetId,
        type: 'image',
        src: assetUrl,
        x: dropX,
        y: dropY,
        w,
        h,
        rotation: 0,
      }

      uploadState.value = 'done'
      console.info(`${LOG} Upload complete`, { assetId, w, h })
      return asset
    } catch (err) {
      const msg = err instanceof WBUploadError ? err.message : 'Upload failed'
      uploadError.value = msg
      uploadState.value = 'error'
      console.error(`${LOG} uploadImage failed`, err)
      return null
    }
  }

  return {
    uploadImage,
    uploadProgress: readonly(uploadProgress),
    uploadState: readonly(uploadState),
    uploadError: readonly(uploadError),
    uploadWarning: readonly(uploadWarning),
    reset,
    handleDrop,
    handlePaste,
    validateFile,
    validateImageFile,
    fileToDataUrl,
  }
}
