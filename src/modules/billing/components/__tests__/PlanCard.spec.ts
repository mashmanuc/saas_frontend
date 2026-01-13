/**
 * PlanCard Component Unit Tests (v0.76.0)
 * 
 * Tests for PlanCard component with inactive plan logic
 */

import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import PlanCard from '../PlanCard.vue'
import { formatMoney } from '../../utils/priceFormatter'

// Mock i18n
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

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

  describe('rendering', () => {
    it('renders plan title correctly', () => {
      const wrapper = mount(PlanCard, {
        props: {
          plan: mockPlan,
          currentPlanCode: 'FREE',
          loading: false
        }
      })

      expect(wrapper.text()).toContain('Pro Plan')
    })

    it('renders formatted price using formatMoney', () => {
      const wrapper = mount(PlanCard, {
        props: {
          plan: mockPlan,
          currentPlanCode: 'FREE',
          loading: false
        }
      })

      const expectedPrice = formatMoney(299, 'UAH')
      expect(wrapper.text()).toContain(expectedPrice)
    })

    it('renders interval text', () => {
      const wrapper = mount(PlanCard, {
        props: {
          plan: mockPlan,
          currentPlanCode: 'FREE',
          loading: false
        }
      })

      expect(wrapper.text()).toContain('billing.planCard.intervalMonthly')
    })

    it('renders features list', () => {
      const wrapper = mount(PlanCard, {
        props: {
          plan: mockPlan,
          currentPlanCode: 'FREE',
          loading: false
        }
      })

      expect(wrapper.text()).toContain('billing.features.CONTACT_UNLOCK')
      expect(wrapper.text()).toContain('billing.features.PRIORITY_SUPPORT')
    })
  })

  describe('CTA button logic', () => {
    it('shows "Current" button when plan is current', () => {
      const wrapper = mount(PlanCard, {
        props: {
          plan: mockPlan,
          currentPlanCode: 'PRO',
          loading: false
        }
      })

      const button = wrapper.find('button')
      expect(button.attributes('disabled')).toBeDefined()
      expect(wrapper.text()).toContain('billing.planCard.current')
    })

    it('shows "Unavailable" button when plan is inactive', () => {
      const inactivePlan = {
        ...mockPlan,
        is_active: false
      }

      const wrapper = mount(PlanCard, {
        props: {
          plan: inactivePlan,
          currentPlanCode: 'FREE',
          loading: false
        }
      })

      const button = wrapper.find('button')
      expect(button.attributes('disabled')).toBeDefined()
      expect(wrapper.text()).toContain('billing.planCard.unavailable')
    })

    it('shows "Select" button for FREE plan', () => {
      const freePlan = {
        ...mockPlan,
        code: 'FREE',
        price: { amount: 0, currency: 'UAH' }
      }

      const wrapper = mount(PlanCard, {
        props: {
          plan: freePlan,
          currentPlanCode: 'PRO',
          loading: false
        }
      })

      expect(wrapper.text()).toContain('billing.planCard.select')
    })

    it('shows "Pay" button for paid plans', () => {
      const wrapper = mount(PlanCard, {
        props: {
          plan: mockPlan,
          currentPlanCode: 'FREE',
          loading: false
        }
      })

      expect(wrapper.text()).toContain('billing.planCard.pay')
    })
  })

  describe('button interactions', () => {
    it('emits select event when clicking pay button', async () => {
      const wrapper = mount(PlanCard, {
        props: {
          plan: mockPlan,
          currentPlanCode: 'FREE',
          loading: false
        }
      })

      const button = wrapper.find('button')
      await button.trigger('click')

      expect(wrapper.emitted('select')).toBeTruthy()
      expect(wrapper.emitted('select')?.[0]).toEqual(['PRO'])
    })

    it('does not emit select when button is disabled (current plan)', async () => {
      const wrapper = mount(PlanCard, {
        props: {
          plan: mockPlan,
          currentPlanCode: 'PRO',
          loading: false
        }
      })

      const button = wrapper.find('button')
      await button.trigger('click')

      expect(wrapper.emitted('select')).toBeFalsy()
    })

    it('does not emit select when button is disabled (inactive plan)', async () => {
      const inactivePlan = {
        ...mockPlan,
        is_active: false
      }

      const wrapper = mount(PlanCard, {
        props: {
          plan: inactivePlan,
          currentPlanCode: 'FREE',
          loading: false
        }
      })

      const button = wrapper.find('button')
      await button.trigger('click')

      expect(wrapper.emitted('select')).toBeFalsy()
    })
  })

  describe('loading state', () => {
    it('disables button when loading', () => {
      const wrapper = mount(PlanCard, {
        props: {
          plan: mockPlan,
          currentPlanCode: 'FREE',
          loading: true
        }
      })

      const button = wrapper.find('button')
      expect(button.attributes('disabled')).toBeDefined()
    })
  })

  describe('plan badges', () => {
    it('shows "Current" badge for current plan', () => {
      const wrapper = mount(PlanCard, {
        props: {
          plan: mockPlan,
          currentPlanCode: 'PRO',
          loading: false
        }
      })

      expect(wrapper.text()).toContain('billing.plan.current')
    })

    it('shows "Recommended" badge for PRO plan', () => {
      const wrapper = mount(PlanCard, {
        props: {
          plan: mockPlan,
          currentPlanCode: 'FREE',
          loading: false
        }
      })

      expect(wrapper.text()).toContain('billing.plan.recommended')
    })

    it('shows "Best for Teams" badge for BUSINESS plan', () => {
      const businessPlan = {
        ...mockPlan,
        code: 'BUSINESS',
        title: 'Business Plan'
      }

      const wrapper = mount(PlanCard, {
        props: {
          plan: businessPlan,
          currentPlanCode: 'FREE',
          loading: false
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

      const wrapper = mount(PlanCard, {
        props: {
          plan: planWithoutFeatures,
          currentPlanCode: 'FREE',
          loading: false
        }
      })

      expect(wrapper.find('ul').exists()).toBe(false)
    })

    it('handles plan without interval', () => {
      const planWithoutInterval = {
        ...mockPlan,
        interval: null
      }

      const wrapper = mount(PlanCard, {
        props: {
          plan: planWithoutInterval,
          currentPlanCode: 'FREE',
          loading: false
        }
      })

      expect(wrapper.text()).not.toContain('billing.planCard.intervalMonthly')
    })

    it('handles yearly interval', () => {
      const yearlyPlan = {
        ...mockPlan,
        interval: 'yearly'
      }

      const wrapper = mount(PlanCard, {
        props: {
          plan: yearlyPlan,
          currentPlanCode: 'FREE',
          loading: false
        }
      })

      expect(wrapper.text()).toContain('billing.planCard.intervalYearly')
    })
  })
})
