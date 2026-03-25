import { describe, it, expect, vi, beforeEach } from 'vitest'

// We test _getDedupeKey directly — it's the pure logic unit.
// Full adapter integration is covered by existing interceptor tests + manual QA.

describe('apiClient GET dedup', () => {
  let _getDedupeKey: (config: Record<string, unknown>) => string | null

  beforeEach(async () => {
    // Reset module cache to get fresh import
    vi.resetModules()

    // Mock dependencies that apiClient.js imports at module level
    vi.doMock('axios', () => {
      const mockAdapter = vi.fn((config) => Promise.resolve({ data: {}, status: 200, config }))
      const instance = {
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() },
        },
        defaults: { adapter: mockAdapter },
        get: vi.fn(),
        post: vi.fn(),
        create: vi.fn(),
      }
      instance.create = vi.fn(() => instance)
      return {
        default: {
          create: instance.create,
          defaults: { adapter: mockAdapter },
          getAdapter: vi.fn(() => mockAdapter),
        },
      }
    })

    vi.doMock('@/modules/auth/store/authStore', () => ({
      useAuthStore: vi.fn(() => ({})),
    }))
    vi.doMock('@/stores/loaderStore', () => ({
      useLoaderStore: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
    }))
    vi.doMock('@/utils/notify', () => ({
      notifyError: vi.fn(),
      notifyWarning: vi.fn(),
    }))

    const mod = await import('@/utils/apiClient')
    _getDedupeKey = (mod as any)._getDedupeKey
  })

  it('generates key for GET requests', () => {
    const config = { method: 'get', url: '/v1/users/me/limits/' }
    const key = _getDedupeKey(config)
    expect(key).toBe('GET:/v1/users/me/limits/:')
  })

  it('deduplicates identical GET requests (same key)', () => {
    const config1 = { method: 'get', url: '/v1/users/me/limits/' }
    const config2 = { method: 'get', url: '/v1/users/me/limits/' }
    expect(_getDedupeKey(config1)).toBe(_getDedupeKey(config2))
  })

  it('does not dedupe POST requests', () => {
    const config = { method: 'post', url: '/v1/users/relations/request-tutor/' }
    expect(_getDedupeKey(config)).toBeNull()
  })

  it('does not dedupe PATCH requests', () => {
    const config = { method: 'patch', url: '/v1/users/me/' }
    expect(_getDedupeKey(config)).toBeNull()
  })

  it('does not dedupe DELETE requests', () => {
    const config = { method: 'delete', url: '/v1/items/123/' }
    expect(_getDedupeKey(config)).toBeNull()
  })

  it('different params produce different keys', () => {
    const config1 = { method: 'get', url: '/v1/items/', params: { status: 'active' } }
    const config2 = { method: 'get', url: '/v1/items/', params: { status: 'draft' } }
    expect(_getDedupeKey(config1)).not.toBe(_getDedupeKey(config2))
  })

  it('same params in different order produce same key', () => {
    const config1 = { method: 'get', url: '/v1/items/', params: { a: '1', b: '2' } }
    const config2 = { method: 'get', url: '/v1/items/', params: { b: '2', a: '1' } }
    expect(_getDedupeKey(config1)).toBe(_getDedupeKey(config2))
  })

  it('different URLs produce different keys', () => {
    const config1 = { method: 'get', url: '/v1/users/me/limits/' }
    const config2 = { method: 'get', url: '/v1/users/me/entitlements/' }
    expect(_getDedupeKey(config1)).not.toBe(_getDedupeKey(config2))
  })

  it('returns null when method is undefined', () => {
    const config = { url: '/v1/items/' }
    expect(_getDedupeKey(config)).toBeNull()
  })

  it('handles config with no params', () => {
    const config = { method: 'get', url: '/v1/dashboard/' }
    const key = _getDedupeKey(config)
    expect(key).toBe('GET:/v1/dashboard/:')
    expect(key).not.toBeNull()
  })
})
