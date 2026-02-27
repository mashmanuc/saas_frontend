/**
 * Validation Messages — maps raw backend errors to user-friendly i18n messages.
 *
 * FIX-B: Backend returns technical messages like "Subject 'language_en' not found or inactive".
 * This module converts them to human-readable, localized messages.
 */

import type { MarketplaceValidationErrors } from './apiErrors'

/**
 * Map backend field name → i18n key for the field label.
 */
const FIELD_LABEL_KEYS: Record<string, string> = {
  headline: 'marketplace.validation.fields.headline',
  bio: 'marketplace.validation.fields.bio',
  subjects: 'marketplace.validation.fields.subjects',
  teaching_languages: 'marketplace.validation.fields.teachingLanguages',
  languages: 'marketplace.validation.fields.languages',
  hourly_rate: 'marketplace.validation.fields.hourlyRate',
  experience_years: 'marketplace.validation.fields.experienceYears',
  birth_year: 'marketplace.validation.fields.birthYear',
  city_code: 'marketplace.validation.fields.city',
  country: 'marketplace.validation.fields.country',
  timezone: 'marketplace.validation.fields.timezone',
  gender: 'marketplace.validation.fields.gender',
  format: 'marketplace.validation.fields.format',
  telegram_username: 'marketplace.validation.fields.telegram',
  pricing: 'marketplace.validation.fields.pricing',
  'pricing.hourly_rate': 'marketplace.validation.fields.hourlyRate',
  'pricing.currency': 'marketplace.validation.fields.currency',
  education: 'marketplace.validation.fields.education',
  certifications: 'marketplace.validation.fields.certifications',
  media: 'marketplace.validation.fields.media',
  custom_direction_text: 'marketplace.validation.fields.customDirection',
  code: 'marketplace.validation.fields.subjectCode',
}

/**
 * Patterns to match in raw backend messages and replace with i18n keys.
 */
const ERROR_PATTERNS: Array<{ pattern: RegExp; key: string }> = [
  { pattern: /not found or inactive/i, key: 'marketplace.validation.errors.notFoundInCatalog' },
  { pattern: /this field is required/i, key: 'marketplace.validation.errors.required' },
  { pattern: /this field may not be blank/i, key: 'marketplace.validation.errors.required' },
  { pattern: /ensure this value is greater than or equal to (\d+)/i, key: 'marketplace.validation.errors.minValue' },
  { pattern: /ensure this value is less than or equal to (\d+)/i, key: 'marketplace.validation.errors.maxValue' },
  { pattern: /ensure this field has no more than (\d+) characters/i, key: 'marketplace.validation.errors.tooLong' },
  { pattern: /ensure this field has at least (\d+) characters/i, key: 'marketplace.validation.errors.tooShort' },
  { pattern: /minimum (\d+) characters/i, key: 'marketplace.validation.errors.tooShort' },
  { pattern: /maximum (\d+) characters/i, key: 'marketplace.validation.errors.tooLong' },
  { pattern: /a valid integer is required/i, key: 'marketplace.validation.errors.mustBeNumber' },
  { pattern: /a valid number is required/i, key: 'marketplace.validation.errors.mustBeNumber' },
  { pattern: /invalid_subjects_format/i, key: 'marketplace.validation.errors.invalidSubjectsFormat' },
  { pattern: /Місто не знайдено/i, key: 'marketplace.validation.errors.cityNotFound' },
]

/**
 * Map a field path to its i18n-friendly field label key.
 * Handles nested paths like "subjects.code" or "subjects[0].code".
 */
export function getFieldLabelKey(fieldPath: string): string {
  // Direct match
  if (FIELD_LABEL_KEYS[fieldPath]) return FIELD_LABEL_KEYS[fieldPath]

  // Try last segment: "subjects[0].code" → "code"
  const lastDot = fieldPath.lastIndexOf('.')
  if (lastDot >= 0) {
    const lastPart = fieldPath.substring(lastDot + 1)
    if (FIELD_LABEL_KEYS[lastPart]) return FIELD_LABEL_KEYS[lastPart]
  }

  // Try parent: "subjects[0].code" → "subjects"
  const bracketIdx = fieldPath.indexOf('[')
  if (bracketIdx >= 0) {
    const parent = fieldPath.substring(0, bracketIdx)
    if (FIELD_LABEL_KEYS[parent]) return FIELD_LABEL_KEYS[parent]
  }

  return fieldPath
}

