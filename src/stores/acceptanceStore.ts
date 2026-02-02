import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getAcceptAvailability } from '@/api/acceptance'
import type { AcceptAvailability } from '@/types/acceptance'

/**
 * Acceptance store.
 * 
 * SSOT-compliant store for accept availability.
 * 
 * Responsibilities:
 * - Fetch accept availability (lazy-load + force refresh)
 * - Cache availability data
 * - Invalidate cache after accept
 * 
 * Does NOT:
 * - Decide onboarding vs billing (backend does this)
 * - Show "source" to user (SSOT Section 7)
 * - Manage billing balance (contactsStore does this)
 */
export const useAcceptanceStore = defineStore('acceptance', () => {
  // ==========================================
  // State
  // ==========================================
  
  const status = ref<'idle' | 'loading' | 'error' | 'ready'>('idle')
  const data = ref<AcceptAvailability | null>(null)
  const error = ref<string | null>(null)
  
  // ==========================================
  // Computed
  // ==========================================
  
  /**
   * Whether tutor can accept inquiry right now.
   * 
   * SSOT Section 4.1: can_accept() contract
   */
  const canAccept = computed(() => data.value?.can_accept ?? false)
  
  /**
   * Number of remaining accepts.
   * 
   * SSOT Section 7: This is the ONLY number shown to tutor.
   */
  const remainingAccepts = computed(() => data.value?.remaining_accepts ?? 0)
  
  /**
   * Whether grace token is available.
   * 
   * Used to determine if we should include token in accept request.
   */
  const hasGraceToken = computed(() => !!data.value?.grace_token)
  
  /**
   * Grace token expiry timestamp.
   * 
   * Used for optional UI countdown (informative only, not blocking).
   */
  const graceTokenExpiresAt = computed(() => data.value?.expires_at)
  
  /**
   * Whether store is loading.
   */
  const isLoading = computed(() => status.value === 'loading')
  
  /**
   * Whether store has data.
   */
  const hasData = computed(() => status.value === 'ready' && data.value !== null)
  
  // ==========================================
  // Actions
  // ==========================================
  
  /**
   * Fetch accept availability.
   * 
   * SSOT Addendum D.3: Preflight check
   * 
   * @param force - Force refresh even if data exists
   * @returns Accept availability
   */
  async function fetchAvailability(force = false): Promise<AcceptAvailability> {
    // Return cached data if available (unless force=true)
    if (!force && data.value && status.value === 'ready') {
      return data.value
    }
    
    status.value = 'loading'
    error.value = null
    
    try {
      const result = await getAcceptAvailability()
      
      data.value = result
      status.value = 'ready'
      
      return result
      
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch accept availability'
      status.value = 'error'
      
      throw e
    }
  }
  
  /**
   * Invalidate cached data.
   * 
   * Called after successful accept to force refresh on next fetch.
   * 
   * SSOT Section 7: Cache invalidation after state change
   */
  function invalidate(): void {
    data.value = null
    status.value = 'idle'
    error.value = null
  }
  
  /**
   * Reset store to initial state.
   */
  function reset(): void {
    invalidate()
  }
  
  // ==========================================
  // Return
  // ==========================================
  
  return {
    // State
    status,
    data,
    error,
    
    // Computed
    canAccept,
    remainingAccepts,
    hasGraceToken,
    graceTokenExpiresAt,
    isLoading,
    hasData,
    
    // Actions
    fetchAvailability,
    invalidate,
    reset
  }
})
