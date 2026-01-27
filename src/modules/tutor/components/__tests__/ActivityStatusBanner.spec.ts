/**
 * Unit tests for ActivityStatusBanner component
 * v0.93.0
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ActivityStatusBanner from '../ActivityStatusBanner.vue'
import { createI18n } from 'vue-i18n'

// Mock i18n
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
            inactive: {
              title: 'Ви неактивні',
              message: 'У вас немає відповідей на запити цього місяця. Ваш профіль прихований від студентів.'
            },
            exempted: {
              title: 'Звільнення від правил активності',
              message: 'Вам надано тимчасове звільнення. Правила активності не застосовуються.'
            },
            atRisk: {
              title: 'Потрібна активність',
              message: 'У вас немає відповідей на запити цього місяця. Відповідайте на запити, щоб залишатися видимим у Marketplace.'
            }
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

describe('ActivityStatusBanner', () => {
  describe('Visibility', () => {
    it('should show banner for ACTIVE eligible tutor', () => {
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

      expect(wrapper.find('[data-test="activity-status-banner"]').exists()).toBe(true)
    })

    it('should NOT show banner for NOT_APPLICABLE', () => {
      const wrapper = mount(ActivityStatusBanner, {
        props: {
          activityStatus: 'ACTIVE',
          activityReason: 'NOT_APPLICABLE',
          reactionsCount: 0
        },
        global: {
          plugins: [i18n]
        }
      })

      expect(wrapper.find('[data-test="activity-status-banner"]').exists()).toBe(false)
    })

    it('should NOT show banner for TRIAL_ACTIVE', () => {
      const wrapper = mount(ActivityStatusBanner, {
        props: {
          activityStatus: 'ACTIVE',
          activityReason: 'TRIAL_ACTIVE',
          reactionsCount: 0
        },
        global: {
          plugins: [i18n]
        }
      })

      expect(wrapper.find('[data-test="activity-status-banner"]').exists()).toBe(false)
    })
  })

  describe('User-Friendly Status Mapping', () => {
    it('should map EXEMPTED reason to EXEMPTED status', () => {
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

      expect(wrapper.text()).toContain('Звільнення від правил активності')
      expect(wrapper.text()).toContain('🛡️')
    })

    it('should map NO_REACTIONS_THIS_MONTH to AT_RISK status', () => {
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

      expect(wrapper.text()).toContain('Потрібна активність')
      expect(wrapper.text()).toContain('⏰')
    })

    it('should map INACTIVE_SOFT to INACTIVE status', () => {
      const wrapper = mount(ActivityStatusBanner, {
        props: {
          activityStatus: 'INACTIVE_SOFT',
          activityReason: 'no_activity',
          reactionsCount: 0
        },
        global: {
          plugins: [i18n]
        }
      })

      expect(wrapper.text()).toContain('Ви неактивні')
      expect(wrapper.text()).toContain('⚠️')
    })

    it('should map ACTIVE to ACTIVE status', () => {
      const wrapper = mount(ActivityStatusBanner, {
        props: {
          activityStatus: 'ACTIVE',
          activityReason: 'ACTIVE',
          reactionsCount: 5
        },
        global: {
          plugins: [i18n]
        }
      })

      expect(wrapper.text()).toContain('Ви активні')
      expect(wrapper.text()).toContain('✅')
    })
  })

  describe('Banner Styling', () => {
    it('should use green styling for ACTIVE', () => {
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

      const banner = wrapper.find('[data-test="activity-status-banner"]')
      expect(banner.classes()).toContain('bg-green-50')
      expect(banner.classes()).toContain('border-green-200')
    })

    it('should use yellow styling for INACTIVE', () => {
      const wrapper = mount(ActivityStatusBanner, {
        props: {
          activityStatus: 'INACTIVE_SOFT',
          activityReason: 'no_activity',
          reactionsCount: 0
        },
        global: {
          plugins: [i18n]
        }
      })

      const banner = wrapper.find('[data-test="activity-status-banner"]')
      expect(banner.classes()).toContain('bg-yellow-50')
      expect(banner.classes()).toContain('border-yellow-200')
    })

    it('should use purple styling for EXEMPTED', () => {
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

      const banner = wrapper.find('[data-test="activity-status-banner"]')
      expect(banner.classes()).toContain('bg-purple-50')
      expect(banner.classes()).toContain('border-purple-200')
    })

    it('should use orange styling for AT_RISK', () => {
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

      const banner = wrapper.find('[data-test="activity-status-banner"]')
      expect(banner.classes()).toContain('bg-orange-50')
      expect(banner.classes()).toContain('border-orange-200')
    })
  })

  describe('Exemption Info', () => {
    it('should show exemption info when EXEMPTED', () => {
      const wrapper = mount(ActivityStatusBanner, {
        props: {
          activityStatus: 'ACTIVE',
          activityReason: 'EXEMPTED',
          reactionsCount: 0,
          exemptionUntil: '2026-02-28T23:59:59Z',
          exemptionReason: 'Vacation in Spain'
        },
        global: {
          plugins: [i18n]
        }
      })

      expect(wrapper.text()).toContain('Активне звільнення')
      expect(wrapper.text()).toContain('Vacation in Spain')
    })

    it('should NOT show exemption info when NOT exempted', () => {
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

      expect(wrapper.text()).not.toContain('Активне звільнення')
    })

    it('should handle missing exemption reason', () => {
      const wrapper = mount(ActivityStatusBanner, {
        props: {
          activityStatus: 'ACTIVE',
          activityReason: 'EXEMPTED',
          reactionsCount: 0,
          exemptionUntil: '2026-02-28T23:59:59Z',
          exemptionReason: null
        },
        global: {
          plugins: [i18n]
        }
      })

      expect(wrapper.text()).toContain('не вказано')
    })
  })

  describe('Reactions Count', () => {
    it('should display reactions count for ACTIVE', () => {
      const wrapper = mount(ActivityStatusBanner, {
        props: {
          activityStatus: 'ACTIVE',
          activityReason: 'ACTIVE',
          reactionsCount: 7
        },
        global: {
          plugins: [i18n]
        }
      })

      expect(wrapper.text()).toContain('7')
    })

    it('should handle 0 reactions for INACTIVE', () => {
      const wrapper = mount(ActivityStatusBanner, {
        props: {
          activityStatus: 'INACTIVE_SOFT',
          activityReason: 'no_activity',
          reactionsCount: 0
        },
        global: {
          plugins: [i18n]
        }
      })

      expect(wrapper.text()).toContain('немає відповідей')
    })
  })

  describe('Edge Cases', () => {
    it('should handle undefined props gracefully', () => {
      const wrapper = mount(ActivityStatusBanner, {
        props: {},
        global: {
          plugins: [i18n]
        }
      })

      // Should not crash, banner should be hidden
      expect(wrapper.find('[data-test="activity-status-banner"]').exists()).toBe(false)
    })

    it('should handle null exemption fields', () => {
      const wrapper = mount(ActivityStatusBanner, {
        props: {
          activityStatus: 'ACTIVE',
          activityReason: 'ACTIVE',
          reactionsCount: 1,
          exemptionUntil: null,
          exemptionReason: null
        },
        global: {
          plugins: [i18n]
        }
      })

      expect(wrapper.find('[data-test="activity-status-banner"]').exists()).toBe(true)
      expect(wrapper.text()).not.toContain('Активне звільнення')
    })
  })
})
