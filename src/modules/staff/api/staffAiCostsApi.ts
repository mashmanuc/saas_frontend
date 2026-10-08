/**
 * Staff: облік витрат на ШІ (власник 2026-10-08; ТЗ saas_docs/domains/billing/AI_COST_METER_TZ_2026-10-08.md).
 * Бекенд — apps/staff/api/ai_costs_views.py. Суми — рядки Decimal у доларах (мікродолари), щоб не губити точність.
 * Сума за журналом — ОЦІНКА за прайсом, не рахунок; рахунок OpenAI — окремо, у звірці.
 */
import apiClient from '@/utils/apiClient'

export interface AiCostGroup {
  cost_usd: string
  calls: number
  unknown_cost_calls: number
}

export interface AiCostBreakdownRow extends AiCostGroup {
  purpose?: string
  provider?: string
  model?: string
  /** З цієї суми — ваші тести */
  internal_cost_usd: string
}

export interface AiCostTeacherRow extends AiCostGroup {
  user_id: number
  email: string
}

export interface AiCostDay {
  date: string
  cost_usd: string
  teachers_cost_usd: string
  internal_cost_usd: string
  calls: number
  unknown_cost_calls: number
}

export interface AiCostReconciliationRow {
  date: string
  journal_usd: string
  /** null — рахунку за цю добу ще немає */
  billed_usd: string | null
  diff_usd: string | null
  flagged: boolean
}

export interface AiCostAlert {
  code: 'spike' | 'unknown_cost' | 'reconciliation_mismatch' | string
  message: string
  params?: Record<string, string | number>
}

export interface AiCostReport {
  period: { from: string; to: string; timezone: string }
  price: { version: string; source: string; verified_on: string | null; cached_input_upper_bound: boolean }
  totals: { all: AiCostGroup; teachers: AiCostGroup; internal: AiCostGroup; no_owner: AiCostGroup }
  unknown_cost_calls: number
  by_purpose: AiCostBreakdownRow[]
  by_model: AiCostBreakdownRow[]
  top_teachers: AiCostTeacherRow[]
  teacher_stats: { active: number; avg_usd: string | null; p95_usd: string | null }
  daily: AiCostDay[]
  reconciliation: {
    rows: AiCostReconciliationRow[]
    days_billed: number
    journal_usd: string
    billed_usd: string | null
    diff_usd: string | null
    admin_key_configured: boolean
  }
  alerts: AiCostAlert[]
}

export function getAiCosts(from: string, to: string): Promise<AiCostReport> {
  return apiClient.get('/v1/staff/stats/ai-costs/', { params: { from, to } })
}
