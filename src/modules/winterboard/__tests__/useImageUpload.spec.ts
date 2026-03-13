// WB: Unit tests for useImageUpload composable (Phase 2: A2.1 + A15)
// Tests: validation, presigned upload flow, error handling, composable state,
//        dimension + size validation (A15)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  validateFile,
  fileToDataUrl,
  uploadFileToStorage,
  validateImageFile,
  WBUploadError,
} from '../composables/useImageUpload'
import type { ImageValidationResult } from '../composables/useImageUpload'

// ── Mock winterboardApi ─────────────────────────────────────────────────

const mockPresignUpload = vi.fn()
const mockUploadToPresigned = vi.fn()
const mockConfirmUpload = vi.fn()

vi.mock('../api/winterboardApi', () => ({
  winterboardApi: {
    presignUpload: (...args: unknown[]) => mockPresignUpload(...args),
    uploadToPresigned: (...args: unknown[]) => mockUploadToPresigned(...args),
    confirmUpload: (...args: unknown[]) => mockConfirmUpload(...args),
  },
}))

// ── Helpers ─────────────────────────────────────────────────────────────

function createFile(
  name: string,
  size: number,
  type: string,
): File {
  const buffer = new ArrayBuffer(size)
  const blob = new Blob([buffer], { type })
  return new File([blob], name, { type })
}

// ── Tests ───────────────────────────────────────────────────────────────

// ── validateFile ────────────────────────────────────────────────────────

describe('validateFile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('accepts PNG files', () => {
    const file = createFile('test.png', 1024, 'image/png')
    expect(validateFile(file)).toEqual({ valid: true })
  })

  it('accepts JPEG files', () => {
    const file = createFile('photo.jpg', 2048, 'image/jpeg')
    expect(validateFile(file)).toEqual({ valid: true })
  })

  it('accepts WebP files', () => {
    const file = createFile('image.webp', 512, 'image/webp')
    expect(validateFile(file)).toEqual({ valid: true })
  })

  it('accepts SVG files', () => {
    const file = createFile('icon.svg', 256, 'image/svg+xml')
    expect(validateFile(file)).toEqual({ valid: true })
  })

  it('rejects unsupported formats (PDF)', () => {
    const file = createFile('doc.pdf', 1024, 'application/pdf')
    const result = validateFile(file)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Unsupported format')
  })

  it('rejects unsupported formats (GIF)', () => {
    const file = createFile('anim.gif', 1024, 'image/gif')
    const result = validateFile(file)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Unsupported format')
  })

  it('rejects files exceeding 10MB', () => {
    const file = createFile('huge.png', 11 * 1024 * 1024, 'image/png')
    const result = validateFile(file)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('too large')
    expect(result.error).toContain('10MB')
  })

  it('accepts files at exactly 10MB', () => {
    const file = createFile('big.png', 10 * 1024 * 1024, 'image/png')
    expect(validateFile(file)).toEqual({ valid: true })
  })

  it('rejects empty files (0 bytes)', () => {
    const file = createFile('empty.png', 0, 'image/png')
    const result = validateFile(file)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('empty')
  })
})

// ── uploadFileToStorage ─────────────────────────────────────────────────

