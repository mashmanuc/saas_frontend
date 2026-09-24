/**
 * «Ранній доступ» — екран тарифу, поки продаж вимкнено (слово власника 2026-09-24).
 *
 * ЧОМУ ЦЕЙ ТЕСТ ІСНУЄ
 * Новий учитель бачив на одній сторінці «FREE», «Без підписки», список лімітів,
 * рядок «Продаж тарифів зараз вимкнено» і порожню історію платежів — і не
 * розумів, він щось купив, щось втратив чи має платити.
 *
 * ІНВАРІАНТИ
 *   INV-EA-1  новий FREE + sales_enabled=false → лише «Ранній доступ»
 *   INV-EA-2  на ньому немає плану, вітрини, історії й слова FREE
 *   INV-EA-3  помилка /billing/plans/ НЕ маскується під ранній доступ
 *   INV-EA-4  той, хто платив (PRO / pending / історія), свій стан не втрачає
 *   INV-EA-5  sales_enabled=true — платний екран незмінний
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AccountBillingView from '../AccountBillingView.vue'
import type { BillingMeDto } from '../../api/dto'

const getMe = vi.fn()
const getPlans = vi.fn()
const getPaymentHistory = vi.fn()
vi.mock('../../api/billingApi', () => ({
  getMe: (...a: unknown[]) => getMe(...a),
  getPlans: (...a: unknown[]) => getPlans(...a),
  getPaymentHistory: (...a: unknown[]) => getPaymentHistory(...a),
  startCheckout: vi.fn(),
  cancelSubscription: vi.fn(),
}))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (k: string) => k, d: (x: Date) => String(x) }),
}))

const PLAN = {
  code: 'PRO', name: 'PRO', is_active: true, sort_order: 10, interval: 'monthly',
  price: { amount: 49900, currency: 'UAH' }, features: [],
}

function me(overrides: Partial<BillingMeDto> = {}): BillingMeDto {
  return {
    // Дзеркало прода 2026-09-24: без підписки сервер віддає ОБ'ЄКТ зі
    // `status: 'none'`, а не null. Тест на `null` пропустив би дефект.
    subscription: { status: 'none', provider: 'none', current_period_end: null, cancel_at_period_end: false, canceled_at: null } as never,
    entitlement: { plan_code: 'FREE', features: [], expires_at: null },
    pending_plan_code: null, pending_since: null,
    display_plan_code: 'FREE', subscription_status: 'none',
    plan: 'FREE', expires_at: null, is_active: false,
    pending_age_seconds: null, last_checkout_order_id: null, last_checkout_created_at: null,
    ...overrides,
  } as BillingMeDto
}

async function mountView() {
  const w = mount(AccountBillingView, { global: { mocks: { $t: (k: string) => k } } })
  await flushPromises(); await flushPromises()
  return w
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  getMe.mockResolvedValue(me())
  getPlans.mockResolvedValue({ plans: [PLAN], sales_enabled: false })
  getPaymentHistory.mockResolvedValue({ results: [], count: 0 })
})

describe('екран тарифу, поки продаж вимкнено', () => {
  it('INV-EA-1 + 2: новий FREE бачить лише «Ранній доступ»', async () => {
    const w = await mountView()
    expect(w.find('[data-testid="early-access"]').exists()).toBe(true)
    expect(w.text()).toContain('billing.earlyAccess.cardTitle')

    expect(w.findComponent({ name: 'CurrentPlanCard' }).exists()).toBe(false)
    expect(w.findComponent({ name: 'PlansList' }).exists()).toBe(false)
    expect(w.findComponent({ name: 'PaymentHistorySection' }).exists()).toBe(false)
    expect(w.find('[data-testid="sales-disabled-notice"]').exists()).toBe(false)
    expect(w.text()).not.toContain('FREE')
    // Шапка «Ваш план / керуйте підпискою» дублювала б заголовок екрана
    // (власник побачив на проді 2026-09-24), а керувати там нічим.
    expect(w.text()).not.toContain('billing.page.title')
    expect(w.text()).not.toContain('billing.page.subtitle')
  })

  it('INV-EA-3: /billing/plans/ упав → звичайний екран, а не ранній доступ', async () => {
    getPlans.mockRejectedValue(new Error('500'))
    const w = await mountView()
    expect(w.find('[data-testid="early-access"]').exists()).toBe(false)
  })

  it('INV-EA-3-біс: історія платежів недоступна → теж не ховаємо', async () => {
    getPaymentHistory.mockRejectedValue(new Error('500'))
    const w = await mountView()
    expect(w.find('[data-testid="early-access"]').exists()).toBe(false)
  })

  it('INV-EA-4: PRO не втрачає свій стан', async () => {
    getMe.mockResolvedValue(me({
      subscription: { status: 'active', provider: 'liqpay', current_period_end: '2026-12-01T00:00:00Z', cancel_at_period_end: false, canceled_at: null },
      entitlement: { plan_code: 'PRO', features: [], expires_at: '2026-12-01T00:00:00Z' },
      plan: 'PRO', display_plan_code: 'PRO', subscription_status: 'active', is_active: true,
    }))
    const w = await mountView()
    expect(w.find('[data-testid="early-access"]').exists()).toBe(false)
    expect(w.findComponent({ name: 'CurrentPlanCard' }).exists()).toBe(true)
  })

  it('INV-EA-4-біс: очікуваний платіж або минулі оплати теж лишають екран як був', async () => {
    getMe.mockResolvedValue(me({ pending_plan_code: 'PRO' }))
    expect((await mountView()).find('[data-testid="early-access"]').exists()).toBe(false)

    setActivePinia(createPinia())
    getMe.mockResolvedValue(me())
    getPaymentHistory.mockResolvedValue({ results: [{ id: 1 }], count: 1 })
    expect((await mountView()).find('[data-testid="early-access"]').exists()).toBe(false)
  })

  // Повторна спроба після успішної відповіді: сервер замовк — рішення про
  // ранній доступ більше не спирається на стару відповідь (fail-closed).
  it('INV-EA-3-трі: після успіху наступна помилка знімає ознаку «сервер відповів»', async () => {
    const { useBillingStore } = await import('../../stores/billingStore')
    const store = useBillingStore()
    await store.fetchPlans()
    expect(store.plansAnswered).toBe(true)

    getPlans.mockRejectedValue(new Error('500'))
    await store.fetchPlans().catch(() => {})
    expect(store.plansAnswered).toBe(false)
  })

  // Підписка вже активна, а entitlement ще не перемкнувся (вікно між оплатою
  // і вебхуком): людина платить — раннього доступу вона бачити не має.
  it('INV-EA-4-три: активна підписка при FREE-entitlement теж лишає екран як був', async () => {
    getMe.mockResolvedValue(me({
      subscription: { status: 'active', provider: 'liqpay', current_period_end: '2026-12-01T00:00:00Z', cancel_at_period_end: false, canceled_at: null } as never,
    }))
    const w = await mountView()
    expect(w.find('[data-testid="early-access"]').exists()).toBe(false)
  })

  it('INV-EA-5: продаж увімкнено → платний екран без змін', async () => {
    getPlans.mockResolvedValue({ plans: [PLAN], sales_enabled: true })
    const w = await mountView()
    expect(w.find('[data-testid="early-access"]').exists()).toBe(false)
    expect(w.findComponent({ name: 'CurrentPlanCard' }).exists()).toBe(true)
    expect(w.findComponent({ name: 'PlansList' }).exists()).toBe(true)
    expect(w.findComponent({ name: 'PaymentHistorySection' }).exists()).toBe(true)
    expect(w.text()).toContain('billing.page.title')   // шапка платного екрана на місці
  })
})
