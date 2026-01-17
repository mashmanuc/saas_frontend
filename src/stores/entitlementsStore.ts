/**
 * Entitlements Store for v0.63.0
 * Manages user subscription plan and feature access
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import entitlementsApi from '@/api/entitlements'
import type { PlanType, FeatureCode, Entitlements } from '@/types/entitlements'
import { rethrowAsDomainError } from '@/utils/rethrowAsDomainError'

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

  // Actions
  async function loadEntitlements(): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      const dto = await entitlementsApi.getEntitlements()
      
      // Normalize DTO to state
      plan.value = dto.plan
      features.value = dto.features as FeatureCode[]
      expiresAt.value = dto.expires_at ? new Date(dto.expires_at) : null
    } catch (err: any) {
      const status = err?.response?.status
      
      // v0.92.2: Graceful fallback for 401/404 - use FREE plan, don't throw
      if (status === 401 || status === 404) {
        console.warn('[EntitlementsStore] Entitlements not available, using FREE plan')
        plan.value = 'FREE'
        features.value = []
        expiresAt.value = null
        error.value = null // Don't show error to user
      } else {
        error.value = 'Failed to load entitlements'
        rethrowAsDomainError(err)
      }
    } finally {
      isLoading.value = false
    }
  }

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
    loadEntitlements,
    reset
  }
})
