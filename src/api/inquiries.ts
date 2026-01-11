/**
 * Inquiries API Client v0.69
 * Based on FRONTEND_IMPLEMENTATION_PLAN_v069.md
 * 
 * API методи для роботи з inquiry (встановлення контакту між tutor і student)
 */

import axios from 'axios'
import type {
  InquiryDTO,
  CreateInquiryPayload,
  CreateInquiryResponse,
  InquiriesListResponse,
  InquiryFilters,
  InquiryActionPayload,
  CancelInquiryPayload
} from '@/types/inquiries'

const BASE_URL = '/api/v1/people/inquiries'

/**
 * Створити inquiry v0.69
 * 
 * @param payload - tutorId, message, clientRequestId (idempotency)
 * @returns створений inquiry
 */
export async function createInquiry(payload: CreateInquiryPayload): Promise<InquiryDTO> {
  const response = await axios.post<CreateInquiryResponse>(`${BASE_URL}/`, payload)
  return response.data.inquiry
}

/**
 * Отримати список inquiries з фільтрами v0.69
 * 
 * @param filters - role, status, page, pageSize
 * @returns список inquiries
 */
export async function fetchInquiries(filters: InquiryFilters = {}): Promise<InquiryDTO[]> {
  const response = await axios.get<InquiriesListResponse>(`${BASE_URL}/`, {
    params: filters
  })
  return response.data.inquiries
}

/**
 * Скасувати inquiry (cancel) - тільки student v0.69
 * 
 * @param inquiryId - ID inquiry
 * @param payload - clientRequestId (idempotency)
 * @returns оновлений inquiry
 */
export async function cancelInquiry(
  inquiryId: string,
  payload: CancelInquiryPayload
): Promise<InquiryDTO> {
  const response = await axios.post<CreateInquiryResponse>(
    `${BASE_URL}/${inquiryId}/cancel/`,
    payload
  )
  return response.data.inquiry
}

/**
 * Прийняти inquiry (accept) - тільки tutor v0.69
 * 
 * @param inquiryId - ID inquiry
 * @param payload - clientRequestId (idempotency)
 * @returns оновлений inquiry
 */
export async function acceptInquiry(
  inquiryId: string,
  payload: InquiryActionPayload
): Promise<InquiryDTO> {
  const response = await axios.post<CreateInquiryResponse>(
    `${BASE_URL}/${inquiryId}/accept/`,
    payload
  )
  return response.data.inquiry
}

/**
 * Відхилити inquiry (decline) - тільки tutor v0.69
 * 
 * @param inquiryId - ID inquiry
 * @param payload - clientRequestId (idempotency)
 * @returns оновлений inquiry
 */
export async function declineInquiry(
  inquiryId: string,
  payload: InquiryActionPayload
): Promise<InquiryDTO> {
  const response = await axios.post<CreateInquiryResponse>(
    `${BASE_URL}/${inquiryId}/decline/`,
    payload
  )
  return response.data.inquiry
}

export default {
  createInquiry,
  fetchInquiries,
  cancelInquiry,
  acceptInquiry,
  declineInquiry
}