describe('uploadFileToStorage', () => {
  const SESSION_ID = 'session-123'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('completes full presign → upload → confirm flow', async () => {
    mockPresignUpload.mockResolvedValue({
      asset_id: 'asset-abc',
      upload_url: 'https://s3.example.com/presigned-put',
      asset_url: 'https://cdn.example.com/asset-abc.png',
      storage_key: 'winterboard/session-123/assets/asset-abc.png',
    })
    mockUploadToPresigned.mockResolvedValue(undefined)
    mockConfirmUpload.mockResolvedValue({
      confirmed: true,
      asset_url: 'https://cdn.example.com/asset-abc.png',
    })

    const file = createFile('photo.png', 1024, 'image/png')
    const result = await uploadFileToStorage(SESSION_ID, file)

    expect(result.assetId).toBe('asset-abc')
    expect(result.assetUrl).toBe('https://cdn.example.com/asset-abc.png')

    expect(mockPresignUpload).toHaveBeenCalledWith(SESSION_ID, {
      filename: 'photo.png',
      content_type: 'image/png',
      file_size: 1024,
    })
    expect(mockUploadToPresigned).toHaveBeenCalledWith(
      'https://s3.example.com/presigned-put',
      file,
      undefined,
    )
    expect(mockConfirmUpload).toHaveBeenCalledWith(SESSION_ID, 'asset-abc')
  })

  it('passes progress callback to uploadToPresigned', async () => {
    mockPresignUpload.mockResolvedValue({
      asset_id: 'asset-xyz',
      upload_url: 'https://s3.example.com/put',
      asset_url: 'https://cdn.example.com/asset-xyz.png',
      storage_key: 'winterboard/session-123/assets/asset-xyz.png',
    })
    mockUploadToPresigned.mockResolvedValue(undefined)
    mockConfirmUpload.mockResolvedValue({
      confirmed: true,
      asset_url: 'https://cdn.example.com/asset-xyz.png',
    })

    const onProgress = vi.fn()
    const file = createFile('img.png', 512, 'image/png')
    await uploadFileToStorage(SESSION_ID, file, onProgress)

    expect(mockUploadToPresigned).toHaveBeenCalledWith(
      'https://s3.example.com/put',
      file,
      onProgress,
    )
  })

  it('throws WBUploadError(presign_failed) on presign failure', async () => {
    mockPresignUpload.mockRejectedValue(new Error('Network error'))

    const file = createFile('test.png', 1024, 'image/png')
    await expect(uploadFileToStorage(SESSION_ID, file)).rejects.toThrow(WBUploadError)
    await expect(uploadFileToStorage(SESSION_ID, file)).rejects.toMatchObject({
      code: 'presign_failed',
    })
  })

  it('throws WBUploadError(quota_exceeded) on 429 presign response', async () => {
    const err = Object.assign(new Error('Too Many Requests'), {
      response: { status: 429 },
    })
    mockPresignUpload.mockRejectedValue(err)

    const file = createFile('test.png', 1024, 'image/png')
    await expect(uploadFileToStorage(SESSION_ID, file)).rejects.toMatchObject({
      code: 'quota_exceeded',
    })
  })

  it('throws WBUploadError(upload_failed) on S3 PUT failure', async () => {
    mockPresignUpload.mockResolvedValue({
      asset_id: 'asset-fail',
      upload_url: 'https://s3.example.com/put',
      asset_url: 'https://cdn.example.com/asset-fail.png',
      storage_key: 'key',
    })
    mockUploadToPresigned.mockRejectedValue(new Error('S3 PUT failed'))

    const file = createFile('test.png', 1024, 'image/png')
    await expect(uploadFileToStorage(SESSION_ID, file)).rejects.toMatchObject({
      code: 'upload_failed',
    })
  })

  it('throws WBUploadError(confirm_failed) on confirm failure', async () => {
    mockPresignUpload.mockResolvedValue({
      asset_id: 'asset-conf',
      upload_url: 'https://s3.example.com/put',
      asset_url: 'https://cdn.example.com/asset-conf.png',
      storage_key: 'key',
    })
    mockUploadToPresigned.mockResolvedValue(undefined)
    mockConfirmUpload.mockRejectedValue(new Error('Confirm failed'))

    const file = createFile('test.png', 1024, 'image/png')
    await expect(uploadFileToStorage(SESSION_ID, file)).rejects.toMatchObject({
      code: 'confirm_failed',
    })
  })

  it('does not call upload if presign fails', async () => {
    mockPresignUpload.mockRejectedValue(new Error('fail'))

    const file = createFile('test.png', 1024, 'image/png')
    try { await uploadFileToStorage(SESSION_ID, file) } catch { /* expected */ }

    expect(mockUploadToPresigned).not.toHaveBeenCalled()
    expect(mockConfirmUpload).not.toHaveBeenCalled()
  })

  it('does not call confirm if upload fails', async () => {
    mockPresignUpload.mockResolvedValue({
      asset_id: 'a1',
      upload_url: 'url',
      asset_url: 'cdn',
      storage_key: 'key',
    })
    mockUploadToPresigned.mockRejectedValue(new Error('fail'))

    const file = createFile('test.png', 1024, 'image/png')
    try { await uploadFileToStorage(SESSION_ID, file) } catch { /* expected */ }

    expect(mockConfirmUpload).not.toHaveBeenCalled()
  })
})

// ── WBUploadError ────────────────────────────────────────────────────────

describe('WBUploadError', () => {
  it('has correct name and code', () => {
    const err = new WBUploadError('presign_failed', 'test message')
    expect(err.name).toBe('WBUploadError')
    expect(err.code).toBe('presign_failed')
    expect(err.message).toBe('test message')
    expect(err).toBeInstanceOf(Error)
  })
})

// ── validateImageFile (A15) ──────────────────────────────────────────────

