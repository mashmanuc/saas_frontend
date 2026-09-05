/**
 * PlanCard Component Unit Tests (v0.76.0)
 * 
 * Tests for PlanCard component with inactive plan logic
 */

import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
// Mock feature mapper BEFORE importing component
vi.mock('../../utils/featureMapper', () => ({
  getFeatureName: (featureCode: string) => `billing.features.${featureCode}`
}))

// Mock i18n BEFORE importing component
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

import PlanCard from '../PlanCard.vue'
import { formatMoney } from '../../utils/priceFormatter'

describe('PlanCard', () => {
  const mockPlan = {
    code: 'PRO',
    title: 'Pro Plan',
    price: {
      amount: 299,
      currency: 'UAH'
    },
    interval: 'monthly',
    features: ['CONTACT_UNLOCK', 'PRIORITY_SUPPORT'],
    is_active: true,
    sort_order: 1
  }

  const defaultProps = {
    plan: mockPlan,
    currentPlanCode: 'FREE',
    pendingPlanCode: null as string | null,
    loading: false
  }

  const mountPlanCard = (propsOverride: Partial<typeof defaultProps> = {}) => {
    return mount(PlanCard, {
      props: {
        ...defaultProps,
        ...propsOverride
      },
      global: {
        mocks: {
          $t: (key: string) => key
        }
      }
    })
  }

  describe('rendering', () => {
    it('renders plan title correctly', () => {
      const wrapper = mountPlanCard()

      expect(wrapper.text()).toContain('Pro Plan')
    })

    it('renders formatted price using formatMoney', () => {
      const wrapper = mountPlanCard()

      const expectedPrice = formatMoney(299, 'UAH')
      expect(wrapper.text()).toContain(expectedPrice)
    })

    it('FE-76.2.3: displays price in major units (499 ₴, not 49900)', () => {
      // Backend returns price in major units after division by 100
      const planWithMajorUnits = {
        ...mockPlan,
        price: {
          amount: 499, // Already in major units (UAH)
          currency: 'UAH'
        }
      }

      const wrapper = mountPlanCard({
        plan: planWithMajorUnits
      })

      // Should display 499 ₴, not 49900
      const formattedPrice = formatMoney(499, 'UAH')
      expect(wrapper.text()).toContain(formattedPrice)
      expect(wrapper.text()).toContain('499')
      expect(wrapper.text()).not.toContain('49900')
    })

    it('renders interval text', () => {
      const wrapper = mountPlanCard()

      expect(wrapper.text()).toContain('billing.planCard.intervalMonthly')
    })

    it('renders features list', () => {
      const wrapper = mountPlanCard()

      expect(wrapper.text()).toContain('billing.features.CONTACT_UNLOCK')
      expect(wrapper.text()).toContain('billing.features.PRIORITY_SUPPORT')
    })
  })

  describe('CTA button logic', () => {
    it('shows "Current" button when plan is current', () => {
      const wrapper = mountPlanCard({
        currentPlanCode: 'PRO'
      })

      const button = wrapper.find('button')
      expect(button.attributes('disabled')).toBeDefined()
      expect(wrapper.text()).toContain('billing.planCard.current')
    })

    it('shows "Unavailable" button when plan is inactive', () => {
      const wrapper = mountPlanCard({
        plan: {
          ...mockPlan,
          is_active: false
        }
      })

      const button = wrapper.find('button')
      expect(button.attributes('disabled')).toBeDefined()
      expect(wrapper.text()).toContain('billing.planCard.unavailable')
    })

    it('shows "Select" button for FREE plan', () => {
      const wrapper = mountPlanCard({
        plan: {
          ...mockPlan,
          code: 'FREE',
          price: {
            amount: 0,
            currency: 'UAH'
          }
        },
        currentPlanCode: 'PRO'
      })

      expect(wrapper.text()).toContain('billing.planCard.select')
    })

    it('shows "Pay" button for paid plans', () => {
      const wrapper = mountPlanCard()

      expect(wrapper.text()).toContain('billing.planCard.pay')
    })
  })

  describe('button interactions', () => {
    it('emits select event when clicking pay button', async () => {
      const wrapper = mountPlanCard()

      const button = wrapper.find('button')
      await button.trigger('click')

      expect(wrapper.emitted('select')).toBeTruthy()
      expect(wrapper.emitted('select')?.[0]).toEqual(['PRO'])
    })

    it('does not emit select when button is disabled (current plan)', async () => {
      const wrapper = mountPlanCard({
        currentPlanCode: 'PRO'
      })

      const button = wrapper.find('button')
      await button.trigger('click')

      expect(wrapper.emitted('select')).toBeFalsy()
    })

    it('does not emit select when button is disabled (inactive plan)', async () => {
      const wrapper = mountPlanCard({
        plan: {
          ...mockPlan,
          is_active: false
        }
      })

      const button = wrapper.find('button')
      await button.trigger('click')

      expect(wrapper.emitted('select')).toBeFalsy()
    })
  })

  // PR-1 (2026-09-04): каталог `free` проти entitlement `FREE` — один план;
  // pending-план не викликає повторний select.
  describe('PR-1: канонічні коди і pending', () => {
    it('public `free` + entitlement `FREE`: позначено поточним, select не емітиться', async () => {
      const wrapper = mountPlanCard({
        plan: { ...mockPlan, code: 'free', title: 'Free', price: { amount: 0, currency: 'UAH' } },
        currentPlanCode: 'FREE'
      })

      expect(wrapper.text()).toContain('billing.plan.current')
      expect(wrapper.text()).toContain('billing.planCard.current')
      const button = wrapper.find('button')
      expect(button.attributes('disabled')).toBeDefined()
      await button.trigger('click')
      expect(wrapper.emitted('select')).toBeFalsy()
    })

    it('public `pro` + pending `PRO`: кнопка «очікуємо оплату», select не емітиться, бейдж pending', async () => {
      const wrapper = mountPlanCard({
        plan: { ...mockPlan, code: 'pro' },
        currentPlanCode: 'FREE',
        pendingPlanCode: 'PRO'
      })

      expect(wrapper.find('[data-testid="plan-cta-pending"]').exists()).toBe(true)
      expect(wrapper.text()).toContain('billing.planCard.pending')
      expect(wrapper.find('[data-testid="plan-badge-pending"]').exists()).toBe(true)
      // pending НЕ називається поточним
      expect(wrapper.text()).not.toContain('billing.plan.current')
      const button = wrapper.find('button')
      expect(button.attributes('disabled')).toBeDefined()
      await button.trigger('click')
      expect(wrapper.emitted('select')).toBeFalsy()
      // юридичні лінки під кнопкою «Оплатити» — без кнопки їх нема
      expect(wrapper.text()).not.toContain('billing.checkout.agreement')
    })

    it('pending за ІНШИЙ план не блокує цю картку', async () => {
      const wrapper = mountPlanCard({
        currentPlanCode: 'FREE',
        pendingPlanCode: 'BUSINESS'
      })

      expect(wrapper.find('[data-testid="plan-cta-pending"]').exists()).toBe(false)
      await wrapper.find('button').trigger('click')
      expect(wrapper.emitted('select')?.[0]).toEqual(['PRO'])
    })

    it('PRO-USD при entitlement PRO — «Поточний», select не емітиться (один tier)', async () => {
      const wrapper = mountPlanCard({
        plan: { ...mockPlan, code: 'pro-usd', title: 'Pro (International)', price: { amount: 1999, currency: 'USD' } },
        currentPlanCode: 'PRO'
      })

      expect(wrapper.text()).toContain('billing.planCard.current')
      expect(wrapper.text()).not.toContain('billing.planCard.pay')
      const button = wrapper.find('button')
      expect(button.attributes('disabled')).toBeDefined()
      await button.trigger('click')
      expect(wrapper.emitted('select')).toBeFalsy()
    })

    it('BUSINESS при entitlement PRO — інший tier, «Оплатити» доступне', () => {
      const wrapper = mountPlanCard({
        plan: { ...mockPlan, code: 'BUSINESS', title: 'Business' },
        currentPlanCode: 'PRO'
      })
      expect(wrapper.text()).toContain('billing.planCard.pay')
    })

    it('чинний план має пріоритет над pending (pending за той самий план не показуємо)', () => {
      const wrapper = mountPlanCard({
        currentPlanCode: 'pro',
        pendingPlanCode: 'PRO'
      })

      expect(wrapper.text()).toContain('billing.planCard.current')
      expect(wrapper.find('[data-testid="plan-cta-pending"]').exists()).toBe(false)
    })
  })

  describe('loading state', () => {
    it('disables button when loading', () => {
      const wrapper = mountPlanCard({
        loading: true
      })

      const button = wrapper.find('button')
      expect(button.attributes('disabled')).toBeDefined()
    })
  })

  describe('plan badges', () => {
    it('shows "Current" badge for current plan', () => {
      const wrapper = mountPlanCard({
        currentPlanCode: 'PRO'
      })

      expect(wrapper.text()).toContain('billing.plan.current')
    })

    it('shows "Recommended" badge for PRO plan', () => {
      const wrapper = mountPlanCard()

      expect(wrapper.text()).toContain('billing.plan.recommended')
    })

    it('2026-09-01: shows "Recommended" badge for PRO-USD (international Stripe variant, same tier as PRO)', () => {
      const wrapper = mountPlanCard({
        plan: {
          ...mockPlan,
          code: 'PRO-USD',
          title: 'Pro (International)',
          price: { amount: 1999, currency: 'USD' }
        }
      })

      expect(wrapper.text()).toContain('billing.plan.recommended')
      expect(wrapper.text()).not.toContain('billing.plan.bestForTeams')
    })

    it('shows "Best for Teams" badge for BUSINESS plan', () => {
      const wrapper = mountPlanCard({
        plan: {
          ...mockPlan,
          code: 'BUSINESS',
          title: 'Business Plan'
        }
      })

      expect(wrapper.text()).toContain('billing.plan.bestForTeams')
    })
  })

  describe('edge cases', () => {
    it('handles plan without features', () => {
      const planWithoutFeatures = {
        ...mockPlan,
        features: []
      }

      const wrapper = mountPlanCard({
        plan: planWithoutFeatures
      })

      expect(wrapper.find('ul').exists()).toBe(false)
    })

    it('handles plan without interval', () => {
      const planWithoutInterval = {
        ...mockPlan,
        interval: null
      }

      const wrapper = mountPlanCard({
        plan: planWithoutInterval
      })

      expect(wrapper.text()).not.toContain('billing.planCard.intervalMonthly')
    })

    it('handles yearly interval', () => {
      const yearlyPlan = {
        ...mockPlan,
        interval: 'yearly'
      }

      const wrapper = mountPlanCard({
        plan: yearlyPlan
      })

      expect(wrapper.text()).toContain('billing.planCard.intervalYearly')
    })
  })
})
