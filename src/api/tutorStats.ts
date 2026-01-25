/**
 * Tutor Stats API Client - Phase 3 F3.1
 * 
 * API методи для роботи з детальною статистикою тьютора
 */

import apiClient from '@/api/client'

export interface DailyBreakdown {
  date: string
  total: number
  accepted: number
  rejected: number
  expired: number
}

export interface SubjectBreakdown {
  subject__name: string
  count: number
}

export interface DetailedStatsResponse {
  summary: {
    response_rate: number
    acceptance_rate: number
    total_inquiries: number
    contacts_spent: number
  }
  daily_breakdown: DailyBreakdown[]
  subject_breakdown: SubjectBreakdown[]
  budget_distribution: any[]
  period_days: number
}

/**
 * Отримати детальну статистику тьютора (Phase 3 F3.1)
 * 
 * @param period - період у днях (7, 30, 90)
 * @returns детальна статистика з summary, daily_breakdown, subject_breakdown
 */
export async function getDetailedStats(period: number = 30): Promise<DetailedStatsResponse> {
  const response = await apiClient.get<DetailedStatsResponse>(
    '/v1/tutors/stats/detailed/',
    { params: { period } }
  )
  return response
}

export default {
  getDetailedStats
}
