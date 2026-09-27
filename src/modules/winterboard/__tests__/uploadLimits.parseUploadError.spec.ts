// Б-74 (2026-09-27): відмова сервера за форматом — окрема причина, а не загальний збій.
// Сервер перевіряє зображення за байтами й відповідає `unsupported_format:<mime>`.

import { describe, it, expect } from 'vitest'
import { parseUploadError } from '../composables/uploadLimits'

const err = (status: number, data: Record<string, unknown>) => ({ response: { status, data } })

describe('parseUploadError', () => {
  it('формат, відхилений сервером за байтами → «Формат не підтримується»', () => {
    expect(parseUploadError(err(400, { error: 'unsupported_format:image/heic' }))).toEqual({ key: 'unsupported_format', params: {} })
    expect(parseUploadError(err(400, { error: 'unsupported_format:image/jpeg' }))).toEqual({ key: 'unsupported_format', params: {} })
    expect(parseUploadError(err(400, { error: 'unsupported_format', mime: 'image/tiff' }))).toEqual({ key: 'unsupported_format', params: {} })
  })

  it('решта причин — як і раніше', () => {
    expect(parseUploadError(err(507, {}))).toEqual({ key: 'quota_exceeded', params: {} })
    expect(parseUploadError(err(429, {}))).toEqual({ key: 'rate_limited', params: {} })
    expect(parseUploadError(err(400, { error: 'file_too_large', limit_mb: 50, actual_mb: 61 })))
      .toEqual({ key: 'file_too_large', params: { actual: 61, limit: 50 } })
    expect(parseUploadError(err(500, { error: 'boom' }))).toEqual({ key: 'upload_failed', params: {} })
    expect(parseUploadError(new Error('network'))).toEqual({ key: 'upload_failed', params: {} })
  })
})
