/**
 * Tests for profileAdapter — buildTutorProfileUpdate and validateProfileBeforeSubmit.
 * Covers: city_code handling, subject normalization, teaching_languages, validation.
 */
import { describe, it, expect } from 'vitest'
import { buildTutorProfileUpdate, validateProfileBeforeSubmit } from '@/modules/marketplace/adapters/profileAdapter'
import type { TutorProfileFormModel } from '@/modules/marketplace/tutorProfileFormModel'

function makeValidForm(overrides: Partial<TutorProfileFormModel> = {}): TutorProfileFormModel {
  return {
    headline: 'Experienced Math Teacher',
    bio: 'I have been teaching for 10 years with proven results.',
    hourly_rate: 25,
    currency: 'UAH',
    trial_lesson_price: null,
    video_intro_url: '',
    country: 'UA',
    timezone: 'Europe/Kyiv',
    format: 'online',
    experience_years: 5,
    subjects: [{ code: 'mathematics', tags: ['grades_5-9'], custom_direction_text: '' }],
    languages: [{ code: 'uk', level: 'native' }],
    teaching_languages: [{ code: 'uk', level: 'native' }],
    is_published: false,
    gender: '',
    show_gender: false,
    birth_year: null,
    show_age: false,
    telegram_username: '',
    city_code: null,
    is_city_public: true,
    ...overrides,
  }
}

describe('buildTutorProfileUpdate', () => {
  it('sends city_code as undefined when null (does not trigger backend clearing)', () => {
    const form = makeValidForm({ city_code: null })
    const payload = buildTutorProfileUpdate(form)
    // undefined means "don't include in JSON" — backend won't touch city field
    expect(payload.city_code).toBeUndefined()
  })

  it('sends city_code when it has a value', () => {
    const form = makeValidForm({ city_code: 'kyiv' })
    const payload = buildTutorProfileUpdate(form)
    expect(payload.city_code).toBe('kyiv')
  })

  it('normalizes subjects — filters out empty codes', () => {
    const form = makeValidForm({
      subjects: [
        { code: 'mathematics', tags: ['online'], custom_direction_text: '' },
        { code: '', tags: [], custom_direction_text: '' },
      ],
    })
    const payload = buildTutorProfileUpdate(form)
    expect(payload.subjects).toHaveLength(1)
    expect(payload.subjects[0].code).toBe('mathematics')
  })

  it('normalizes teaching_languages — filters out empty codes', () => {
    const form = makeValidForm({
      teaching_languages: [
        { code: 'uk', level: 'native' },
        { code: '', level: 'fluent' },
      ],
    })
    const payload = buildTutorProfileUpdate(form)
    expect(payload.teaching_languages).toHaveLength(1)
    expect(payload.teaching_languages![0].code).toBe('uk')
  })

  it('sets pricing correctly', () => {
    const form = makeValidForm({ hourly_rate: 50, currency: 'EUR', trial_lesson_price: 10 })
    const payload = buildTutorProfileUpdate(form)
    expect(payload.pricing.hourly_rate).toBe(50)
    expect(payload.pricing.currency).toBe('EUR')
    expect(payload.pricing.trial_lesson_price).toBe(10)
  })

  it('handles empty form gracefully', () => {
    const form = makeValidForm({
      headline: '',
      bio: '',
      subjects: [],
      teaching_languages: [],
      hourly_rate: 0,
    })
    const payload = buildTutorProfileUpdate(form)
    expect(payload.headline).toBe('')
    expect(payload.bio).toBe('')
    expect(payload.subjects).toHaveLength(0)
    expect(payload.teaching_languages).toHaveLength(0)
  })

  it('drops custom_direction_text shorter than 50 chars', () => {
    const form = makeValidForm({
      subjects: [{ code: 'math', tags: [], custom_direction_text: 'Too short text' }],
    })
    const payload = buildTutorProfileUpdate(form)
    expect(payload.subjects[0].custom_direction_text).toBe('')
  })
})

describe('validateProfileBeforeSubmit', () => {
  it('returns no errors for valid form', () => {
    const form = makeValidForm()
    const errors = validateProfileBeforeSubmit(form)
    expect(errors).toHaveLength(0)
  })

  it('returns error for missing headline', () => {
    const form = makeValidForm({ headline: '' })
    const errors = validateProfileBeforeSubmit(form)
    expect(errors.some(e => e.field === 'headline')).toBe(true)
  })

  it('returns error for missing bio', () => {
    const form = makeValidForm({ bio: '' })
    const errors = validateProfileBeforeSubmit(form)
    expect(errors.some(e => e.field === 'bio')).toBe(true)
  })

  it('returns error for zero hourly_rate', () => {
    const form = makeValidForm({ hourly_rate: 0 })
    const errors = validateProfileBeforeSubmit(form)
    expect(errors.some(e => e.field === 'hourly_rate')).toBe(true)
  })

  it('returns error for empty subjects', () => {
    const form = makeValidForm({ subjects: [] })
    const errors = validateProfileBeforeSubmit(form)
    expect(errors.some(e => e.field === 'subjects')).toBe(true)
  })

  it('returns error for empty teaching_languages', () => {
    const form = makeValidForm({ teaching_languages: [] })
    const errors = validateProfileBeforeSubmit(form)
    expect(errors.some(e => e.field === 'teaching_languages')).toBe(true)
  })

  it('returns error for negative experience_years', () => {
    const form = makeValidForm({ experience_years: -1 })
    const errors = validateProfileBeforeSubmit(form)
    expect(errors.some(e => e.field === 'experience_years')).toBe(true)
  })

  it('returns error for invalid birth_year', () => {
    const form = makeValidForm({ birth_year: 1800 })
    const errors = validateProfileBeforeSubmit(form)
    expect(errors.some(e => e.field === 'birth_year')).toBe(true)
  })

  it('accepts null birth_year without error', () => {
    const form = makeValidForm({ birth_year: null })
    const errors = validateProfileBeforeSubmit(form)
    expect(errors.some(e => e.field === 'birth_year')).toBe(false)
  })
})