/**
 * Convert a raw backend error message to a user-friendly i18n key.
 * Returns the i18n key if matched, or the original message if no pattern matches.
 */
export function mapErrorMessage(rawMessage: string): string {
  for (const { pattern, key } of ERROR_PATTERNS) {
    if (pattern.test(rawMessage)) {
      return key
    }
  }
  return rawMessage
}

/**
 * Map field → tab for auto-navigation to the tab with error.
 */
type EditorTab = 'photo' | 'basic' | 'subjects' | 'teaching-languages' | 'pricing' | 'privacy' | 'lesson-links' | 'telegram' | 'publish'

const FIELD_TO_TAB: Record<string, EditorTab> = {
  headline: 'basic',
  bio: 'basic',
  experience_years: 'basic',
  country: 'basic',
  timezone: 'basic',
  subjects: 'subjects',
  code: 'subjects',
  custom_direction_text: 'subjects',
  teaching_languages: 'teaching-languages',
  languages: 'teaching-languages',
  hourly_rate: 'pricing',
  pricing: 'pricing',
  'pricing.hourly_rate': 'pricing',
  'pricing.currency': 'pricing',
  gender: 'privacy',
  birth_year: 'privacy',
  show_gender: 'privacy',
  show_age: 'privacy',
  telegram_username: 'privacy',
  city_code: 'privacy',
  is_city_public: 'privacy',
  format: 'privacy',
}

/**
 * Find the first editor tab that has a validation error.
 */
export function findFirstTabWithError(fields: MarketplaceValidationErrors): EditorTab | null {
  const tabOrder: EditorTab[] = ['basic', 'subjects', 'teaching-languages', 'pricing', 'privacy']

  const errorTabs = new Set<EditorTab>()
  for (const fieldPath of Object.keys(fields)) {
    // Direct match
    const direct = FIELD_TO_TAB[fieldPath]
    if (direct) {
      errorTabs.add(direct)
      continue
    }
    // Try parent: "subjects[0].code" → "subjects"
    const bracketIdx = fieldPath.indexOf('[')
    if (bracketIdx >= 0) {
      const parent = fieldPath.substring(0, bracketIdx)
      const tab = FIELD_TO_TAB[parent]
      if (tab) errorTabs.add(tab)
      continue
    }
    // Try last segment
    const lastDot = fieldPath.lastIndexOf('.')
    if (lastDot >= 0) {
      const lastPart = fieldPath.substring(lastDot + 1)
      const tab = FIELD_TO_TAB[lastPart]
      if (tab) errorTabs.add(tab)
    }
  }

  for (const tab of tabOrder) {
    if (errorTabs.has(tab)) return tab
  }

  return null
}

/**
 * Build a user-friendly error summary from backend validation errors.
 * Each line: "• Field label: friendly message"
 *
 * @param fields - raw backend field errors
 * @param t - i18n translate function
 * @param maxLines - max lines to show (default 5)
 */
export function buildFriendlyErrorSummary(
  fields: MarketplaceValidationErrors,
  t: (key: string, fallback?: string) => string,
  maxLines = 5,
): string[] {
  const lines: string[] = []

  for (const [fieldPath, rawMessages] of Object.entries(fields)) {
    if (!rawMessages?.length) continue

    const labelKey = getFieldLabelKey(fieldPath)
    const label = labelKey.startsWith('marketplace.') ? t(labelKey, fieldPath) : fieldPath

    for (const raw of rawMessages) {
      const msgKey = mapErrorMessage(raw)
      const msg = msgKey.startsWith('marketplace.') ? t(msgKey, raw) : raw
      lines.push(`${label}: ${msg}`)
      if (lines.length >= maxLines) return lines
    }
  }

  return lines
}
