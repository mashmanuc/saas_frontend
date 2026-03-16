// Phase 15 A2.1: Analytics API client — tutor stats, views timeseries, achievements
// Authenticated endpoints → apiClient.
// Ref: AGENT_A_FE_CORE.md A2.1

import apiClient from '@/utils/apiClient'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TutorStats {
  lessons_count: number
  total_views: number
  total_forks: number
  total_clones: number
  average_rating: number | null
  top_lessons: Array<{
    id: string
    title: string
    slug: string
    views: number
    forks: number
    avg_rating: number | null
  }>
}

export interface ViewsDataPoint {
  date: string  // YYYY-MM-DD
  views_count: number
}

export interface TutorAchievement {
  achievement_type: string
  display_name: string
  description: string
  icon: string
  earned_at: string | null    // null = locked
  progress: number | null     // 0-100%, null if earned
  metadata: Record<string, unknown>
}

// ─── API ────────────────────────────────────────────────────────────────────

export const analyticsApi = {
  /**
   * GET /api/v1/knowledge/my/analytics/
   * Tutor stats summary: lesson count, views, forks, clones, avg rating, top lessons.
   */
  async getMyStats(): Promise<TutorStats> {
    const res = await apiClient.get('/v1/knowledge/my/analytics/')
    return res as TutorStats
  },

  /**
   * GET /api/v1/knowledge/my/analytics/views/?days=30
   * Views timeseries for the given period.
   */
  async getViewsTimeseries(days: number = 30): Promise<ViewsDataPoint[]> {
    const res = await apiClient.get(`/v1/knowledge/my/analytics/views/?days=${days}`)
    return res as ViewsDataPoint[]
  },

  /**
   * GET /api/v1/knowledge/my/achievements/
   * Tutor achievements list (earned + locked).
   */
  async getMyAchievements(): Promise<TutorAchievement[]> {
    const res = await apiClient.get('/v1/knowledge/my/achievements/')
    return res as TutorAchievement[]
  },
}
