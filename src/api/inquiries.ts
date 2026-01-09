/**
 * Inquiries API Client v0.62
 * Based on FRONTEND — Технічне завдання v0.62.0.md
 * 
 * API методи для роботи з inquiry (переговори між tutor і student)
 */

import axios from 'axios'
import type {
  InquiryDTO,
  CreateInquiryPayload,
  CreateInquiryResponse,
  InquiriesListResponse
} from '@/types/inquiries'

const BASE_URL = '/api/v1/inquiries'

/**
 * Створити inquiry (запит на доступ до контактів)
 * 
 * @param payload - relation_id та message
 * @returns створений inquiry
 */
export async function createInquiry(payload: CreateInquiryPayload): Promise<InquiryDTO> {
  const response = await axios.post<CreateInquiryResponse>(`${BASE_URL}/`, payload)
  return response.data.inquiry
}

/**
 * Отримати список inquiries для конкретного relation
 * 
 * @param relationId - ID relation
 * @returns список inquiries
 */
export async function listInquiries(relationId: string): Promise<InquiryDTO[]> {
  const response = await axios.get<InquiriesListResponse>(`${BASE_URL}/`, {
    params: { relation_id: relationId }
  })
  return response.data.inquiries
}

/**
 * Прийняти inquiry (accept)
 * 
 * @param inquiryId - ID inquiry
 * @returns оновлений inquiry
 */
export async function acceptInquiry(inquiryId: string): Promise<InquiryDTO> {
  const response = await axios.post<CreateInquiryResponse>(`${BASE_URL}/${inquiryId}/accept/`)
  return response.data.inquiry
}

/**
 * Відхилити inquiry (reject)
 * 
 * @param inquiryId - ID inquiry
 * @returns оновлений inquiry
 */
export async function rejectInquiry(inquiryId: string): Promise<InquiryDTO> {
  const response = await axios.post<CreateInquiryResponse>(`${BASE_URL}/${inquiryId}/reject/`)
  return response.data.inquiry
}

export default {
  createInquiry,
  listInquiries,
  acceptInquiry,
  rejectInquiry
}
