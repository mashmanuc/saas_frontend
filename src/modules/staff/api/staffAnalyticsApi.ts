/**
 * Staff Analytics API v0.92.0
 *
 * Endpoints for funnel analytics dashboard.
 */
import apiClient from '@/utils/apiClient'

export interface FunnelSnapshotItem {
  id: string
  period: 'daily' | 'weekly' | 'monthly'
  period_start: string
  period_end: string
  role: string
  registered: number
  email_verified: number
  first_login: number
  onboarding_started: number
  onboarding_completed: number
  profile_saved: number
  profile_published: number
  first_inquiry_sent: number
  extra_metrics: Record<string, unknown>
  computed_at: string
}

export interface FunnelSnapshotResponse {
  period: string
  role: string
  count: number
  results: FunnelSnapshotItem[]
}

export interface FunnelRealtimeRoleData {
  registered: number
  email_verified: number
  first_login: number
  onboarding_started: number
  onboarding_completed: number
  profile_saved: number
  profile_published: number
  first_inquiry_sent: number
}

export interface FunnelRealtimeResponse {
  date: string
  data: Record<string, FunnelRealtimeRoleData>
}

export interface DropoffStep {
  from_step: string
  to_step: string
  from_count: number
  to_count: number
  conversion_rate: number
  drop_rate: number
}

export interface FunnelDropoffResponse {
  period: string
  role: string
  days: number
  totals: Record<string, number>
  dropoff: DropoffStep[]
}

export interface FunnelSnapshotParams {
  period?: 'daily' | 'weekly' | 'monthly'
  role?: 'ALL' | 'TUTOR' | 'STUDENT'
  days?: number
}

export interface FunnelDropoffParams {
  period?: 'daily' | 'weekly' | 'monthly'
  role?: 'ALL' | 'TUTOR' | 'STUDENT'
  days?: number
}

const staffAnalyticsApi = {
  async getFunnelSnapshots(params?: FunnelSnapshotParams): Promise<FunnelSnapshotResponse> {
    const res = await apiClient.get('/v1/staff/analytics/funnel/', {
      params,
      meta: { skipLoader: true },
    } as any)
    return res as unknown as FunnelSnapshotResponse
  },

  async getFunnelRealtime(): Promise<FunnelRealtimeResponse> {
    const res = await apiClient.get('/v1/staff/analytics/funnel/realtime/', {
      meta: { skipLoader: true },
    } as any)
    return res as unknown as FunnelRealtimeResponse
  },

  async getFunnelDropoff(params?: FunnelDropoffParams): Promise<FunnelDropoffResponse> {
    const res = await apiClient.get('/v1/staff/analytics/funnel/dropoff/', {
      params,
      meta: { skipLoader: true },
    } as any)
    return res as unknown as FunnelDropoffResponse
  },
}

export default staffAnalyticsApi
