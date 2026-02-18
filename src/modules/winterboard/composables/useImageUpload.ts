// WB: useImageUpload — composable for image upload via presigned URL flow
// Ref: TASK_BOARD_PHASES.md A2.1, ManifestWinterboard_v2.md LAW-08, LAW-18
// Flow: validate → presign → S3 PUT → confirm → add asset to store

import { ref, readonly } from 'vue'
import type { WBAsset } from '../types/winterboard'
import { winterboardApi } from '../api/winterboardApi'
import type { WBPresignResponse } from '../api/winterboardApi'

// ─── Constants ──────────────────────────────────────────────────────────────

const LOG = '[WB:ImageUpload]'
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB (matches backend WB_MAX_ASSET_SIZE)
const SUPPORTED_FORMATS = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
const DEFAULT_ASSET_SIZE = 300 // Default width/height for dropped images

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
  | 'quota_exceeded'
  | 'network_error'

export class WBUploadError extends Error {
  code: WBUploadErrorCode
  constructor(code: WBUploadErrorCode, message: string) {
    super(message)
    this.name = 'WBUploadError'
    this.code = code
  }
}

// ─── Presigned Upload Flow ──────────────────────────────────────────────────

/**
 * Full presigned upload flow: presign → S3 PUT → confirm.
 * Returns the confirmed asset_url (CDN URL).
 */
export async function uploadFileToStorage(
  sessionId: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<{ assetId: string; assetUrl: string }> {
  // Step 1: Presign
  let presign: WBPresignResponse
  try {
    presign = await winterboardApi.presignUpload(sessionId, {
      filename: file.name || `upload-${Date.now()}.${file.type.split('/')[1] || 'png'}`,
      content_type: file.type,
      file_size: file.size,
    })
    console.info(`${LOG} Presign OK`, { assetId: presign.asset_id, size: file.size })
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status
    if (status === 429) {
      throw new WBUploadError('quota_exceeded', 'Asset or storage quota exceeded')
    }
    console.error(`${LOG} Presign failed`, err)
    throw new WBUploadError('presign_failed', 'Failed to get upload URL')
  }

  // Step 2: Upload to presigned URL
  try {
    await winterboardApi.uploadToPresigned(presign.upload_url, file, onProgress)
    console.info(`${LOG} S3 PUT OK`, { assetId: presign.asset_id })
  } catch (err) {
    console.error(`${LOG} S3 PUT failed`, err)
    throw new WBUploadError('upload_failed', 'Failed to upload file to storage')
  }

  // Step 3: Confirm
  try {
    const confirm = await winterboardApi.confirmUpload(sessionId, presign.asset_id)
    console.info(`${LOG} Confirm OK`, { assetId: presign.asset_id, url: confirm.asset_url })
    return { assetId: presign.asset_id, assetUrl: confirm.asset_url }
  } catch (err) {
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

  function reset(): void {
    uploadProgress.value = 0
    uploadState.value = 'idle'
    uploadError.value = null
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
    reset,
    handleDrop,
    handlePaste,
    validateFile,
    fileToDataUrl,
  }
}
