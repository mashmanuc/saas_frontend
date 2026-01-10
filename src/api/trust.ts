/**
 * Trust & Safety API Client v0.66.0
 * 
 * API methods for trust & safety features:
 * - Block/unblock users
 * - Create reports
 * - Get trust status
 */

import axios from 'axios'
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

const BASE_URL = '/api/v1/trust'

/**
 * Block a user
 */
export async function blockUser(payload: BlockUserRequest): Promise<BlockResponse> {
  const response = await axios.post<BlockResponse>(`${BASE_URL}/block/`, payload)
  return response.data
}

/**
 * Unblock a user
 */
export async function unblockUser(payload: UnblockUserRequest): Promise<BlockResponse> {
  const response = await axios.post<BlockResponse>(`${BASE_URL}/unblock/`, payload)
  return response.data
}

/**
 * Get list of user's blocks
 */
export async function getBlocks(): Promise<BlocksListResponse> {
  const response = await axios.get<BlocksListResponse>(`${BASE_URL}/blocks/me/`)
  return response.data
}

/**
 * Create a report
 */
export async function createReport(payload: CreateReportRequest): Promise<CreateReportResponse> {
  const response = await axios.post<CreateReportResponse>(`${BASE_URL}/report/`, payload)
  return response.data
}

/**
 * Get list of user's reports
 */
export async function getReports(): Promise<ReportsListResponse> {
  const response = await axios.get<ReportsListResponse>(`${BASE_URL}/reports/me/`)
  return response.data
}

/**
 * Get user's ban status
 */
export async function getBanStatus(): Promise<BanStatusResponse> {
  const response = await axios.get<BanStatusResponse>(`${BASE_URL}/me/status/`)
  return response.data
}

export const trustApi = {
  blockUser,
  unblockUser,
  getBlocks,
  createReport,
  getReports,
  getBanStatus,
}
