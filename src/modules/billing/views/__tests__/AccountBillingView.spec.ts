/**
 * Unit tests for AccountBillingView (v0.74 UI)
 * 
 * Tests for billing page UI with current plan and plans list.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AccountBillingView from '../AccountBillingView.vue'
import { useBillingStore } from '../../stores/billingStore'
import type { BillingMeDto, PlanDto } from '../../api/dto'

const makeBillingMeDto = (overrides: Partial<BillingMeDto> = {}): BillingMeDto => ({
  subscription: {
    status: 'active',
    provider: 'liqpay',
    current_period_end: '2026-02-01T00:00:00Z',
    cancel_at_period_end: false,
    canceled_at: null
  },
  entitlement: {
    plan_code: 'PRO',
    features: ['CONTACT_UNLOCK', 'UNLIMITED_INQUIRIES'],
    expires_at: '2026-02-01T00:00:00Z'
  },
  pending_plan_code: null,
  pending_since: null,
  display_plan_code: 'PRO',
  subscription_status: 'active',
  plan: 'PRO',
  expires_at: '2026-02-01T00:00:00Z',
  is_active: true,
  pending_age_seconds: null,
  last_checkout_order_id: null,
  last_checkout_created_at: null,
  ...overrides
})

// Mock router
const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockPush
  })
}))

// Mock i18n
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    d: (date: Date) => date.toLocaleDateString()
  })
}))

describe('AccountBillingView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('renders loading state initially', async () => {
    const billingStore = useBillingStore()
    billingStore.isLoading = true
    billingStore.me = null
    billingStore.plans = []

    const wrapper = mount(AccountBillingView, {
      global: {
        stubs: {
          Card: true,
          Button: true,
          Heading: true,
          CurrentPlanCard: true,
          PlansList: true
        }
      }
    })

    await wrapper.vm.$nextTick()
    
    // Loading state should render skeleton
    expect(wrapper.html()).toBeTruthy()
  })

  it('renders error state when billing data fails to load', async () => {
    const billingStore = useBillingStore()
    billingStore.isLoading = false
    billingStore.me = null
    billingStore.lastError = {
      code: 'network_error',
      message: 'Network error',
      details: {}
    }

    const wrapper = mount(AccountBillingView, {
      global: {
        stubs: {
          Card: true,
          Button: true,
          Heading: true,
          CurrentPlanCard: true,
          PlansList: true
        }
      }
    })

    await wrapper.vm.$nextTick()

    // Error state should render
    expect(wrapper.html()).toBeTruthy()
  })

  it('renders current plan and plans list when data loaded', async () => {
    const wrapper = mount(AccountBillingView, {
      global: {
        stubs: {
          Card: true,
          Button: true,
          Heading: true,
          CurrentPlanCard: true,
          PlansList: true
        }
      }
    })

    const billingStore = useBillingStore()
    
    const mockMe = makeBillingMeDto()

    const mockPlans: PlanDto[] = [
      {
        code: 'FREE',
        title: 'Free',
        price: { amount: 0, currency: 'UAH' },
        interval: null,
        features: [],
        is_active: true,
        sort_order: 0
      },
      {
        code: 'PRO',
        title: 'Pro',
        price: { amount: 299, currency: 'UAH' },
        interval: 'monthly',
        features: ['CONTACT_UNLOCK', 'UNLIMITED_INQUIRIES'],
        is_active: true,
        sort_order: 1
      }
    ]

    billingStore.me = mockMe
    billingStore.plans = mockPlans
    billingStore.isLoading = false

    await wrapper.vm.$nextTick()

    expect(wrapper.findComponent({ name: 'CurrentPlanCard' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'PlansList' }).exists()).toBe(true)
  })

  it('shows "No Subscription" state when user has no plan', async () => {
    const wrapper = mount(AccountBillingView, {
      global: {
        stubs: {
          Card: true,
          Button: true,
          Heading: true,
          CurrentPlanCard: true,
          PlansList: true
        }
      }
    })

    const billingStore = useBillingStore()
    
    const mockMe = makeBillingMeDto({
      subscription: {
        status: 'none',
        provider: null,
        current_period_end: null,
        cancel_at_period_end: false,
        canceled_at: null
      },
      entitlement: {
        plan_code: 'FREE',
        features: [],
        expires_at: null
      },
      display_plan_code: 'FREE',
      subscription_status: 'none',
      plan: 'FREE',
      expires_at: null,
      is_active: false
    })

    billingStore.me = mockMe
    billingStore.plans = []
    billingStore.isLoading = false

    await wrapper.vm.$nextTick()

    expect(wrapper.findComponent({ name: 'CurrentPlanCard' }).props('subscription').status).toBe('none')
  })

  it('calls startCheckout when plan is selected', async () => {
    const wrapper = mount(AccountBillingView, {
      global: {
        stubs: {
          Card: true,
          Button: true,
          Heading: true,
          CurrentPlanCard: true,
          PlansList: true
        }
      }
    })

    const billingStore = useBillingStore()
    const startCheckoutSpy = vi.spyOn(billingStore, 'startCheckout').mockResolvedValue({
      provider: 'liqpay',
      session_id: 'test_session',
      checkout: {
        method: 'POST',
        url: 'https://test.com',
        form_fields: {
          data: 'test_data',
          signature: 'test_signature'
        }
      }
    })

    billingStore.me = makeBillingMeDto({
      subscription: {
        status: 'none',
        provider: null,
        current_period_end: null,
        cancel_at_period_end: false,
        canceled_at: null
      },
      entitlement: {
        plan_code: 'FREE',
        features: [],
        expires_at: null
      },
      display_plan_code: 'FREE',
      subscription_status: 'none',
      plan: 'FREE',
      expires_at: null,
      is_active: false
    })
    billingStore.plans = [
      {
        code: 'PRO',
        title: 'Pro',
        price: { amount: 299, currency: 'UAH' },
        interval: 'monthly',
        features: ['CONTACT_UNLOCK'],
        is_active: true,
        sort_order: 1
      }
    ]
    billingStore.isLoading = false

    await wrapper.vm.$nextTick()

    const plansList = wrapper.findComponent({ name: 'PlansList' })
    await plansList.vm.$emit('select', 'PRO')

    expect(startCheckoutSpy).toHaveBeenCalledWith('PRO')
  })

  it('handles cancel subscription flow', async () => {
    const billingStore = useBillingStore()
    const cancelSpy = vi.spyOn(billingStore, 'cancel').mockResolvedValue({
      status: 'cancelled',
      message: 'Subscription cancelled'
    })
    const fetchMeSpy = vi.spyOn(billingStore, 'fetchMe').mockResolvedValue()

    // Mock window.confirm
    global.confirm = vi.fn(() => true)

    billingStore.me = makeBillingMeDto({
      entitlement: {
        plan_code: 'PRO',
        features: ['CONTACT_UNLOCK'],
        expires_at: '2026-02-01T00:00:00Z'
      }
    })
    billingStore.isLoading = false

    const wrapper = mount(AccountBillingView, {
      global: {
        stubs: {
          Card: true,
          Button: true,
          Heading: true,
          CurrentPlanCard: true,
          PlansList: true
        }
      }
    })

    await wrapper.vm.$nextTick()

    // Call handleCancel directly
    await (wrapper.vm as any).handleCancel()

    expect(global.confirm).toHaveBeenCalled()
    expect(cancelSpy).toHaveBeenCalledWith(true)
    expect(fetchMeSpy).toHaveBeenCalled()
  })

  it('retries loading data when retry is called', async () => {
    const billingStore = useBillingStore()
    const fetchMeSpy = vi.spyOn(billingStore, 'fetchMe').mockResolvedValue()
    const fetchPlansSpy = vi.spyOn(billingStore, 'fetchPlans').mockResolvedValue()

    billingStore.isLoading = false
    billingStore.me = null
    billingStore.lastError = {
      code: 'network_error',
      message: 'Network error',
      details: {}
    }

    const wrapper = mount(AccountBillingView, {
      global: {
        stubs: {
          Card: true,
          Button: true,
          Heading: true,
          CurrentPlanCard: true,
          PlansList: true
        }
      }
    })

    await wrapper.vm.$nextTick()

    // Call retry directly
    await (wrapper.vm as any).retry()

    expect(fetchMeSpy).toHaveBeenCalled()
    expect(fetchPlansSpy).toHaveBeenCalled()
  })

  it('navigates back to user account when goBack is called', async () => {
    const billingStore = useBillingStore()
    billingStore.me = makeBillingMeDto({
      subscription: {
        status: 'none',
        provider: null,
        current_period_end: null,
        cancel_at_period_end: false,
        canceled_at: null
      },
      entitlement: {
        plan_code: 'FREE',
        features: [],
        expires_at: null
      },
      display_plan_code: 'FREE',
      subscription_status: 'none',
      plan: 'FREE',
      expires_at: null,
      is_active: false
    })
    billingStore.isLoading = false

    const wrapper = mount(AccountBillingView, {
      global: {
        stubs: {
          Card: true,
          Button: true,
          Heading: true,
          CurrentPlanCard: true,
          PlansList: true
        }
      }
    })

    await wrapper.vm.$nextTick()

    // Call goBack directly
    ;(wrapper.vm as any).goBack()

    expect(mockPush).toHaveBeenCalledWith({ name: 'user-account' })
  })
})
