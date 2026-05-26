/**
 * Phase 29: Query Key Factory — SSOT for all TanStack Query keys
 *
 * Rules (INV-5):
 * - ALL query keys MUST be defined here
 * - Components/stores MUST import from this file
 * - NEVER hardcode query key strings elsewhere
 * - Keys use tuple format for hierarchical invalidation:
 *   invalidateQueries(['relations']) → invalidates ['relations'] AND ['relations', { status: 'pending' }]
 */

import type { InquiryFilters } from '@/types/inquiries'

export interface RelationFilters {
  role?: 'student' | 'tutor'
  status?: string
  cursor?: string | null
}

export const queryKeys = {
  // ── User ──────────────────────────────────
  userContext: () => ['user-context'] as const,

  // ── Entitlements & Billing ────────────────
  entitlements: () => ['entitlements'] as const,
  billing: () => ['billing'] as const,

  // ── Limits ────────────────────────────────
  limits: () => ['limits'] as const,

  // ── Relations ─────────────────────────────
  relations: () => ['relations'] as const,
  relationsFiltered: (filters: RelationFilters) => ['relations', filters] as const,

  // ── Dashboard ─────────────────────────────
  studentDashboard: () => ['student-dashboard'] as const,
  tutorDashboard: () => ['tutor-dashboard'] as const,
  marketplaceMe: () => ['marketplace-me'] as const,

  // ── Contacts ──────────────────────────────
  contactBalance: () => ['contact-balance'] as const,
  contactStats: () => ['contact-stats'] as const,

  // ── Inquiries ─────────────────────────────
  inquiries: () => ['inquiries'] as const,
  inquiriesFiltered: (filters: InquiryFilters) => ['inquiries', filters] as const,

  // ── Activation Engine (M3) ────────────────
  // Ієрархія: ['activation'] → invalidates state + milestones + all gates
  activationState: () => ['activation', 'state'] as const,
  activationMilestones: () => ['activation', 'milestones'] as const,
  activationGate: (slug: string) => ['activation', 'gate', slug] as const,
} as const

/**
 * Helper: invalidate all queries that start with the given key prefix.
 * Example: invalidateByPrefix(queryClient, 'relations') → invalidates ['relations'] + ['relations', {...}]
 */
export function invalidateByPrefix(queryClient: any, prefix: string) {
  queryClient.invalidateQueries({ queryKey: [prefix] })
}
