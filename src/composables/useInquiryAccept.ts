import { ref } from 'vue'
import { useAcceptanceStore } from '@/stores/acceptanceStore'
import { useInquiriesStore } from '@/stores/inquiriesStore'
import { acceptInquiry } from '@/api/acceptance'
import { useToast } from '@/composables/useToast'

/**
 * Composable for inquiry accept flow.
 * 
 * SSOT-compliant accept flow with grace token retry.
 */
export function useInquiryAccept() {
  const acceptanceStore = useAcceptanceStore()
  const inquiriesStore = useInquiriesStore()
  const toast = useToast()
  
  const isAccepting = ref(false)
  
  /**
   * Accept inquiry with grace token retry.
   * 
   * SSOT Section 6: Main flow
   * SSOT Addendum F.2: Grace token guarantee
   * 
   * Flow:
   * 1. Fetch availability (lazy)
   * 2. Accept with grace token (if available)
   * 3. If "Grace token expired" → retry once with fresh token
   * 4. Invalidate cache and refresh inquiries
   * 
   * @param inquiryId - Inquiry ID to accept
   */
  async function handleAccept(inquiryId: string): Promise<void> {
    if (isAccepting.value) {
      return // Prevent double-click
    }
    
    isAccepting.value = true
    
    try {
      // Step 1: Fetch availability (lazy-load)
      await acceptanceStore.fetchAvailability()
      
      // Step 2: Accept with grace token (if available)
      const graceToken = acceptanceStore.data?.grace_token
      
      try {
        await acceptInquiry(inquiryId, graceToken)
        
        // Success
        await handleAcceptSuccess(inquiryId)
        
      } catch (error: any) {
        // Step 3: Grace token expired? Retry once
        if (isGraceTokenExpiredError(error)) {
          await retryWithFreshToken(inquiryId)
        } else {
          throw error
        }
      }
      
    } catch (error: any) {
      handleAcceptError(error)
    } finally {
      isAccepting.value = false
    }
  }
  
  /**
   * Retry accept with fresh grace token.
   * 
   * SSOT Addendum F.2: Grace token TTL 45s
   * 
   * If token expired, fetch fresh availability and retry ONCE.
   */
  async function retryWithFreshToken(inquiryId: string): Promise<void> {
    // Force refresh availability
    await acceptanceStore.fetchAvailability(true)
    
    const freshToken = acceptanceStore.data?.grace_token
    
    if (!freshToken) {
      throw new Error('No accepts available after refresh')
    }
    
    // Retry accept with fresh token
    await acceptInquiry(inquiryId, freshToken)
    
    // Success
    await handleAcceptSuccess(inquiryId)
  }
  
  /**
   * Handle successful accept.
   */
  async function handleAcceptSuccess(inquiryId: string): Promise<void> {
    // Invalidate acceptance cache
    acceptanceStore.invalidate()
    
    // Refresh inquiries list
    await inquiriesStore.refetch()
    
    // Show success toast
    toast.success('Inquiry accepted successfully!')
    
    // Analytics
    trackAcceptSuccess(inquiryId)
  }
  
  /**
   * Handle accept error.
   */
  function handleAcceptError(error: any): void {
    const message = error.message || 'Failed to accept inquiry'
    
    // Show error toast
    toast.error(message)
    
    // Analytics
    if (isLimitReachedError(error)) {
      trackAcceptLimitReached()
    } else {
      trackAcceptError(error)
    }
  }
  
  /**
   * Check if error is "grace token expired".
   */
  function isGraceTokenExpiredError(error: any): boolean {
    return (
      error.message?.includes('Grace token expired') ||
      error.message?.includes('Invalid grace token') ||
      error.response?.data?.error?.includes('token')
    )
  }
  
  /**
   * Check if error is "limit reached".
   */
  function isLimitReachedError(error: any): boolean {
    return (
      error.message?.includes('limit reached') ||
      error.message?.includes('No accepts available')
    )
  }
  
  /**
   * Track accept success.
   */
  function trackAcceptSuccess(inquiryId: string): void {
    // Analytics event
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'acceptance_used', {
        inquiry_id: inquiryId,
        remaining_after: acceptanceStore.remainingAccepts
      })
    }
  }
  
  /**
   * Track accept limit reached.
   */
  function trackAcceptLimitReached(): void {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'acceptance_limit_reached', {
        remaining: acceptanceStore.remainingAccepts
      })
    }
  }
  
  /**
   * Track accept error.
   */
  function trackAcceptError(error: any): void {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'acceptance_error', {
        error: error.message
      })
    }
  }
  
  return {
    isAccepting,
    handleAccept
  }
}
