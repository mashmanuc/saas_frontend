/**
 * Profile Adapter Layer
 * v0.60.1: Converts UI Form State → API Contract (TutorProfileUpdate)
 * 
 * CRITICAL: UI Form Model ≠ API Contract Model
 * This adapter ensures strict contract compliance.
 */

import type { TutorProfileUpdate, SubjectWrite, Language } from '../api/marketplace'
import type { TutorProfileFormModel } from '../tutorProfileFormModel'

/**
 * Validation errors for preflight checks
 */
export interface ProfileValidationError {
  field: string
  message: string
}

/**
 * Preflight validation before sending to API
 */
export function validateProfileBeforeSubmit(model: TutorProfileFormModel): ProfileValidationError[] {
  const errors: ProfileValidationError[] = []

  // Required fields
  if (!model.headline?.trim()) {
    errors.push({ field: 'headline', message: 'marketplace.profile.errors.headlineRequired' })
  }

  if (!model.bio?.trim()) {
    errors.push({ field: 'bio', message: 'marketplace.profile.errors.bioRequired' })
  }

  if (!model.hourly_rate || model.hourly_rate <= 0) {
    errors.push({ field: 'hourly_rate', message: 'marketplace.profile.errors.hourlyRatePositive' })
  }

  if (!model.currency?.trim()) {
    errors.push({ field: 'currency', message: 'marketplace.profile.errors.currencyRequired' })
  }

  if (typeof model.experience_years !== 'number' || model.experience_years < 0) {
    errors.push({ field: 'experience_years', message: 'marketplace.profile.errors.experienceNonNegative' })
  }

  const birthYear = model.birth_year
  if (birthYear != null) {
    if (birthYear < 1900 || birthYear > 2100) {
      errors.push({ field: 'birth_year', message: 'marketplace.profile.errors.birthYearInvalid' })
    }
  }

  // Subjects validation
  if (!Array.isArray(model.subjects) || model.subjects.length === 0) {
    errors.push({ field: 'subjects', message: 'marketplace.profile.errors.subjectsRequired' })
  } else {
    model.subjects.forEach((subject, index) => {
      if (!subject.code?.trim()) {
        errors.push({ field: `subjects[${index}].code`, message: 'marketplace.profile.errors.subjectCodeRequired' })
      }

      // Validate custom_direction_text length if present
      const customText = subject.custom_direction_text?.trim()
      if (customText && (customText.length < 50 || customText.length > 800)) {
        errors.push({
          field: `subjects[${index}].custom_direction_text`,
          message: 'marketplace.profile.errors.customDirectionLength',
        })
      }
    })
  }

  // Languages validation
  if (!Array.isArray(model.languages) || model.languages.length === 0) {
    errors.push({ field: 'languages', message: 'marketplace.profile.errors.languagesRequired' })
  }

  return errors
}

/**
 * Build TutorProfileUpdate payload from UI form state
 * 
 * This is the ONLY way to convert form data to API payload.
 * NO direct spreading, NO partial payloads, NO legacy fields.
 */
export function buildTutorProfileUpdate(model: TutorProfileFormModel): TutorProfileUpdate {
  // Normalize subjects: ensure all required fields, filter invalid
  const subjects: SubjectWrite[] = (model.subjects || [])
    .filter((s) => s.code?.trim()) // Only subjects with valid code
    .map((s) => {
      const customText = s.custom_direction_text?.trim()
      return {
        code: s.code.trim(),
        tags: Array.isArray(s.tags) ? s.tags.filter((t) => t?.trim()) : [],
        custom_direction_text: customText && customText.length >= 50 && customText.length <= 800 
          ? customText 
          : '',
      }
    })

  // Normalize languages
  const languages: Language[] = (model.languages || [])
    .filter((l) => l.code?.trim())
    .map((l) => ({
      code: l.code.trim(),
      name: '', // Backend doesn't use this field in write operations
      level: l.level || 'fluent',
    }))

  // Build COMPLETE TutorProfileUpdate payload
  const payload: TutorProfileUpdate = {
    // Required text fields
    bio: model.bio?.trim() || '',
    headline: model.headline?.trim() || '',

    // Required arrays (can be empty but must exist)
    education: [], // TODO: Add education form fields
    certifications: [], // TODO: Add certifications form fields
    languages,
    subjects,

    // Required number
    experience_years: typeof model.experience_years === 'number' ? model.experience_years : 0,

    // Publication status
    is_published: model.is_published || false,

    // Optional profile fields
    country: model.country?.trim() || undefined,
    timezone: model.timezone?.trim() || undefined,
    format: model.format || undefined,

    // Privacy
    gender: model.gender?.trim() || undefined,
    show_gender: typeof model.show_gender === 'boolean' ? model.show_gender : undefined,
    birth_year: model.birth_year ?? null,
    show_age: typeof model.show_age === 'boolean' ? model.show_age : undefined,
    telegram_username: model.telegram_username?.trim() || undefined,

    // Required nested object: pricing
    pricing: {
      hourly_rate: model.hourly_rate || 0,
      currency: model.currency?.trim() || 'USD',
      trial_lesson_price: model.trial_lesson_price ?? null,
    },

    // Required nested object: media
    media: {
      photo_url: null, // Photo is managed separately via upload API
      video_intro_url: model.video_intro_url?.trim() || '',
    },
  }

  return payload
}

/**
 * Debug helper: log payload structure for verification
 */
export function debugPayload(payload: TutorProfileUpdate, label = 'TutorProfileUpdate'): void {
  if (import.meta.env.DEV) {
    console.group(`[ProfileAdapter] ${label}`)
    console.log('bio:', payload.bio ? payload.bio.substring(0, 50) + '...' : '(empty)')
    console.log('headline:', payload.headline || '(empty)')
    console.log('subjects:', payload.subjects?.length ?? 0, payload.subjects ?? [])
    console.log('languages:', payload.languages?.length ?? 0, payload.languages ?? [])
    console.log('experience_years:', payload.experience_years)
    console.log('is_published:', payload.is_published)
    console.log('pricing:', payload.pricing)
    console.log('media:', payload.media)
    console.log('education:', payload.education?.length ?? 0)
    console.log('certifications:', payload.certifications?.length ?? 0)
    console.groupEnd()
  }
}
