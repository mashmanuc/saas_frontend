import { describe, it, expect } from 'vitest'
import { queryClient } from '@/app/queryClient'

describe('queryClient config', () => {
  it('has correct default staleTime', () => {
    const defaults = queryClient.getDefaultOptions()
    expect(defaults.queries?.staleTime).toBe(60_000)
  })

  it('has correct gcTime', () => {
    const defaults = queryClient.getDefaultOptions()
    expect(defaults.queries?.gcTime).toBe(5 * 60_000)
  })

  it('has retry set to 1', () => {
    const defaults = queryClient.getDefaultOptions()
    expect(defaults.queries?.retry).toBe(1)
  })

  it('refetchOnWindowFocus is false', () => {
    const defaults = queryClient.getDefaultOptions()
    expect(defaults.queries?.refetchOnWindowFocus).toBe(false)
  })

  it('refetchOnReconnect is true', () => {
    const defaults = queryClient.getDefaultOptions()
    expect(defaults.queries?.refetchOnReconnect).toBe(true)
  })
})
