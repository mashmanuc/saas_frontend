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

// Mock telemetry — перевіряємо що events fire-аться у правильні моменти
const mockTrackEvent = vi.fn()
vi.mock('@/utils/telemetryAgent', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}))

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

  it('rejects SVG files (stored-XSS guard, 2026-06-13 P1-2)', () => {
    // SVG видалено з SUPPORTED_FORMATS: може містити <script>, зберігався as-is.
    // Зворотний регрес-guard — поверне хтось svg → цей тест впаде.
    const file = createFile('icon.svg', 256, 'image/svg+xml')
    const result = validateFile(file)
    expect(result.valid).toBe(false)
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
    mockTrackEvent.mockClear()
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

    // 4-й аргумент — `signal` (undefined коли upload без AbortController)
    expect(mockPresignUpload).toHaveBeenCalledWith(SESSION_ID, {
      filename: 'photo.png',
      content_type: 'image/png',
      file_size: 1024,
    }, undefined)
    expect(mockUploadToPresigned).toHaveBeenCalledWith(
      'https://s3.example.com/presigned-put',
      file,
      undefined,
      undefined,
    )
    expect(mockConfirmUpload).toHaveBeenCalledWith(SESSION_ID, 'asset-abc', undefined, undefined)
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
      undefined,
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

  it('throws WBUploadError(quota_exceeded) on 429 з body.error="quota_exceeded"', async () => {
    // Backend контракт (test_assets.py:170): {error: "quota_exceeded"} → permanent
    const err = Object.assign(new Error('Too Many Requests'), {
      response: { status: 429, data: { error: 'quota_exceeded' } },
    })
    mockPresignUpload.mockRejectedValue(err)

    const file = createFile('test.png', 1024, 'image/png')
    await expect(uploadFileToStorage(SESSION_ID, file)).rejects.toMatchObject({
      code: 'quota_exceeded',
    })
    // Permanent error — НЕ retry: викликано лише 1 раз
    expect(mockPresignUpload).toHaveBeenCalledTimes(1)
  })

  it('throws WBUploadError(quota_exceeded) on 429 з body.error="storage_quota_exceeded"', async () => {
    // Backend контракт (test_assets.py:188): {error: "storage_quota_exceeded"} → permanent
    // FE класифікатор має ловити exact match (НЕ підрядок "quota").
    const err = Object.assign(new Error('Too Many Requests'), {
      response: { status: 429, data: { error: 'storage_quota_exceeded' } },
    })
    mockPresignUpload.mockRejectedValue(err)

    const file = createFile('test.png', 1024, 'image/png')
    await expect(uploadFileToStorage(SESSION_ID, file)).rejects.toMatchObject({
      code: 'quota_exceeded',
    })
    expect(mockPresignUpload).toHaveBeenCalledTimes(1)
  })

  it('P0 regression: 429 з body.error як OBJECT {code} не кидає TypeError', async () => {
    // BACKLOG_PASTE_STORM_HANDLING P0: деякі throttle повертають
    // {error: {code, detail}} (object). Раніше data.error.toLowerCase()
    // кидав TypeError і ламав весь recovery-шлях. Тепер — типобезпечно:
    // object з code='quota_exceeded' класифікується як permanent quota.
    const err = Object.assign(new Error('Too Many Requests'), {
      response: { status: 429, data: { error: { code: 'quota_exceeded', detail: 'Max assets' } } },
    })
    mockPresignUpload.mockRejectedValue(err)

    const file = createFile('test.png', 1024, 'image/png')
    await expect(uploadFileToStorage(SESSION_ID, file)).rejects.toMatchObject({
      code: 'quota_exceeded',
    })
    // Permanent → НЕ retry (і головне: НЕ TypeError-краш у класифікаторі)
    expect(mockPresignUpload).toHaveBeenCalledTimes(1)
  })

  it('P0 regression: 429 з object error БЕЗ code → unknown_429 (не краш)', async () => {
    // object {detail: "..."} без code — невідома форма. Має дати safe default
    // unknown_429 (НЕ TypeError, НЕ нескінченний retry).
    const err = Object.assign(new Error('429'), {
      response: { status: 429, data: { error: { detail: 'throttled, no code' } } },
    })
    mockPresignUpload.mockRejectedValue(err)

    const file = createFile('test.png', 1024, 'image/png')
    vi.useFakeTimers()
    const promise = uploadFileToStorage(SESSION_ID, file).catch((e) => e)
    await vi.advanceTimersByTimeAsync(5_000)
    const result = await promise
    vi.useRealTimers()

    expect(result.code).toBe('unknown_429')
    expect(mockPresignUpload).toHaveBeenCalledTimes(2) // 1 + 1 retry (MAX_RETRIES_UNKNOWN_429)
  })

  it('повертає WBUploadError.details для quota з { current, limit }', async () => {
    const err = Object.assign(new Error('429'), {
      response: {
        status: 429,
        data: { error: 'quota_exceeded', current: 50, limit: 50, detail: 'Max 50 assets' },
      },
    })
    mockPresignUpload.mockRejectedValue(err)

    const file = createFile('test.png', 1024, 'image/png')
    try {
      await uploadFileToStorage(SESSION_ID, file)
      expect.fail('should throw')
    } catch (e) {
      expect((e as Error).constructor.name).toBe('WBUploadError')
      const wbErr = e as { code: string; details?: { current?: number; limit?: number } }
      expect(wbErr.code).toBe('quota_exceeded')
      expect(wbErr.details?.current).toBe(50)
      expect(wbErr.details?.limit).toBe(50)
    }
  })

  it('429 з невідомим body.error — unknown_429, 1 retry max (CDN edge)', async () => {
    // Гіпотетичний майбутній код типу "quota_warning" не має тригерити
    // повний rate_limited retry, але CDN/edge можуть дати 429 без body —
    // даємо ОДИН retry (P1 fix), потім fail. Це баланс: не спамимо при
    // permanent стані, але й не втрачаємо upload при transient edge throttle.
    const err = Object.assign(new Error('429'), {
      response: { status: 429, data: { error: 'quota_warning' } },
    })
    mockPresignUpload.mockRejectedValue(err)

    const file = createFile('test.png', 1024, 'image/png')
    vi.useFakeTimers()
    const promise = uploadFileToStorage(SESSION_ID, file).catch((e) => e)
    await vi.advanceTimersByTimeAsync(5_000)
    const result = await promise
    vi.useRealTimers()

    expect(result.code).toBe('unknown_429')
    // 1 початкова + 1 retry = 2 спроби (MAX_RETRIES_UNKNOWN_429 = 1)
    expect(mockPresignUpload).toHaveBeenCalledTimes(2)
  })

  it('unknown_429: перший fail, другий success → upload проходить', async () => {
    const err = Object.assign(new Error('429'), {
      response: { status: 429, data: { error: 'edge_throttle' } },
    })
    mockPresignUpload
      .mockRejectedValueOnce(err)
      .mockResolvedValueOnce({
        asset_id: 'a-recovered',
        upload_url: 'https://s3/put',
        asset_url: 'https://cdn/a-recovered.png',
        storage_key: 'key',
      })
    mockUploadToPresigned.mockResolvedValue(undefined)
    mockConfirmUpload.mockResolvedValue({
      confirmed: true,
      asset_url: 'https://cdn/a-recovered.png',
    })

    const file = createFile('test.png', 1024, 'image/png')
    vi.useFakeTimers()
    const promise = uploadFileToStorage(SESSION_ID, file)
    await vi.advanceTimersByTimeAsync(5_000)
    const result = await promise
    vi.useRealTimers()

    expect(result.assetId).toBe('a-recovered')
    expect(mockPresignUpload).toHaveBeenCalledTimes(2)
  })

  it('AbortSignal — переривання перед attempt → cancelled', async () => {
    const controller = new AbortController()
    controller.abort()

    const file = createFile('test.png', 1024, 'image/png')
    await expect(
      uploadFileToStorage(SESSION_ID, file, undefined, controller.signal),
    ).rejects.toMatchObject({ code: 'cancelled' })
    expect(mockPresignUpload).not.toHaveBeenCalled()
  })

  it('AbortSignal — переривання під час backoff → cancelled (без retry)', async () => {
    const err = Object.assign(new Error('429'), { response: { status: 429 } })
    mockPresignUpload.mockRejectedValue(err) // завжди rate_limited

    const file = createFile('test.png', 1024, 'image/png')
    const controller = new AbortController()

    vi.useFakeTimers()
    const promise = uploadFileToStorage(
      SESSION_ID, file, undefined, controller.signal,
    ).catch((e) => e)

    // Запускаємо першу спробу → fail (rate_limited) → іде у backoff
    await vi.advanceTimersByTimeAsync(50)
    // Зараз спить у backoff (~1000ms). Abort ПІД ЧАС backoff.
    controller.abort()
    await vi.advanceTimersByTimeAsync(2000)
    const result = await promise
    vi.useRealTimers()

    expect(result.code).toBe('cancelled')
    expect(mockPresignUpload).toHaveBeenCalledTimes(1) // тільки перша спроба, retry не запустився
  })

  it('retries 429 без quota body як rate_limited та зрештою успіх', async () => {
    // 3 fail (rate_limited), потім success — має пройти.
    const err = Object.assign(new Error('Too Many Requests'), {
      response: { status: 429 }, // без body.error → класифікація як rate_limited
    })
    mockPresignUpload
      .mockRejectedValueOnce(err)
      .mockRejectedValueOnce(err)
      .mockResolvedValueOnce({
        asset_id: 'a-retry',
        upload_url: 'https://s3/put',
        asset_url: 'https://cdn/a-retry.png',
        storage_key: 'key',
      })
    mockUploadToPresigned.mockResolvedValue(undefined)
    mockConfirmUpload.mockResolvedValue({
      confirmed: true,
      asset_url: 'https://cdn/a-retry.png',
    })

    const file = createFile('test.png', 1024, 'image/png')

    vi.useFakeTimers()
    const promise = uploadFileToStorage(SESSION_ID, file)

    // Прокручуємо 3 backoff (1s + 2s + jitter)
    await vi.advanceTimersByTimeAsync(10_000)
    const result = await promise
    vi.useRealTimers()

    expect(result.assetId).toBe('a-retry')
    expect(mockPresignUpload).toHaveBeenCalledTimes(3) // 2 fail + 1 success
  })

  it('здається після MAX_RETRIES (3) спроб', async () => {
    const err = Object.assign(new Error('Too Many Requests'), {
      response: { status: 429 },
    })
    mockPresignUpload.mockRejectedValue(err)

    const file = createFile('test.png', 1024, 'image/png')
    vi.useFakeTimers()
    const promise = uploadFileToStorage(SESSION_ID, file).catch((e) => e)
    await vi.advanceTimersByTimeAsync(20_000)
    const result = await promise
    vi.useRealTimers()

    expect(result).toBeInstanceOf(Object)
    expect(result.code).toBe('rate_limited')
    // 1 початкова + 3 retry = 4 спроби (MAX_RETRIES = 3)
    expect(mockPresignUpload).toHaveBeenCalledTimes(4)
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

  // ─── Telemetry events ───────────────────────────────────────────────────

  it('telemetry: success → wb.upload.start + wb.upload.success', async () => {
    mockPresignUpload.mockResolvedValue({
      asset_id: 'a-1', upload_url: 'https://s3/put',
      asset_url: 'https://cdn/a-1.png', storage_key: 'key',
    })
    mockUploadToPresigned.mockResolvedValue(undefined)
    mockConfirmUpload.mockResolvedValue({ confirmed: true, asset_url: 'https://cdn/a-1.png' })

    const file = createFile('test.png', 2048, 'image/png')
    await uploadFileToStorage(SESSION_ID, file)

    const events = mockTrackEvent.mock.calls.map((c) => c[0])
    expect(events).toContain('wb.upload.start')
    expect(events).toContain('wb.upload.success')

    const successCall = mockTrackEvent.mock.calls.find((c) => c[0] === 'wb.upload.success')
    expect(successCall![1].asset_id).toBe('a-1')
    expect(successCall![2].file_size).toBe(2048)
    expect(successCall![2].attempts).toBe(1)
    expect(typeof successCall![2].duration_ms).toBe('number')
  })

  it('telemetry: failure (quota) → wb.upload.start + wb.upload.failure', async () => {
    const err = Object.assign(new Error('429'), {
      response: { status: 429, data: { error: 'quota_exceeded' } },
    })
    mockPresignUpload.mockRejectedValue(err)

    const file = createFile('test.png', 1024, 'image/png')
    await expect(uploadFileToStorage(SESSION_ID, file)).rejects.toThrow()

    const events = mockTrackEvent.mock.calls.map((c) => c[0])
    expect(events).toContain('wb.upload.start')
    expect(events).toContain('wb.upload.failure')

    const failureCall = mockTrackEvent.mock.calls.find((c) => c[0] === 'wb.upload.failure')
    expect(failureCall![1].code).toBe('quota_exceeded')
  })

  it('telemetry: rate_limited retry → wb.upload.retry events', async () => {
    const err = Object.assign(new Error('429'), { response: { status: 429 } })
    mockPresignUpload
      .mockRejectedValueOnce(err)
      .mockRejectedValueOnce(err)
      .mockResolvedValueOnce({
        asset_id: 'a-r', upload_url: 'https://s3/put',
        asset_url: 'https://cdn/a-r.png', storage_key: 'key',
      })
    mockUploadToPresigned.mockResolvedValue(undefined)
    mockConfirmUpload.mockResolvedValue({ confirmed: true, asset_url: 'https://cdn/a-r.png' })

    const file = createFile('test.png', 1024, 'image/png')
    vi.useFakeTimers()
    const promise = uploadFileToStorage(SESSION_ID, file)
    await vi.advanceTimersByTimeAsync(10_000)
    await promise
    vi.useRealTimers()

    const retryEvents = mockTrackEvent.mock.calls.filter((c) => c[0] === 'wb.upload.retry')
    expect(retryEvents).toHaveLength(2) // 2 fail → 2 retry
    expect(retryEvents[0][1].code).toBe('rate_limited')
    expect(retryEvents[0][2].attempt).toBe(1)
    expect(retryEvents[1][2].attempt).toBe(2)
  })

  it('telemetry: AbortSignal → wb.upload.cancelled', async () => {
    const controller = new AbortController()
    controller.abort()

    const file = createFile('test.png', 1024, 'image/png')
    await expect(
      uploadFileToStorage(SESSION_ID, file, undefined, controller.signal),
    ).rejects.toMatchObject({ code: 'cancelled' })

    const cancelledCall = mockTrackEvent.mock.calls.find((c) => c[0] === 'wb.upload.cancelled')
    expect(cancelledCall).toBeDefined()
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
