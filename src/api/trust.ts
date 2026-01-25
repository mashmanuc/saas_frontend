/**
 * Trust & Safety API Client v0.66.0
 * 
 * API methods for trust & safety features:
 * - Block/unblock users
 * - Create reports
 * - Get trust status
 */

import apiClient from '@/utils/apiClient'
import type {
  BlockUserRequest,
  UnblockUserRequest,
  BlockResponse,
  BlocksListResponse,
  CreateReportRequest,
  CreateReportResponse,
  ReportsListResponse,
  BanStatusResponse,
} from '@/types/trust'

const BASE_URL = '/v1/trust'

/**
 * Block a user
 */
export async function blockUser(payload: BlockUserRequest): Promise<BlockResponse> {
  return apiClient.post(`${BASE_URL}/block/`, payload)
}

/**
 * Unblock a user
 */
export async function unblockUser(payload: UnblockUserRequest): Promise<BlockResponse> {
  return apiClient.post(`${BASE_URL}/unblock/`, payload)
}

/**
 * Get list of user's blocks
 */
export async function getBlocks(): Promise<BlocksListResponse> {
  return apiClient.get(`${BASE_URL}/blocks/me/`)
}

/**
 * Create a report
 */
export async function createReport(payload: CreateReportRequest): Promise<CreateReportResponse> {
  return apiClient.post(`${BASE_URL}/report/`, payload)
}

/**
 * Get list of user's reports
 */
export async function getReports(): Promise<ReportsListResponse> {
  return apiClient.get(`${BASE_URL}/reports/me/`)
}

/**
 * Get user's ban status
 */
export async function getBanStatus(): Promise<BanStatusResponse> {
  return apiClient.get(`${BASE_URL}/me/status/`)
}

export const trustApi = {
  blockUser,
  unblockUser,
  getBlocks,
  createReport,
  getReports,
  getBanStatus,
}
