/**
 * Unit tests for ActivityStatusBanner v0.94.0 updates
 * 
 * Tests actionable CTA for AT_RISK state
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ActivityStatusBanner from '../ActivityStatusBanner.vue'
import { createI18n } from 'vue-i18n'

const i18n = createI18n({
  legacy: false,
  locale: 'uk',
  messages: {
    uk: {
      tutor: {
        activity: {
          banner: {
            active: {
              title: 'Ви активні',
              message: 'У вас {count} відповідей цього місяця. Продовжуйте у тому ж дусі!'
            },
            atRisk: {
              title: 'Потрібна активність',
              message: 'У вас немає відповідей на запити цього місяця.'
            }
          },
          cta: {
            title: 'Що потрібно зробити?',
            message: 'Відповідайте хоча б на один запит від студента (прийняти або відхилити). Це єдиний спосіб відновити видимість профілю.'
          },
          exemption: {
            active: 'Активне звільнення',
            info: 'До {until}. Причина: {reason}',
            noReason: 'не вказано'
          }
        }
      }
    }
  }
})

describe('ActivityStatusBanner v0.94.0 - Actionable CTA', () => {
  describe('AT_RISK CTA', () => {
    it('should show actionable CTA for AT_RISK status', () => {
      const wrapper = mount(ActivityStatusBanner, {
        props: {
          activityStatus: 'INACTIVE_SOFT',
          activityReason: 'NO_REACTIONS_THIS_MONTH',
          reactionsCount: 0
        },
        global: {
          plugins: [i18n]
        }
      })

      // Banner показується
      expect(wrapper.find('[data-test="activity-status-banner"]').exists()).toBe(true)
      
      // CTA блок присутній
      const ctaBlock = wrapper.find('.bg-orange-50')
      expect(ctaBlock.exists()).toBe(true)
      
      // CTA містить title та message
      expect(ctaBlock.text()).toContain('Що потрібно зробити?')
      expect(ctaBlock.text()).toContain('Відповідайте хоча б на один запит')
    })

    it('should NOT show CTA for ACTIVE status', () => {
      const wrapper = mount(ActivityStatusBanner, {
        props: {
          activityStatus: 'ACTIVE',
          activityReason: 'ACTIVE',
          reactionsCount: 3
        },
        global: {
          plugins: [i18n]
        }
      })

      // CTA блок відсутній
      const ctaBlock = wrapper.find('.bg-orange-50')
      expect(ctaBlock.exists()).toBe(false)
    })

    it('should NOT show CTA for EXEMPTED status', () => {
      const wrapper = mount(ActivityStatusBanner, {
        props: {
          activityStatus: 'ACTIVE',
          activityReason: 'EXEMPTED',
          reactionsCount: 0,
          exemptionReason: 'Vacation'
        },
        global: {
          plugins: [i18n]
        }
      })

      // CTA блок відсутній
      const ctaBlock = wrapper.find('.bg-orange-50')
      expect(ctaBlock.exists()).toBe(false)
    })

    it('should NOT show CTA for INACTIVE status (not AT_RISK)', () => {
      const wrapper = mount(ActivityStatusBanner, {
        props: {
          activityStatus: 'INACTIVE_SOFT',
          activityReason: 'no_activity', // NOT NO_REACTIONS_THIS_MONTH
          reactionsCount: 0
        },
        global: {
          plugins: [i18n]
        }
      })

      // CTA блок відсутній (тільки для AT_RISK)
      const ctaBlock = wrapper.find('.bg-orange-50')
      expect(ctaBlock.exists()).toBe(false)
    })
  })

  describe('CTA Content', () => {
    it('should display informational CTA (NOT a button)', () => {
      const wrapper = mount(ActivityStatusBanner, {
        props: {
          activityStatus: 'INACTIVE_SOFT',
          activityReason: 'NO_REACTIONS_THIS_MONTH',
          reactionsCount: 0
        },
        global: {
          plugins: [i18n]
        }
      })

      const ctaBlock = wrapper.find('.bg-orange-50')
      
      // НЕ кнопка, а інформаційний блок
      expect(ctaBlock.find('button').exists()).toBe(false)
      expect(ctaBlock.find('a').exists()).toBe(false)
      
      // Тільки текст
      expect(ctaBlock.find('p').exists()).toBe(true)
    })

    it('should explain the ONLY exit path (responses >= 1)', () => {
      const wrapper = mount(ActivityStatusBanner, {
        props: {
          activityStatus: 'INACTIVE_SOFT',
          activityReason: 'NO_REACTIONS_THIS_MONTH',
          reactionsCount: 0
        },
        global: {
          plugins: [i18n]
        }
      })

      const ctaText = wrapper.find('.bg-orange-50').text()
      
      // Містить пояснення про єдиний шлях виходу
      expect(ctaText).toContain('єдиний спосіб')
      expect(ctaText).toContain('відповідей')
    })
  })

  describe('v0.94.0 Invariants', () => {
    it('CTA is informational, NOT interactive', () => {
      const wrapper = mount(ActivityStatusBanner, {
        props: {
          activityStatus: 'INACTIVE_SOFT',
          activityReason: 'NO_REACTIONS_THIS_MONTH',
          reactionsCount: 0
        },
        global: {
          plugins: [i18n]
        }
      })

      const ctaBlock = wrapper.find('.bg-orange-50')
      
      // INVARIANT: NO buttons, NO forms, NO wizards
      expect(ctaBlock.find('button').exists()).toBe(false)
      expect(ctaBlock.find('form').exists()).toBe(false)
      expect(ctaBlock.find('input').exists()).toBe(false)
    })

    it('CTA explains exit condition explicitly', () => {
      const wrapper = mount(ActivityStatusBanner, {
        props: {
          activityStatus: 'INACTIVE_SOFT',
          activityReason: 'NO_REACTIONS_THIS_MONTH',
          reactionsCount: 0
        },
        global: {
          plugins: [i18n]
        }
      })

      const ctaText = wrapper.find('.bg-orange-50').text()
      
      // INVARIANT: Explicit exit condition (responses >= 1)
      // NO timer, NO manual confirmation, NO staff action
      expect(ctaText.toLowerCase()).toContain('відповід') // "відповідайте"
    })
  })
})
