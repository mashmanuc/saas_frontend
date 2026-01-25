/**
 * Entitlements API client for v0.63.0
 * Handles user subscription and feature access endpoints
 */

import apiClient from '@/utils/apiClient'
import type { EntitlementsDTO } from '@/types/entitlements'

const BASE_URL = '/v1/users/me/entitlements'

/**
 * Get current user's entitlements (plan, features, expiration)
 */
export async function getEntitlements(): Promise<EntitlementsDTO> {
  return apiClient.get(BASE_URL + '/')
}

export default {
  getEntitlements
}
