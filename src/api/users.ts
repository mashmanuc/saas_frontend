/**
 * Users API Client v0.62
 * Based on FRONTEND — Технічне завдання v0.62.0.md
 * 
 * API методи для роботи з користувачами та їх контактами
 */

import apiClient from '@/utils/apiClient'
import type { ContactPayload } from '@/types/inquiries'

const BASE_URL = '/v1/users'

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
  getContact
}
