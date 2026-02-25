import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import StudentInquiriesView from '../StudentInquiriesView.vue'

vi.mock('@/api/inquiries', () => ({
  fetchInquiries: vi.fn(() => Promise.resolve([]))
}))

const i18n = createI18n({
  legacy: false,
  locale: 'uk',
  messages: {
    uk: {
      inquiries: {
        student: {
          title: 'Мої запити',
          empty: {
            title: 'Немає запитів',
            description: 'Ви ще не надіслали жодного запиту'
          }
        }
      },
      common: {
        loading: 'Завантаження...',
        retry: 'Спробувати ще раз'
      }
    }
  }
})

describe('StudentInquiriesView - Auto-refresh', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('завантажує inquiries при монтуванні', async () => {
    const { fetchInquiries } = await import('@/api/inquiries')
    vi.mocked(fetchInquiries).mockResolvedValue([])

    mount(StudentInquiriesView, {
      global: {
        plugins: [i18n, createPinia()],
        stubs: {
          'router-link': true
        }
      }
    })

    await flushPromises()

    expect(vi.mocked(fetchInquiries)).toHaveBeenCalled()
  })

  it('компонент монтується без помилок і відмонтовується коректно', async () => {
    const wrapper = mount(StudentInquiriesView, {
      global: {
        plugins: [i18n, createPinia()],
        stubs: {
          'router-link': true
        }
      }
    })

    await flushPromises()
    expect(wrapper.exists()).toBe(true)
    expect(() => wrapper.unmount()).not.toThrow()
  })

  it('показує порожній стан коли немає inquiries', async () => {
    const { fetchInquiries } = await import('@/api/inquiries')
    vi.mocked(fetchInquiries).mockResolvedValue([])

    const wrapper = mount(StudentInquiriesView, {
      global: {
        plugins: [i18n, createPinia()],
        stubs: {
          'router-link': true
        }
      }
    })

    await flushPromises()

    expect(wrapper.text()).toContain('Немає запитів')
  })
})
