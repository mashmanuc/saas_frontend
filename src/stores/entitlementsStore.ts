/**
 * Entitlements Store for v0.63.0
 * Manages user subscription plan and feature access
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { PlanType, FeatureCode } from '@/types/entitlements'

export const useEntitlementsStore = defineStore('entitlements', () => {
  // State
  const plan = ref<PlanType>('FREE')
  const features = ref<FeatureCode[]>([])
  const expiresAt = ref<Date | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Getters
  const isActive = computed(() => {
    if (!expiresAt.value) return true
    return expiresAt.value > new Date()
  })

  const hasFeature = computed(() => {
    return (featureCode: FeatureCode): boolean => {
      if (!isActive.value) return false
      return features.value.includes(featureCode)
    }
  })

  const isPro = computed(() => plan.value === 'PRO' || plan.value === 'BUSINESS')
  const isFree = computed(() => plan.value === 'FREE')

  // Phase 29: READ via useUserContextQuery (TanStack Query). Store keeps state for legacy computed refs.

  function reset(): void {
    plan.value = 'FREE'
    features.value = []
    expiresAt.value = null
    isLoading.value = false
    error.value = null
  }

  return {
    // State
    plan,
    features,
    expiresAt,
    isLoading,
    error,
    
    // Getters
    isActive,
    hasFeature,
    isPro,
    isFree,
    
    // Actions
    reset
  }
})
