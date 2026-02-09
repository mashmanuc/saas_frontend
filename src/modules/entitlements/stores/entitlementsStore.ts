/**
 * Entitlements Store
 * 
 * DOMAIN-06: Entitlements State Management
 * 
 * Pinia store for managing user entitlements, feature gates, and grace periods.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { entitlementsApi, UserEntitlements, EntitlementCheck, PlanFeature } from '../api/entitlements'

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

export const useEntitlementsStore = defineStore('entitlements', () => {
  // State
  const entitlements = ref<UserEntitlements | null>(null)
  const features = ref<PlanFeature[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const lastFetched = ref<number>(0)
  const graceAcknowledged = ref<boolean>(false)
  const pendingChecks = ref<Set<string>>(new Set())

  // Getters
  const isFresh = computed(() => {
    if (!lastFetched.value) return false
    return Date.now() - lastFetched.value < CACHE_TTL_MS
  })

  const currentPlan = computed(() => entitlements.value?.plan || 'none')
  const planStatus = computed(() => entitlements.value?.status || 'none')

  const isInGracePeriod = computed(() => {
    return planStatus.value === 'grace_period'
  })

  const isTrialing = computed(() => {
    return planStatus.value === 'trialing'
  })

  const isActive = computed(() => {
    return planStatus.value === 'active'
  })

  const gracePeriodInfo = computed(() => {
    if (!isInGracePeriod.value) return null
    return entitlements.value?.grace_period
  })

  const trialInfo = computed(() => {
    if (!isTrialing.value) return null
    return entitlements.value?.trial
  })

  const daysRemaining = computed(() => {
    if (gracePeriodInfo.value) {
      return gracePeriodInfo.value.days_remaining
    }
    if (trialInfo.value) {
      return trialInfo.value.days_remaining
    }
    return null
  })

  const gracePeriodEndsAt = computed(() => {
    return gracePeriodInfo.value?.ends_at
  })

  const shouldShowGraceBanner = computed(() => {
    return isInGracePeriod.value && !graceAcknowledged.value
  })

  // Feature checking helpers
  function canUseFeature(feature: string): boolean {
    if (!entitlements.value?.features) return false
    return entitlements.value.features[feature]?.granted ?? false
  }

  function getFeatureReason(feature: string): string | undefined {
    if (!entitlements.value?.features) return undefined
    return entitlements.value.features[feature]?.reason
  }

  function getFeatureExpiry(feature: string): string | undefined {
    if (!entitlements.value?.features) return undefined
    return entitlements.value.features[feature]?.expires_at
  }

  // Limits
  const maxContactsPerMonth = computed(() => {
    return entitlements.value?.limits?.max_contacts_per_month ?? 0
  })

  const maxStudents = computed(() => {
    return entitlements.value?.limits?.max_students ?? 0
  })

  const maxStorageGb = computed(() => {
    return entitlements.value?.limits?.max_storage_gb ?? 0
  })

  const analyticsLevel = computed(() => {
    return entitlements.value?.limits?.analytics_level ?? 'none'
  })

  // Actions
  async function fetchEntitlements(force = false): Promise<void> {
    if (!force && isFresh.value) return
    
    loading.value = true
    error.value = null
    
    try {
      const response = await entitlementsApi.getUserEntitlements()
      entitlements.value = response
      lastFetched.value = Date.now()
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch entitlements'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function checkFeature(feature: string): Promise<EntitlementCheck> {
    // If we have fresh data, use cached value
    if (isFresh.value && entitlements.value?.features?.[feature]) {
      return entitlements.value.features[feature]
    }
    
    // Prevent duplicate concurrent checks
    if (pendingChecks.value.has(feature)) {
      // Wait for existing check to complete
      while (pendingChecks.value.has(feature)) {
        await new Promise(resolve => setTimeout(resolve, 50))
      }
      return entitlements.value?.features?.[feature] || { feature, granted: false, reason: 'none' }
    }
    
    pendingChecks.value.add(feature)
    
    try {
      const response = await entitlementsApi.checkFeature(feature)
      // Update entitlements cache with the result
      if (entitlements.value) {
        entitlements.value.features[feature] = response
      }
      return response
    } catch (e: any) {
      // Return restrictive check on error
      return { feature, granted: false, reason: 'none' }
    } finally {
      pendingChecks.value.delete(feature)
    }
  }

  async function fetchFeatures(): Promise<void> {
    loading.value = true
    error.value = null
    
    try {
      const response = await entitlementsApi.getPlanFeatures()
      features.value = response
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch features'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function acknowledgeGrace(): Promise<void> {
    try {
      await entitlementsApi.acknowledgeGracePeriod()
      graceAcknowledged.value = true
    } catch (e) {
      // Still mark as acknowledged locally even if API fails
      graceAcknowledged.value = true
    }
  }

  // Feature gate composable helper
  function useFeatureGate(feature: string) {
    return {
      granted: computed(() => canUseFeature(feature)),
      reason: computed(() => getFeatureReason(feature)),
      expiresAt: computed(() => getFeatureExpiry(feature)),
    }
  }

  function $reset(): void {
    entitlements.value = null
    features.value = []
    loading.value = false
    error.value = null
    lastFetched.value = 0
    graceAcknowledged.value = false
    pendingChecks.value.clear()
  }

  return {
    // State
    entitlements,
    features,
    loading,
    error,
    graceAcknowledged,
    
    // Getters
    isFresh,
    currentPlan,
    planStatus,
    isInGracePeriod,
    isTrialing,
    isActive,
    gracePeriodInfo,
    trialInfo,
    daysRemaining,
    gracePeriodEndsAt,
    shouldShowGraceBanner,
    maxContactsPerMonth,
    maxStudents,
    maxStorageGb,
    analyticsLevel,
    
    // Methods
    canUseFeature,
    getFeatureReason,
    getFeatureExpiry,
    useFeatureGate,
    
    // Actions
    fetchEntitlements,
    checkFeature,
    fetchFeatures,
    acknowledgeGrace,
    $reset,
  }
})
