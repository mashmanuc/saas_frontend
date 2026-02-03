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

  it('встановлює інтервал авто-рефрешу на 2 хвилини (120s)', async () => {
    const setIntervalSpy = vi.spyOn(window, 'setInterval')
    
    mount(StudentInquiriesView, {
      global: {
        plugins: [i18n, createPinia()],
        stubs: {
          'router-link': true
        }
      }
    })

    await flushPromises()

    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 120000)
  })

  it('очищає інтервал при unmount', async () => {
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval')
    
    const wrapper = mount(StudentInquiriesView, {
      global: {
        plugins: [i18n, createPinia()],
        stubs: {
          'router-link': true
        }
      }
    })

    await flushPromises()
    wrapper.unmount()

    expect(clearIntervalSpy).toHaveBeenCalled()
  })

  it('викликає loadInquiries кожні 2 хвилини коли вкладка активна', async () => {
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
    const initialCallCount = vi.mocked(fetchInquiries).mock.calls.length

    // Advance time by 2 minutes
    vi.advanceTimersByTime(120000)
    await flushPromises()

    expect(vi.mocked(fetchInquiries).mock.calls.length).toBeGreaterThan(initialCallCount)
  })
})
