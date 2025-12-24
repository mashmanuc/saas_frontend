import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import BookingRequestModal from '@/modules/booking/components/requests/BookingRequestModal.vue'
import { bookingRequestsApi } from '@/modules/booking/api/bookingRequestsApi'

const toastMock = {
  success: vi.fn(),
  error: vi.fn(),
}

vi.mock('@/composables/useToast', () => ({
  useToast: () => toastMock,
}))

vi.mock('@/modules/booking/api/bookingRequestsApi', () => ({
  bookingRequestsApi: {
    create: vi.fn(),
  },
}))

describe('BookingRequestModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.values(toastMock).forEach(fn => fn.mockReset())
  })

  const mockSlot = {
    startAtUTC: '2024-12-23T09:00:00Z',
  }

  it('renders modal when visible', () => {
    const wrapper = mount(BookingRequestModal, {
      props: {
        visible: true,
        tutorId: 79,
        slot: mockSlot,
      },
    })

    expect(wrapper.find('.modal-overlay').exists()).toBe(true)
    expect(wrapper.find('.modal-container').exists()).toBe(true)
  })

  it('does not render when not visible', () => {
    const wrapper = mount(BookingRequestModal, {
      props: {
        visible: false,
        tutorId: 79,
        slot: mockSlot,
      },
    })

    expect(wrapper.find('.modal-overlay').exists()).toBe(false)
  })

  it('displays slot information', () => {
    const wrapper = mount(BookingRequestModal, {
      props: {
        visible: true,
        tutorId: 79,
        slot: mockSlot,
      },
    })

    expect(wrapper.find('.slot-info').exists()).toBe(true)
    expect(wrapper.find('.slot-date').exists()).toBe(true)
    expect(wrapper.find('.slot-time').exists()).toBe(true)
  })

  it('renders duration selector with 4 options', () => {
    const wrapper = mount(BookingRequestModal, {
      props: {
        visible: true,
        tutorId: 79,
        slot: mockSlot,
      },
    })

    const durationButtons = wrapper.findAll('.duration-btn')
    expect(durationButtons.length).toBe(4)
    expect(durationButtons[0].text()).toContain('30')
    expect(durationButtons[1].text()).toContain('60')
    expect(durationButtons[2].text()).toContain('90')
    expect(durationButtons[3].text()).toContain('120')
  })

  it('selects 60 minutes by default', () => {
    const wrapper = mount(BookingRequestModal, {
      props: {
        visible: true,
        tutorId: 79,
        slot: mockSlot,
      },
    })

    const activeDuration = wrapper.find('.duration-btn.active')
    expect(activeDuration.text()).toContain('60')
  })

  it('changes duration when button clicked', async () => {
    const wrapper = mount(BookingRequestModal, {
      props: {
        visible: true,
        tutorId: 79,
        slot: mockSlot,
      },
    })

    const duration90Btn = wrapper.findAll('.duration-btn')[2]
    await duration90Btn.trigger('click')
    await wrapper.vm.$nextTick()

    expect(duration90Btn.classes()).toContain('active')
  })

  it('renders message textarea', () => {
    const wrapper = mount(BookingRequestModal, {
      props: {
        visible: true,
        tutorId: 79,
        slot: mockSlot,
      },
    })

    expect(wrapper.find('.textarea').exists()).toBe(true)
  })

  it('emits close event when close button clicked', async () => {
    const wrapper = mount(BookingRequestModal, {
      props: {
        visible: true,
        tutorId: 79,
        slot: mockSlot,
      },
    })

    const closeBtn = wrapper.find('.close-btn')
    await closeBtn.trigger('click')

    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('emits close event when cancel button clicked', async () => {
    const wrapper = mount(BookingRequestModal, {
      props: {
        visible: true,
        tutorId: 79,
        slot: mockSlot,
      },
    })

    const cancelBtn = wrapper.find('.btn-secondary')
    await cancelBtn.trigger('click')

    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('submits booking request with correct data', async () => {
    vi.mocked(bookingRequestsApi.create).mockResolvedValue({
      id: 456,
      tutor_id: 79,
      student_id: 123,
      start_datetime: mockSlot.startAtUTC,
      duration_minutes: 60,
      student_message: 'Test message',
      tutor_response: null,
      status: 'pending',
      created_at: '2024-12-23T20:00:00Z',
      updated_at: '2024-12-23T20:00:00Z',
    })

    const wrapper = mount(BookingRequestModal, {
      props: {
        visible: true,
        tutorId: 79,
        slot: mockSlot,
      },
    })

    const textarea = wrapper.find('.textarea')
    await textarea.setValue('Test message')

    const form = wrapper.find('.request-form')
    await form.trigger('submit.prevent')
    await flushPromises()

    expect(bookingRequestsApi.create).toHaveBeenCalledWith({
      tutor_id: 79,
      start_datetime: mockSlot.startAtUTC,
      duration_minutes: 60,
      student_message: 'Test message',
    })
  })

  it('shows success notification on successful submit', async () => {
    vi.mocked(bookingRequestsApi.create).mockResolvedValue({
      id: 456,
      tutor_id: 79,
      student_id: 123,
      start_datetime: mockSlot.startAtUTC,
      duration_minutes: 60,
      student_message: '',
      tutor_response: null,
      status: 'pending',
      created_at: '2024-12-23T20:00:00Z',
      updated_at: '2024-12-23T20:00:00Z',
    })

    const wrapper = mount(BookingRequestModal, {
      props: {
        visible: true,
        tutorId: 79,
        slot: mockSlot,
      },
    })

    const form = wrapper.find('.request-form')
    await form.trigger('submit.prevent')
    await flushPromises()

    expect(toastMock.success).toHaveBeenCalledWith('Запит надіслано!')
  })

  it('emits success event with request id', async () => {
    vi.mocked(bookingRequestsApi.create).mockResolvedValue({
      id: 456,
      tutor_id: 79,
      student_id: 123,
      start_datetime: mockSlot.startAtUTC,
      duration_minutes: 60,
      student_message: '',
      tutor_response: null,
      status: 'pending',
      created_at: '2024-12-23T20:00:00Z',
      updated_at: '2024-12-23T20:00:00Z',
    })

    const wrapper = mount(BookingRequestModal, {
      props: {
        visible: true,
        tutorId: 79,
        slot: mockSlot,
      },
    })

    const form = wrapper.find('.request-form')
    await form.trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.emitted('success')).toBeTruthy()
    expect(wrapper.emitted('success')?.[0]).toEqual([456])
  })

  it('shows error message for overlap conflict', async () => {
    vi.mocked(bookingRequestsApi.create).mockRejectedValue({
      response: {
        data: {
          error: 'overlap_exists',
        },
      },
    })

    const wrapper = mount(BookingRequestModal, {
      props: {
        visible: true,
        tutorId: 79,
        slot: mockSlot,
      },
    })

    const form = wrapper.find('.request-form')
    await form.trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.find('.error-message').exists()).toBe(true)
    expect(wrapper.find('.error-message').text()).toContain('У вас вже є урок у цей час')
  })

  it('shows generic error message for other errors', async () => {
    vi.mocked(bookingRequestsApi.create).mockRejectedValue(
      new Error('Network error')
    )

    const wrapper = mount(BookingRequestModal, {
      props: {
        visible: true,
        tutorId: 79,
        slot: mockSlot,
      },
    })

    const form = wrapper.find('.request-form')
    await form.trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.find('.error-message').exists()).toBe(true)
    expect(wrapper.find('.error-message').text()).toContain('Не вдалося надіслати запит')
  })

  it('disables submit button during submission', async () => {
    vi.mocked(bookingRequestsApi.create).mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 100))
    )

    const wrapper = mount(BookingRequestModal, {
      props: {
        visible: true,
        tutorId: 79,
        slot: mockSlot,
      },
    })

    const form = wrapper.find('.request-form')
    await form.trigger('submit.prevent')
    await wrapper.vm.$nextTick()

    const submitBtn = wrapper.find('.btn-primary')
    expect(submitBtn.attributes('disabled')).toBeDefined()
  })

  it('shows loading spinner during submission', async () => {
    vi.mocked(bookingRequestsApi.create).mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 100))
    )

    const wrapper = mount(BookingRequestModal, {
      props: {
        visible: true,
        tutorId: 79,
        slot: mockSlot,
      },
    })

    const form = wrapper.find('.request-form')
    await form.trigger('submit.prevent')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.animate-spin').exists()).toBe(true)
  })

  it('closes modal after successful submission', async () => {
    vi.mocked(bookingRequestsApi.create).mockResolvedValue({
      id: 456,
      tutor_id: 79,
      student_id: 123,
      start_datetime: mockSlot.startAtUTC,
      duration_minutes: 60,
      student_message: '',
      tutor_response: null,
      status: 'pending',
      created_at: '2024-12-23T20:00:00Z',
      updated_at: '2024-12-23T20:00:00Z',
    })

    const wrapper = mount(BookingRequestModal, {
      props: {
        visible: true,
        tutorId: 79,
        slot: mockSlot,
      },
    })

    const form = wrapper.find('.request-form')
    await form.trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.emitted('close')).toBeTruthy()
  })
})
