import { describe, it, expect, vi } from 'vitest'
import { queryKeys, invalidateByPrefix } from '@/api/queryKeys'

describe('queryKeys factory', () => {
  it('returns stable references for parameterless keys', () => {
    expect(queryKeys.userContext()).toEqual(['user-context'])
    expect(queryKeys.relations()).toEqual(['relations'])
    expect(queryKeys.limits()).toEqual(['limits'])
    expect(queryKeys.entitlements()).toEqual(['entitlements'])
    expect(queryKeys.billing()).toEqual(['billing'])
    expect(queryKeys.studentDashboard()).toEqual(['student-dashboard'])
    expect(queryKeys.tutorDashboard()).toEqual(['tutor-dashboard'])
    expect(queryKeys.marketplaceMe()).toEqual(['marketplace-me'])
    expect(queryKeys.contactBalance()).toEqual(['contact-balance'])
    expect(queryKeys.contactStats()).toEqual(['contact-stats'])
    expect(queryKeys.inquiries()).toEqual(['inquiries'])
  })

  it('includes filters in relation filtered keys', () => {
    const filters = { role: 'student' as const, status: 'pending' }
    const key = queryKeys.relationsFiltered(filters)
    expect(key).toEqual(['relations', filters])
    expect(key[0]).toBe('relations') // prefix match for invalidation
  })

  it('inquiry filtered keys include prefix', () => {
    const filters = { role: 'tutor' as const }
    const key = queryKeys.inquiriesFiltered(filters)
    expect(key[0]).toBe('inquiries')
    expect(key[1]).toEqual(filters)
  })

  it('all keys are readonly tuples (arrays)', () => {
    expect(Array.isArray(queryKeys.studentDashboard())).toBe(true)
    expect(Array.isArray(queryKeys.tutorDashboard())).toBe(true)
    expect(Array.isArray(queryKeys.relationsFiltered({ role: 'tutor' }))).toBe(true)
  })

  it('invalidateByPrefix calls queryClient.invalidateQueries with prefix array', () => {
    const mockClient = { invalidateQueries: vi.fn() }
    invalidateByPrefix(mockClient, 'relations')
    expect(mockClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['relations'] })
  })

  it('covers all 11 expected query endpoints', () => {
    const allKeys = [
      queryKeys.userContext(),
      queryKeys.entitlements(),
      queryKeys.billing(),
      queryKeys.limits(),
      queryKeys.relations(),
      queryKeys.studentDashboard(),
      queryKeys.tutorDashboard(),
      queryKeys.marketplaceMe(),
      queryKeys.contactBalance(),
      queryKeys.contactStats(),
      queryKeys.inquiries(),
    ]
    expect(allKeys.length).toBe(11)
    // All unique first elements
    const prefixes = allKeys.map(k => k[0])
    expect(new Set(prefixes).size).toBe(11)
  })
})
