/**
 * Token Refresh Orchestration — v0.15.0
 * Перехоплення 401, автоматичний token rotation, сесійні повідомлення
 */

import { apiClient } from '../../utils/apiClient'

/**
 * Configuration
 */
const CONFIG = {
  refreshEndpoint: '/v1/auth/refresh/',
  tokenRefreshThresholdMs: 5 * 60 * 1000, // 5 minutes before expiry
  maxRefreshRetries: 3,
  refreshRetryDelayMs: 1000,
}

/**
 * Token state
 */
let isRefreshing = false
let refreshPromise = null
let refreshRetryCount = 0
let tokenExpiresAt = null
let refreshTimer = null

let requestInterceptorId = null
let responseInterceptorId = null
let interceptorAxiosInstance = null

/**
 * Callbacks
 */
let onSessionRefreshed = null
let onSessionExpired = null
let onRefreshError = null

/**
 * Parse JWT to get expiration time
 */
function parseJwtExpiry(token) {
  if (!token) return null
  
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    
    const payload = JSON.parse(atob(parts[1]))
    return payload.exp ? payload.exp * 1000 : null
  } catch (error) {
    console.warn('[tokenRefresh] failed to parse JWT:', error)
    return null
  }
}

/**
 * Check if token is about to expire
 */
function isTokenExpiringSoon() {
  if (!tokenExpiresAt) return false
  return Date.now() >= tokenExpiresAt - CONFIG.tokenRefreshThresholdMs
}

/**
 * Check if token is expired
 */
function isTokenExpired() {
  if (!tokenExpiresAt) return false
  return Date.now() >= tokenExpiresAt
}

/**
 * Schedule proactive token refresh
 */
function scheduleRefresh() {
  if (refreshTimer) {
    clearTimeout(refreshTimer)
    refreshTimer = null
  }
  
  if (!tokenExpiresAt) return
  
  const timeUntilRefresh = tokenExpiresAt - Date.now() - CONFIG.tokenRefreshThresholdMs
  
  if (timeUntilRefresh <= 0) {
    // Token already needs refresh
    refreshToken()
    return
  }
  
  refreshTimer = setTimeout(() => {
    refreshToken()
  }, timeUntilRefresh)
}

/**
 * Refresh the access token
 */
async function refreshToken() {
  if (isRefreshing) {
    return refreshPromise
  }
  
  isRefreshing = true
  refreshRetryCount = 0
  
  refreshPromise = performRefresh()
  
  try {
    const result = await refreshPromise
    return result
  } finally {
    isRefreshing = false
    refreshPromise = null
  }
}

/**
 * Perform the actual refresh request
 */
async function performRefresh() {
  while (refreshRetryCount < CONFIG.maxRefreshRetries) {
    try {
      const response = await apiClient.post(CONFIG.refreshEndpoint, {}, {
        withCredentials: true, // Send httpOnly refresh cookie
        skipAuthRefresh: true, // Prevent infinite loop
      })

      const data = response?.data ?? {}
      const access_token = data?.access_token
      const expires_in = data?.expires_in

      if (access_token) {
        // Update token expiry
        tokenExpiresAt = parseJwtExpiry(access_token) || (Date.now() + (expires_in || 3600) * 1000)
        
        // Schedule next refresh
        scheduleRefresh()
        
        // Notify success
        onSessionRefreshed?.()
        
        return { success: true, token: access_token }
      }
      
      throw new Error('No access token in refresh response')
    } catch (error) {
      refreshRetryCount++
      const status = error?.response?.status
      
      if ([401, 403, 422].includes(status)) {
        // Refresh token is invalid or request cannot be processed - expire session immediately
        handleSessionExpired()
        onRefreshError?.(error)
        return { success: false, error: 'session_expired' }
      }
      
      if (refreshRetryCount < CONFIG.maxRefreshRetries) {
        await new Promise(resolve => setTimeout(resolve, CONFIG.refreshRetryDelayMs))
        continue
      }
      
      onRefreshError?.(error)
      return { success: false, error: error.message }
    }
  }
  
  return { success: false, error: 'max_retries_exceeded' }
}

