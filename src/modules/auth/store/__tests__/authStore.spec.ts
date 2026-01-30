import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '../authStore'
import authApi from '../../api/authApi'

vi.mock('../../api/authApi', () => {
  const mockFn = () => vi.fn()
  return {
    default: {
      login: vi.fn(),
      csrf: vi.fn(),
      mfaVerify: vi.fn(),
      requestAccountUnlock: vi.fn(),
      confirmAccountUnlock: vi.fn(),
      logout: vi.fn(),
      getCurrentUser: vi.fn(),
    },
  }
})
vi.mock('../../../../utils/storage', () => ({
  storage: {
    getAccess: vi.fn(() => null),
    getUser: vi.fn(() => null),
    setAccess: vi.fn(),
    setUser: vi.fn(),
    clearAll: vi.fn(),
  },
}))

describe('authStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('getters', () => {
    it('isAuthenticated повертає true коли є access та user', () => {
      const store = useAuthStore()
      store.access = 'test-token'
      store.user = { id: 1, email: 'test@example.com' }
      
      expect(store.isAuthenticated).toBe(true)
    })

    it('isAuthenticated повертає false коли немає access', () => {
      const store = useAuthStore()
      store.access = null
      store.user = { id: 1, email: 'test@example.com' }
      
      expect(store.isAuthenticated).toBe(false)
    })

    it('isAccountLocked повертає true коли lastErrorCode === account_locked', () => {
      const store = useAuthStore()
      store.lastErrorCode = 'account_locked'
      
      expect(store.isAccountLocked).toBe(true)
    })

    it('canRequestUnlock повертає true коли акаунт заблоковано', () => {
      const store = useAuthStore()
      store.lastErrorCode = 'account_locked'
      
      expect(store.canRequestUnlock).toBe(true)
    })

    it('hasTrial повертає true коли trialStatus.active === true', () => {
      const store = useAuthStore()
      store.trialStatus = { active: true, days_left: 7 }
      
      expect(store.hasTrial).toBe(true)
    })

    it('trialDaysLeft повертає кількість днів', () => {
      const store = useAuthStore()
      store.trialStatus = { active: true, days_left: 5 }
      
      expect(store.trialDaysLeft).toBe(5)
    })
  })

  describe('actions', () => {
    describe('login', () => {
      it('успішний логін встановлює access та user', async () => {
        const store = useAuthStore()
        const mockResponse = {
          access: 'test-token',
          user: { id: 1, email: 'test@example.com', role: 'student' },
        }
        
        vi.mocked(authApi.login).mockResolvedValue(mockResponse)
        vi.mocked(authApi.csrf).mockResolvedValue({ csrf: 'csrf-token' })
        
        const result = await store.login({ email: 'test@example.com', password: 'password' })
        
        expect(store.access).toBe('test-token')
        expect(store.user).toEqual(mockResponse.user)
        expect(result).toEqual(mockResponse.user)
      })

      it('логін з MFA повертає mfa_required', async () => {
        const store = useAuthStore()
        const mockResponse = {
          mfa_required: true,
          session_id: 'mfa-session-123',
        }
        
        vi.mocked(authApi.login).mockResolvedValue(mockResponse)
        
        const result = await store.login({ email: 'test@example.com', password: 'password' })
        
        expect(result).toEqual({ mfa_required: true, session_id: 'mfa-session-123' })
        expect(store.pendingMfaSessionId).toBe('mfa-session-123')
        expect(store.lastErrorCode).toBe('mfa_required')
      })
    })

    describe('requestAccountUnlock', () => {
      it('успішний запит на розблокування', async () => {
        const store = useAuthStore()
        vi.mocked(authApi.requestAccountUnlock).mockResolvedValue({ status: 'ok' })
        
        const result = await store.requestAccountUnlock('test@example.com')
        
        expect(result).toEqual({ success: true })
        expect(authApi.requestAccountUnlock).toHaveBeenCalledWith({ email: 'test@example.com' })
      })

      it('обробляє помилку запиту на розблокування', async () => {
        const store = useAuthStore()
        const mockError = {
          response: {
            status: 500,
            data: { message: 'Server error' },
          },
        }
        
        vi.mocked(authApi.requestAccountUnlock).mockRejectedValue(mockError)
        
        await expect(store.requestAccountUnlock('test@example.com')).rejects.toThrow()
        expect(store.error).toBeTruthy()
      })
    })

    describe('confirmAccountUnlock', () => {
      it('успішне підтвердження розблокування', async () => {
        const store = useAuthStore()
        store.lockedUntil = '2026-01-30T12:00:00Z'
        store.lastErrorCode = 'account_locked'
        
        vi.mocked(authApi.confirmAccountUnlock).mockResolvedValue({ status: 'ok' })
        
        const result = await store.confirmAccountUnlock('unlock-token-123')
        
        expect(result).toEqual({ success: true })
        expect(store.lockedUntil).toBeNull()
        expect(store.lastErrorCode).toBeNull()
      })
    })

    describe('handleError', () => {
      it('обробляє 423 (account_locked) та зберігає lockedUntil', () => {
        const store = useAuthStore()
        const mockError = {
          response: {
            status: 423,
            data: {
              message: 'Account locked',
              details: { locked_until: '2026-01-30T12:00:00Z' },
            },
          },
        }
        
        store.handleError(mockError)
        
        expect(store.lastErrorCode).toBe('account_locked')
        expect(store.lockedUntil).toBe('2026-01-30T12:00:00Z')
        expect(store.error).toContain('Account locked')
      })

      it('обробляє 429 (rate_limited)', () => {
        const store = useAuthStore()
        const mockError = {
          response: {
            status: 429,
            headers: { 'retry-after': '60' },
          },
        }
        
        store.handleError(mockError)
        
        expect(store.lastErrorCode).toBe('rate_limited')
        expect(store.error).toContain('Забагато запитів')
      })
    })
  })
})
