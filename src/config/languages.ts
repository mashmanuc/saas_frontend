/**
 * Centralized language configuration.
 * 
 * All language names and codes should be imported from here.
 * DO NOT hardcode language names anywhere else in the codebase.
 * 
 * Usage:
 *   import { LANGUAGES, getLanguageName } from '@/config/languages'
 *   
 *   // Get all languages
 *   LANGUAGES.forEach(lang => console.log(lang.code, lang.name))
 *   
 *   // Get language name by code
 *   const name = getLanguageName('uk') // Returns 'Ukrainian'
 */

export interface Language {
  code: string
  name: string
  native: string
}

// ISO 639-1 language codes with names
// Native names included for i18n support
export const LANGUAGES: Language[] = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'uk', name: 'Ukrainian', native: 'Українська' },
  { code: 'pl', name: 'Polish', native: 'Polski' },
  { code: 'de', name: 'German', native: 'Deutsch' },
  { code: 'es', name: 'Spanish', native: 'Español' },
  { code: 'fr', name: 'French', native: 'Français' },
  { code: 'it', name: 'Italian', native: 'Italiano' },
  { code: 'pt', name: 'Portuguese', native: 'Português' },
  { code: 'nl', name: 'Dutch', native: 'Nederlands' },
  { code: 'sv', name: 'Swedish', native: 'Svenska' },
  { code: 'cs', name: 'Czech', native: 'Čeština' },
  { code: 'ro', name: 'Romanian', native: 'Română' },
  { code: 'hu', name: 'Hungarian', native: 'Magyar' },
  { code: 'tr', name: 'Turkish', native: 'Türkçe' },
  { code: 'ru', name: 'Russian', native: 'Русский' },
  { code: 'zh', name: 'Chinese', native: '中文' },
  { code: 'ja', name: 'Japanese', native: '日本語' },
  { code: 'ko', name: 'Korean', native: '한국어' },
  { code: 'ar', name: 'Arabic', native: 'العربية' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
]

// Quick lookup map: code -> name
export const LANGUAGE_NAMES: Record<string, string> = Object.fromEntries(
  LANGUAGES.map(lang => [lang.code, lang.name])
)

// Quick lookup map: code -> native name
export const LANGUAGE_NATIVE_NAMES: Record<string, string> = Object.fromEntries(
  LANGUAGES.map(lang => [lang.code, lang.native])
)

// List of language codes
export const LANGUAGE_CODES: string[] = LANGUAGES.map(lang => lang.code)

/**
 * Get language name by code.
 * 
 * @param code - ISO 639-1 language code (e.g., 'en', 'uk')
 * @param native - If true, return native name (e.g., 'Українська' instead of 'Ukrainian')
 * @returns Language name, or the code itself if not found
 */
export function getLanguageName(code: string, native = false): string {
  if (native) {
    return LANGUAGE_NATIVE_NAMES[code] || code
  }
  return LANGUAGE_NAMES[code] || code
}

/**
 * Get full language info by code.
 * 
 * @param code - ISO 639-1 language code
 * @returns Language object or undefined if not found
 */
export function getLanguageByCode(code: string): Language | undefined {
  return LANGUAGES.find(lang => lang.code === code)
}

/**
 * Get languages as options for Select component.
 * 
 * @param native - If true, use native names as labels
 * @returns Array of { label, value } objects
 */
export function getLanguageOptions(native = false): { label: string; value: string }[] {
  return LANGUAGES.map(lang => ({
    label: native ? lang.native : lang.name,
    value: lang.code,
  }))
}
