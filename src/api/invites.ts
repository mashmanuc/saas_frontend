/**
 * TutorInvite API Client
 * 
 * API методи для роботи з tutor invites (invite-based student onboarding)
 */

import apiClient from '@/api/client'
import type {
  InviteDTO,
  CreateInviteResponse,
  InviteDetailResponse,
  AcceptInviteResponse,
  InvitesListResponse,
  InviteFilters
} from '@/types/invites'

const BASE_URL = '/api/v1'

/**
 * Створити invite (tutor only)
 * 
 * @returns створений invite
 */
export async function createInvite(): Promise<InviteDTO> {
  const response = await apiClient.post<CreateInviteResponse>(`${BASE_URL}/tutor/invites/create/`)
  return response
}

/**
 * Отримати деталі invite по токену (public endpoint)
 * 
 * @param token - invite token
 * @returns деталі invite
 */
export async function getInviteDetail(token: string): Promise<InviteDTO> {
  const response = await apiClient.get<InviteDetailResponse>(`${BASE_URL}/invites/${token}/`)
  return response
}

/**
 * Прийняти invite (student)
 * 
 * @param token - invite token
 * @returns результат прийняття
 */
export async function acceptInvite(token: string): Promise<InviteDTO> {
  const response = await apiClient.post<AcceptInviteResponse>(`${BASE_URL}/invites/${token}/accept/`)
  return response
}

/**
 * Скасувати invite (tutor only)
 * 
 * @param publicId - invite public_id (UUID)
 * @returns оновлений invite
 */
export async function cancelInvite(publicId: string): Promise<InviteDTO> {
  const response = await apiClient.post<InviteDTO>(`${BASE_URL}/tutor/invites/${publicId}/cancel/`)
  return response
}

/**
 * Отримати список invites (tutor only)
 * 
 * @param filters - фільтри (status)
 * @returns список invites
 */
export async function fetchInvites(filters: InviteFilters = {}): Promise<InviteDTO[]> {
  const response = await apiClient.get<InvitesListResponse>(`${BASE_URL}/tutor/invites/`, {
    params: filters
  })
  return response.results
}

export const invitesApi = {
  createInvite,
  getInviteDetail,
  acceptInvite,
  cancelInvite,
  fetchInvites
}

export default invitesApi
