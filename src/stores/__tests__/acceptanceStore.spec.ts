import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAcceptanceStore } from '../acceptanceStore'
import * as acceptanceApi from '@/api/acceptance'

vi.mock('@/api/acceptance')

describe('acceptanceStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })
  
  it('should fetch availability successfully', async () => {
    const mockData = {
      can_accept: true,
      remaining_accepts: 3,
      grace_token: 'abc123',
      expires_at: '2026-02-02T12:00:45Z'
    }
    
    vi.mocked(acceptanceApi.getAcceptAvailability).mockResolvedValue(mockData)
    
    const store = useAcceptanceStore()
    await store.fetchAvailability()
    
    expect(store.status).toBe('ready')
    expect(store.data).toEqual(mockData)
    expect(store.canAccept).toBe(true)
    expect(store.remainingAccepts).toBe(3)
    expect(store.hasGraceToken).toBe(true)
  })
  
  it('should cache data and not refetch unless forced', async () => {
    const mockData = {
      can_accept: true,
      remaining_accepts: 3
    }
    
    vi.mocked(acceptanceApi.getAcceptAvailability).mockResolvedValue(mockData)
    
    const store = useAcceptanceStore()
    
    // First fetch
    await store.fetchAvailability()
    expect(acceptanceApi.getAcceptAvailability).toHaveBeenCalledTimes(1)
    
    // Second fetch (cached)
    await store.fetchAvailability()
    expect(acceptanceApi.getAcceptAvailability).toHaveBeenCalledTimes(1)
    
    // Force refresh
    await store.fetchAvailability(true)
    expect(acceptanceApi.getAcceptAvailability).toHaveBeenCalledTimes(2)
  })
  
  it('should invalidate cache', async () => {
    const mockData = {
      can_accept: true,
      remaining_accepts: 3
    }
    
    vi.mocked(acceptanceApi.getAcceptAvailability).mockResolvedValue(mockData)
    
    const store = useAcceptanceStore()
    
    await store.fetchAvailability()
    expect(store.hasData).toBe(true)
    
    // Invalidate
    store.invalidate()
    
    expect(store.status).toBe('idle')
    expect(store.data).toBeNull()
    expect(store.hasData).toBe(false)
  })
  
  it('should handle error', async () => {
    const error = new Error('Network error')
    vi.mocked(acceptanceApi.getAcceptAvailability).mockRejectedValue(error)
    
    const store = useAcceptanceStore()
    
    await expect(store.fetchAvailability()).rejects.toThrow('Network error')
    
    expect(store.status).toBe('error')
    expect(store.error).toBe('Network error')
  })
  
  it('should return false for canAccept when no data', () => {
    const store = useAcceptanceStore()
    
    expect(store.canAccept).toBe(false)
    expect(store.remainingAccepts).toBe(0)
    expect(store.hasGraceToken).toBe(false)
  })
  
  it('should return false for canAccept when can_accept is false', async () => {
    const mockData = {
      can_accept: false,
      remaining_accepts: 0
    }
    
    vi.mocked(acceptanceApi.getAcceptAvailability).mockResolvedValue(mockData)
    
    const store = useAcceptanceStore()
    await store.fetchAvailability()
    
    expect(store.canAccept).toBe(false)
    expect(store.remainingAccepts).toBe(0)
  })
  
  it('should reset store to initial state', async () => {
    const mockData = {
      can_accept: true,
      remaining_accepts: 3
    }
    
    vi.mocked(acceptanceApi.getAcceptAvailability).mockResolvedValue(mockData)
    
    const store = useAcceptanceStore()
    await store.fetchAvailability()
    
    expect(store.hasData).toBe(true)
    
    store.reset()
    
    expect(store.status).toBe('idle')
    expect(store.data).toBeNull()
    expect(store.error).toBeNull()
  })
})
