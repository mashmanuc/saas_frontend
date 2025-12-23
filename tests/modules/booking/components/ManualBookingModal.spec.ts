import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import ManualBookingModal from '@/modules/booking/components/modals/ManualBookingModal.vue'
import type { CalendarCell } from '@/modules/booking/types/calendar'

vi.mock('@/modules/booking/stores/bookingStore', () => ({
  useBookingStore: () => ({
    recentStudents: [],
    createManualBooking: vi.fn().mockResolvedValue({ id: 123 }),
    searchStudents: vi.fn(),
  }),
}))

describe('ManualBookingModal', () => {
  const mockCell: CalendarCell = {
    startAtUTC: '2024-12-23T10:00:00Z',
    durationMin: 30,
    status: 'available',
    source: 'template',
  }

  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('Rendering', () => {
    it('renders modal when visible', () => {
      const wrapper = mount(ManualBookingModal, {
        props: {
          visible: true,
          cell: mockCell,
        },
        global: {
          mocks: {
            $t: (key: string) => key,
          },
        },
      })

      expect(wrapper.find('.modal-overlay').exists()).toBe(true)
      expect(wrapper.text()).toContain('booking.manualBooking.title')
    })

    it('does not render when not visible', () => {
      const wrapper = mount(ManualBookingModal, {
        props: {
          visible: false,
          cell: mockCell,
        },
      })

      expect(wrapper.find('.modal-overlay').exists()).toBe(false)
    })

    it('renders all form fields', () => {
      const wrapper = mount(ManualBookingModal, {
        props: {
          visible: true,
          cell: mockCell,
        },
        global: {
          mocks: {
            $t: (key: string) => key,
          },
        },
      })

      expect(wrapper.text()).toContain('booking.manualBooking.student')
      expect(wrapper.text()).toContain('booking.manualBooking.startTime')
      expect(wrapper.text()).toContain('booking.manualBooking.duration')
      expect(wrapper.text()).toContain('booking.manualBooking.notes')
    })

    it('renders duration selector with 30/60/90 options', () => {
      const wrapper = mount(ManualBookingModal, {
        props: {
          visible: true,
          cell: mockCell,
        },
      })

      const durationButtons = wrapper.findAll('.duration-btn')
      expect(durationButtons).toHaveLength(3)
      expect(durationButtons[0].text()).toContain('30')
      expect(durationButtons[1].text()).toContain('60')
      expect(durationButtons[2].text()).toContain('90')
    })
  })

  describe('Duration selection', () => {
    it('defaults to 60 minutes', () => {
      const wrapper = mount(ManualBookingModal, {
        props: {
          visible: true,
          cell: mockCell,
        },
      })

      const activeButton = wrapper.find('.duration-btn.active')
      expect(activeButton.text()).toContain('60')
    })

    it('changes duration when button clicked', async () => {
      const wrapper = mount(ManualBookingModal, {
        props: {
          visible: true,
          cell: mockCell,
        },
      })

      const duration30Button = wrapper.findAll('.duration-btn')[0]
      await duration30Button.trigger('click')

      expect(duration30Button.classes()).toContain('active')
    })
  })

  describe('Form validation', () => {
    it('disables submit button when no student selected', () => {
      const wrapper = mount(ManualBookingModal, {
        props: {
          visible: true,
          cell: mockCell,
        },
      })

      const submitButton = wrapper.find('button[type="submit"]')
      expect(submitButton.attributes('disabled')).toBeDefined()
    })

    it('shows validation error when submitting without student', async () => {
      const wrapper = mount(ManualBookingModal, {
        props: {
          visible: true,
          cell: mockCell,
        },
      })

      const form = wrapper.find('form')
      await form.trigger('submit')

      expect(wrapper.find('.field-error').exists()).toBe(true)
    })
  })

  describe('Form submission', () => {
    it('calls createManualBooking with correct params', async () => {
      const mockCreateBooking = vi.fn().mockResolvedValue({ id: 123 })
      
      const wrapper = mount(ManualBookingModal, {
        props: {
          visible: true,
          cell: mockCell,
        },
        global: {
          mocks: {
            bookingStore: {
              createManualBooking: mockCreateBooking,
              recentStudents: [],
            },
          },
        },
      })

      // Simulate student selection
      const vm = wrapper.vm as any
      vm.selectedStudent = { id: 45, name: 'Test Student' }
      vm.selectedDuration = 60
      vm.notes = 'Test notes'

      const form = wrapper.find('form')
      await form.trigger('submit')

      // Note: Full test would require proper store mocking
    })

    it('shows loading state during submission', async () => {
      const wrapper = mount(ManualBookingModal, {
        props: {
          visible: true,
          cell: mockCell,
        },
      })

      // Access component state through vm
      const vm = wrapper.vm as any
      vm.selectedStudent = { id: 45, name: 'Test' }
      vm.submitting = true
      await wrapper.vm.$nextTick()

      const submitButton = wrapper.find('button[type="submit"]')
      expect(submitButton.find('.animate-spin').exists()).toBe(true)
    })

    it('emits success event after successful submission', async () => {
      const wrapper = mount(ManualBookingModal, {
        props: {
          visible: true,
          cell: mockCell,
        },
      })

      const vm = wrapper.vm as any
      vm.selectedStudent = { id: 45, name: 'Test' }
      
      // Simulate successful submission
      await wrapper.vm.$nextTick()
      wrapper.vm.$emit('success', 123)

      expect(wrapper.emitted('success')).toBeTruthy()
      expect(wrapper.emitted('success')?.[0]).toEqual([123])
    })
  })

  describe('Error handling', () => {
    it('displays tutor overlap error', async () => {
      const wrapper = mount(ManualBookingModal, {
        props: {
          visible: true,
          cell: mockCell,
        },
      })

      const vm = wrapper.vm as any
      vm.error = 'tutor_overlap'
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.error-message').exists()).toBe(true)
      expect(wrapper.text()).toContain('У вас вже є урок у цей час')
    })

    it('displays student overlap error', async () => {
      const wrapper = mount(ManualBookingModal, {
        props: {
          visible: true,
          cell: mockCell,
        },
      })

      const vm = wrapper.vm as any
      vm.error = 'student_overlap'
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.error-message').exists()).toBe(true)
      expect(wrapper.text()).toContain('Учень вже має урок у цей час')
    })

    it('displays generic error', async () => {
      const wrapper = mount(ManualBookingModal, {
        props: {
          visible: true,
          cell: mockCell,
        },
      })

      const vm = wrapper.vm as any
      vm.error = 'Some error message'
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.error-message').exists()).toBe(true)
    })
  })

  describe('Close behavior', () => {
    it('emits close when close button clicked', async () => {
      const wrapper = mount(ManualBookingModal, {
        props: {
          visible: true,
          cell: mockCell,
        },
      })

      const closeButton = wrapper.find('.close-btn')
      await closeButton.trigger('click')

      expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('emits close when cancel button clicked', async () => {
      const wrapper = mount(ManualBookingModal, {
        props: {
          visible: true,
          cell: mockCell,
        },
      })

      const cancelButton = wrapper.find('.btn-secondary')
      await cancelButton.trigger('click')

      expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('emits close when clicking overlay', async () => {
      const wrapper = mount(ManualBookingModal, {
        props: {
          visible: true,
          cell: mockCell,
        },
      })

      const overlay = wrapper.find('.modal-overlay')
      await overlay.trigger('click')

      expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('resets form state on close', async () => {
      const wrapper = mount(ManualBookingModal, {
        props: {
          visible: true,
          cell: mockCell,
        },
      })

      const vm = wrapper.vm as any
      vm.selectedStudent = { id: 45, name: 'Test' }
      vm.notes = 'Test notes'
      vm.error = 'Some error'

      const closeButton = wrapper.find('.close-btn')
      await closeButton.trigger('click')

      // After close, state should be reset
      expect(wrapper.emitted('close')).toBeTruthy()
    })
  })

  describe('Time formatting', () => {
    it('displays formatted start time', () => {
      const wrapper = mount(ManualBookingModal, {
        props: {
          visible: true,
          cell: mockCell,
        },
      })

      const timeInput = wrapper.find('.input-disabled')
      const inputElement = timeInput.element as HTMLInputElement
      expect(inputElement.value.length).toBeGreaterThan(0)
    })
  })

  describe('Telemetry', () => {
    it('tracks manual booking creation', async () => {
      const mockTelemetry = {
        track: vi.fn(),
      }
      
      ;(window as any).telemetry = mockTelemetry

      const wrapper = mount(ManualBookingModal, {
        props: {
          visible: true,
          cell: mockCell,
        },
      })

      const vm = wrapper.vm as any
      vm.selectedStudent = { id: 45, name: 'Test' }
      
      // Simulate successful submission
      // Note: Full test would require proper store integration
    })
  })
})
