import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useInquiryAccept } from '../useInquiryAccept'
import { useAcceptanceStore } from '@/stores/acceptanceStore'
import { useInquiriesStore } from '@/stores/inquiriesStore'
import * as acceptanceApi from '@/api/acceptance'

vi.mock('@/api/acceptance')
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn()
  })
}))

describe('useInquiryAccept', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    
    // Mock window.gtag
    global.window = { gtag: vi.fn() } as any
  })
  
  it('should accept inquiry with grace token', async () => {
    const acceptanceStore = useAcceptanceStore()
    const inquiriesStore = useInquiriesStore()
    
    acceptanceStore.data = {
      can_accept: true,
      remaining_accepts: 3,
      grace_token: 'token123'
    }
    acceptanceStore.status = 'ready'
    
    vi.mocked(acceptanceApi.acceptInquiry).mockResolvedValue({
      inquiry_id: '123',
      status: 'accepted',
      accepted_at: '2026-02-02T12:00:00Z'
    })
    
    vi.spyOn(inquiriesStore, 'refetch').mockResolvedValue()
    
    const { handleAccept } = useInquiryAccept()
    
    await handleAccept('123')
    
    expect(acceptanceApi.acceptInquiry).toHaveBeenCalledWith('123', 'token123')
    expect(inquiriesStore.refetch).toHaveBeenCalled()
  })
  
  it('should retry with fresh token if grace token expired', async () => {
    const acceptanceStore = useAcceptanceStore()
    const inquiriesStore = useInquiriesStore()
    
    // Initial data
    acceptanceStore.data = {
      can_accept: true,
      remaining_accepts: 3,
      grace_token: 'old_token'
    }
    acceptanceStore.status = 'ready'
    
    // First call fails with expired token
    vi.mocked(acceptanceApi.acceptInquiry)
      .mockRejectedValueOnce(new Error('Grace token expired'))
      .mockResolvedValueOnce({
        inquiry_id: '123',
        status: 'accepted',
        accepted_at: '2026-02-02T12:00:00Z'
      })
    
    // Fresh availability
    vi.mocked(acceptanceApi.getAcceptAvailability).mockResolvedValue({
      can_accept: true,
      remaining_accepts: 2,
      grace_token: 'fresh_token'
    })
    
    vi.spyOn(inquiriesStore, 'refetch').mockResolvedValue()
    
    const { handleAccept } = useInquiryAccept()
    
    await handleAccept('123')
    
    // Should retry with fresh token
    expect(acceptanceApi.acceptInquiry).toHaveBeenCalledTimes(2)
    expect(acceptanceApi.acceptInquiry).toHaveBeenNthCalledWith(1, '123', 'old_token')
    expect(acceptanceApi.acceptInquiry).toHaveBeenNthCalledWith(2, '123', 'fresh_token')
  })
  
  it('should not retry if error is not grace token expired', async () => {
    const acceptanceStore = useAcceptanceStore()
    
    acceptanceStore.data = {
      can_accept: true,
      remaining_accepts: 3,
      grace_token: 'token123'
    }
    acceptanceStore.status = 'ready'
    
    vi.mocked(acceptanceApi.acceptInquiry).mockRejectedValue(
      new Error('Inquiry already accepted')
    )
    
    const { handleAccept } = useInquiryAccept()
    
    // Should not throw, error is handled internally
    await handleAccept('123')
    
    // Should NOT retry
    expect(acceptanceApi.acceptInquiry).toHaveBeenCalledTimes(1)
  })
  
  it('should invalidate acceptance cache after success', async () => {
    const acceptanceStore = useAcceptanceStore()
    const inquiriesStore = useInquiriesStore()
    
    acceptanceStore.data = {
      can_accept: true,
      remaining_accepts: 3,
      grace_token: 'token123'
    }
    acceptanceStore.status = 'ready'
    
    vi.mocked(acceptanceApi.acceptInquiry).mockResolvedValue({
      inquiry_id: '123',
      status: 'accepted',
      accepted_at: '2026-02-02T12:00:00Z'
    })
    
    vi.spyOn(inquiriesStore, 'refetch').mockResolvedValue()
    vi.spyOn(acceptanceStore, 'invalidate')
    
    const { handleAccept } = useInquiryAccept()
    
    await handleAccept('123')
    
    expect(acceptanceStore.invalidate).toHaveBeenCalled()
  })
  
  it('should prevent double-click', async () => {
    const acceptanceStore = useAcceptanceStore()
    
    acceptanceStore.data = {
      can_accept: true,
      remaining_accepts: 3,
      grace_token: 'token123'
    }
    acceptanceStore.status = 'ready'
    
    vi.mocked(acceptanceApi.acceptInquiry).mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 100))
    )
    
    const { handleAccept, isAccepting } = useInquiryAccept()
    
    // First call
    const promise1 = handleAccept('123')
    
    // Second call (should be ignored)
    await handleAccept('123')
    
    await promise1
    
    // Should only call API once
    expect(acceptanceApi.acceptInquiry).toHaveBeenCalledTimes(1)
  })
  
  it('should track analytics events', async () => {
    const acceptanceStore = useAcceptanceStore()
    const inquiriesStore = useInquiriesStore()
    
    acceptanceStore.data = {
      can_accept: true,
      remaining_accepts: 3,
      grace_token: 'token123'
    }
    acceptanceStore.status = 'ready'
    
    vi.mocked(acceptanceApi.acceptInquiry).mockResolvedValue({
      inquiry_id: '123',
      status: 'accepted',
      accepted_at: '2026-02-02T12:00:00Z'
    })
    
    vi.spyOn(inquiriesStore, 'refetch').mockResolvedValue()
    
    const { handleAccept } = useInquiryAccept()
    
    await handleAccept('123')
    
    // After invalidate, remainingAccepts becomes 0
    expect(window.gtag).toHaveBeenCalledWith('event', 'acceptance_used', {
      inquiry_id: '123',
      remaining_after: 0
    })
  })
})
