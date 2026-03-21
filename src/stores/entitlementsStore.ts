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

  // Cache: entitlements rarely change, no need to refetch every page load
  const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
  let _lastFetchedAt = 0
  let _fetchPromise: Promise<void> | null = null

  // Actions
  async function loadEntitlements(force = false): Promise<void> {
    // Return cached data if still fresh
    if (!force && plan.value !== 'FREE' && Date.now() - _lastFetchedAt < CACHE_TTL_MS) {
      return
    }
    // Deduplicate concurrent calls
    if (_fetchPromise) return _fetchPromise

    _fetchPromise = _doLoadEntitlements()
    try {
      await _fetchPromise
    } finally {
      _fetchPromise = null
    }
  }

  async function _doLoadEntitlements(): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      const dto = await entitlementsApi.getEntitlements()

      // Normalize DTO to state
      plan.value = dto.plan
      features.value = dto.features as FeatureCode[]
      expiresAt.value = dto.expires_at ? new Date(dto.expires_at) : null
      _lastFetchedAt = Date.now()
    } catch (err: any) {
      // Don't show error on 429 — background fetch, not user action
      if (err?.response?.status !== 429) {
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
