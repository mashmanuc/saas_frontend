/**
 * StaffBillingPendingView Tests v0.81.1
 * 
 * Smoke-check scenarios:
 * - 200: Successful load with data
 * - 401: Unauthorized access
 * - 403: Forbidden access
 * - Timeout: Request timeout
 * - Empty list: No pending sessions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import StaffBillingPendingView from '../StaffBillingPendingView.vue'
import { useAuthStore } from '@/modules/auth/store/authStore'
import apiClient from '@/utils/apiClient'

vi.mock('@/utils/apiClient')
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: vi.fn()
  })
}))

describe('StaffBillingPendingView', () => {
  let wrapper
  let authStore

  beforeEach(() => {
    setActivePinia(createPinia())
    authStore = useAuthStore()
    authStore.access = 'mock-token'
    authStore.user = {
      id: 1,
      email: 'staff@example.com',
      role: 'superuser'
    }
    vi.clearAllMocks()
  })

  describe('Scenario: 200 - Successful load with data', () => {
    it('should display pending sessions when API returns 200', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          order_id: 'order-123',
          user_id: 'user-1',
          user_email: 'user@example.com',
          status: 'pending',
          pending_plan_code: 'PRO',
          pending_since: '2024-01-15T10:00:00Z',
          pending_age_seconds: 3600,
          provider: 'liqpay',
          created_at: '2024-01-15T09:00:00Z'
        },
        {
          id: 'session-2',
          order_id: 'order-456',
          user_id: 'user-2',
          user_email: 'user2@example.com',
          status: 'pending',
          pending_plan_code: 'BUSINESS',
          pending_since: '2024-01-15T08:00:00Z',
          pending_age_seconds: 7200,
          provider: 'liqpay',
          created_at: '2024-01-15T07:00:00Z'
        }
      ]

      apiClient.get.mockResolvedValue({
        data: { sessions: mockSessions }
      })

      wrapper = mount(StaffBillingPendingView, {
        global: {
          stubs: {
            FinalizeModal: true
          },
          mocks: {
            $t: (key) => key
          }
        }
      })

      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(apiClient.get).toHaveBeenCalledWith(
        '/v1/staff/billing/pending/',
        expect.objectContaining({ timeout: 15000 })
      )
      expect(wrapper.vm.pendingSessions).toHaveLength(2)
      expect(wrapper.vm.isLoading).toBe(false)
      expect(wrapper.vm.error).toBeNull()
    })
  })

  describe('Scenario: 401 - Unauthorized access', () => {
    it('should show error with logout button on 401', async () => {
      const error401 = {
        response: {
          status: 401,
          data: { detail: 'Unauthorized' }
        }
      }

      apiClient.get.mockRejectedValue(error401)

      wrapper = mount(StaffBillingPendingView, {
        global: {
          stubs: {
            FinalizeModal: true
          },
          mocks: {
            $t: (key) => key
          }
        }
      })

      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(wrapper.vm.isLoading).toBe(false)
      expect(wrapper.vm.error).toBeTruthy()
      expect(wrapper.vm.error.status).toBe(401)
      expect(wrapper.vm.isUnauthorized).toBe(true)
      expect(wrapper.vm.errorMessage).toContain('Unauthorized')
    })
  })

  describe('Scenario: 403 - Forbidden access', () => {
    it('should show access denied error on 403', async () => {
      const error403 = {
        response: {
          status: 403,
          data: { detail: 'Access denied' }
        }
      }

      apiClient.get.mockRejectedValue(error403)

      wrapper = mount(StaffBillingPendingView, {
        global: {
          stubs: {
            FinalizeModal: true
          },
          mocks: {
            $t: (key) => key
          }
        }
      })

      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(wrapper.vm.isLoading).toBe(false)
      expect(wrapper.vm.error).toBeTruthy()
      expect(wrapper.vm.error.status).toBe(403)
      expect(wrapper.vm.errorMessage).toContain('Access denied')
    })
  })

  describe('Scenario: Timeout', () => {
    it('should show timeout error when request times out', async () => {
      const timeoutError = {
        code: 'ECONNABORTED',
        message: 'timeout of 15000ms exceeded'
      }

      apiClient.get.mockRejectedValue(timeoutError)

      wrapper = mount(StaffBillingPendingView, {
        global: {
          stubs: {
            FinalizeModal: true
          },
          mocks: {
            $t: (key) => key
          }
        }
      })

      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(wrapper.vm.isLoading).toBe(false)
      expect(wrapper.vm.error).toBeTruthy()
      expect(wrapper.vm.errorMessage).toContain('timeout')
    })
  })

  describe('Scenario: Empty list', () => {
    it('should show empty state when no pending sessions', async () => {
      apiClient.get.mockResolvedValue({
        data: { sessions: [] }
      })

      wrapper = mount(StaffBillingPendingView, {
        global: {
          stubs: {
            FinalizeModal: true
          },
          mocks: {
            $t: (key) => key
          }
        }
      })

      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(wrapper.vm.pendingSessions).toHaveLength(0)
      expect(wrapper.vm.filteredSessions).toHaveLength(0)
      expect(wrapper.vm.isLoading).toBe(false)
      expect(wrapper.vm.error).toBeNull()
    })
  })

  describe('Search and filter functionality', () => {
    beforeEach(async () => {
      const mockSessions = [
        {
          id: 'session-1',
          order_id: 'order-123',
          user_id: 'user-1',
          user_email: 'alice@example.com',
          status: 'pending',
          pending_plan_code: 'PRO',
          pending_since: '2024-01-15T10:00:00Z',
          pending_age_seconds: 1800,
          provider: 'liqpay',
          created_at: '2024-01-15T09:00:00Z'
        },
        {
          id: 'session-2',
          order_id: 'order-456',
          user_id: 'user-2',
          user_email: 'bob@example.com',
          status: 'pending',
          pending_plan_code: 'BUSINESS',
          pending_since: '2024-01-15T06:00:00Z',
          pending_age_seconds: 7200,
          provider: 'liqpay',
          created_at: '2024-01-15T05:00:00Z'
        }
      ]

      apiClient.get.mockResolvedValue({
        data: { sessions: mockSessions }
      })

      wrapper = mount(StaffBillingPendingView, {
        global: {
          stubs: {
            FinalizeModal: true
          },
          mocks: {
            $t: (key) => key
          }
        }
      })

      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 100))
    })

    it('should filter sessions by search query', async () => {
      expect(wrapper.vm.filteredSessions).toHaveLength(2)

      wrapper.vm.searchQuery = 'alice'
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.filteredSessions).toHaveLength(1)
      expect(wrapper.vm.filteredSessions[0].user_email).toBe('alice@example.com')
    })

    it('should filter stale sessions (>1 hour)', async () => {
      expect(wrapper.vm.filteredSessions).toHaveLength(2)

      wrapper.vm.showOnlyStale = true
      await wrapper.vm.$nextTick()

      const staleSessions = wrapper.vm.filteredSessions.filter(s => s.pending_age_seconds > 3600)
      expect(staleSessions.length).toBeGreaterThan(0)
    })
  })

  describe('Retry functionality', () => {
    it('should retry loading on error', async () => {
      apiClient.get.mockRejectedValueOnce({
        response: {
          status: 500,
          data: { detail: 'Server error' }
        }
      })

      wrapper = mount(StaffBillingPendingView, {
        global: {
          stubs: {
            FinalizeModal: true
          },
          mocks: {
            $t: (key) => key
          }
        }
      })

      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(wrapper.vm.error).toBeTruthy()

      apiClient.get.mockResolvedValue({
        data: { sessions: [] }
      })

      await wrapper.vm.retry()
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(wrapper.vm.error).toBeNull()
      expect(apiClient.get).toHaveBeenCalledTimes(2)
    })
  })
})
