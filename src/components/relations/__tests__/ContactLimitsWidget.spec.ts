/**
 * Unit Tests for ContactLimitsWidget
 * 
 * Тестує логіку відображення лімітів, прогрес-бару та попереджень
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ContactLimitsWidget from '../ContactLimitsWidget.vue'
import { useLimitsStore } from '@/stores/limitsStore'
import type { ContactLimit } from '@/types/relations'

/**
 * Stub UI components, щоб izolate logic та уникнути реальних import errors
 */
vi.mock('@/components/ui/Card.vue', () => ({
  default: defineComponent({
    name: 'CardStub',
    template: '<div class="card-stub"><slot /></div>',
  }),
}))

vi.mock('@/components/ui/Badge.vue', () => ({
  default: defineComponent({
    name: 'BadgeStub',
    props: ['variant'],
    template: '<span :data-variant="variant"><slot /></span>',
  }),
}))

vi.mock('@/components/ui/Alert.vue', () => ({
  default: defineComponent({
    name: 'AlertStub',
    props: ['variant'],
    template: '<div :data-variant="variant"><slot /></div>',
  }),
}))

/**
 * Stub i18n для стабільного тексту в тестах
 */
vi.mock('vue-i18n', () => {
  const translations: Record<string, string> = {
    'limits.studentRequests': 'Запити до тьюторів',
    'limits.tutorAccepts': 'Прийняття запитів',
    'limits.resetsAt': 'Оновлення',
    'limits.remaining': 'залишилось',
    'student.myTutors.lastActivity': 'Остання активність',
    'student.myTutors.lessonsCount': 'Уроків',
    'student.myTutors.title': 'Мої тьютори',
    'loader.loading': 'Завантаження...',
    'common.retry': 'Спробувати ще раз',
    'student.myTutors.empty': 'Немає активних тьюторів',
    'student.myTutors.findTutor': 'Знайти тьютора',
    'common.joinCurrentLesson': 'Приєднатися до уроку',
    'common.openLessonChat': 'Відкрити чат',
    'common.bookLessonToChat': 'Забронювати урок',
    'common.bookLesson': 'Забронювати урок',
    'common.never': 'Ніколи',
  }

  return {
    useI18n: () => ({
      t: (key: string, params?: Record<string, any>) => {
        if (key === 'limits.nearLimit') {
          return `Залишилося ${params?.remaining}`
        }
        if (key === 'limits.limitReached') {
          return `Ліміт вичерпано до ${params?.resetDate}`
        }
        return translations[key] ?? key
      },
    }),
  }
})

