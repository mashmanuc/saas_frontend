import { describe, it, beforeEach, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { reactive } from 'vue'
import dayjs from 'dayjs'

const { notifySuccess, notifyError, settingsStoreMock } = vi.hoisted(() => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
  settingsStoreMock: { language: 'en' },
}))

vi.mock('@fullcalendar/vue3', () => ({
  default: {
    name: 'FullCalendarStub',
    props: ['options'],
    template: '<div data-test="calendar"></div>',
  },
}))

vi.mock('../../src/utils/notify', () => ({
  notifySuccess,
  notifyError,
}))

vi.mock('../../src/stores/settingsStore', () => ({
  useSettingsStore: () => settingsStoreMock,
}))

// Mock StudentAutocomplete component
vi.mock('../../src/modules/booking/components/StudentAutocomplete.vue', () => ({
  default: {
    name: 'StudentAutocomplete',
    props: ['modelValue', 'label', 'placeholder', 'showInviteCta'],
    emits: ['update:modelValue', 'invite'],
    template: '<div data-test="student-autocomplete"><input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" /></div>',
  },
}))

vi.mock('../../src/modules/booking/api/studentsApi', () => ({
  studentsApi: {
    listStudents: vi.fn().mockResolvedValue({ count: 1, results: [{ id: 'student-1', full_name: 'Student 1' }] }),
  },
}))

import LessonList from '../../src/modules/lessons/views/LessonList.vue'

let lessonStoreMock

const createLessonStoreMock = () => {
  const store = reactive({
    items: [
      {
        id: 1,
        status: 'scheduled',
        student: { name: 'Alan T.' },
        startLocal: '2024-01-01T10:00:00.000Z',
        endLocal: '2024-01-01T11:00:00.000Z',
      },
    ],
    role: 'tutor',
    status: 'scheduled',
    loading: false,
    error: null,
    range: {
      start: null,
      end: null,
    },
    setRole: vi.fn((value) => {
      store.role = value
    }),
    setStatus: vi.fn((value) => {
      store.status = value
    }),
    fetchLessons: vi.fn().mockResolvedValue(),
    setRange: vi.fn((range) => {
      store.range = range
    }),
    initializeRange: vi.fn(),
    startPolling: vi.fn(),
    stopPolling: vi.fn(),
    createLesson: vi.fn().mockResolvedValue(),
    rescheduleLesson: vi.fn().mockResolvedValue(),
    cancelLesson: vi.fn().mockResolvedValue(),
  })

  return store
}

vi.mock('../../src/modules/lessons/store/lessonStore', () => ({
  useLessonStore: () => lessonStoreMock,
  LESSON_STATUSES: Object.freeze({
    SCHEDULED: 'scheduled',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
  }),
}))

const mountComponent = () =>
  mount(LessonList, {
    global: {
      stubs: {
        teleport: true,
      },
    },
  })

