import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock apiClient as axios-like instance with interceptors
const mockRequestUse = vi.fn()
// Транспортний дедуп (INV-2) — керований із тестів: скільки GET-ів склеєно.
let mockCollapsed = 0
vi.mock('@/utils/apiClient', () => {
  return {
    default: {
      interceptors: {
        request: { use: (...args: any[]) => mockRequestUse(...args) },
        response: { use: vi.fn() },
      },
    },
    getDedupStats: () => ({ collapsed: mockCollapsed, inFlight: 0 }),
  }
})

import {
  attachNetworkTracker,
  getNetworkStats,
  resetNetworkStats,
  detachNetworkTracker,
} from '../networkTracker'

describe('networkTracker', () => {
  let capturedInterceptor: (config: any) => any

  beforeEach(() => {
    mockCollapsed = 0
    detachNetworkTracker()
    mockRequestUse.mockReset()
    mockRequestUse.mockImplementation((fn: any) => {
      capturedInterceptor = fn
    })
  })

  it('counts requests via interceptor', () => {
    attachNetworkTracker()
    expect(mockRequestUse).toHaveBeenCalledTimes(1)

    // Simulate 3 POST requests (no dedup key)
    capturedInterceptor({ method: 'post', url: '/api/v1/auth/login' })
    capturedInterceptor({ method: 'post', url: '/api/v1/auth/login' })
    capturedInterceptor({ method: 'delete', url: '/api/v1/items/1' })

    const stats = getNetworkStats()
    expect(stats.requests).toBe(3)
    expect(stats.duplicates).toBe(0)
  })

  it('detects duplicates — same GET URL+params within window', () => {
    attachNetworkTracker(5_000)

    // First GET — not a duplicate
    capturedInterceptor({ method: 'get', url: '/api/v1/relations', params: { status: 'active' } })
    expect(getNetworkStats().duplicates).toBe(0)

    // Second identical GET within window — IS a duplicate
    capturedInterceptor({ method: 'get', url: '/api/v1/relations', params: { status: 'active' } })
    expect(getNetworkStats().duplicates).toBe(1)

    // Third identical GET — another duplicate
    capturedInterceptor({ method: 'get', url: '/api/v1/relations', params: { status: 'active' } })
    expect(getNetworkStats().duplicates).toBe(2)
  })

  it('different params produce different dedupe keys — no duplicate', () => {
    attachNetworkTracker(5_000)

    capturedInterceptor({ method: 'get', url: '/api/v1/relations', params: { status: 'active' } })
    capturedInterceptor({ method: 'get', url: '/api/v1/relations', params: { status: 'pending' } })

    expect(getNetworkStats().duplicates).toBe(0)
    expect(getNetworkStats().requests).toBe(2)
  })

  it('reset clears counters', () => {
    attachNetworkTracker()

    capturedInterceptor({ method: 'get', url: '/api/v1/test' })
    capturedInterceptor({ method: 'get', url: '/api/v1/test' })
    expect(getNetworkStats().requests).toBe(2)
    expect(getNetworkStats().duplicates).toBe(1)

    resetNetworkStats()
    expect(getNetworkStats().requests).toBe(0)
    expect(getNetworkStats().duplicates).toBe(0)
  })

  it('does not modify request config (returns config as-is)', () => {
    attachNetworkTracker()

    const config = { method: 'get', url: '/test', params: { a: 1 }, headers: { 'X-Custom': 'val' } }
    const configBefore = JSON.stringify(config)
    const result = capturedInterceptor(config)

    expect(result).toBe(config)
    expect(JSON.stringify(result)).toBe(configBefore)
  })

  it('attaches interceptor only once', () => {
    attachNetworkTracker()
    attachNetworkTracker()
    attachNetworkTracker()

    expect(mockRequestUse).toHaveBeenCalledTimes(1)
  })

  /**
   * Склеєні транспортом ≠ дублі в мережі.
   *
   * Інтерсептор бачить ДВА однакові GET, але adapter-дедуп apiClient (INV-2)
   * другий склеює з in-flight — у мережу йде один. Оверлей раніше показував
   * «Duplicate requests (1) ❌» саме на таку, коректно виконану роботу
   * (живий скрін 2026-08-16), і це вчило ігнорувати червоний бейдж.
   */
  describe('склеєні транспортом не рахуються дублями', () => {
    function twoIdenticalGets() {
      attachNetworkTracker()
      capturedInterceptor({ method: 'get', url: '/api/v1/x/', params: { a: 1 } })
      capturedInterceptor({ method: 'get', url: '/api/v1/x/', params: { a: 1 } })
    }

    it('усі повтори склеєні → duplicates 0, але видно, що їх помічено', () => {
      mockCollapsed = 1
      twoIdenticalGets()

      const s = getNetworkStats()
      expect(s.duplicates).toBe(0)
      expect(s.duplicatesSeen).toBe(1)
      expect(s.duplicatesCollapsed).toBe(1)
    })

    it('повтор пішов у мережу (нічого не склеєно) → duplicates 1', () => {
      mockCollapsed = 0
      twoIdenticalGets()

      expect(getNetworkStats().duplicates).toBe(1)
    })

    it('склеєних більше, ніж помічено у вікні → не йде в мінус', () => {
      // Реально: перший запит висів довше за вікно дедупу, тож інтерсептор
      // повтору не зарахував, а транспорт його все одно склеїв.
      mockCollapsed = 3
      twoIdenticalGets()

      expect(getNetworkStats().duplicates).toBe(0)
    })

    it('відсутній getDedupStats (старий мок/оточення) не валить статистику', () => {
      mockCollapsed = null as unknown as number   // → NaN у відніманні, якби не guard
      twoIdenticalGets()

      const s = getNetworkStats()
      expect(Number.isFinite(s.duplicates)).toBe(true)
      expect(s.duplicates).toBeGreaterThanOrEqual(0)
    })
  })
})
