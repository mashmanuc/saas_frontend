/**
 * RBAC Configuration v0.81.1
 * 
 * Centralized role-based access control definitions
 */

import { USER_ROLES } from '@/types/user'

/**
 * Staff roles that have access to staff console
 */
export const STAFF_ROLES = [
  USER_ROLES.SUPERADMIN,
  USER_ROLES.ADMIN,
]

/**
 * Staff roles that have access to billing operations
 */
export const STAFF_BILLING_ROLES = [
  USER_ROLES.SUPERADMIN,
  USER_ROLES.ADMIN,
  USER_ROLES.SUPERUSER,
  USER_ROLES.FINANCE_OPS,
  USER_ROLES.BILLING_ADMIN,
]

/**
 * Check if user has staff access
 */
export function isStaffUser(userRole) {
  return STAFF_ROLES.includes(userRole)
}

/**
 * Check if user has staff billing access
 */
export function isStaffBillingUser(userRole) {
  return STAFF_BILLING_ROLES.includes(userRole)
}

/**
 * Check if user is staff (any staff role including billing)
 */
export function hasStaffAccess(userRole) {
  return STAFF_ROLES.includes(userRole) || STAFF_BILLING_ROLES.includes(userRole)
}