describe('validateImageFile', () => {
  // ── Mock helpers ──────────────────────────────────────────────────────

  /**
   * Replace global Image with a mock that reports given dimensions
   * and fires onload immediately after src is set (jsdom does not load blob: URLs).
   */
  function setupImageDimensions(width: number, height: number): void {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-wb')
    vi.spyOn(URL, 'revokeObjectURL').mockReturnValue(undefined)

    vi.stubGlobal(
      'Image',
      vi.fn(() => {
        let _onload: ((ev: Event) => void) | null = null
        let _onerror: ((ev: Event) => void) | null = null
        const img: Record<string, unknown> = {
          naturalWidth: width,
          naturalHeight: height,
          get onload() { return _onload },
          set onload(fn: ((ev: Event) => void) | null) { _onload = fn },
          get onerror() { return _onerror },
          set onerror(fn: ((ev: Event) => void) | null) { _onerror = fn },
        }
        Object.defineProperty(img, 'src', {
          set(_v: string) {
            Promise.resolve().then(() => {
              if (typeof _onload === 'function') _onload(new Event('load'))
            })
          },
          get() { return '' },
          configurable: true,
        })
        return img
      }),
    )
  }

  function createMockImageFile(type: string, sizeBytes: number): File {
    const file = new File(['wb-test'], 'test.img', { type })
    Object.defineProperty(file, 'size', { value: sizeBytes, writable: false, configurable: true })
    return file
  }

  function createMockPdfFile(sizeBytes: number): File {
    const file = new File(['pdf'], 'test.pdf', { type: 'application/pdf' })
    Object.defineProperty(file, 'size', { value: sizeBytes, writable: false, configurable: true })
    return file
  }

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  // ── Tests ──────────────────────────────────────────────────────────────

  it('passes small image without warning', async () => {
    setupImageDimensions(100, 100)
    const file = createMockImageFile('image/png', 50 * 1024)
    const result: ImageValidationResult = await validateImageFile(file)
    expect(result.valid).toBe(true)
    expect(result.blocked).toBe(false)
    expect(result.warning).toBeUndefined()
  })

  it('warns for large image (>2048px) but does not block', async () => {
    setupImageDimensions(3000, 2500)
    const file = createMockImageFile('image/jpeg', 2 * 1024 * 1024)
    const result = await validateImageFile(file)
    expect(result.valid).toBe(true)
    expect(result.blocked).toBe(false)
    expect(result.warning).toBeDefined()
    expect(result.warning).toContain('3000')
  })

  it('blocks oversized image (>4096px)', async () => {
    setupImageDimensions(5000, 4000)
    const file = createMockImageFile('image/png', 8 * 1024 * 1024)
    const result = await validateImageFile(file)
    expect(result.valid).toBe(false)
    expect(result.blocked).toBe(true)
    expect(result.warning).toContain('5000')
  })

  it('blocks file over 10 MB before dimension check', async () => {
    const file = createMockImageFile('image/jpeg', 11 * 1024 * 1024)
    const result = await validateImageFile(file)
    expect(result.valid).toBe(false)
    expect(result.blocked).toBe(true)
    expect(result.warning).toContain('10 MB')
  })

  it('skips dimension check for SVG (returns valid regardless of size)', async () => {
    const file = createMockImageFile('image/svg+xml', 1024)
    const result = await validateImageFile(file)
    expect(result.valid).toBe(true)
    expect(result.blocked).toBe(false)
  })

  it('skips dimension check for non-image file (PDF)', async () => {
    const file = createMockPdfFile(5 * 1024 * 1024)
    const result = await validateImageFile(file)
    expect(result.valid).toBe(true)
    expect(result.blocked).toBe(false)
  })

  it('returns valid if image dimensions cannot be read (graceful fallback)', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-wb')
    vi.spyOn(URL, 'revokeObjectURL').mockReturnValue(undefined)
    vi.stubGlobal(
      'Image',
      vi.fn(() => {
        let _onerror: ((ev: Event) => void) | null = null
        const img: Record<string, unknown> = {
          naturalWidth: 0,
          naturalHeight: 0,
          onload: null,
          get onerror() { return _onerror },
          set onerror(fn: ((ev: Event) => void) | null) { _onerror = fn },
        }
        Object.defineProperty(img, 'src', {
          set(_v: string) {
            Promise.resolve().then(() => {
              if (typeof _onerror === 'function') _onerror(new Event('error'))
            })
          },
          get() { return '' },
          configurable: true,
        })
        return img
      }),
    )
    const file = createMockImageFile('image/png', 100 * 1024)
    const result = await validateImageFile(file)
    expect(result.valid).toBe(true)
    expect(result.blocked).toBe(false)
  })
})
