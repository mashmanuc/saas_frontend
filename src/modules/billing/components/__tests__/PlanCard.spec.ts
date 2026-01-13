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
