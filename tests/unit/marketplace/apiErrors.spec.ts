/**
 * Tests for parseMarketplaceApiError — critical for profile save error handling.
 * Covers: DRF 400 validation errors, 422, field parsing, edge cases.
 */
import { describe, it, expect } from 'vitest'
import { parseMarketplaceApiError, mapMarketplaceErrorToMessage } from '@/modules/marketplace/utils/apiErrors'

function mockAxiosError(status: number, data: any) {
  return { response: { status, data } }
}

describe('parseMarketplaceApiError', () => {
  it('parses DRF 400 validation errors with field arrays', () => {
    const err = mockAxiosError(400, {
      headline: ['This field is required.'],
      bio: ['Ensure this field has at least 10 characters.'],
    })
    const result = parseMarketplaceApiError(err)
    expect(result.status).toBe(400)
    expect(result.fields).not.toBeNull()
    expect(result.fields!.headline).toEqual(['This field is required.'])
    expect(result.fields!.bio).toEqual(['Ensure this field has at least 10 characters.'])
  })

  it('parses DRF 400 with nested city_code error', () => {
    const err = mockAxiosError(400, {
      city_code: ['Місто не знайдено в довіднику. Оберіть місто зі списку або залиште поле порожнім.'],
    })
    const result = parseMarketplaceApiError(err)
    expect(result.status).toBe(400)
    expect(result.fields).not.toBeNull()
    expect(result.fields!.city_code).toHaveLength(1)
    expect(result.fields!.city_code[0]).toContain('Місто не знайдено')
  })

  it('parses 422 with structured fields container', () => {
    const err = mockAxiosError(422, {
      fields: {
        subjects: ['At least one subject is required.'],
      },
    })
    const result = parseMarketplaceApiError(err)
    expect(result.status).toBe(422)
    expect(result.fields).not.toBeNull()
    expect(result.fields!.subjects).toEqual(['At least one subject is required.'])
  })

  it('parses 422 with errors container', () => {
    const err = mockAxiosError(422, {
      errors: {
        pricing: ['Invalid pricing data.'],
      },
    })
    const result = parseMarketplaceApiError(err)
    expect(result.fields).not.toBeNull()
    expect(result.fields!.pricing).toEqual(['Invalid pricing data.'])
  })

  it('skips detail/error/message/code keys when parsing fields', () => {
    const err = mockAxiosError(400, {
      detail: 'Some error detail',
      error: 'validation_failed',
      message: 'Something went wrong',
      code: 'bad_request',
      headline: ['Too short'],
    })
    const result = parseMarketplaceApiError(err)
    expect(result.fields).not.toBeNull()
    expect(result.fields!.headline).toEqual(['Too short'])
    expect(result.fields).not.toHaveProperty('detail')
    expect(result.fields).not.toHaveProperty('error')
    expect(result.fields).not.toHaveProperty('message')
    expect(result.fields).not.toHaveProperty('code')
  })

  it('returns null fields for 403 forbidden', () => {
    const err = mockAxiosError(403, { error: 'forbidden' })
    const result = parseMarketplaceApiError(err)
    expect(result.status).toBe(403)
    expect(result.fields).toBeNull()
  })

  it('returns null fields for 500 server error', () => {
    const err = mockAxiosError(500, { detail: 'Internal server error' })
    const result = parseMarketplaceApiError(err)
    expect(result.status).toBe(500)
    expect(result.fields).toBeNull()
  })

  it('handles string field values (not arrays)', () => {
    const err = mockAxiosError(400, {
      experience_years: 'Must be a positive number.',
    })
    const result = parseMarketplaceApiError(err)
    expect(result.fields).not.toBeNull()
    expect(result.fields!.experience_years).toEqual(['Must be a positive number.'])
  })

  it('extracts code and detail from response', () => {
    const err = mockAxiosError(400, {
      error: 'invalid_subjects_format',
      detail: 'Subjects must be in new format',
    })
    const result = parseMarketplaceApiError(err)
    expect(result.code).toBe('invalid_subjects_format')
    expect(result.detail).toBe('Subjects must be in new format')
  })

  it('handles missing response gracefully', () => {
    const result = parseMarketplaceApiError(new Error('Network error'))
    expect(result.status).toBeNull()
    expect(result.code).toBeNull()
    expect(result.fields).toBeNull()
  })
})
