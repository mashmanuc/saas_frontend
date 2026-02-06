/**
 * User Settings API Client
 * 
 * Phase 2 Refactoring (2026-02-06)
 * Contract: docs/STUDENT_PROFILE/API_CONTRACTS_PHASE_2.md
 * 
 * Endpoints:
 * - GET /api/v1/me/settings — отримати налаштування користувача
 * - PATCH /api/v1/me/settings — оновити налаштування
 */

import apiClient from './client'

/**
 * Language Option Interface
 */
export interface LanguageOption {
  code: string    // Language code ("uk" or "en")
  name: string    // Language name ("Українська" or "English")
}

/**
 * User Settings Interface
 * 
 * Contains UI/UX, privacy, and notification settings
 * Contract: API_CONTRACTS_PHASE_2.md → Section 2.1
 */
export interface UserSettings {
  // ==================== LANGUAGE & THEME ====================
  ui_language: string                 // UI language ("uk" or "en")
  interface_language: string          // Interface language ("uk" or "en")
  languages: LanguageOption[]         // Available languages (read-only)
  dark_mode: 'system' | 'light' | 'dark' // Dark mode preference
  
  // ==================== NOTIFICATIONS ====================
  notifications_enabled: boolean      // Enable notifications
  
  // ==================== PRIVACY ====================
  privacy_public_profile: boolean     // Legacy (deprecated)
  public_profile_enabled: boolean     // Enable public profile
  show_email_publicly: boolean        // Show email publicly
  show_avatar_publicly: boolean       // Show avatar publicly
  show_certifications_publicly: boolean // Show certifications publicly
  show_subjects_publicly: boolean     // Show subjects publicly
  show_bio_publicly: boolean          // Show bio publicly
}

/**
 * User Settings Update Payload
 * All fields are optional (partial update)
 */
export type UserSettingsUpdate = Partial<Omit<UserSettings, 'languages'>>

/**
 * GET /api/v1/me/settings
 * 
 * Отримати налаштування користувача
 * 
 * @returns UserSettings
 * @throws ApiError (401) if not authenticated
 */
export async function getUserSettings(): Promise<UserSettings> {
  const response = await apiClient.get('/v1/me/settings')
  return response.data
}

/**
 * PATCH /api/v1/me/settings
 * 
 * Оновити налаштування користувача (часткове оновлення)
 * 
 * @param data - Partial settings data to update
 * @returns Updated UserSettings
 * @throws ApiError (400) for validation errors
 * @throws ApiError (401) if not authenticated
 */
export async function updateUserSettings(data: UserSettingsUpdate): Promise<UserSettings> {
  const response = await apiClient.patch('/v1/me/settings', data)
  return response.data
}

/**
 * Client-side validation helpers
 */

/**
 * Validate language code
 */
export function isValidLanguage(lang: string): boolean {
  return ['uk', 'en'].includes(lang)
}

/**
 * Validate dark mode value
 */
export function isValidDarkMode(mode: string): boolean {
  return ['system', 'light', 'dark'].includes(mode)
}

/**
 * Validate user settings data (client-side)
 * 
 * @param data - Settings data to validate
 * @returns Object with field errors or null if valid
 */
export function validateUserSettings(data: Partial<UserSettings>): Record<string, string> | null {
  const errors: Record<string, string> = {}
  
  // UI language validation
  if (data.ui_language && !isValidLanguage(data.ui_language)) {
    errors.ui_language = 'UI language must be "uk" or "en"'
  }
  
  // Interface language validation
  if (data.interface_language && !isValidLanguage(data.interface_language)) {
    errors.interface_language = 'Interface language must be "uk" or "en"'
  }
  
  // Dark mode validation
  if (data.dark_mode && !isValidDarkMode(data.dark_mode)) {
    errors.dark_mode = 'Dark mode must be "system", "light", or "dark"'
  }
  
  return Object.keys(errors).length > 0 ? errors : null
}
