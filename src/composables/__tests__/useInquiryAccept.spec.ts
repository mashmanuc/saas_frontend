import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useInquiryAccept } from '../useInquiryAccept'
import { useAcceptanceStore } from '@/stores/acceptanceStore'
import { useInquiriesStore } from '@/stores/inquiriesStore'
import * as acceptanceApi from '@/api/acceptance'

vi.mock('@/api/acceptance')
vi.mock('@/utils/notify', () => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
  notifyWarning: vi.fn(),
}))

/**
 * Helper: set up stores with standard mocks for accept tests.
 * Composable calls fetchAvailability(true) first, so we mock that
 * to populate the store data.
 */
function setupStores(overrides: Record<string, any> = {}) {
  const acceptanceStore = useAcceptanceStore()
  const inquiriesStore = useInquiriesStore()

  // fetchAvailability populates store.data
  const storeData = {
    can_accept: true,
    remaining_accepts: 3,
    grace_token: 'token123',
    ...overrides,
  }
  vi.spyOn(acceptanceStore, 'fetchAvailability').mockImplementation(async () => {
    acceptanceStore.data = storeData as any
    acceptanceStore.status = 'ready' as any
  })
  vi.spyOn(acceptanceStore, 'invalidate').mockImplementation(() => {
    acceptanceStore.data = { ...acceptanceStore.data!, remaining_accepts: 0 } as any
  })
  vi.spyOn(inquiriesStore, 'refetch').mockResolvedValue()

  return { acceptanceStore, inquiriesStore }
}

describe('useInquiryAccept', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()

    // Mock window.gtag
    ;(globalThis as any).window = Object.assign(globalThis.window ?? {}, { gtag: vi.fn() })
  })

  it('should accept inquiry with grace token', async () => {
    const { inquiriesStore } = setupStores({ grace_token: 'token123' })

    vi.mocked(acceptanceApi.acceptInquiry).mockResolvedValue({
      inquiry_id: '123',
      status: 'accepted',
      accepted_at: '2026-02-02T12:00:00Z',
    } as any)

    const { handleAccept } = useInquiryAccept()

    await handleAccept('123')

    expect(acceptanceApi.acceptInquiry).toHaveBeenCalledWith('123', 'token123')
    expect(inquiriesStore.refetch).toHaveBeenCalled()
  })

  it('should retry with fresh token if grace token expired', async () => {
    const { acceptanceStore } = setupStores({ grace_token: 'old_token' })

    // First call fails with expired token
    vi.mocked(acceptanceApi.acceptInquiry)
      .mockRejectedValueOnce(Object.assign(new Error('Grace token expired'), { message: 'Grace token expired' }))
      .mockResolvedValueOnce({
        inquiry_id: '123',
        status: 'accepted',
        accepted_at: '2026-02-02T12:00:00Z',
      } as any)

    // On retry, fetchAvailability returns fresh token
    let callCount = 0
    vi.mocked(acceptanceStore.fetchAvailability).mockImplementation(async () => {
      callCount++
      acceptanceStore.data = {
        can_accept: true,
        remaining_accepts: callCount === 1 ? 3 : 2,
        grace_token: callCount === 1 ? 'old_token' : 'fresh_token',
      } as any
    })

    const { handleAccept } = useInquiryAccept()

    await handleAccept('123')

    expect(acceptanceApi.acceptInquiry).toHaveBeenCalledTimes(2)
    expect(acceptanceApi.acceptInquiry).toHaveBeenNthCalledWith(1, '123', 'old_token')
    expect(acceptanceApi.acceptInquiry).toHaveBeenNthCalledWith(2, '123', 'fresh_token')
  })

  it('should not retry if error is not grace token expired', async () => {
    setupStores({ grace_token: 'token123' })

    vi.mocked(acceptanceApi.acceptInquiry).mockRejectedValue(
      new Error('Inquiry already accepted'),
    )

    const { handleAccept } = useInquiryAccept()

    // handleAcceptError re-throws, so we expect a throw
    await expect(handleAccept('123')).rejects.toThrow()

    // Should NOT retry
    expect(acceptanceApi.acceptInquiry).toHaveBeenCalledTimes(1)
  })

  it('should prevent double-click', async () => {
    setupStores({ grace_token: 'token123' })

    vi.mocked(acceptanceApi.acceptInquiry).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({} as any), 100)),
    )

    const { handleAccept } = useInquiryAccept()

    // First call
    const promise1 = handleAccept('123')

    // Second call (should be ignored because isAccepting is true)
    await handleAccept('123')

    await promise1

    // Should only call API once (fetchAvailability + acceptInquiry)
    expect(acceptanceApi.acceptInquiry).toHaveBeenCalledTimes(1)
  })
})