describe('LessonList.vue', () => {
  beforeEach(() => {
    lessonStoreMock = createLessonStoreMock()
    notifySuccess.mockClear()
    notifyError.mockClear()
  })

  it('renders header content and calendar stub', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    expect(wrapper.find('[data-test="lessons-header-title"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="lessons-header-subtitle"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="calendar"]').exists()).toBe(true)
  })

  it('refresh button triggers lessons fetch', async () => {
    const wrapper = mountComponent()
    await flushPromises()
    lessonStoreMock.fetchLessons.mockClear()

    const refreshButton = wrapper.find('[data-test="refresh-lessons-button"]')
    await refreshButton.trigger('click')
    await flushPromises()

    expect(lessonStoreMock.fetchLessons).toHaveBeenCalled()
  })

  it('switching role updates store and refetches', async () => {
    const wrapper = mountComponent()
    await flushPromises()
    const studentButton = wrapper.find('[data-test="role-student"]')

    await studentButton.trigger('click')
    await flushPromises()

    expect(lessonStoreMock.setRole).toHaveBeenCalledWith('student')
    expect(lessonStoreMock.fetchLessons).toHaveBeenCalled()
  })

  it('datesSet handler updates range and reloads lessons', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    const calendar = wrapper.findComponent({ name: 'FullCalendarStub' })
    const options = calendar.props('options')

    await options.datesSet({ startStr: '2024-01-01', endStr: '2024-01-07' })
    await flushPromises()

    expect(lessonStoreMock.setRange).toHaveBeenCalledWith({ start: '2024-01-01', end: '2024-01-07' })
    expect(lessonStoreMock.fetchLessons).toHaveBeenCalled()
  })

  it('status filter updates store and refetches lessons', async () => {
    const wrapper = mountComponent()
    await flushPromises()
    lessonStoreMock.setStatus.mockClear()
    lessonStoreMock.fetchLessons.mockClear()

    const statusFilter = wrapper.find('[data-test="status-filter"]')
    const statusButtons = statusFilter.findAll('button')
    // Button order: all(0), scheduled(1), completed(2), cancelled(3)
    // Current status is 'scheduled', so click 'completed' (index 2) to trigger change
    await statusButtons[2].trigger('click')
    await flushPromises()

    expect(lessonStoreMock.setStatus).toHaveBeenCalledWith('completed')
    expect(lessonStoreMock.fetchLessons).toHaveBeenCalled()
  })

  it('shows partial results banner when store flag set', async () => {
    lessonStoreMock.hasMoreEvents = true
    const wrapper = mountComponent()
    await flushPromises()

    expect(wrapper.find('[data-test="partial-info"]').exists()).toBe(true)
  })

  it('create lesson form submits payload via store', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    const newLessonButton = wrapper.find('[data-test="create-lesson-button"]')
    await newLessonButton.trigger('click')

    // StudentAutocomplete is mocked - find input inside it
    const studentAutocompleteInput = wrapper.find('[data-test="student-autocomplete"] input')
    const seriesInput = wrapper.find('[data-test="series-id-input"]')
    const datetimeInputs = wrapper.findAll('input[type="datetime-local"]')

    // Set student ID via mocked autocomplete input
    await studentAutocompleteInput.setValue('student-1')
    await seriesInput.setValue('SERIES-10')
    await datetimeInputs[0].setValue('2024-01-01T10:00')
    await datetimeInputs[1].setValue('2024-01-01T11:00')

    const saveButton = wrapper.find('[data-test="submit-create-lesson"]')
    await saveButton.trigger('click')
    await flushPromises()

    expect(lessonStoreMock.createLesson).toHaveBeenCalledWith({
      student_id: 'student-1',
      start: dayjs('2024-01-01T10:00').toISOString(),
      end: dayjs('2024-01-01T11:00').toISOString(),
      series_id: 'SERIES-10',
    })
    expect(notifySuccess).toHaveBeenCalled()
  })

  it('event drag invokes reschedule API and notifications', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    const calendar = wrapper.findComponent({ name: 'FullCalendarStub' })
    const options = calendar.props('options')

    await options.eventDrop({
      event: {
        id: '1',
        start: new Date('2024-01-02T12:00:00.000Z'),
        end: new Date('2024-01-02T13:00:00.000Z'),
      },
      revert: vi.fn(),
    })

    expect(lessonStoreMock.rescheduleLesson).toHaveBeenCalledWith('1', {
      start: '2024-01-02T12:00:00.000Z',
      end: '2024-01-02T13:00:00.000Z',
    })
    expect(notifySuccess).toHaveBeenCalled()
  })

  it('reschedule errors revert event and show error notification', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    const revertSpy = vi.fn()
    lessonStoreMock.rescheduleLesson.mockRejectedValueOnce(new Error('fail'))

    const calendar = wrapper.findComponent({ name: 'FullCalendarStub' })
    const options = calendar.props('options')

    await options.eventDrop({
      event: {
        id: '1',
        start: new Date('2024-01-03T09:00:00.000Z'),
        end: new Date('2024-01-03T10:00:00.000Z'),
      },
      revert: revertSpy,
    })

    expect(revertSpy).toHaveBeenCalled()
    expect(notifyError).toHaveBeenCalled()
  })
})
