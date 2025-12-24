import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AvailabilityTemplateEditor from '@/modules/booking/components/availability/AvailabilityTemplateEditor.vue'
import { useAvailabilityStore } from '@/modules/booking/stores/availabilityStore'

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  }),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
}))

vi.mock('@/modules/booking/api/availabilityApi', () => ({
  availabilityApi: {
    getTemplate: vi.fn().mockResolvedValue(null),
    saveTemplate: vi.fn(),
    deleteTemplate: vi.fn(),
    getGenerationJobStatus: vi.fn(),
  },
}))

describe('AvailabilityTemplateEditor', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders weekdays', async () => {
    const wrapper = mount(AvailabilityTemplateEditor, {
      global: {
        mocks: {
          $t: (key: string) => key,
        },
      },
    })

    await flushPromises()
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('common.weekdays.monday')
    expect(wrapper.text()).toContain('common.weekdays.tuesday')
    expect(wrapper.text()).toContain('common.weekdays.wednesday')
  })

  it('allows adding time slots', async () => {
    const wrapper = mount(AvailabilityTemplateEditor, {
      global: {
        mocks: {
          $t: (key: string) => key,
        },
      },
    })

    await flushPromises()
    await wrapper.vm.$nextTick()

    const addButtons = wrapper.findAll('.btn-add-slot')
    expect(addButtons.length).toBeGreaterThan(0)

    await addButtons[0].trigger('click')
    await wrapper.vm.$nextTick()

    const timeInputs = wrapper.findAll('.time-input')
    expect(timeInputs.length).toBeGreaterThan(0)
  })

  it('validates overlapping slots', async () => {
    const wrapper = mount(AvailabilityTemplateEditor, {
      global: {
        mocks: {
          $t: (key: string) => key,
        },
      },
    })

    await flushPromises()
    await wrapper.vm.$nextTick()

    // Add two slots to Monday
    const addButton = wrapper.findAll('.btn-add-slot')[0]
    await addButton.trigger('click')
    await addButton.trigger('click')
    await wrapper.vm.$nextTick()

    // Set overlapping times
    const timeInputs = wrapper.findAll('.time-input')
    await timeInputs[0].setValue('09:00')
    await timeInputs[1].setValue('12:00')
    await timeInputs[2].setValue('11:00')
    await timeInputs[3].setValue('13:00')

    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Перетин')
  })

  it('disables save button when no slots', async () => {
    const wrapper = mount(AvailabilityTemplateEditor, {
      global: {
        mocks: {
          $t: (key: string) => key,
        },
      },
    })

    await flushPromises()
    await wrapper.vm.$nextTick()

    const saveButton = wrapper.find('.btn-primary')
    expect(saveButton.attributes('disabled')).toBeDefined()
  })

  it('enables save button when valid slots exist', async () => {
    const wrapper = mount(AvailabilityTemplateEditor, {
      global: {
        mocks: {
          $t: (key: string) => key,
        },
      },
    })

    await flushPromises()
    await wrapper.vm.$nextTick()

    // Add a valid slot
    const addButton = wrapper.findAll('.btn-add-slot')[0]
    await addButton.trigger('click')
    await wrapper.vm.$nextTick()

    const timeInputs = wrapper.findAll('.time-input')
    await timeInputs[0].setValue('09:00')
    await timeInputs[1].setValue('10:00')
    await wrapper.vm.$nextTick()

    const saveButton = wrapper.find('.btn-primary')
    expect(saveButton.attributes('disabled')).toBeUndefined()
  })

  it('removes slot when delete button clicked', async () => {
    const wrapper = mount(AvailabilityTemplateEditor, {
      global: {
        mocks: {
          $t: (key: string) => key,
        },
      },
    })

    await flushPromises()
    await wrapper.vm.$nextTick()

    // Add a slot
    const addButton = wrapper.findAll('.btn-add-slot')[0]
    await addButton.trigger('click')
    await wrapper.vm.$nextTick()

    let timeSlots = wrapper.findAll('.time-slot-item')
    expect(timeSlots.length).toBe(1)

    // Remove the slot
    const deleteButton = wrapper.find('.btn-icon-danger')
    await deleteButton.trigger('click')
    await wrapper.vm.$nextTick()

    timeSlots = wrapper.findAll('.time-slot-item')
    expect(timeSlots.length).toBe(0)
  })

  it('validates end time is after start time', async () => {
    const wrapper = mount(AvailabilityTemplateEditor, {
      global: {
        mocks: {
          $t: (key: string) => key,
        },
      },
    })

    await flushPromises()
    await wrapper.vm.$nextTick()

    // Add a slot
    const addButton = wrapper.findAll('.btn-add-slot')[0]
    await addButton.trigger('click')
    await wrapper.vm.$nextTick()

    // Set invalid times (end before start)
    const timeInputs = wrapper.findAll('.time-input')
    await timeInputs[0].setValue('12:00')
    await timeInputs[1].setValue('09:00')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('пізніше')
  })

  it('loads existing template on mount', async () => {
    const store = useAvailabilityStore()
    store.template = {
      id: 1,
      tutor_id: 79,
      weekly_slots: [
        { weekday: 0, start: '09:00', end: '12:00' },
        { weekday: 2, start: '14:00', end: '18:00' },
      ],
      timezone: 'Europe/Kiev',
      version: 1,
      last_generation_job_id: null,
      updated_at: '2025-12-23T19:00:00Z',
    }

    vi.spyOn(store, 'loadTemplate').mockResolvedValue(store.template)

    const wrapper = mount(AvailabilityTemplateEditor, {
      global: {
        mocks: {
          $t: (key: string) => key,
        },
      },
    })

    await wrapper.vm.$nextTick()
    await new Promise(resolve => setTimeout(resolve, 100))

    const timeSlots = wrapper.findAll('.time-slot-item')
    expect(timeSlots.length).toBeGreaterThan(0)
  })
})
