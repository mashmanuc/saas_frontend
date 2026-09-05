/**
 * PR-1 білінгу (2026-09-04): друга вітрина тарифів (/tutor/billing/plans).
 *
 *  - BILLING_SALES_ENABLED=false → сітки планів немає, є повідомлення, кнопка
 *    оплати не існує, а прямий виклик buyPlan не йде в стор/API.
 *  - PRO-USD при entitlement PRO — «ваш поточний план», без кнопки оплати.
 *
 * Ізольовано від API: модуль billingApi підмінено цілком.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/modules/billing/api/billingApi', () => ({
  getMe: vi.fn().mockRejectedValue(new Error('offline (mocked)')),
  getPlans: vi.fn().mockRejectedValue(new Error('offline (mocked)')),
  startCheckout: vi.fn(),
  cancelSubscription: vi.fn(),
  getPaymentHistory: vi.fn().mockRejectedValue(new Error('offline (mocked)')),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key, locale: { value: 'uk' } }),
}))

import PlansView from '../PlansView.vue'
import { useBillingStore } from '@/modules/billing/stores/billingStore'

const PRO_USD = {
  code: 'pro-usd', title: 'Pro (International)', price: { amount: 19.99, currency: 'USD' },
  interval: 'monthly', features: [], is_active: true, sort_order: 10, is_featured: true,
}
const BUSINESS = {
  code: 'business', title: 'Business', price: { amount: 999, currency: 'UAH' },
  interval: 'monthly', features: [], is_active: true, sort_order: 20,
}

function mountView() {
  return mount(PlansView, {
    global: {
      mocks: { $t: (k: string) => k },
      stubs: {
        Heading: true,
        Card: { template: '<section v-bind="$attrs"><slot /></section>' },
        Button: { template: '<button v-bind="$attrs"><slot /></button>' },
        Sparkles: true, Check: true, Star: true,
      },
    },
  })
}

describe('PlansView (PR-1)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('продаж вимкнено: сітки немає, повідомлення є, buyPlan не йде в стор', async () => {
    const w = mountView()
    const store = useBillingStore()
    const spy = vi.spyOn(store, 'startCheckout').mockResolvedValue({} as any)
    store.plans = [PRO_USD, BUSINESS] as any
    store.salesEnabled = false
    store.isLoadingPlans = false
    store.lastError = null
    await w.vm.$nextTick()

    expect(w.find('[data-testid="sales-disabled-notice"]').exists()).toBe(true)
    expect(w.find('[data-testid="plans-grid"]').exists()).toBe(false)
    expect(w.text()).not.toContain('billing.plans.subscribe')

    await (w.vm as any).buyPlan(BUSINESS)
    expect(spy).not.toHaveBeenCalled()
    expect(w.text()).toContain('billing.errors.salesDisabled')
  })

  it('продаж увімкнено, entitlement PRO: PRO-USD = «ваш поточний план», BUSINESS — оплата', async () => {
    const w = mountView()
    const store = useBillingStore()
    store.me = {
      subscription: { status: 'active', provider: 'plata', current_period_end: null, cancel_at_period_end: false, canceled_at: null },
      entitlement: { plan_code: 'PRO', features: [], expires_at: null },
      pending_plan_code: null, pending_since: null, display_plan_code: 'PRO', subscription_status: 'active',
      plan: 'PRO', expires_at: null, is_active: true, pending_age_seconds: null,
      last_checkout_order_id: null, last_checkout_created_at: null,
    } as any
    store.plans = [PRO_USD, BUSINESS] as any
    store.salesEnabled = true
    store.isLoadingPlans = false
    store.lastError = null
    await w.vm.$nextTick()

    const cards = w.findAll('[data-testid="plans-grid"] > section')
    expect(cards).toHaveLength(2)
    expect(cards[0].text()).toContain('billing.yourCurrentPlan')
    expect(cards[0].text()).not.toContain('billing.plans.subscribe')
    expect(cards[1].text()).toContain('billing.plans.subscribe')
  })
})
