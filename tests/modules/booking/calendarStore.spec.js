// Unit tests for calendarStore (v0.21.0)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Mock booking API
vi.mock('@/modules/booking/api/booking', () => ({
  bookingApi: {
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
    getAvailability: vi.fn(),
    setAvailability: vi.fn(),
    deleteAvailability: vi.fn(),
    getSlots: vi.fn(),
    blockSlot: vi.fn(),
    unblockSlot: vi.fn(),
    createCustomSlot: vi.fn(),
    getExceptions: vi.fn(),
    addException: vi.fn(),
    deleteException: vi.fn(),
    getCalendar: vi.fn(),
  },
}))

import { useCalendarStore } from '@/modules/booking/stores/calendarStore'
import { bookingApi } from '@/modules/booking/api/booking'

const mockSlot = {
  id: 1,
  date: '2024-12-15',
  start_time: '10:00:00',
  end_time: '11:00:00',
  start_datetime: '2024-12-15T10:00:00Z',
  end_datetime: '2024-12-15T11:00:00Z',
  status: 'available',
  duration_minutes: 60,
}

const mockSettings = {
  timezone: 'Europe/Kiev',
  default_lesson_duration: 60,
  buffer_before: 5,
  buffer_after: 5,
  min_booking_notice: 2,
  max_booking_advance: 30,
  auto_accept: false,
  cancellation_policy: 'moderate',
  email_notifications: true,
  push_notifications: true,
}

