/**
 * PR-1 білінгу (2026-09-04): картка поточного плану говорить правду.
 *
 * Інваріанти під тестом:
 *  1. «Поточний план» і ліміти — лише з entitlement, не з pending.
 *  2. Pending — окрема плашка, а не «поточний».
 *  5. Немає підписки + pending: сторінка стабільна, Free-entitlement не схований.
 *  «Немає pending» → плашки немає.
 *
 * Реальний DOM (happy-dom), реальний компонент; i18n — ключі як є, щоб
 * assert-и були про семантику, а не про переклад.
 */
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, named?: Record<string, unknown>) =>
      named ? `${key}|${JSON.stringify(named)}` : key,
    te: () => false,
    d: (date: Date) => date.toISOString().slice(0, 10),
  }),
}))

// UpgradeHint тягне router-link і телеметрію — не предмет цього тесту.
vi.mock('../UpgradeHint.vue', () => ({
  default: { name: 'UpgradeHint', template: '<span data-testid="upgrade-hint" />' },
}))

import CurrentPlanCard from '../CurrentPlanCard.vue'

const FREE_LIMITS = { monthly_ai_requests: 20, monthly_exports: 5, monthly_imports: 10 }
const PRO_LIMITS = { monthly_ai_requests: null, monthly_exports: null, monthly_imports: null }

const noSubscription = {
  status: 'none',
  provider: 'none',
  current_period_end: null,
  cancel_at_period_end: false,
  canceled_at: null,
}

function mountCard(props: Record<string, unknown>) {
  return mount(CurrentPlanCard, {
    props: {
      planCode: 'FREE',
      pendingPlanCode: null,
      subscription: noSubscription,
      entitlement: { plan_code: 'FREE', features: [], limits: FREE_LIMITS, expires_at: null },
      loading: false,
      ...props,
    },
    global: {
      mocks: {
        $t: (key: string, named?: Record<string, unknown>) =>
          named ? `${key}|${JSON.stringify(named)}` : key,
      },
      stubs: { Card: { template: '<section><slot /></section>' }, Button: true },
    },
  })
}

describe('CurrentPlanCard (PR-1)', () => {
  it('active FREE + pending PRO: поточний = FREE, ліміти Free, pending окремою плашкою', () => {
    const w = mountCard({ planCode: 'FREE', pendingPlanCode: 'PRO' })

    expect(w.get('[data-testid="current-plan-code"]').text()).toBe('FREE')
    // ліміти саме Free (20/5/10), а не Pro (∞)
    expect(w.text()).toContain('billing.planFeatures.monthlyAi|{"value":"20"}')
    expect(w.text()).not.toContain('monthlyAiUnlimited')
    // pending — окремо, з назвою плану, за який чекаємо
    const notice = w.get('[data-testid="pending-plan-notice"]')
    expect(notice.text()).toContain('billing.currentPlanCard.pendingAwaiting|{"plan":"PRO"}')
    expect(notice.text()).toContain('billing.currentPlanCard.pendingLimitsNote|{"plan":"FREE"}')
    // «поточний» ніде не називає PRO
    expect(w.get('[data-testid="current-plan-code"]').text()).not.toContain('PRO')
  })

  it('немає підписки + pending PRO: рендериться стабільно, Free-entitlement не схований', () => {
    const w = mountCard({
      planCode: 'FREE',
      pendingPlanCode: 'PRO',
      subscription: null,
    })

    expect(w.get('[data-testid="current-plan-code"]').text()).toBe('FREE')
    expect(w.text()).toContain('billing.planFeatures.monthlyExports|{"value":"5"}')
    expect(w.find('[data-testid="pending-plan-notice"]').exists()).toBe(true)
    // «Без підписки» не показуємо поверх pending — очікування важливіше
    expect(w.find('[data-testid="no-subscription-state"]').exists()).toBe(false)
  })

  it('немає pending: плашки немає; Free без підписки бачить і план, і «без підписки»', () => {
    const w = mountCard({ planCode: 'FREE', pendingPlanCode: null })

    expect(w.find('[data-testid="pending-plan-notice"]').exists()).toBe(false)
    expect(w.get('[data-testid="current-plan-code"]').text()).toBe('FREE')
    expect(w.find('[data-testid="no-subscription-state"]').exists()).toBe(true)
    expect(w.text()).toContain('billing.planFeatures.monthlyImports|{"value":"10"}')
  })

  it('active PRO без pending: поточний PRO, ліміти ∞, ні плашки, ні «без підписки»', () => {
    const w = mountCard({
      planCode: 'PRO',
      pendingPlanCode: null,
      subscription: {
        status: 'active',
        provider: 'plata',
        current_period_end: '2026-10-01T00:00:00Z',
        cancel_at_period_end: false,
        canceled_at: null,
      },
      entitlement: { plan_code: 'PRO', features: [], limits: PRO_LIMITS, expires_at: '2026-10-01T00:00:00Z' },
    })

    expect(w.get('[data-testid="current-plan-code"]').text()).toBe('PRO')
    expect(w.text()).toContain('billing.planFeatures.monthlyAiUnlimited')
    expect(w.find('[data-testid="pending-plan-notice"]').exists()).toBe(false)
    expect(w.find('[data-testid="no-subscription-state"]').exists()).toBe(false)
  })

  it('BILLING_SALES_ENABLED=false: апсел «Доступно у PRO» схований, план і ліміти лишаються', () => {
    const w = mountCard({ planCode: 'FREE', pendingPlanCode: null, salesEnabled: false })
    expect(w.find('[data-testid="upgrade-hint-slot"]').exists()).toBe(false)
    expect(w.find('[data-testid="upgrade-hint"]').exists()).toBe(false)
    expect(w.get('[data-testid="current-plan-code"]').text()).toBe('FREE')
    expect(w.text()).toContain('billing.planFeatures.monthlyAi|{"value":"20"}')
  })

  it('продаж увімкнено (дефолт пропа): апсел на Free без підписки є', () => {
    const w = mountCard({ planCode: 'FREE', pendingPlanCode: null })
    expect(w.find('[data-testid="upgrade-hint"]').exists()).toBe(true)
  })

  it('pending за той самий план, що вже чинний (`pro` vs PRO) — плашки немає', () => {
    const w = mountCard({
      planCode: 'PRO',
      pendingPlanCode: 'pro',
      subscription: { ...noSubscription, status: 'active', provider: 'plata' },
      entitlement: { plan_code: 'PRO', features: [], limits: PRO_LIMITS, expires_at: null },
    })
    expect(w.find('[data-testid="pending-plan-notice"]').exists()).toBe(false)
  })
})
