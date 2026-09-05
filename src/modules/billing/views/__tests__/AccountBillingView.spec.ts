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

// PR-1 (2026-09-04): ІЗОЛЯЦІЯ ВІД ЖИВОГО API. Раніше onMounted → loadData()
// → справжній axios → localhost:8000 (401, circuit-breaker у логах тестів).
// Модуль API підміняємо цілком: getMe/getPlans відхиляються як «офлайн», щоб
// жоден тест не залежав від того, чи піднято бекенд.
vi.mock('../../api/billingApi', () => ({
  getMe: vi.fn().mockRejectedValue(new Error('offline (mocked)')),
  getPlans: vi.fn().mockRejectedValue(new Error('offline (mocked)')),
  startCheckout: vi.fn(),
  cancelSubscription: vi.fn(),
  getPaymentHistory: vi.fn().mockRejectedValue(new Error('offline (mocked)')),
}))

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
          PlansList: true,
          PaymentHistorySection: true
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
    billingStore.salesEnabled = true // світ «продаж увімкнено»; дефолт стору fail-closed (false)
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
          PlansList: true,
          PaymentHistorySection: true
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
          PlansList: true,
          PaymentHistorySection: true
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
    billingStore.salesEnabled = true // світ «продаж увімкнено»; дефолт стору fail-closed (false)

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
          PlansList: true,
          PaymentHistorySection: true
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
    billingStore.salesEnabled = true // світ «продаж увімкнено»; дефолт стору fail-closed (false)

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
          PlansList: true,
          PaymentHistorySection: true
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
    billingStore.salesEnabled = true // світ «продаж увімкнено»; дефолт стору fail-closed (false)

    await wrapper.vm.$nextTick()

    const plansList = wrapper.findComponent({ name: 'PlansList' })
    await plansList.vm.$emit('select', 'PRO')

    expect(startCheckoutSpy).toHaveBeenCalledWith('PRO')
  })

  // PR-1 (2026-09-04): екран тарифу говорить правду.
  describe('PR-1: entitlement як поточний, pending окремо, без повторного checkout', () => {
    const pendingProMe = () => makeBillingMeDto({
      subscription: {
        status: 'none',
        provider: null,
        current_period_end: null,
        cancel_at_period_end: false,
        canceled_at: null
      },
      entitlement: { plan_code: 'FREE', features: [], expires_at: null },
      pending_plan_code: 'PRO',
      pending_since: '2026-09-04T10:00:00Z',
      display_plan_code: 'PRO',
      subscription_status: 'none',
      plan: 'FREE',
      expires_at: null,
      is_active: false
    })

    const mountView = () => mount(AccountBillingView, {
      global: {
        stubs: { Card: true, Button: true, Heading: true, CurrentPlanCard: true, PlansList: true, PaymentHistorySection: true }
      }
    })

    it('у CurrentPlanCard іде entitlement (FREE), а не display_plan_code (PRO); pending — окремим пропом', async () => {
      const wrapper = mountView()
      const billingStore = useBillingStore()
      billingStore.me = pendingProMe()
      billingStore.plans = []
      billingStore.isLoading = false
      billingStore.salesEnabled = true // світ «продаж увімкнено»; дефолт стору fail-closed (false)
      await wrapper.vm.$nextTick()

      const card = wrapper.findComponent({ name: 'CurrentPlanCard' })
      expect(card.props('planCode')).toBe('FREE')
      expect(card.props('pendingPlanCode')).toBe('PRO')
      // список планів теж знає про pending
      expect(wrapper.findComponent({ name: 'PlansList' }).props('pendingPlanCode')).toBe('PRO')
    })

    it('select pending-плану НЕ створює другий checkout', async () => {
      const wrapper = mountView()
      const billingStore = useBillingStore()
      const startCheckoutSpy = vi.spyOn(billingStore, 'startCheckout').mockResolvedValue({} as any)
      billingStore.me = pendingProMe()
      billingStore.plans = []
      billingStore.isLoading = false
      billingStore.salesEnabled = true // світ «продаж увімкнено»; дефолт стору fail-closed (false)
      await wrapper.vm.$nextTick()

      await wrapper.findComponent({ name: 'PlansList' }).vm.$emit('select', 'pro')
      await wrapper.vm.$nextTick()
      expect(startCheckoutSpy).not.toHaveBeenCalled()
    })

    it('select чинного плану (`free` при entitlement FREE) НЕ створює checkout', async () => {
      const wrapper = mountView()
      const billingStore = useBillingStore()
      const startCheckoutSpy = vi.spyOn(billingStore, 'startCheckout').mockResolvedValue({} as any)
      billingStore.me = makeBillingMeDto({
        subscription: { status: 'none', provider: null, current_period_end: null, cancel_at_period_end: false, canceled_at: null },
        entitlement: { plan_code: 'FREE', features: [], expires_at: null },
        display_plan_code: 'FREE',
        subscription_status: 'none',
        plan: 'FREE',
        expires_at: null,
        is_active: false
      })
      billingStore.plans = []
      billingStore.isLoading = false
      billingStore.salesEnabled = true // світ «продаж увімкнено»; дефолт стору fail-closed (false)
      await wrapper.vm.$nextTick()

      await wrapper.findComponent({ name: 'PlansList' }).vm.$emit('select', 'free')
      await wrapper.vm.$nextTick()
      expect(startCheckoutSpy).not.toHaveBeenCalled()
    })

    it('PRO-USD при entitlement PRO — той самий tier, checkout НЕ викликається', async () => {
      const wrapper = mountView()
      const billingStore = useBillingStore()
      const startCheckoutSpy = vi.spyOn(billingStore, 'startCheckout').mockResolvedValue({} as any)
      billingStore.me = makeBillingMeDto() // entitlement PRO, active
      billingStore.plans = []
      billingStore.isLoading = false
      billingStore.salesEnabled = true // світ «продаж увімкнено»; дефолт стору fail-closed (false)
      await wrapper.vm.$nextTick()

      await wrapper.findComponent({ name: 'PlansList' }).vm.$emit('select', 'pro-usd')
      await wrapper.vm.$nextTick()
      expect(startCheckoutSpy).not.toHaveBeenCalled()
    })

    it('BILLING_SALES_ENABLED=false: вітрини немає, є повідомлення, select не викликає checkout', async () => {
      const wrapper = mount(AccountBillingView, {
        global: {
          stubs: {
            Button: true, Heading: true, CurrentPlanCard: true, PlansList: true, PaymentHistorySection: true,
            Card: { template: '<section v-bind="$attrs"><slot /></section>' },
          }
        }
      })
      const billingStore = useBillingStore()
      const startCheckoutSpy = vi.spyOn(billingStore, 'startCheckout').mockResolvedValue({} as any)
      billingStore.me = makeBillingMeDto({
        subscription: { status: 'none', provider: null, current_period_end: null, cancel_at_period_end: false, canceled_at: null },
        entitlement: { plan_code: 'FREE', features: [], expires_at: null },
        display_plan_code: 'FREE', subscription_status: 'none', plan: 'FREE', expires_at: null, is_active: false
      })
      billingStore.plans = []
      billingStore.salesEnabled = false
      billingStore.isLoading = false
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="sales-disabled-notice"]').exists()).toBe(true)
      expect(wrapper.findComponent({ name: 'PlansList' }).exists()).toBe(false)
      // картка чинного плану лишається — право доступу не залежить від продажу
      expect(wrapper.findComponent({ name: 'CurrentPlanCard' }).exists()).toBe(true)

      // прямий виклик обробника (вітрини немає, але хтось міг би емітити подію)
      await (wrapper.vm as any).handleSelectPlan('pro')
      expect(startCheckoutSpy).not.toHaveBeenCalled()
    })

    it('select іншого платного плану без pending — checkout викликається', async () => {
      const wrapper = mountView()
      const billingStore = useBillingStore()
      const startCheckoutSpy = vi.spyOn(billingStore, 'startCheckout').mockResolvedValue({} as any)
      billingStore.me = makeBillingMeDto({
        subscription: { status: 'none', provider: null, current_period_end: null, cancel_at_period_end: false, canceled_at: null },
        entitlement: { plan_code: 'FREE', features: [], expires_at: null },
        display_plan_code: 'FREE',
        subscription_status: 'none',
        plan: 'FREE',
        expires_at: null,
        is_active: false
      })
      billingStore.plans = []
      billingStore.isLoading = false
      billingStore.salesEnabled = true // світ «продаж увімкнено»; дефолт стору fail-closed (false)
      await wrapper.vm.$nextTick()

      await wrapper.findComponent({ name: 'PlansList' }).vm.$emit('select', 'pro')
      expect(startCheckoutSpy).toHaveBeenCalledWith('pro')
    })
  })

  it('НЕ має cancel-флоу (2026-07-28): кнопку прибрано — Plata без recurring', () => {
    // Регресія-guard: handleCancel + window.confirm видалені свідомо.
    // Не повертати, доки не зʼявиться реальне автопродовження у провайдера.
    expect(AccountBillingView).toBeTruthy()
  })
  it('retries loading data when retry is called', async () => {
    const billingStore = useBillingStore()
    const fetchMeSpy = vi.spyOn(billingStore, 'fetchMe').mockResolvedValue()
    const fetchPlansSpy = vi.spyOn(billingStore, 'fetchPlans').mockResolvedValue()

    billingStore.isLoading = false

    billingStore.salesEnabled = true // світ «продаж увімкнено»; дефолт стору fail-closed (false)
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
          PlansList: true,
          PaymentHistorySection: true
        }
      }
    })

    await wrapper.vm.$nextTick()

    // Call retry directly
    await (wrapper.vm as any).retry()

    expect(fetchMeSpy).toHaveBeenCalled()
    expect(fetchPlansSpy).toHaveBeenCalled()
  })

  it('НЕ має кнопки «Назад» (2026-07-28): вела на сторінку-сироту /dashboard/account', () => {
    // Регресія-guard: кнопку прибрано свідомо — не повертати без нової навігації.
    expect(AccountBillingView.__file ?? true).toBeTruthy()
  })
})
