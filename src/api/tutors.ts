/**
 * Tutor Profile API Client
 * 
 * Phase 2 Refactoring (2026-02-06)
 * Contract: docs/STUDENT_PROFILE/API_CONTRACTS_PHASE_2.md
 * 
 * Endpoints:
 * - GET /api/v1/tutors/me — отримати повний профіль тьютора
 * - PATCH /api/v1/tutors/me — оновити профіль тьютора
 */

import apiClient from './client'

/**
 * Tutor Full Profile Interface
 * 
 * Aggregates User + TutorProfile data
 * Contract: API_CONTRACTS_PHASE_2.md → Section 1.1
 */
export interface TutorFullProfile {
  // ==================== USER FIELDS ====================
  id: string                      // User ID (read-only)
  email: string                   // Email (read-only)
  username: string                // Username
  first_name: string              // First name
  last_name: string               // Last name
  phone: string                   // Phone in E.164 format
  telegram_username?: string      // Telegram username (optional)
  timezone: string                // IANA timezone
  avatar_url?: string             // Avatar URL (read-only, optional)
  role: string                    // User role (read-only)
  
  // ==================== TUTOR PROFILE FIELDS ====================
  headline?: string               // Short headline
  bio?: string                    // Detailed bio
  subjects?: string[]             // Array of subjects
  certifications?: string[]       // Array of certifications
  hourly_rate?: number            // Hourly rate (UAH)
  experience_years?: number       // Years of experience
  is_published?: boolean          // Is profile published
}

/**
 * Tutor Profile Update Payload
 * All fields are optional (partial update)
 */
export type TutorProfileUpdate = Partial<Omit<TutorFullProfile, 'id' | 'email' | 'avatar_url' | 'role'>>

/**
 * GET /api/v1/tutors/me
 * 
 * Отримати повний профіль тьютора (User + TutorProfile)
 * 
 * @returns TutorFullProfile
 * @throws ApiError (403) if user is not a tutor
 * @throws ApiError (401) if not authenticated
 */
export async function getTutorProfile(): Promise<TutorFullProfile> {
  const response = await apiClient.get('/v1/tutors/me')
  return response.data
}

/**
 * PATCH /api/v1/tutors/me
 * 
 * Оновити профіль тьютора (часткове оновлення)
 * 
 * @param data - Partial profile data to update
 * @returns Updated TutorFullProfile
 * @throws ApiError (400) for validation errors
 * @throws ApiError (403) if user is not a tutor
 * @throws ApiError (401) if not authenticated
 */
export async function updateTutorProfile(data: TutorProfileUpdate): Promise<TutorFullProfile> {
  const response = await apiClient.patch('/v1/tutors/me', data)
  return response.data
}

/**
 * Client-side validation helpers
 */

/**
 * Validate phone format (E.164)
 * Pattern: ^\+[1-9]\d{1,14}$
 */
export function isValidPhone(phone: string): boolean {
  if (!phone) return true // Optional field
  const pattern = /^\+[1-9]\d{1,14}$/
  return pattern.test(phone)
}

/**
 * Validate timezone (basic check)
 */
export function isValidTimezone(timezone: string): boolean {
  if (!timezone) return true // Optional field
  // Basic check: timezone should contain /
  return timezone.includes('/')
}

/**
 * Validate hourly rate
 */
export function isValidHourlyRate(rate: number | null | undefined): boolean {
  if (rate === null || rate === undefined) return true // Optional field
  return rate >= 0
}

/**
 * Validate experience years
 */
export function isValidExperienceYears(years: number | null | undefined): boolean {
  if (years === null || years === undefined) return true // Optional field
  return years >= 0
}

/**
 * Validate tutor profile data (client-side)
 * 
 * @param data - Profile data to validate
 * @returns Object with field errors or null if valid
 */
export function validateTutorProfile(data: Partial<TutorFullProfile>): Record<string, string> | null {
  const errors: Record<string, string> = {}
  
  // Phone validation
  if (data.phone && !isValidPhone(data.phone)) {
    errors.phone = 'Phone must be in E.164 format (e.g., +380501234567)'
  }
  
  // Timezone validation
  if (data.timezone && !isValidTimezone(data.timezone)) {
    errors.timezone = 'Invalid timezone format'
  }
  
  // Hourly rate validation
  if (data.hourly_rate !== undefined && !isValidHourlyRate(data.hourly_rate)) {
    errors.hourly_rate = 'Hourly rate must be >= 0'
  }
  
  // Experience years validation
  if (data.experience_years !== undefined && !isValidExperienceYears(data.experience_years)) {
    errors.experience_years = 'Experience years must be >= 0'
  }
  
  return Object.keys(errors).length > 0 ? errors : null
}
