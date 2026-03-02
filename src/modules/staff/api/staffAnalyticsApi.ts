/**
 * Staff Analytics API v0.99.0
 *
 * Endpoints for funnel analytics dashboard + alerts + cohort analysis + user journey + engagement + revenue + marketplace health + experiments.
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

// ── Alert types (Phase 5.1) ──

export interface FunnelAlert {
  id: string
  alert_type: string
  severity: 'info' | 'warning' | 'critical'
  status: 'active' | 'acknowledged' | 'resolved'
  title: string
  description: string
  funnel_step: string
  role: string
  current_value: number | null
  expected_value: number | null
  threshold: number | null
  metadata: Record<string, unknown>
  created_at: string
  acknowledged_at: string | null
  acknowledged_by_email: string | null
  resolved_at: string | null
}

export interface FunnelAlertsResponse {
  count: number
  active_count: number
  results: FunnelAlert[]
}

export interface FunnelAlertsParams {
  status?: 'active' | 'acknowledged' | 'resolved'
  severity?: 'info' | 'warning' | 'critical'
  limit?: number
}

// ── Cohort types (Phase 5.2) ──

export interface CohortSnapshotItem {
  id: string
  cohort_type: 'reg_week' | 'reg_month'
  cohort_key: string
  role: string
  cohort_size: number
  day_1_verified: number
  day_1_login: number
  day_3_onboarding: number
  day_7_published: number
  day_14_inquiry: number
  day_30_active: number
  metrics: Record<string, unknown>
  computed_at: string
  pct_day_1_verified: number
  pct_day_1_login: number
  pct_day_3_onboarding: number
  pct_day_7_published: number
  pct_day_14_inquiry: number
  pct_day_30_active: number
}

export interface CohortAnalysisResponse {
  cohort_type: string
  role: string
  count: number
  milestones: string[]
  results: CohortSnapshotItem[]
}

export interface CohortAnalysisParams {
  type?: 'reg_week' | 'reg_month'
  role?: 'ALL' | 'TUTOR' | 'STUDENT'
  weeks?: number
}

// ── User Journey types (Phase 6.1) ──

export interface JourneyEvent {
  action: string
  timestamp: string
  time_since_prev: string | null
  metadata: Record<string, unknown>
}

export interface UserJourneyResponse {
  user_id: number
  user_email: string
  user_role: string
  registered_at: string
  current_funnel_step: string | null
  days_since_registration: number
  days_stuck: number
  journey: JourneyEvent[]
  missing_steps: string[]
  recommendations: string[]
}

export interface UserJourneyParams {
  limit?: number
  actions?: 'funnel' | 'all'
}

// ── Engagement Score types (Phase 6.2) ──

export type EngagementSegment = 'champion' | 'loyal' | 'potential' | 'at_risk' | 'hibernating'

export interface EngagementItem {
  user_id: number
  user_email: string
  user_role: string
  score: number
  segment: EngagementSegment
  frequency_score: number
  recency_score: number
  depth_score: number
  consistency_score: number
  login_count_30d: number
  action_count_30d: number
  active_days_30d: number
  last_activity_at: string | null
  computed_at: string
}

export interface EngagementListResponse {
  total: number
  page: number
  page_size: number
  results: EngagementItem[]
}

export interface EngagementListParams {
  segment?: EngagementSegment
  role?: 'TUTOR' | 'STUDENT' | 'ALL'
  sort?: 'score' | '-score'
  page?: number
  page_size?: number
}

export interface SegmentInfo {
  count: number
  percent: number
}

export interface EngagementSummaryResponse {
  total_users: number
  segments: Record<EngagementSegment, { count: number; percent: number }>
  avg_score: number
  trend: string
}

// ── Revenue (Phase 7.1) ──

export interface RevenueSnapshotItem {
  id: string
  period: 'daily' | 'weekly' | 'monthly'
  period_start: string
  period_end: string
  total_revenue: number
  new_subscriptions: number
  churned_subscriptions: number
  active_subscriptions: number
  trial_starts: number
  trial_conversions: number
  avg_revenue_per_user: number
  revenue_breakdown: Record<string, number>
  computed_at: string | null
}

export interface RevenueSummary {
  total_revenue: number
  avg_daily_revenue: number
  total_new_subs: number
  total_churned: number
  net_subs: number
  current_active_subs: number
}

export interface RevenueListResponse {
  results: RevenueSnapshotItem[]
  total: number
  page: number
  page_size: number
  summary: RevenueSummary
}

export interface RevenueListParams {
  period?: 'daily' | 'weekly' | 'monthly'
  days?: number
  page?: number
  page_size?: number
}

// ── Marketplace Health (Phase 7.2) ──

export interface MarketplaceHealthItem {
  id: string
  period_start: string
  period_end: string
  total_tutors: number
  published_tutors: number
  active_tutors_7d: number
  total_students: number
  active_students_7d: number
  inquiries_created: number
  inquiries_accepted: number
  avg_time_to_first_inquiry_hours: number | null
  avg_time_to_accept_hours: number | null
  repeat_inquiry_rate: number
  supply_demand_ratio: number
  subject_breakdown: Record<string, { tutors: number; ratio: number }>
  computed_at: string | null
}

export interface MarketplaceHealthSummary {
  total_tutors: number
  published_tutors: number
  active_tutors_7d: number
  total_students: number
  active_students_7d: number
  supply_demand_ratio: number
  accept_rate: number
}

export interface MarketplaceHealthResponse {
  results: MarketplaceHealthItem[]
  total: number
  page: number
  page_size: number
  summary: MarketplaceHealthSummary
}

export interface MarketplaceHealthParams {
  days?: number
  page?: number
  page_size?: number
}

// ── Experiments (Phase 8) ──

export interface ExperimentVariant {
  name: string
  weight: number
  flag_value: boolean | string
}

export interface ExperimentItem {
  id: string
  name: string
  description: string
  hypothesis: string
  flag_name: string
  status: 'draft' | 'running' | 'paused' | 'completed' | 'cancelled'
  traffic_percentage: number
  variants: ExperimentVariant[]
  success_metric: string
  secondary_metrics: string[]
  started_at: string | null
  ended_at: string | null
  results: Record<string, any>
  created_by: number | null
  created_at: string
  updated_at: string
  assignment_count: number
}

export interface ExperimentListResponse {
  results: ExperimentItem[]
  total: number
  page: number
  page_size: number
}

export interface ExperimentListParams {
  status?: string
  page?: number
  page_size?: number
}

export interface CreateExperimentPayload {
  name: string
  flag_name: string
  success_metric: string
  description?: string
  hypothesis?: string
  traffic_percentage?: number
  variants?: ExperimentVariant[]
  secondary_metrics?: string[]
}

export interface ExperimentVariantResult {
  assigned: number
  converted: number
  rate: number
}

export interface ExperimentResults {
  variants: Record<string, ExperimentVariantResult>
  primary_metric: string
  chi_squared: {
    statistic: number
    p_value: number
    significant: boolean
    df: number
  } | null
  winner: string | null
  secondary_metrics: Record<string, Record<string, { converted: number; rate: number }>>
  computed_at: string
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

  // ── Alerts (Phase 5.1) ──

  async getAlerts(params?: FunnelAlertsParams): Promise<FunnelAlertsResponse> {
    const res = await apiClient.get('/v1/staff/analytics/alerts/', {
      params,
      meta: { skipLoader: true },
    } as any)
    return res as unknown as FunnelAlertsResponse
  },

  async acknowledgeAlert(alertId: string): Promise<{ id: string; status: string; acknowledged_at: string }> {
    const res = await apiClient.post(`/v1/staff/analytics/alerts/${alertId}/ack/`)
    return res as unknown as { id: string; status: string; acknowledged_at: string }
  },

  async resolveAlert(alertId: string): Promise<{ id: string; status: string; resolved_at: string }> {
    const res = await apiClient.post(`/v1/staff/analytics/alerts/${alertId}/resolve/`)
    return res as unknown as { id: string; status: string; resolved_at: string }
  },

  // ── Cohorts (Phase 5.2) ──

  async getCohorts(params?: CohortAnalysisParams): Promise<CohortAnalysisResponse> {
    const res = await apiClient.get('/v1/staff/analytics/cohorts/', {
      params,
      meta: { skipLoader: true },
    } as any)
    return res as unknown as CohortAnalysisResponse
  },

  // ── User Journey (Phase 6.1) ──

  async getUserJourney(userId: number | string, params?: UserJourneyParams): Promise<UserJourneyResponse> {
    const res = await apiClient.get(`/v1/staff/analytics/user-journey/${userId}/`, {
      params,
      meta: { skipLoader: true },
    } as any)
    return res as unknown as UserJourneyResponse
  },

  // ── Engagement Scores (Phase 6.2) ──

  async getEngagement(params?: EngagementListParams): Promise<EngagementListResponse> {
    const res = await apiClient.get('/v1/staff/analytics/engagement/', {
      params,
      meta: { skipLoader: true },
    } as any)
    return res as unknown as EngagementListResponse
  },

  async getEngagementSummary(): Promise<EngagementSummaryResponse> {
    const res = await apiClient.get('/v1/staff/analytics/engagement/summary/', {
      meta: { skipLoader: true },
    } as any)
    return res as unknown as EngagementSummaryResponse
  },

  // ── Revenue (Phase 7.1) ──

  async getRevenue(params?: RevenueListParams): Promise<RevenueListResponse> {
    const res = await apiClient.get('/v1/staff/analytics/revenue/', {
      params,
      meta: { skipLoader: true },
    } as any)
    return res as unknown as RevenueListResponse
  },

  // ── Marketplace Health (Phase 7.2) ──

  async getMarketplaceHealth(params?: MarketplaceHealthParams): Promise<MarketplaceHealthResponse> {
    const res = await apiClient.get('/v1/staff/analytics/marketplace-health/', {
      params,
      meta: { skipLoader: true },
    } as any)
    return res as unknown as MarketplaceHealthResponse
  },

  // ── Experiments (Phase 8) ──

  async getExperiments(params?: ExperimentListParams): Promise<ExperimentListResponse> {
    const res = await apiClient.get('/v1/staff/analytics/experiments/', {
      params,
      meta: { skipLoader: true },
    } as any)
    return res as unknown as ExperimentListResponse
  },

  async createExperiment(payload: CreateExperimentPayload): Promise<ExperimentItem> {
    const res = await apiClient.post('/v1/staff/analytics/experiments/', payload)
    return res as unknown as ExperimentItem
  },

  async getExperimentDetail(id: string): Promise<ExperimentItem> {
    const res = await apiClient.get(`/v1/staff/analytics/experiments/${id}/`, {
      meta: { skipLoader: true },
    } as any)
    return res as unknown as ExperimentItem
  },

  async startExperiment(id: string): Promise<ExperimentItem> {
    const res = await apiClient.post(`/v1/staff/analytics/experiments/${id}/start/`)
    return res as unknown as ExperimentItem
  },

  async stopExperiment(id: string): Promise<ExperimentItem> {
    const res = await apiClient.post(`/v1/staff/analytics/experiments/${id}/stop/`)
    return res as unknown as ExperimentItem
  },

  async getExperimentResults(id: string, recompute = false): Promise<ExperimentResults> {
    const res = await apiClient.get(`/v1/staff/analytics/experiments/${id}/results/`, {
      params: { recompute: recompute ? 'true' : 'false' },
      meta: { skipLoader: true },
    } as any)
    return res as unknown as ExperimentResults
  },
}

export default staffAnalyticsApi
