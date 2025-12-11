/**
 * Web Push Registration — v0.16.0
 * Push subscription, backend API integration, auto-refresh
 */

import { apiClient } from '../../utils/apiClient'

/**
 * Configuration
 */
const CONFIG = {
  vapidPublicKey: import.meta.env.VITE_VAPID_PUBLIC_KEY || '',
  registerEndpoint: '/api/v1/push/register',
  unregisterEndpoint: '/api/v1/push/unregister',
  refreshIntervalMs: 24 * 60 * 60 * 1000, // 24 hours
}

/**
 * State
 */
let subscription = null
let refreshTimer = null
let isRegistering = false

/**
 * Check if push notifications are supported
 */
export function isPushSupported() {
  return 'serviceWorker' in navigator && 
         'PushManager' in window && 
         'Notification' in window
}

/**
 * Check if notifications are permitted
 */
export function isNotificationPermitted() {
  return Notification.permission === 'granted'
}

/**
 * Check if notifications are denied
 */
export function isNotificationDenied() {
  return Notification.permission === 'denied'
}

/**
 * Request notification permission
 */
export async function requestPermission() {
  if (!isPushSupported()) {
    throw new Error('Push notifications not supported')
  }
  
  const permission = await Notification.requestPermission()
  return permission === 'granted'
}

/**
 * Get current subscription
 */
export async function getSubscription() {
  if (!isPushSupported()) {
    return null
  }
  
  try {
    const registration = await navigator.serviceWorker.ready
    const sub = await registration.pushManager.getSubscription()
    return sub
  } catch (error) {
    console.error('[push] failed to get subscription:', error)
    return null
  }
}

/**
 * Convert VAPID key to Uint8Array
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  
  return outputArray
}

/**
 * Subscribe to push notifications
 */
export async function subscribe() {
  if (!isPushSupported()) {
    throw new Error('Push notifications not supported')
  }
  
  if (!isNotificationPermitted()) {
    const granted = await requestPermission()
    if (!granted) {
      throw new Error('Notification permission denied')
    }
  }
  
  if (!CONFIG.vapidPublicKey) {
    throw new Error('VAPID public key not configured')
  }
  
  try {
    const registration = await navigator.serviceWorker.ready
    
    // Check for existing subscription
    let sub = await registration.pushManager.getSubscription()
    
    if (!sub) {
      // Create new subscription
      sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(CONFIG.vapidPublicKey),
      })
    }
    
    subscription = sub
    return sub
  } catch (error) {
    console.error('[push] subscription failed:', error)
    throw error
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribe() {
  const sub = await getSubscription()
  
  if (sub) {
    await sub.unsubscribe()
    subscription = null
  }
  
  return true
}

/**
 * Register subscription with backend
 */
export async function registerWithBackend(sub = null) {
  if (isRegistering) {
    console.log('[push] registration already in progress')
    return
  }
  
  isRegistering = true
  
  try {
    const pushSubscription = sub || subscription || await getSubscription()
    
    if (!pushSubscription) {
      throw new Error('No push subscription available')
    }
    
    const subscriptionData = pushSubscription.toJSON()
    
    const response = await apiClient.post(CONFIG.registerEndpoint, {
      endpoint: subscriptionData.endpoint,
      keys: subscriptionData.keys,
      expirationTime: subscriptionData.expirationTime,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
    })
    
    console.log('[push] registered with backend')
    
    // Schedule refresh
    scheduleRefresh()
    
    return response.data
  } catch (error) {
    console.error('[push] backend registration failed:', error)
    throw error
  } finally {
    isRegistering = false
  }
}

/**
 * Unregister subscription from backend
 */
export async function unregisterFromBackend() {
  const sub = await getSubscription()
  
  if (!sub) {
    return
  }
  
  try {
    const subscriptionData = sub.toJSON()
    
    await apiClient.post(CONFIG.unregisterEndpoint, {
      endpoint: subscriptionData.endpoint,
    })
    
    console.log('[push] unregistered from backend')
  } catch (error) {
    console.error('[push] backend unregistration failed:', error)
  }
  
  // Cancel refresh
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

/**
 * Schedule subscription refresh
 */
function scheduleRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer)
  }
  
  refreshTimer = setInterval(async () => {
    console.log('[push] refreshing subscription...')
    
    try {
      // Re-subscribe to get fresh subscription
      const sub = await subscribe()
      await registerWithBackend(sub)
    } catch (error) {
      console.error('[push] refresh failed:', error)
    }
  }, CONFIG.refreshIntervalMs)
}

/**
 * Initialize push notifications
 */
export async function initPush(options = {}) {
  if (!isPushSupported()) {
    console.warn('[push] push notifications not supported')
    return { supported: false }
  }
  
  const result = {
    supported: true,
    permitted: isNotificationPermitted(),
    denied: isNotificationDenied(),
    subscription: null,
    registered: false,
  }
  
  // If already permitted, subscribe and register
  if (result.permitted) {
    try {
      result.subscription = await subscribe()
      
      if (options.autoRegister !== false) {
        await registerWithBackend(result.subscription)
        result.registered = true
      }
    } catch (error) {
      console.error('[push] init failed:', error)
    }
  }
  
  return result
}

/**
 * Full registration flow
 */
export async function registerPush() {
  // Request permission
  const permitted = await requestPermission()
  if (!permitted) {
    return { success: false, reason: 'permission_denied' }
  }
  
  // Subscribe
  const sub = await subscribe()
  if (!sub) {
    return { success: false, reason: 'subscription_failed' }
  }
  
  // Register with backend
  await registerWithBackend(sub)
  
  return { success: true, subscription: sub }
}

/**
 * Full unregistration flow
 */
export async function unregisterPush() {
  await unregisterFromBackend()
  await unsubscribe()
  
  return { success: true }
}

/**
 * Get push status
 */
export async function getPushStatus() {
  const sub = await getSubscription()
  
  return {
    supported: isPushSupported(),
    permitted: isNotificationPermitted(),
    denied: isNotificationDenied(),
    subscribed: !!sub,
    endpoint: sub?.endpoint || null,
  }
}

export default {
  isPushSupported,
  isNotificationPermitted,
  isNotificationDenied,
  requestPermission,
  subscribe,
  unsubscribe,
  registerWithBackend,
  unregisterFromBackend,
  initPush,
  registerPush,
  unregisterPush,
  getPushStatus,
  getSubscription,
}
