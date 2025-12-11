/**
 * Feature Flag Composable — v0.14.0
 * Глобальний composable для перевірки feature flags
 */

import { computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useFeatureFlagsStore } from '../stores/featureFlagsStore'

/**
 * Check if a single feature flag is enabled
 * @param {string} flagName - Name of the feature flag
 * @returns {{ enabled: ComputedRef<boolean>, loading: ComputedRef<boolean> }}
 */
export function useFeatureFlag(flagName) {
  const store = useFeatureFlagsStore()
  const { loading } = storeToRefs(store)
  
  const enabled = computed(() => store.isEnabled(flagName))
  
  // Initialize store if not already
  onMounted(() => {
    if (store.isCacheStale && !store.loading) {
      store.init()
    }
  })
  
  return {
    enabled,
    loading,
  }
}

/**
 * Check multiple feature flags at once
 * @param {string[]} flagNames - Array of feature flag names
 * @returns {{ flags: ComputedRef<Record<string, boolean>>, allEnabled: ComputedRef<boolean>, anyEnabled: ComputedRef<boolean>, loading: ComputedRef<boolean> }}
 */
export function useFeatureFlags(flagNames) {
  const store = useFeatureFlagsStore()
  const { loading } = storeToRefs(store)
  
  const flags = computed(() => {
    const result = {}
    for (const name of flagNames) {
      result[name] = store.isEnabled(name)
    }
    return result
  })
  
  const allEnabled = computed(() => {
    return flagNames.every(name => store.isEnabled(name))
  })
  
  const anyEnabled = computed(() => {
    return flagNames.some(name => store.isEnabled(name))
  })
  
  // Initialize store if not already
  onMounted(() => {
    if (store.isCacheStale && !store.loading) {
      store.init()
    }
  })
  
  return {
    flags,
    allEnabled,
    anyEnabled,
    loading,
  }
}

/**
 * Get all enabled feature flags
 * @returns {{ enabledFeatures: ComputedRef<string[]>, loading: ComputedRef<boolean> }}
 */
export function useEnabledFeatures() {
  const store = useFeatureFlagsStore()
  const { loading, enabledFeatures } = storeToRefs(store)
  
  onMounted(() => {
    if (store.isCacheStale && !store.loading) {
      store.init()
    }
  })
  
  return {
    enabledFeatures,
    loading,
  }
}

/**
 * Feature flag directive helper
 * Usage: v-if="$feature('chat_reactions')"
 */
export function createFeatureFlagHelper() {
  const store = useFeatureFlagsStore()
  return (flagName) => store.isEnabled(flagName)
}

/**
 * Initialize feature flags (call in main.js)
 */
export async function initFeatureFlags() {
  const store = useFeatureFlagsStore()
  await store.init()
}

export default useFeatureFlag
