/**
 * Entitlements types for v0.63.0
 * Defines user subscription plans and feature access
 */

/**
 * Available subscription plans
 */
export type PlanType = 'FREE' | 'PRO' | 'BUSINESS'

/**
 * Feature codes that can be enabled per plan
 */
export type FeatureCode = 'CONTACT_UNLOCK' | 'UNLIMITED_INQUIRIES'

/**
 * Entitlements DTO from backend
 */
export interface EntitlementsDTO {
  plan: PlanType
  features: string[]
  expires_at: string | null
}

/**
 * Normalized entitlements state
 */
export interface Entitlements {
  plan: PlanType
  features: FeatureCode[]
  expiresAt: Date | null
}
