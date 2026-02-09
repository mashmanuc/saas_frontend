/**
 * Feature Gate Composable
 * 
 * DOMAIN-06: Feature Gate — Declarative feature access control
 * 
 * Usage:
 *   const { granted, reason, expiresAt, loading, check } = useFeatureGate('analytics_advanced')
 *   
 *   // In template:
 *   <FeatureGate feature="analytics_advanced">
 *     <AdvancedAnalytics />
 *   </FeatureGate>
 *   
 *   // Or with fallback:
 *   <FeatureGate feature="analytics_advanced" fallback={<UpgradePrompt />}>
 *     <AdvancedAnalytics />
 *   </FeatureGate>
 */

import { ref, computed, onMounted } from 'vue'
import { useEntitlementsStore } from '../stores/entitlementsStore'

export function useFeatureGate(feature: string) {
  const store = useEntitlementsStore()
  const loading = ref(false)
  const checked = ref(false)

  const granted = computed(() => {
    return store.canUseFeature(feature)
  })

  const reason = computed(() => {
    return store.getFeatureReason(feature)
  })

  const expiresAt = computed(() => {
    return store.getFeatureExpiry(feature)
  })

  const isExpired = computed(() => {
    if (!expiresAt.value) return false
    return new Date(expiresAt.value) < new Date()
  })

  const isGracePeriod = computed(() => {
    return reason.value === 'grace_period'
  })

  const isTrial = computed(() => {
    return reason.value === 'trial'
  })

  async function check(): Promise<void> {
    loading.value = true
    try {
      await store.checkFeature(feature)
      checked.value = true
    } finally {
      loading.value = false
    }
  }

  // Auto-check on mount if no cached data
  onMounted(() => {
    if (!store.isFresh || !store.entitlements?.features?.[feature]) {
      check()
    }
  })

  return {
    granted,
    reason,
    expiresAt,
    isExpired,
    isGracePeriod,
    isTrial,
    loading,
    checked,
    check,
  }
}

// Multiple features at once
export function useFeatureGates(features: string[]) {
  const store = useEntitlementsStore()
  const loading = ref(false)

  const results = computed(() => {
    return features.map(feature => ({
      feature,
      granted: store.canUseFeature(feature),
      reason: store.getFeatureReason(feature),
      expiresAt: store.getFeatureExpiry(feature),
    }))
  })

  const allGranted = computed(() => {
    return results.value.every(r => r.granted)
  })

  const anyGranted = computed(() => {
    return results.value.some(r => r.granted)
  })

  const missingFeatures = computed(() => {
    return results.value.filter(r => !r.granted).map(r => r.feature)
  })

  async function checkAll(): Promise<void> {
    loading.value = true
    try {
      await Promise.all(features.map(f => store.checkFeature(f)))
    } finally {
      loading.value = false
    }
  }

  onMounted(() => {
    if (!store.isFresh) {
      checkAll()
    }
  })

  return {
    results,
    allGranted,
    anyGranted,
    missingFeatures,
    loading,
    checkAll,
  }
}

export default useFeatureGate
