// WB: Unit tests for useImageUpload composable (Phase 2: A2.1)
// Tests: validation, presigned upload flow, error handling, composable state

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  validateFile,
  fileToDataUrl,
  uploadFileToStorage,
  WBUploadError,
} from '../composables/useImageUpload'

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

describe('useImageUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── validateFile ────────────────────────────────────────────────────

  describe('validateFile', () => {
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

  // ── uploadFileToStorage ─────────────────────────────────────────────

  describe('uploadFileToStorage', () => {
    const SESSION_ID = 'session-123'

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

      // Verify call order and params
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

  // ── WBUploadError ───────────────────────────────────────────────────

  describe('WBUploadError', () => {
    it('has correct name and code', () => {
      const err = new WBUploadError('presign_failed', 'test message')
      expect(err.name).toBe('WBUploadError')
      expect(err.code).toBe('presign_failed')
      expect(err.message).toBe('test message')
      expect(err).toBeInstanceOf(Error)
    })
  })
})
