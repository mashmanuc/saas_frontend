/**
 * API Client Type Definitions
 * v0.86.3 - API Client Auth Invariants
 * 
 * Provides TypeScript types for apiClient.js
 * apiClient automatically unwraps .data from AxiosResponse via interceptor
 */

import type { AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios'

// Augment axios to support custom `meta` field on request config
declare module 'axios' {
  interface AxiosRequestConfig {
    meta?: {
      skipLoader?: boolean
      fullResponse?: boolean
      bypassCircuitBreaker?: boolean
    }
  }
  interface InternalAxiosRequestConfig {
    meta?: {
      skipLoader?: boolean
      fullResponse?: boolean
      bypassCircuitBreaker?: boolean
    }
    _dedupeKey?: string
    _retry?: boolean
    _csrfRetry?: boolean
  }
}

interface ApiClient {
  /**
   * GET request - returns unwrapped data (not AxiosResponse)
   */
  get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T>

  /**
   * POST request - returns unwrapped data (not AxiosResponse)
   */
  post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T>

  /**
   * PUT request - returns unwrapped data (not AxiosResponse)
   */
  put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T>

  /**
   * PATCH request - returns unwrapped data (not AxiosResponse)
   */
  patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T>

  /**
   * DELETE request - returns unwrapped data (not AxiosResponse)
   */
  delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T>
}

declare const apiClient: ApiClient

export default apiClient
export { apiClient }
export function isCircuitBreakerOpen(): boolean
export function resetCircuitBreaker(): void
export function _getDedupeKey(config: any): string | null