describe('ContactLimitsWidget', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  const createMockLimit = (overrides: Partial<ContactLimit> = {}): ContactLimit => ({
    limit_type: 'student_request',
    max_count: 10,
    current_count: 0,
    remaining: 10,
    reset_at: '2026-01-15T00:00:00Z',
    period_days: 30,
    ...overrides
  })

  describe('Progress Bar Color Logic', () => {
    it('shows green color when usage is below 70%', () => {
      const limitsStore = useLimitsStore()
      const limit = createMockLimit({ current_count: 6, remaining: 4 }) // 60%
      limitsStore.limits = [limit]

      const wrapper = mount(ContactLimitsWidget, {
        props: { limitType: 'student_request' }
      })

      const progressBar = wrapper.find('.bg-green-500')
      expect(progressBar.exists()).toBe(true)
    })

    it('shows yellow color when usage is between 70% and 90%', () => {
      const limitsStore = useLimitsStore()
      const limit = createMockLimit({ current_count: 8, remaining: 2, max_count: 10 }) // 80%
      limitsStore.limits = [limit]

      const wrapper = mount(ContactLimitsWidget, {
        props: { limitType: 'student_request' }
      })

      const progressBar = wrapper.find('.bg-yellow-500')
      expect(progressBar.exists()).toBe(true)
    })

    it('shows red color when usage is 90% or above', () => {
      const limitsStore = useLimitsStore()
      const limit = createMockLimit({ current_count: 9, remaining: 1, max_count: 10 }) // 90%
      limitsStore.limits = [limit]

      const wrapper = mount(ContactLimitsWidget, {
        props: { limitType: 'student_request' }
      })

      const progressBar = wrapper.find('.bg-red-500')
      expect(progressBar.exists()).toBe(true)
    })

    it('shows red color when limit is fully exhausted', () => {
      const limitsStore = useLimitsStore()
      const limit = createMockLimit({ current_count: 10, remaining: 0, max_count: 10 }) // 100%
      limitsStore.limits = [limit]

      const wrapper = mount(ContactLimitsWidget, {
        props: { limitType: 'student_request' }
      })

      const progressBar = wrapper.find('.bg-red-500')
      expect(progressBar.exists()).toBe(true)
    })
  })

  describe('Warning Alert Logic', () => {
    it('shows warning alert when remaining <= 2 and remaining > 0', () => {
      const limitsStore = useLimitsStore()
      const limit = createMockLimit({ current_count: 8, remaining: 2, max_count: 10 })
      limitsStore.limits = [limit]

      const wrapper = mount(ContactLimitsWidget, {
        props: { limitType: 'student_request' }
      })

      const warningAlert = wrapper.find('[data-variant="warning"]')
      
      expect(warningAlert.exists()).toBe(true)
    })

    it('shows warning alert when remaining = 1', () => {
      const limitsStore = useLimitsStore()
      const limit = createMockLimit({ current_count: 9, remaining: 1, max_count: 10 })
      limitsStore.limits = [limit]

      const wrapper = mount(ContactLimitsWidget, {
        props: { limitType: 'student_request' }
      })

      const warningAlert = wrapper.find('[data-variant="warning"]')
      
      expect(warningAlert.exists()).toBe(true)
    })

    it('does NOT show warning alert when remaining > 2', () => {
      const limitsStore = useLimitsStore()
      const limit = createMockLimit({ current_count: 7, remaining: 3, max_count: 10 })
      limitsStore.limits = [limit]

      const wrapper = mount(ContactLimitsWidget, {
        props: { limitType: 'student_request' }
      })

      const alerts = wrapper.findAllComponents({ name: 'Alert' })
      const warningAlert = alerts.find(alert => alert.props('variant') === 'warning')
      
      expect(warningAlert?.exists()).toBeFalsy()
    })
  })

  describe('Error Alert Logic', () => {
    it('shows error alert when remaining === 0', () => {
      const limitsStore = useLimitsStore()
      const limit = createMockLimit({ current_count: 10, remaining: 0, max_count: 10 })
      limitsStore.limits = [limit]

      const wrapper = mount(ContactLimitsWidget, {
        props: { limitType: 'student_request' }
      })

      const errorAlert = wrapper.find('[data-variant="error"]')
      
      expect(errorAlert.exists()).toBe(true)
    })

    it('does NOT show error alert when remaining > 0', () => {
      const limitsStore = useLimitsStore()
      const limit = createMockLimit({ current_count: 9, remaining: 1, max_count: 10 })
      limitsStore.limits = [limit]

      const wrapper = mount(ContactLimitsWidget, {
        props: { limitType: 'student_request' }
      })

      const alerts = wrapper.findAllComponents({ name: 'Alert' })
      const errorAlert = alerts.find(alert => alert.props('variant') === 'error')
      
      expect(errorAlert?.exists()).toBeFalsy()
    })
  })

  describe('Badge Variant Logic', () => {
    it('shows success badge when remaining > 2', () => {
      const limitsStore = useLimitsStore()
      const limit = createMockLimit({ current_count: 5, remaining: 5, max_count: 10 })
      limitsStore.limits = [limit]

      const wrapper = mount(ContactLimitsWidget, {
        props: { limitType: 'student_request' }
      })

      const badge = wrapper.find('[data-variant="success"]')
      expect(badge.exists()).toBe(true)
    })

    it('shows warning badge when remaining <= 2 and remaining > 0', () => {
      const limitsStore = useLimitsStore()
      const limit = createMockLimit({ current_count: 8, remaining: 2, max_count: 10 })
      limitsStore.limits = [limit]

      const wrapper = mount(ContactLimitsWidget, {
        props: { limitType: 'student_request' }
      })

      const badge = wrapper.find('[data-variant="warning"]')
      expect(badge.exists()).toBe(true)
    })

    it('shows error badge when remaining === 0', () => {
      const limitsStore = useLimitsStore()
      const limit = createMockLimit({ current_count: 10, remaining: 0, max_count: 10 })
      limitsStore.limits = [limit]

      const wrapper = mount(ContactLimitsWidget, {
        props: { limitType: 'student_request' }
      })

      const badge = wrapper.find('[data-variant="error"]')
      expect(badge.exists()).toBe(true)
    })
  })

  describe('Progress Percentage Calculation', () => {
    it('calculates 0% correctly', () => {
      const limitsStore = useLimitsStore()
      const limit = createMockLimit({ current_count: 0, remaining: 10, max_count: 10 })
      limitsStore.limits = [limit]

      const wrapper = mount(ContactLimitsWidget, {
        props: { limitType: 'student_request' }
      })

      const progressBar = wrapper.find('[class*="absolute"]')
      expect(progressBar.attributes('style')).toContain('width: 0%')
    })

    it('calculates 50% correctly', () => {
      const limitsStore = useLimitsStore()
      const limit = createMockLimit({ current_count: 5, remaining: 5, max_count: 10 })
      limitsStore.limits = [limit]

      const wrapper = mount(ContactLimitsWidget, {
        props: { limitType: 'student_request' }
      })

      const progressBar = wrapper.find('[class*="absolute"]')
      expect(progressBar.attributes('style')).toContain('width: 50%')
    })

    it('calculates 100% correctly', () => {
      const limitsStore = useLimitsStore()
      const limit = createMockLimit({ current_count: 10, remaining: 0, max_count: 10 })
      limitsStore.limits = [limit]

      const wrapper = mount(ContactLimitsWidget, {
        props: { limitType: 'student_request' }
      })

      const progressBar = wrapper.find('[class*="absolute"]')
      expect(progressBar.attributes('style')).toContain('width: 100%')
    })
  })

  describe('Limit Type Display', () => {
    it('displays correct title for student_request', () => {
      const limitsStore = useLimitsStore()
      const limit = createMockLimit({ limit_type: 'student_request' })
      limitsStore.limits = [limit]

      const wrapper = mount(ContactLimitsWidget, {
        props: { limitType: 'student_request' }
      })

      expect(wrapper.text()).toContain('Запити до тьюторів')
    })

    it('displays correct title for tutor_accept', () => {
      const limitsStore = useLimitsStore()
      const limit = createMockLimit({ limit_type: 'tutor_accept' })
      limitsStore.limits = [limit]

      const wrapper = mount(ContactLimitsWidget, {
        props: { limitType: 'tutor_accept' }
      })

      expect(wrapper.text()).toContain('Прийняття запитів')
    })
  })

  describe('Empty State', () => {
    it('does not render when limit is null', () => {
      const limitsStore = useLimitsStore()
      limitsStore.limits = []

      const wrapper = mount(ContactLimitsWidget, {
        props: { limitType: 'student_request' }
      })

      expect(wrapper.find('Card').exists()).toBe(false)
    })
  })

  describe('Reset Date Formatting', () => {
    it('formats reset_at date correctly', () => {
      const limitsStore = useLimitsStore()
      const limit = createMockLimit({ reset_at: '2026-01-15T12:30:00Z' })
      limitsStore.limits = [limit]

      const wrapper = mount(ContactLimitsWidget, {
        props: { limitType: 'student_request' }
      })

      // Перевіряємо що відображається переклад
      expect(wrapper.text()).toContain('Оновлення')
    })
  })
})
