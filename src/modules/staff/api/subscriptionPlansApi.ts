/**
 * Staff Subscription Plans API v0.91.0
 *
 * SUPERADMIN-only CRUD for subscription plans.
 * Backend: GET/POST/PATCH/DELETE /api/v1/staff/subscription-plans/
 */
import apiClient from '@/utils/apiClient'

const BASE = '/v1/staff/subscription-plans'

/**
 * Quota limits map.
 * Semantics (Sprint 1 — Entitlement Access Plan v2.0):
 *  - null або відсутній ключ = unlimited
 *  - positive integer = quota cap
 *  - 0 заборонено (валідація на backend)
 */
export type PlanLimits = Record<string, number | null>

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
  // Sprint 3 Task 2: lessons_per_month лишається у DTO як read-only legacy поле
  // (backend все ще повертає його). Quota керується через limits.monthly_lessons.
  lessons_per_month: number
  features: string[]
  limits: PlanLimits
  /** Sprint 3 Task 1: contact tokens granted on subscription activation. */
  contact_grant_on_purchase: number
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
  // lessons_per_month прибрано з payload — read-only у Staff API (Sprint 3 Task 2).
  features?: string[]
  limits?: PlanLimits
  /** Sprint 3 Task 1: contact tokens granted on subscription activation. */
  contact_grant_on_purchase?: number
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
