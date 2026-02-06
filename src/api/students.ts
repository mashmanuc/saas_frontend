/**
 * Student Profile API Client
 * 
 * Phase 1 Refactoring (2026-02-06)
 * Contract: docs/STUDENT_PROFILE/API_CONTRACTS_STUDENT_PROFILE.md
 * 
 * Endpoints:
 * - GET /api/v1/students/me — отримати повний профіль студента
 * - PATCH /api/v1/students/me — оновити профіль студента
 */

import { apiClient } from './client'

/**
 * Student Full Profile Interface
 * 
 * Агрегує дані з User та StudentProfile.
 * Contract: API_CONTRACTS_STUDENT_PROFILE.md → Section 1.1
 */
export interface StudentFullProfile {
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
  
  // ==================== STUDENT PROFILE FIELDS ====================
  headline?: string               // Short headline
  bio?: string                    // Detailed bio
  learning_goals?: string         // Learning goals
  preferred_subjects?: string[]   // Array of subject names
  budget_min?: number             // Minimum budget per hour (UAH)
  budget_max?: number             // Maximum budget per hour (UAH)
  grade?: number                  // School grade (1-12)
  parent_contact?: string         // Parent contact info
  notes?: string                  // Private notes
  preferred_language?: string     // Preferred language ("uk" or "en")
}

/**
 * Partial update payload for PATCH request
 * All fields are optional
 */
export type StudentProfileUpdate = Partial<Omit<StudentFullProfile, 'id' | 'email' | 'avatar_url' | 'role'>>

/**
 * GET /api/v1/students/me
 * 
 * Отримати повний профіль студента (User + StudentProfile).
 * 
 * @returns StudentFullProfile
 * @throws ApiError (403) if user is not a student
 * @throws ApiError (401) if not authenticated
 */
export async function getStudentProfile(): Promise<StudentFullProfile> {
  const response = await apiClient.get('/v1/students/me')
  return response.data
}

/**
 * PATCH /api/v1/students/me
 * 
 * Оновити профіль студента (часткове оновлення).
 * Всі поля optional.
 * 
 * @param data - Partial profile data to update
 * @returns Updated StudentFullProfile
 * @throws ApiError (400) if validation fails
 * @throws ApiError (403) if user is not a student
 * @throws ApiError (401) if not authenticated
 */
export async function updateStudentProfile(data: StudentProfileUpdate): Promise<StudentFullProfile> {
  const response = await apiClient.patch('/v1/students/me', data)
  return response.data
}

/**
 * Validation Helpers
 */

/**
 * Validate phone format (E.164)
 * Pattern: ^\+[1-9]\d{1,14}$
 */
export function isValidPhone(phone: string): boolean {
  if (!phone) return true // Empty is valid
  return /^\+[1-9]\d{1,14}$/.test(phone)
}

/**
 * Validate budget range (min <= max)
 */
export function isValidBudgetRange(min?: number, max?: number): boolean {
  if (min !== undefined && max !== undefined) {
    return min <= max
  }
  return true
}

/**
 * Validate grade (1-12)
 */
export function isValidGrade(grade?: number): boolean {
  if (grade === undefined || grade === null) return true
  return grade >= 1 && grade <= 12
}

/**
 * Validate timezone (basic check)
 * Full validation happens on backend via ZoneInfo
 */
export function isValidTimezone(timezone: string): boolean {
  if (!timezone) return false
  // Basic check: timezone should contain '/'
  return timezone.includes('/')
}

/**
 * Client-side validation before sending to backend
 * 
 * @param data - Profile data to validate
 * @returns Validation errors or null if valid
 */
export function validateStudentProfile(data: StudentProfileUpdate): Record<string, string> | null {
  const errors: Record<string, string> = {}
  
  // Phone validation
  if (data.phone && !isValidPhone(data.phone)) {
    errors.phone = 'Phone must be in E.164 format (e.g., +380501234567)'
  }
  
  // Budget range validation
  if (!isValidBudgetRange(data.budget_min, data.budget_max)) {
    errors.budget_max = 'Budget max must be >= budget min'
  }
  
  // Grade validation
  if (data.grade !== undefined && !isValidGrade(data.grade)) {
    errors.grade = 'Grade must be between 1 and 12'
  }
  
  // Timezone validation
  if (data.timezone && !isValidTimezone(data.timezone)) {
    errors.timezone = 'Invalid timezone format'
  }
  
  return Object.keys(errors).length > 0 ? errors : null
}
