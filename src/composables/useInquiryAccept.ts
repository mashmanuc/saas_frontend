import { ref } from 'vue'
import { useAcceptanceStore } from '@/stores/acceptanceStore'
import { useInquiriesStore } from '@/stores/inquiriesStore'
import { useContactAccessStore } from '@/stores/contactAccessStore'
import { useRelationsStore } from '@/stores/relationsStore'
import { acceptInquiry } from '@/api/acceptance'
import { notifySuccess, notifyError } from '@/utils/notify'

/**
 * Composable for inquiry accept flow.
 * 
 * SSOT-compliant accept flow with grace token retry.
 */
export function useInquiryAccept() {
  const acceptanceStore = useAcceptanceStore()
  const inquiriesStore = useInquiriesStore()
  const contactAccessStore = useContactAccessStore()
  const relationsStore = useRelationsStore()

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
      // Step 1: Always fetch fresh availability (grace token TTL=45s)
      await acceptanceStore.fetchAvailability(true)
      
      // Step 2: Accept with grace token (if available)
      const graceToken = acceptanceStore.data?.grace_token
      
      try {
        const result = await acceptInquiry(inquiryId, graceToken)
        
        // Success
        await handleAcceptSuccess(inquiryId, result)
        
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
    const result = await acceptInquiry(inquiryId, freshToken)
    
    // Success
    await handleAcceptSuccess(inquiryId, result)
  }
  
  /**
   * Handle successful accept.
   * 
   * Phase 1 v0.87.1: ТЗ-1.1 Синхронізація ContactAccess
   * ⚠️ R-P0-1: ContactAccess синхронізується для відображення контактів,
   * але НЕ використовується як gate для чату
   */
  async function handleAcceptSuccess(inquiryId: string, result: any): Promise<void> {
    // Optimistic UI update: immediately mark inquiry as ACCEPTED in store
    const storeItems = inquiriesStore.items
    const idx = storeItems.findIndex(i => String(i.id) === String(inquiryId))
    if (idx !== -1) {
      storeItems[idx] = { ...storeItems[idx], status: 'ACCEPTED' }
    }
    
    // Invalidate acceptance cache
    acceptanceStore.invalidate()
    
    // Phase 1 v0.87.1: ТЗ-1.1 - Синхронізація ContactAccess після accept
    if (result?.relation?.id) {
      try {
        await contactAccessStore.fetchContactAccessByRelation(result.relation.id)
      } catch {
        // Не блокуємо flow якщо не вдалося отримати контакти
      }
    }
    
    // Оновлюємо relations - relation.status стане 'active'
    try {
      await relationsStore.fetchRelations()
    } catch {
      // Не блокуємо flow
    }
    
    // Refresh inquiries list
    await inquiriesStore.refetch()
    
    // Show success notification
    notifySuccess('Запит прийнято. Контакти відкрито.')
    
    // Analytics
    trackAcceptSuccess(inquiryId)
  }
  
  /**
   * Extract human-readable message from axios error or plain error.
   * Backend returns DomainError format: { code, meta } (no message field!)
   * or APIError format: { error: { code, detail } }
   */
  function getErrorMessage(error: any): string {
    const data = error?.response?.data
    return (
      data?.message ||                                    // старий формат DomainError (apps.core.exceptions)
      data?.error?.detail ||                             // APIError format
      (data?.code && data?.meta?.reason
        ? `${data.code}: ${data.meta.reason}`            // новий DomainError (apps.core.errors)
        : null) ||
      data?.code ||
      error?.message ||
      'Помилка при прийнятті запиту'
    )
  }

  /**
   * Handle accept error.
   * Shows notification AND re-throws so caller can react.
   */
  function handleAcceptError(error: any): void {
    // Ф5 (token-teardown): CONTACTS_BALANCE_TOO_LOW більше не існує (accept завжди
    // безкоштовний, BE-гілку видалено) — paywall-детект прибрано. SaaS-ліміти (403
    // LIMIT_EXCEEDED) обробляє глобальний інтерсептор apiClient → LimitPaywallModal.

    const message = getErrorMessage(error)

    // Show error via the real notification system (notifyStore → ToastContainer)
    notifyError(message)

    // Analytics
    if (isLimitReachedError(error)) {
      trackAcceptLimitReached()
    } else {
      trackAcceptError(error)
    }

    // Re-throw so TutorInquiriesView can handle it too
    throw error
  }

  /**
   * Check if error is "grace token expired" or "grace token required".
   * Backend returns { code, message, meta } via DomainError handler.
   * Axios wraps it in error.response.data.
   */
  function isGraceTokenExpiredError(error: any): boolean {
    const data = error?.response?.data
    const backendMessage = data?.message || ''
    const backendReason = data?.meta?.reason || ''
    const axiosMessage = error?.message || ''
    return (
      backendMessage.includes('Grace token expired') ||
      backendMessage.includes('Invalid grace token') ||
      backendMessage.includes('grace_token') ||
      backendReason.includes('grace_token') ||
      axiosMessage.includes('Grace token expired')
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
