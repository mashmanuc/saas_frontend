import { describe, it, expect } from 'vitest'
import { validateProfileBeforeSubmit, buildTutorProfileUpdate } from '../profileAdapter'
import type { TutorProfileFormModel } from '../../tutorProfileFormModel'

describe('profileAdapter', () => {
  describe('validateProfileBeforeSubmit', () => {
    const createValidModel = (): TutorProfileFormModel => ({
      headline: 'Test Headline',
      bio: 'Test bio with enough characters',
      hourly_rate: 50,
      currency: 'USD',
      trial_lesson_price: null,
      video_intro_url: '',
      country: '',
      timezone: '',
      format: '',
      experience_years: 5,
      subjects: [{ code: 'math', tags: [], custom_direction_text: '' }],
      languages: [{ code: 'en', level: 'fluent' }],
      teaching_languages: [],
      is_published: false,
      gender: '',
      show_gender: false,
      birth_year: null,
      show_age: false,
      telegram_username: '',
    })

    describe('experience_years validation', () => {
      it('should accept 0 as valid experience_years', () => {
        const model = createValidModel()
        model.experience_years = 0
        const errors = validateProfileBeforeSubmit(model)
        const expError = errors.find(e => e.field === 'experience_years')
        expect(expError).toBeUndefined()
      })

      it('should accept positive numbers as valid experience_years', () => {
        const model = createValidModel()
        model.experience_years = 10
        const errors = validateProfileBeforeSubmit(model)
        const expError = errors.find(e => e.field === 'experience_years')
        expect(expError).toBeUndefined()
      })

      it('should reject negative numbers', () => {
        const model = createValidModel()
        model.experience_years = -5
        const errors = validateProfileBeforeSubmit(model)
        const expError = errors.find(e => e.field === 'experience_years')
        expect(expError).toBeDefined()
        expect(expError?.message).toBe('marketplace.profile.errors.experienceNonNegative')
      })

      it('should reject NaN', () => {
        const model = createValidModel()
        model.experience_years = NaN
        const errors = validateProfileBeforeSubmit(model)
        const expError = errors.find(e => e.field === 'experience_years')
        expect(expError).toBeDefined()
        expect(expError?.message).toBe('marketplace.profile.errors.experienceNonNegative')
      })

      it('should reject Infinity', () => {
        const model = createValidModel()
        model.experience_years = Infinity
        const errors = validateProfileBeforeSubmit(model)
        const expError = errors.find(e => e.field === 'experience_years')
        expect(expError).toBeDefined()
        expect(expError?.message).toBe('marketplace.profile.errors.experienceNonNegative')
      })

      it('should normalize string numbers to numeric', () => {
        const model = createValidModel()
        model.experience_years = '5' as any
        const errors = validateProfileBeforeSubmit(model)
        const expError = errors.find(e => e.field === 'experience_years')
        expect(expError).toBeUndefined()
        expect(model.experience_years).toBe(5)
        expect(typeof model.experience_years).toBe('number')
      })

      it('should normalize string "0" to numeric 0', () => {
        const model = createValidModel()
        model.experience_years = '0' as any
        const errors = validateProfileBeforeSubmit(model)
        const expError = errors.find(e => e.field === 'experience_years')
        expect(expError).toBeUndefined()
        expect(model.experience_years).toBe(0)
        expect(typeof model.experience_years).toBe('number')
      })
    })

    describe('buildTutorProfileUpdate', () => {
      it('should use 0 as default for invalid experience_years', () => {
        const model = createValidModel()
        model.experience_years = NaN
        const payload = buildTutorProfileUpdate(model)
        expect(payload.experience_years).toBe(0)
      })

      it('should preserve valid experience_years', () => {
        const model = createValidModel()
        model.experience_years = 10
        const payload = buildTutorProfileUpdate(model)
        expect(payload.experience_years).toBe(10)
      })

      it('should preserve 0 as valid experience_years', () => {
        const model = createValidModel()
        model.experience_years = 0
        const payload = buildTutorProfileUpdate(model)
        expect(payload.experience_years).toBe(0)
      })
    })
  })
})
