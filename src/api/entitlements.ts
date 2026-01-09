/**
 * Entitlements API client for v0.63.0
 * Handles user subscription and feature access endpoints
 */

import axios from 'axios'
import type { EntitlementsDTO } from '@/types/entitlements'

const BASE_URL = '/api/v1/users/me/entitlements'

/**
 * Get current user's entitlements (plan, features, expiration)
 */
export async function getEntitlements(): Promise<EntitlementsDTO> {
  const response = await axios.get<EntitlementsDTO>(BASE_URL + '/')
  return response.data
}

export default {
  getEntitlements
}
