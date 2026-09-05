/**
 * /pro (публічний USD-лендинг) — fail-closed щодо продажу (2026-09-05).
 *
 * Рішення власника: продаж зараз не вмикаємо. Сторінка не має обіцяти ціну й
 * кнопку оплати, якщо бекенд явно не відповів `sales_enabled: true`. Три стани:
 *   - явне true  → ціна ($19.99), CTA зверху і в блоку ціни є;
 *   - явне false → нічого з цього немає, лишається «Try the board»;
 *   - старий BE без поля / помилка запиту → те саме, що false (fail-closed).
 *
 * Ізольовано від API (billingApi замокано) і від auth/router.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/modules/billing/api/billingApi', () => ({
  getMe: vi.fn().mockRejectedValue(new Error('offline (mocked)')),
  getPlans: vi.fn().mockRejectedValue(new Error('offline (mocked)')),
  startCheckout: vi.fn(),
  cancelSubscription: vi.fn(),
  getPaymentHistory: vi.fn().mockRejectedValue(new Error('offline (mocked)')),
}))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/modules/auth/store/authStore', () => ({
  useAuthStore: () => ({ isAuthenticated: false }),
}))

import ProLandingView from '../ProLandingView.vue'
import * as billingApi from '@/modules/billing/api/billingApi'

const PRO_USD = {
  code: 'pro-usd', title: 'Pro (International)', price: { amount: 1999, currency: 'USD' },
  interval: 'monthly', features: [], is_active: true, sort_order: 10,
}

async function mountLanding() {
  const w = mount(ProLandingView)
  await flushPromises()
  return w
}

describe('ProLandingView — продаж fail-closed', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('sales_enabled:true → ціна і обидві кнопки оплати є', async () => {
    vi.mocked(billingApi.getPlans).mockResolvedValue({ plans: [PRO_USD], sales_enabled: true } as any)
    const w = await mountLanding()
    expect(w.find('[data-testid="pro-cta-top"]').exists()).toBe(true)
    expect(w.find('[data-testid="pro-cta-price"]').exists()).toBe(true)
    expect(w.find('[data-testid="pro-price-block"]').exists()).toBe(true)
    expect(w.text()).toContain('$19.99')
  })

  it('sales_enabled:false → ні ціни, ні кнопок оплати; «Try the board» лишається', async () => {
    vi.mocked(billingApi.getPlans).mockResolvedValue({ plans: [], sales_enabled: false } as any)
    const w = await mountLanding()
    expect(w.find('[data-testid="pro-cta-top"]').exists()).toBe(false)
    expect(w.find('[data-testid="pro-cta-price"]').exists()).toBe(false)
    expect(w.find('[data-testid="pro-price-block"]').exists()).toBe(false)
    expect(w.text()).not.toContain('$19.99')
    expect(w.find('[data-testid="pro-try-board"]').exists()).toBe(true)
  })

  it('старий BE без поля sales_enabled → як false (fail-closed)', async () => {
    vi.mocked(billingApi.getPlans).mockResolvedValue({ plans: [PRO_USD] } as any)
    const w = await mountLanding()
    expect(w.find('[data-testid="pro-cta-top"]').exists()).toBe(false)
    expect(w.text()).not.toContain('$19.99')
  })

  it('помилка запиту планів → як false, без необробленого reject', async () => {
    vi.mocked(billingApi.getPlans).mockRejectedValue(new Error('offline (mocked)'))
    const w = await mountLanding()
    expect(w.find('[data-testid="pro-cta-top"]').exists()).toBe(false)
    expect(w.find('[data-testid="pro-price-block"]').exists()).toBe(false)
    expect(w.text()).not.toContain('$19.99')
  })
})
