/**
 * Entitlements API Client
 * 
 * DOMAIN-06: Entitlements — Feature Gates, Grace Period, Plan Features
 * 
 * API methods for checking user entitlements and plan features.
 */

import apiClient from '@/utils/apiClient'

// Types
export interface EntitlementCheck {
  feature: string
  granted: boolean
  reason?: 'active_subscription' | 'trial' | 'grace_period' | 'none' | 'expired'
  expires_at?: string
  grace_period_ends_at?: string
}

export interface UserEntitlements {
  plan: string
  status: 'active' | 'trialing' | 'grace_period' | 'expired' | 'none'
  features: Record<string, EntitlementCheck>
  limits: {
    max_contacts_per_month: number
    max_students: number
    max_storage_gb: number
    analytics_level: 'basic' | 'advanced' | 'none'
  }
  grace_period?: {
    started_at: string
    ends_at: string
    days_remaining: number
  }
  trial?: {
    started_at: string
    ends_at: string
    days_remaining: number
  }
}

export interface PlanFeature {
  id: string
  name: string
  description: string
  included_in_plans: string[]
  limit?: number
  icon?: string
}

export interface PlanComparison {
  slug: string
  name: string
  price: number
  currency: string
  features: Array<{
    feature_id: string
    included: boolean
    limit?: number
  }>
}

export const entitlementsApi = {
  // Get all user entitlements
  getUserEntitlements: (): Promise<UserEntitlements> =>
    apiClient.get('/entitlements/me/'),

  // Check specific feature
  checkFeature: (feature: string): Promise<EntitlementCheck> =>
    apiClient.get(`/entitlements/check/${feature}/`),

  // Get plan features directory
  getPlanFeatures: (): Promise<PlanFeature[]> =>
    apiClient.get('/entitlements/features/'),

  // Get plan comparison
  getPlanComparison: (): Promise<PlanComparison[]> =>
    apiClient.get('/entitlements/plans/'),

  // Acknowledge grace period (user has seen the banner)
  acknowledgeGracePeriod: (): Promise<void> =>
    apiClient.post('/entitlements/grace/acknowledge/', {}),
}

export default entitlementsApi
