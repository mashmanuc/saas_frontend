/**
 * Staff Subscription Plans API v0.91.0
 *
 * SUPERADMIN-only CRUD for subscription plans.
 * Backend: GET/POST/PATCH/DELETE /api/v1/staff/subscription-plans/
 */
import apiClient from '@/utils/apiClient'

const BASE = '/v1/staff/subscription-plans'

export interface PlanItem {
  id: number
  name: string
  slug: string
  description: string
  title_uk: string
  description_uk: string
  price: number
  price_decimal: number
  currency: 'UAH' | 'USD'
  interval: 'monthly' | 'quarterly' | 'yearly'
  lessons_per_month: number
  features: string[]
  provider: string
  provider_price_id: string
  provider_product_id: string
  is_active: boolean
  is_featured: boolean
  display_order: number
  created_at: string
  updated_at: string
}

export interface PlanListResponse {
  results: PlanItem[]
  count: number
}

export interface PlanCreatePayload {
  name: string
  slug: string
  description?: string
  title_uk?: string
  description_uk?: string
  price: number
  currency?: 'UAH' | 'USD'
  interval?: 'monthly' | 'quarterly' | 'yearly'
  lessons_per_month?: number
  features?: string[]
  provider?: string
  provider_price_id?: string
  provider_product_id?: string
  is_active?: boolean
  is_featured?: boolean
  display_order?: number
}

export type PlanUpdatePayload = Partial<PlanCreatePayload>

export async function getSubscriptionPlans(): Promise<PlanListResponse> {
  const res = await apiClient.get(`${BASE}/`)
  return { results: res.results || [], count: res.count || 0 }
}

export async function getSubscriptionPlan(id: number): Promise<PlanItem> {
  return apiClient.get(`${BASE}/${id}/`)
}

export async function createSubscriptionPlan(data: PlanCreatePayload): Promise<PlanItem> {
  return apiClient.post(`${BASE}/`, data)
}

export async function updateSubscriptionPlan(id: number, data: PlanUpdatePayload): Promise<PlanItem> {
  return apiClient.patch(`${BASE}/${id}/`, data)
}

export async function deactivateSubscriptionPlan(id: number): Promise<{ status: string; active_subscriptions_count: number }> {
  return apiClient.delete(`${BASE}/${id}/`)
}

export default {
  getSubscriptionPlans,
  getSubscriptionPlan,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  deactivateSubscriptionPlan,
}
