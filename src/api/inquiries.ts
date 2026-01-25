/**
 * Inquiries API Client v0.69
 * Based on FRONTEND_IMPLEMENTATION_PLAN_v069.md
 * 
 * API методи для роботи з inquiry (встановлення контакту між tutor і student)
 */

import apiClient from '@/api/client'
import type {
  InquiryDTO,
  CreateInquiryPayload,
  CreateInquiryResponse,
  InquiriesListResponse,
  InquiryFilters,
  AcceptInquiryPayload,
  AcceptInquiryResponse,
  RejectInquiryPayload,
  RejectInquiryResponse,
  CancelInquiryPayload,
  CancelInquiryResponse
} from '@/types/inquiries'

const BASE_URL = '/v1/inquiries'

/**
 * Створити inquiry v0.69
 * 
 * @param payload - tutorId, message, clientRequestId (idempotency)
 * @returns створений inquiry
 */
export async function createInquiry(payload: CreateInquiryPayload): Promise<InquiryDTO> {
  // Phase 1 v0.86: Send tutor_id as integer to backend
  const backendPayload = {
    tutor_id: parseInt(payload.tutorId),
    message: payload.message
  }
  const response = await apiClient.post<CreateInquiryResponse>(`${BASE_URL}/`, backendPayload)
  return response.data.inquiry
}

/**
 * Отримати список inquiries з фільтрами v0.69
 * 
 * @param filters - role, status, page, pageSize
 * @returns список inquiries
 */
export async function fetchInquiries(filters: InquiryFilters = {}): Promise<InquiryDTO[]> {
  const response = await apiClient.get<InquiriesListResponse>(`${BASE_URL}/`, {
    params: filters
  })
  return response.data.inquiries
}

/**
 * Скасувати inquiry (cancel) - тільки student (Phase 1 v0.86)
 * 
 * @param inquiryId - ID inquiry
 * @returns response з inquiry та message
 */
export async function cancelInquiry(
  inquiryId: number
): Promise<CancelInquiryResponse> {
  const response = await apiClient.post<CancelInquiryResponse>(
    `${BASE_URL}/${inquiryId}/cancel/`,
    {}
  )
  return response.data
}

/**
 * Прийняти inquiry (accept) - тільки tutor (Phase 1 v0.86)
 * 
 * @param inquiryId - ID inquiry
 * @returns response з inquiry, relation, contacts, thread_id
 */
export async function acceptInquiry(
  inquiryId: number
): Promise<AcceptInquiryResponse> {
  const response = await apiClient.post<AcceptInquiryResponse>(
    `${BASE_URL}/${inquiryId}/accept/`,
    {}
  )
  return response.data
}

/**
 * Відхилити inquiry (reject) - тільки tutor (Phase 1 v0.86)
 * 
 * @param inquiryId - ID inquiry
 * @param payload - reason та optional comment
 * @returns response з inquiry та message
 */
export async function rejectInquiry(
  inquiryId: number,
  payload: RejectInquiryPayload
): Promise<RejectInquiryResponse> {
  const response = await apiClient.post<RejectInquiryResponse>(
    `${BASE_URL}/${inquiryId}/reject/`,
    payload
  )
  return response.data
}

export default {
  createInquiry,
  fetchInquiries,
  cancelInquiry,
  acceptInquiry,
  rejectInquiry
}