/**
 * Handle session expiration
 */
function handleSessionExpired() {
  tokenExpiresAt = null
  
  if (refreshTimer) {
    clearTimeout(refreshTimer)
    refreshTimer = null
  }
  
  onSessionExpired?.()
}

/**
 * Create axios interceptor for 401 handling
 */
function createAuthInterceptor(axiosInstance) {
  // If re-initializing, ensure we don't accumulate interceptors
  if (interceptorAxiosInstance && interceptorAxiosInstance === axiosInstance) {
    if (requestInterceptorId !== null) {
      interceptorAxiosInstance.interceptors.request.eject(requestInterceptorId)
      requestInterceptorId = null
    }
    if (responseInterceptorId !== null) {
      interceptorAxiosInstance.interceptors.response.eject(responseInterceptorId)
      responseInterceptorId = null
    }
  }
  interceptorAxiosInstance = axiosInstance

  // Request interceptor - add token
  requestInterceptorId = axiosInstance.interceptors.request.use(
    (config) => {
      // Token is now in httpOnly cookie, no need to add header
      // But we can check if refresh is needed
      if (isTokenExpiringSoon() && !config.skipAuthRefresh) {
        // Trigger background refresh
        refreshToken()
      }
      return config
    },
    (error) => Promise.reject(error)
  )
  
  // Response interceptor - handle 401
  responseInterceptorId = axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config
      
      // Skip if already retrying or if it's the refresh endpoint
      if (originalRequest._retry || originalRequest.skipAuthRefresh) {
        return Promise.reject(error)
      }
      
      // Handle 401 Unauthorized
      if (error.response?.status === 401) {
        originalRequest._retry = true
        
        try {
          const result = await refreshToken()
          
          if (result.success) {
            // Retry original request
            return axiosInstance(originalRequest)
          }
          
          // Refresh failed - session expired
          handleSessionExpired()
        } catch (refreshError) {
          handleSessionExpired()
        }
      }
      
      return Promise.reject(error)
    }
  )
}

/**
 * Initialize token refresh system
 */
export function initTokenRefresh(options = {}) {
  const {
    axiosInstance = apiClient,
    onRefreshed,
    onExpired,
    onError,
    initialToken,
  } = options
  
  onSessionRefreshed = onRefreshed
  onSessionExpired = onExpired
  onRefreshError = onError
  
  // Parse initial token expiry
  if (initialToken) {
    tokenExpiresAt = parseJwtExpiry(initialToken)
    scheduleRefresh()
  }
  
  // Create interceptor
  createAuthInterceptor(axiosInstance)
  
  return {
    refresh: refreshToken,
    isRefreshing: () => isRefreshing,
    isExpiringSoon: isTokenExpiringSoon,
    isExpired: isTokenExpired,
    setToken: (token) => {
      tokenExpiresAt = parseJwtExpiry(token)
      scheduleRefresh()
    },
    destroy: () => {
      if (refreshTimer) {
        clearTimeout(refreshTimer)
        refreshTimer = null
      }

      if (interceptorAxiosInstance) {
        if (requestInterceptorId !== null) {
          interceptorAxiosInstance.interceptors.request.eject(requestInterceptorId)
          requestInterceptorId = null
        }
        if (responseInterceptorId !== null) {
          interceptorAxiosInstance.interceptors.response.eject(responseInterceptorId)
          responseInterceptorId = null
        }
        interceptorAxiosInstance = null
      }
      tokenExpiresAt = null
      isRefreshing = false
      refreshPromise = null
    },
  }
}

/**
 * Token refresh composable for Vue components
 */
export function useTokenRefresh() {
  return {
    refresh: refreshToken,
    isRefreshing: () => isRefreshing,
    isExpiringSoon: isTokenExpiringSoon,
    isExpired: isTokenExpired,
  }
}

export default {
  initTokenRefresh,
  useTokenRefresh,
  refreshToken,
}
