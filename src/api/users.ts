/**
 * Users API Client v1.0
 * Based on USERS_FRONTEND_TECH_TASKS.md
 * 
 * API методи для роботи з користувачами, профілями, налаштуваннями та контактами
 */

import apiClient from '@/utils/apiClient'
import type { ContactPayload } from '@/types/inquiries'

const BASE_URL = '/v1/users'

export interface UserProfile {
  id: string
  email: string
  first_name: string
  last_name: string
  display_name?: string  // P0.1: Privacy-safe name (format: "FirstName L.")
  full_name?: string     // P0.1: Full name when contact access granted
  role: string
  avatar_url?: string
  email_verified: boolean
  timezone?: string
}

export interface TutorProfile {
  bio?: string
  headline?: string
  experience?: number
  hourly_rate?: number
  currency?: string
  is_published?: boolean
  subjects?: string[]
  certifications?: any[]
}

export interface StudentProfile {
  learning_goals?: string
  preferred_subjects?: string[]
  budget_min?: number
  budget_max?: number
  phone: string  // Phase 1: Обов'язкове поле для контакту після Accept
  telegram_username?: string  // Phase 1: Опціональне поле для контакту
}

export interface UserSettings {
  language?: string
  timezone?: string
  dark_mode?: boolean
  email_notifications?: boolean
  sms_notifications?: boolean
}

export interface ProfileResponse {
  user: UserProfile
  tutor_profile?: TutorProfile
  student_profile?: StudentProfile
  settings?: UserSettings
  avatar_url?: string
}

export interface RoleHistoryEntry {
  id: string
  old_role: string
  new_role: string
  changed_by: string
  changed_at: string
  reason?: string
}

/**
 * Отримати повний профіль поточного користувача
 */
export async function getMyProfile(): Promise<ProfileResponse> {
  return apiClient.get('/v1/me')
}

/**
 * Оновити профіль поточного користувача
 */
export async function updateMyProfile(payload: Partial<TutorProfile | StudentProfile>): Promise<ProfileResponse> {
  return apiClient.patch('/v1/me', payload)
}

/**
 * Отримати публічний профіль тьютора
 */
export async function getTutorProfile(userId: string): Promise<ProfileResponse> {
  return apiClient.get(`${BASE_URL}/${userId}/`)
}

/**
 * Опублікувати профіль тьютора
 */
export async function publishTutorProfile(): Promise<ProfileResponse> {
  return apiClient.post(`${BASE_URL}/me/publish/`)
}

/**
 * Зберегти чернетку профілю
 */
export async function saveTutorDraft(payload: Partial<TutorProfile>): Promise<any> {
  return apiClient.post(`${BASE_URL}/me/draft/`, payload)
}

/**
 * Отримати налаштування користувача
 */
export async function getUserSettings(): Promise<UserSettings> {
  return apiClient.get(`${BASE_URL}/me/settings/`)
}

/**
 * Оновити налаштування користувача
 */
export async function updateUserSettings(payload: Partial<UserSettings>): Promise<UserSettings> {
  return apiClient.patch(`${BASE_URL}/me/settings/`, payload)
}

/**
 * Завантажити аватар
 */
export async function uploadAvatar(file: File): Promise<{ avatar_url: string }> {
  const formData = new FormData()
  formData.append('avatar', file)
  return apiClient.post(`${BASE_URL}/me/avatar/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

/**
 * Видалити аватар
 */
export async function deleteAvatar(): Promise<void> {
  return apiClient.delete(`${BASE_URL}/me/avatar/`)
}

/**
 * Повторно надіслати email верифікації
 */
export async function resendVerificationEmail(): Promise<{ message: string }> {
  return apiClient.post(`${BASE_URL}/me/verify-email/resend/`)
}

/**
 * Архівувати акаунт користувача (soft delete)
 * @param password - пароль для підтвердження
 * @param reason - причина архівування (опціонально)
 */
export async function archiveAccount(password: string, reason: string = 'user_request'): Promise<{
  status: string
  message: string
  archived_at: string
  email_suffix: string
}> {
  return apiClient.post(`${BASE_URL}/me/archive`, { password, reason })
}

/**
 * Архівувати акаунт користувача (admin endpoint)
 * @param userId - ID користувача для архівування
 * @param reason - причина архівування
 * @param notes - додаткові нотатки
 */
export async function adminArchiveUser(userId: number, reason: string = 'admin_action', notes?: string): Promise<{
  status: string
  message: string
  user_id: number
  archived_at: string
}> {
  return apiClient.post(`${BASE_URL}/admin/users/${userId}/archive`, { reason, notes })
}

/**
 * @deprecated Використовуйте archiveAccount замість цього
 */
export async function deleteAccount(password: string): Promise<void> {
  return archiveAccount(password).then(() => undefined)
}

/**
 * Експортувати дані користувача (GDPR)
 */
export async function exportUserData(): Promise<Blob> {
  return apiClient.get(`${BASE_URL}/me/export/`, { responseType: 'blob' })
}

/**
 * Отримати історію змін ролей (admin only)
 */
export async function getRoleHistory(userId: string): Promise<RoleHistoryEntry[]> {
  return apiClient.get(`${BASE_URL}/${userId}/role-history/`)
}

/**
 * Отримати контактні дані користувача
 * Завжди повертає структуру з null + locked_reason якщо доступ заборонено
 * 
 * @param userId - ID користувача
 * @returns контактні дані або locked payload
 */
export async function getContact(userId: string): Promise<ContactPayload> {
  return apiClient.get(`${BASE_URL}/${userId}/contact/`)
}

export default {
  getMyProfile,
  updateMyProfile,
  getTutorProfile,
  publishTutorProfile,
  saveTutorDraft,
  getUserSettings,
  updateUserSettings,
  uploadAvatar,
  deleteAvatar,
  resendVerificationEmail,
  archiveAccount,
  adminArchiveUser,
  deleteAccount,
  exportUserData,
  getRoleHistory,
  getContact
}
