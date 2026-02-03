import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import InquiryFormModal from '../InquiryFormModal.vue'
import { useInquiriesStore } from '@/stores/inquiriesStore'

vi.mock('@/api/inquiries', () => ({
  createInquiry: vi.fn(),
  fetchInquiries: vi.fn(() => Promise.resolve([]))
}))

const i18n = createI18n({
  legacy: false,
  locale: 'uk',
  messages: {
    uk: {
      inquiries: {
        form: {
          title: 'Надіслати запит тьютору',
          studentLevel: 'Ваш рівень',
          studentLevelPlaceholder: 'Оберіть рівень',
          levels: {
            beginner: 'Початківець',
            intermediate: 'Середній',
            advanced: 'Професіонал'
          },
          budget: 'Бюджет (грн/год)',
          budgetHint: 'Мінімальна ставка тьютора: {rate} грн/год',
          budgetTooLow: 'Ваш бюджет нижче мінімальної ставки тьютора',
          startPreference: 'Коли хочете почати?',
          startOptions: {
            asap: 'Якнайшвидше',
            week: 'Через тиждень',
            month: 'Через місяць'
          },
          message: 'Що хочете вивчити?',
          messagePlaceholder: 'Розкажіть про свої цілі та очікування...',
          submit: 'Надіслати запит',
          submitting: 'Надсилаємо...',
          cancel: 'Скасувати',
          retryIn: 'Спробуйте через {seconds} с'
        },
        success: {
          created: 'Запит успішно надіслано!',
          description: 'Тьютор отримає ваш запит і зможе відповісти найближчим часом.',
          viewMyInquiries: 'Переглянути мої запити',
          findMoreTutors: 'Знайти інших тьюторів'
        },
        errors: {
          cooldownActive: 'Ви можете надіслати новий запит цьому тьютору через {days} днів',
          maxOpenReached: 'Досягнуто ліміт активних запитів ({limit})',
          maxOpenReachedUpgrade: 'Оновіть до PRO для необмежених запитів',
          rateLimitExceeded: 'Перевищено ліміт: {limit_display}',
          alreadyExists: 'У вас вже є активний запит до цього тьютора'
        }
      }
    }
  }
})

describe('InquiryFormModal', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  const tutor = {
    id: 1,
    full_name: 'Test Tutor',
    avatar: '/avatar.png',
    subjects: ['Math', 'Physics'],
    min_hourly_rate: 500
  }

  it.skip('показує success-state після успішного створення inquiry', async () => {
    const { createInquiry, fetchInquiries } = await import('@/api/inquiries')
    
    vi.mocked(createInquiry).mockResolvedValue({
      id: 1,
      student: { id: 1, full_name: 'Student', avatar: '' },
      tutor: { id: 1, full_name: 'Tutor', avatar: '' },
      message: 'Test message',
      status: 'OPEN',
      created_at: new Date().toISOString()
    } as any)
    
    vi.mocked(fetchInquiries).mockResolvedValue([])

    const pinia = createPinia()
    const wrapper = mount(InquiryFormModal, {
      props: {
        show: true,
        tutor
      },
      global: {
        plugins: [i18n, pinia],
        stubs: {
          'router-link': true,
          ErrorState: true
        }
      }
    })

    await wrapper.find('select#student_level').setValue('beginner')
    await wrapper.find('input#budget').setValue(600)
    await wrapper.find('select#start_preference').setValue('asap')
    await wrapper.find('textarea#message').setValue('Test message for inquiry')

    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()
    await wrapper.vm.$nextTick()
    await flushPromises()

    // Verify success state is shown
    expect(wrapper.text()).toContain('Запит успішно надіслано!')
    expect(wrapper.find('.success-state').exists()).toBe(true)
    expect(wrapper.find('.success-icon').exists()).toBe(true)
    
    // Verify router-links exist (text rendering requires e2e test due to stub limitations)
    const links = wrapper.findAll('router-link-stub')
    expect(links.length).toBe(2)
    expect(links[0].attributes('to')).toBe('/student/inquiries')
    expect(links[1].attributes('to')).toBe('/marketplace')
    
    // NOTE: Full navigation test requires e2e (Playwright/Cypress) due to router-link stub limitations in unit tests
  })

  it('показує помилку cooldown з backend meta', async () => {
    const { createInquiry } = await import('@/api/inquiries')
    const cooldownError = {
      isAxiosError: true,
      response: {
        status: 409,
        data: {
          code: 'INQUIRY_COOLDOWN_ACTIVE',
          message: 'Cooldown active',
          meta: {
            locked_reason: 'cooldown',
            cooldown_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            tutor_id: '1'
          }
        }
      }
    }
    vi.mocked(createInquiry).mockRejectedValue(cooldownError)

    const wrapper = mount(InquiryFormModal, {
      props: {
        show: true,
        tutor
      },
      global: {
        plugins: [i18n, createPinia()],
        stubs: {
          'router-link': true
        }
      }
    })

    await wrapper.find('select#student_level').setValue('beginner')
    await wrapper.find('textarea#message').setValue('Test message for inquiry')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.text()).toContain('Cooldown активний')
  })

  it('показує помилку max-open з CTA для upgrade', async () => {
    const { createInquiry } = await import('@/api/inquiries')
    const maxOpenError = {
      isAxiosError: true,
      response: {
        status: 409,
        data: {
          code: 'STUDENT_ACTIVE_LIMIT_REACHED',
          message: 'Active limit reached',
          meta: {
            locked_reason: 'max_open_limit',
            limit: 5,
            current_count: 5
          }
        }
      }
    }
    vi.mocked(createInquiry).mockRejectedValue(maxOpenError)

    const wrapper = mount(InquiryFormModal, {
      props: {
        show: true,
        tutor
      },
      global: {
        plugins: [i18n, createPinia()],
        stubs: {
          'router-link': {
            template: '<a><slot /></a>'
          }
        }
      }
    })

    await wrapper.find('select#student_level').setValue('beginner')
    await wrapper.find('textarea#message').setValue('Test message for inquiry')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.text()).toContain('Досягнуто ліміт активних запитів')
    expect(wrapper.html()).toContain('Оновіть до PRO')
  })

  it.skip('показує limit_display при 429 rate limit', async () => {
    const { createInquiry } = await import('@/api/inquiries')
    const rateLimitError = {
      isAxiosError: true,
      response: {
        status: 429,
        headers: {
          'retry-after': '60'
        },
        data: {
          code: 'rate_limited',
          message: 'Too many requests',
          meta: {
            retry_after_seconds: 60,
            limit_display: '10/год, 30/день',
            locked_reason: 'rate_limit'
          }
        }
      }
    }
    vi.mocked(createInquiry).mockRejectedValue(rateLimitError)

    const wrapper = mount(InquiryFormModal, {
      props: {
        show: true,
        tutor
      },
      global: {
        plugins: [i18n, createPinia()],
        stubs: {
          'router-link': true
        }
      }
    })

    await wrapper.find('select#student_level').setValue('beginner')
    await wrapper.find('textarea#message').setValue('Test message for inquiry')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.text()).toContain('Перевищено ліміт: 10/год, 30/день')
  })
})
