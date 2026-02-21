/**
 * Staff Stats API v0.90.0
 *
 * Endpoints for dashboard KPI and billing summary.
 */
import apiClient from '@/utils/apiClient'

export interface StatsOverviewUsers {
  total: number
  students: number
  tutors: number
  staff: number
  new_7d: number
  new_30d: number
}

export interface StatsOverviewBilling {
  active_subscriptions: number
  pro_count: number
  business_count: number
  trial_active: number
  pending_sessions: number
}

export interface StatsOverviewTrust {
  open_reports: number
  active_bans: number
  suspicious_open: number
}

export interface StatsOverviewActivity {
  active_tutors: number
  inactive_tutors: number
  exempted_tutors: number
}

export interface StatsOverview {
  users: StatsOverviewUsers
  billing: StatsOverviewBilling
  trust: StatsOverviewTrust
  activity: StatsOverviewActivity
}

export interface PendingCheckout {
  order_id: string
  user_email: string
  plan: string
  pending_age_seconds: number
  created_at: string
}

export interface RecentPayment {
  id: string
  user_email: string
  amount: number
  currency: string
  payment_status: string
  created_at: string
}

export interface StatsBilling {
  subscriptions_by_plan: Record<string, number>
  subscriptions_by_status: Record<string, number>
  pending_checkouts: PendingCheckout[]
  recent_payments: RecentPayment[]
}

const staffStatsApi = {
  async getStatsOverview(): Promise<StatsOverview> {
    const res = await apiClient.get('/v1/staff/stats/overview/', {
      meta: { skipLoader: true },
    } as any)
    return res as unknown as StatsOverview
  },

  async getStatsBilling(): Promise<StatsBilling> {
    const res = await apiClient.get('/v1/staff/stats/billing/', {
      meta: { skipLoader: true },
    } as any)
    return res as unknown as StatsBilling
  },
}

export default staffStatsApi
