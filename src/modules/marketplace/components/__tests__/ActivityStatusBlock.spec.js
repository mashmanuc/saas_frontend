import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import ActivityStatusBlock from '../ActivityStatusBlock.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      tutor: {
        activity: {
          currentMonth: 'Current month',
          notRequired: {
            title: 'Activity not required this month',
            trial: 'You are on trial period',
            paidPlan: 'You have a paid plan',
            notPublished: 'Profile not published',
          },
          met: {
            title: 'Requirement met',
            count: '{current} / {required} responses this month',
          },
          notMet: {
            title: 'Activity required this month',
            description: 'You need to respond to at least 1 student inquiry (accept or reject)',
            count: '{current} / {required} completed',
            hint: 'Go to student inquiries',
          },
          exempt: {
            title: 'Exempt from requirement this month',
            description: 'Administration has granted you an exemption',
          },
        },
      },
    },
  },
})

describe('ActivityStatusBlock', () => {
  describe('CASE D: Staff Exemption', () => {
    it('shows exemption message when has_exemption is true', () => {
      const wrapper = mount(ActivityStatusBlock, {
        props: {
          status: {
            has_exemption: true,
            activity_required: true,
            meets_requirement: false,
            activity_count: 0,
            required_count: 1,
            current_month: '2026-01',
            is_trial: false,
            plan: 'FREE',
          },
        },
        global: {
          plugins: [i18n],
        },
      })

      expect(wrapper.find('[data-test="activity-exempt"]').exists()).toBe(true)
      expect(wrapper.text()).toContain('Exempt from requirement this month')
    })

    it('shows exemption message when is_exempt is true', () => {
      const wrapper = mount(ActivityStatusBlock, {
        props: {
          status: {
            is_exempt: true,
            activity_required: true,
            meets_requirement: false,
            activity_count: 0,
            required_count: 1,
            current_month: '2026-01',
            is_trial: false,
            plan: 'FREE',
          },
        },
        global: {
          plugins: [i18n],
        },
      })

      expect(wrapper.find('[data-test="activity-exempt"]').exists()).toBe(true)
    })
  })

  describe('CASE A: No Requirement', () => {
    it('shows not required message when activity_required is false', () => {
      const wrapper = mount(ActivityStatusBlock, {
        props: {
          status: {
            activity_required: false,
            meets_requirement: true,
            activity_count: 0,
            required_count: 1,
            current_month: '2026-01',
            is_trial: true,
            plan: 'FREE',
          },
        },
        global: {
          plugins: [i18n],
        },
      })

      expect(wrapper.find('[data-test="activity-not-required"]').exists()).toBe(true)
      expect(wrapper.text()).toContain('Activity not required this month')
    })

    it('shows trial reason when is_trial is true', () => {
      const wrapper = mount(ActivityStatusBlock, {
        props: {
          status: {
            activity_required: false,
            meets_requirement: true,
            activity_count: 0,
            required_count: 1,
            current_month: '2026-01',
            is_trial: true,
            plan: 'FREE',
          },
        },
        global: {
          plugins: [i18n],
        },
      })

      expect(wrapper.text()).toContain('You are on trial period')
    })

    it('shows paid plan reason when plan is not FREE', () => {
      const wrapper = mount(ActivityStatusBlock, {
        props: {
          status: {
            activity_required: false,
            meets_requirement: true,
            activity_count: 0,
            required_count: 1,
            current_month: '2026-01',
            is_trial: false,
            plan: 'PRO',
          },
        },
        global: {
          plugins: [i18n],
        },
      })

      expect(wrapper.text()).toContain('You have a paid plan')
    })
  })

  describe('CASE C: Requirement Met', () => {
    it('shows met message when meets_requirement is true', () => {
      const wrapper = mount(ActivityStatusBlock, {
        props: {
          status: {
            activity_required: true,
            meets_requirement: true,
            activity_count: 1,
            required_count: 1,
            current_month: '2026-01',
            is_trial: false,
            plan: 'FREE',
          },
        },
        global: {
          plugins: [i18n],
        },
      })

      expect(wrapper.find('[data-test="activity-met"]').exists()).toBe(true)
      expect(wrapper.text()).toContain('Requirement met')
      expect(wrapper.text()).toContain('1 / 1')
    })
  })

  describe('CASE B: Requirement Not Met', () => {
    it('shows not met message when requirement is not met', () => {
      const wrapper = mount(ActivityStatusBlock, {
        props: {
          status: {
            activity_required: true,
            meets_requirement: false,
            activity_count: 0,
            required_count: 1,
            current_month: '2026-01',
            is_trial: false,
            plan: 'FREE',
          },
        },
        global: {
          plugins: [i18n],
        },
      })

      expect(wrapper.find('[data-test="activity-not-met"]').exists()).toBe(true)
      expect(wrapper.text()).toContain('Activity required this month')
      expect(wrapper.text()).toContain('0 / 1')
      expect(wrapper.text()).toContain('Go to student inquiries')
    })
  })

  describe('Month display', () => {
    it('always shows current month', () => {
      const wrapper = mount(ActivityStatusBlock, {
        props: {
          status: {
            activity_required: false,
            meets_requirement: true,
            activity_count: 0,
            required_count: 1,
            current_month: '2026-01',
            is_trial: true,
            plan: 'FREE',
          },
        },
        global: {
          plugins: [i18n],
        },
      })

      expect(wrapper.text()).toContain('2026-01')
    })
  })
})
