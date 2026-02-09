/**
 * Trust API Client
 * 
 * DOMAIN-12: Trust & Safety — Block, Report, Bans, Appeals
 * 
 * API methods for trust and safety operations.
 */

import apiClient from '@/utils/apiClient'

// Types
export interface Block {
  id: number
  target_user_id: number
  target_user_name: string
  reason: string
  created_at: string
}

export interface CreateBlockRequest {
  target_user_id: number
  reason?: string
}

export interface Report {
  id: number
  target_type: 'user' | 'inquiry' | 'review' | 'message'
  target_id: number
  category: 'spam' | 'harassment' | 'fraud' | 'inappropriate' | 'other'
  comment: string
  status: 'pending' | 'investigating' | 'resolved' | 'dismissed'
  created_at: string
}

export interface CreateReportRequest {
  target_type: Report['target_type']
  target_id: number
  category: Report['category']
  comment?: string
}

export interface Ban {
  id: number
  scope: 'all' | 'inquiries' | 'messaging' | 'marketplace'
  reason: string
  expires_at: string | null
  is_permanent: boolean
  created_at: string
}

export interface Appeal {
  id: number
  ban_id: number
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  admin_response?: string
  created_at: string
  resolved_at?: string
}

export interface CreateAppealRequest {
  ban_id: number
  reason: string
}

export interface SuspiciousActivity {
  id: number
  timestamp: string
  pattern: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  reviewed: boolean
}

export const trustApi = {
  // Blocks
  getBlockedUsers: (): Promise<Block[]> =>
    apiClient.get('/trust/block/'),

  blockUser: (data: CreateBlockRequest): Promise<Block> =>
    apiClient.post('/trust/block/', data),

  unblockUser: (blockId: number): Promise<void> =>
    apiClient.delete(`/trust/block/${blockId}/`),

  // Reports
  createReport: (data: CreateReportRequest): Promise<Report> =>
    apiClient.post('/trust/report/', data),

  getMyReports: (): Promise<Report[]> =>
    apiClient.get('/trust/reports/me/'),

  // Bans
  getActiveBans: (): Promise<Ban[]> =>
    apiClient.get('/trust/bans/'),

  // Appeals
  getMyAppeals: (): Promise<Appeal[]> =>
    apiClient.get('/trust/appeals/me/'),

  createAppeal: (data: CreateAppealRequest): Promise<Appeal> =>
    apiClient.post(`/trust/bans/${data.ban_id}/appeal/`, { reason: data.reason }),

  withdrawAppeal: (appealId: number): Promise<void> =>
    apiClient.delete(`/trust/appeals/${appealId}/`),

  // Suspicious Activity (admin/staff only)
  getSuspiciousActivity: (params?: { from?: string; to?: string; severity?: string }): Promise<SuspiciousActivity[]> =>
    apiClient.get('/trust/suspicious-activity/', { params }),

  markActivityReviewed: (activityId: number): Promise<void> =>
    apiClient.post(`/trust/suspicious-activity/${activityId}/reviewed/`),
}

export default trustApi