describe('calendarStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('initial state', () => {
    it('should have empty slots', () => {
      const store = useCalendarStore()
      expect(store.slots).toEqual([])
    })

    it('should have null settings', () => {
      const store = useCalendarStore()
      expect(store.settings).toBeNull()
    })

    it('should have week view mode', () => {
      const store = useCalendarStore()
      expect(store.viewMode).toBe('week')
    })

    it('should have today as selected date', () => {
      const store = useCalendarStore()
      const today = new Date()
      expect(store.selectedDate.getDate()).toBe(today.getDate())
    })
  })

  describe('computed properties', () => {
    it('slotsByDate should group slots by date', () => {
      const store = useCalendarStore()
      store.slots = [
        { ...mockSlot, id: 1, date: '2024-12-15' },
        { ...mockSlot, id: 2, date: '2024-12-15' },
        { ...mockSlot, id: 3, date: '2024-12-16' },
      ]

      expect(Object.keys(store.slotsByDate)).toHaveLength(2)
      expect(store.slotsByDate['2024-12-15']).toHaveLength(2)
      expect(store.slotsByDate['2024-12-16']).toHaveLength(1)
    })

    it('availableSlots should filter available slots', () => {
      const store = useCalendarStore()
      store.slots = [
        { ...mockSlot, id: 1, status: 'available' },
        { ...mockSlot, id: 2, status: 'booked' },
        { ...mockSlot, id: 3, status: 'available' },
      ]

      expect(store.availableSlots).toHaveLength(2)
    })

    it('bookedSlots should filter booked slots', () => {
      const store = useCalendarStore()
      store.slots = [
        { ...mockSlot, id: 1, status: 'available' },
        { ...mockSlot, id: 2, status: 'booked' },
        { ...mockSlot, id: 3, status: 'blocked' },
      ]

      expect(store.bookedSlots).toHaveLength(1)
    })

    it('weekDays should return 7 days starting from Monday', () => {
      const store = useCalendarStore()
      store.selectedDate = new Date('2024-12-15') // Sunday

      expect(store.weekDays).toHaveLength(7)
      // First day should be Monday (Dec 9)
      expect(store.weekDays[0].getDay()).toBe(1) // Monday
    })
  })

  describe('loadSettings action', () => {
    it('should load settings from API', async () => {
      const store = useCalendarStore()
      bookingApi.getSettings.mockResolvedValue(mockSettings)

      await store.loadSettings()

      expect(store.settings).toEqual(mockSettings)
    })

    it('should handle errors', async () => {
      const store = useCalendarStore()
      bookingApi.getSettings.mockRejectedValue(new Error('Network error'))

      await store.loadSettings()

      expect(store.error).toBe('Network error')
    })
  })

  describe('updateSettings action', () => {
    it('should update settings', async () => {
      const store = useCalendarStore()
      const updated = { ...mockSettings, auto_accept: true }
      bookingApi.updateSettings.mockResolvedValue(updated)

      await store.updateSettings({ auto_accept: true })

      expect(store.settings?.auto_accept).toBe(true)
    })
  })

  describe('loadSlots action', () => {
    it('should load slots from API', async () => {
      const store = useCalendarStore()
      const mockSlots = [mockSlot, { ...mockSlot, id: 2 }]
      bookingApi.getSlots.mockResolvedValue(mockSlots)

      await store.loadSlots(1, '2024-12-15', '2024-12-21')

      expect(bookingApi.getSlots).toHaveBeenCalledWith(1, '2024-12-15', '2024-12-21')
      expect(store.slots).toEqual(mockSlots)
    })

    it('should set loading state', async () => {
      const store = useCalendarStore()
      bookingApi.getSlots.mockResolvedValue([])

      const promise = store.loadSlots(1, '2024-12-15', '2024-12-21')
      expect(store.isLoading).toBe(true)

      await promise
      expect(store.isLoading).toBe(false)
    })
  })

  describe('blockSlot action', () => {
    it('should block slot and update status', async () => {
      const store = useCalendarStore()
      store.slots = [{ ...mockSlot, status: 'available' }]
      bookingApi.blockSlot.mockResolvedValue(undefined)

      await store.blockSlot(1, 'Personal time')

      expect(bookingApi.blockSlot).toHaveBeenCalledWith(1, 'Personal time')
      expect(store.slots[0].status).toBe('blocked')
    })
  })

  describe('unblockSlot action', () => {
    it('should unblock slot and update status', async () => {
      const store = useCalendarStore()
      store.slots = [{ ...mockSlot, status: 'blocked' }]
      bookingApi.unblockSlot.mockResolvedValue(undefined)

      await store.unblockSlot(1)

      expect(store.slots[0].status).toBe('available')
    })
  })

  describe('availability actions', () => {
    it('loadAvailability should load from API', async () => {
      const store = useCalendarStore()
      const mockAvailability = [
        { id: 1, day_of_week: 1, start_time: '09:00', end_time: '17:00' },
      ]
      bookingApi.getAvailability.mockResolvedValue(mockAvailability)

      await store.loadAvailability()

      expect(store.availability).toEqual(mockAvailability)
    })

    it('setAvailability should update and reload', async () => {
      const store = useCalendarStore()
      bookingApi.setAvailability.mockResolvedValue(undefined)
      bookingApi.getAvailability.mockResolvedValue([])

      await store.setAvailability([
        { day_of_week: 1, start_time: '09:00', end_time: '17:00' },
      ])

      expect(bookingApi.setAvailability).toHaveBeenCalled()
      expect(bookingApi.getAvailability).toHaveBeenCalled()
    })
  })

  describe('exception actions', () => {
    it('loadExceptions should load from API', async () => {
      const store = useCalendarStore()
      const mockExceptions = [
        { id: 1, date: '2024-12-25', exception_type: 'unavailable' },
      ]
      bookingApi.getExceptions.mockResolvedValue(mockExceptions)

      await store.loadExceptions('2024-12-01', '2024-12-31')

      expect(store.exceptions).toEqual(mockExceptions)
    })

    it('addException should add to list', async () => {
      const store = useCalendarStore()
      const newException = { id: 1, date: '2024-12-25', exception_type: 'unavailable' }
      bookingApi.addException.mockResolvedValue(newException)

      await store.addException({ date: '2024-12-25', exception_type: 'unavailable' })

      expect(store.exceptions).toContain(newException)
    })

    it('deleteException should remove from list', async () => {
      const store = useCalendarStore()
      store.exceptions = [{ id: 1, date: '2024-12-25', exception_type: 'unavailable' }]
      bookingApi.deleteException.mockResolvedValue(undefined)

      await store.deleteException(1)

      expect(store.exceptions).toHaveLength(0)
    })
  })

  describe('navigation actions', () => {
    it('setSelectedDate should update date', () => {
      const store = useCalendarStore()
      const newDate = new Date('2024-12-20')

      store.setSelectedDate(newDate)

      expect(store.selectedDate).toEqual(newDate)
    })

    it('setSelectedSlot should update slot', () => {
      const store = useCalendarStore()

      store.setSelectedSlot(mockSlot)

      expect(store.selectedSlot).toEqual(mockSlot)
    })

    it('setViewMode should update mode', () => {
      const store = useCalendarStore()

      store.setViewMode('month')

      expect(store.viewMode).toBe('month')
    })

    it('navigateWeek should move by 7 days', () => {
      const store = useCalendarStore()
      store.selectedDate = new Date('2024-12-15')

      store.navigateWeek(1)

      expect(store.selectedDate.getDate()).toBe(22)
    })

    it('navigateWeek should move backwards', () => {
      const store = useCalendarStore()
      store.selectedDate = new Date('2024-12-15')

      store.navigateWeek(-1)

      expect(store.selectedDate.getDate()).toBe(8)
    })

    it('navigateMonth should move by 1 month', () => {
      const store = useCalendarStore()
      store.selectedDate = new Date('2024-12-15')

      store.navigateMonth(1)

      expect(store.selectedDate.getMonth()).toBe(0) // January
    })

    it('goToToday should set to today', () => {
      const store = useCalendarStore()
      store.selectedDate = new Date('2024-01-01')

      store.goToToday()

      const today = new Date()
      expect(store.selectedDate.getDate()).toBe(today.getDate())
    })
  })

  describe('$reset action', () => {
    it('should reset all state', () => {
      const store = useCalendarStore()
      store.slots = [mockSlot]
      store.settings = mockSettings
      store.viewMode = 'month'
      store.selectedSlot = mockSlot

      store.$reset()

      expect(store.slots).toEqual([])
      expect(store.settings).toBeNull()
      expect(store.viewMode).toBe('week')
      expect(store.selectedSlot).toBeNull()
    })
  })
})
