// Unit tests for bookingStore (v0.21.0)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Mock booking API
vi.mock('@/modules/booking/api/booking', () => ({
  bookingApi: {
    getBookings: vi.fn(),
    getBooking: vi.fn(),
    createBooking: vi.fn(),
    confirmBooking: vi.fn(),
    cancelBooking: vi.fn(),
    rescheduleBooking: vi.fn(),
  },
}))

import { useBookingStore } from '@/modules/booking/stores/bookingStore'
import { bookingApi } from '@/modules/booking/api/booking'

const mockBooking = {
  id: 1,
  booking_id: 'BK-001',
  student: { id: 1, first_name: 'John', last_name: 'Doe' },
  tutor: { id: 2, first_name: 'Jane', last_name: 'Smith' },
  time_slot: {
    id: 1,
    date: '2024-12-15',
    start_time: '10:00:00',
    end_time: '11:00:00',
    start_datetime: '2024-12-15T10:00:00Z',
    end_datetime: '2024-12-15T11:00:00Z',
    status: 'booked',
    duration_minutes: 60,
  },
  subject: 'Mathematics',
  lesson_type: 'regular',
  status: 'confirmed',
  student_notes: 'Focus on algebra',
  price: 50,
  currency: '$',
  created_at: '2024-12-10T08:00:00Z',
}

describe('bookingStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('initial state', () => {
    it('should have empty bookings array', () => {
      const store = useBookingStore()
      expect(store.bookings).toEqual([])
    })

    it('should have null currentBooking', () => {
      const store = useBookingStore()
      expect(store.currentBooking).toBeNull()
    })

    it('should not be loading', () => {
      const store = useBookingStore()
      expect(store.isLoading).toBe(false)
    })

    it('should have no error', () => {
      const store = useBookingStore()
      expect(store.error).toBeNull()
    })
  })

  describe('computed properties', () => {
    it('upcomingBookings should filter confirmed future bookings', () => {
      const store = useBookingStore()
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 7)

      store.bookings = [
        {
          ...mockBooking,
          id: 1,
          status: 'confirmed',
          time_slot: {
            ...mockBooking.time_slot,
            start_datetime: futureDate.toISOString(),
            end_datetime: futureDate.toISOString(),
          },
        },
        {
          ...mockBooking,
          id: 2,
          status: 'pending',
          time_slot: {
            ...mockBooking.time_slot,
            start_datetime: futureDate.toISOString(),
          },
        },
        {
          ...mockBooking,
          id: 3,
          status: 'cancelled',
        },
      ]

      expect(store.upcomingBookings).toHaveLength(1)
      expect(store.upcomingBookings[0].id).toBe(1)
    })

    it('pendingBookings should filter pending bookings', () => {
      const store = useBookingStore()
      store.bookings = [
        { ...mockBooking, id: 1, status: 'pending' },
        { ...mockBooking, id: 2, status: 'confirmed' },
        { ...mockBooking, id: 3, status: 'pending' },
      ]

      expect(store.pendingBookings).toHaveLength(2)
    })

    it('pastBookings should filter completed/cancelled bookings', () => {
      const store = useBookingStore()
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 7)

      store.bookings = [
        { ...mockBooking, id: 1, status: 'completed' },
        { ...mockBooking, id: 2, status: 'cancelled' },
        {
          ...mockBooking,
          id: 3,
          status: 'confirmed',
          time_slot: {
            ...mockBooking.time_slot,
            end_datetime: pastDate.toISOString(),
          },
        },
      ]

      expect(store.pastBookings).toHaveLength(3)
    })

    it('nextBooking should return first upcoming booking', () => {
      const store = useBookingStore()
      const futureDate1 = new Date()
      futureDate1.setDate(futureDate1.getDate() + 3)
      const futureDate2 = new Date()
      futureDate2.setDate(futureDate2.getDate() + 7)

      store.bookings = [
        {
          ...mockBooking,
          id: 2,
          status: 'confirmed',
          time_slot: {
            ...mockBooking.time_slot,
            start_datetime: futureDate2.toISOString(),
          },
        },
        {
          ...mockBooking,
          id: 1,
          status: 'confirmed',
          time_slot: {
            ...mockBooking.time_slot,
            start_datetime: futureDate1.toISOString(),
          },
        },
      ]

      expect(store.nextBooking?.id).toBe(1)
    })
  })

  describe('loadBookings action', () => {
    it('should load bookings from API', async () => {
      const store = useBookingStore()
      const mockResponse = {
        count: 2,
        results: [mockBooking, { ...mockBooking, id: 2 }],
      }

      bookingApi.getBookings.mockResolvedValue(mockResponse)

      await store.loadBookings()

      expect(bookingApi.getBookings).toHaveBeenCalled()
      expect(store.bookings).toHaveLength(2)
      expect(store.totalCount).toBe(2)
    })

    it('should pass params to API', async () => {
      const store = useBookingStore()
      bookingApi.getBookings.mockResolvedValue({ count: 0, results: [] })

      await store.loadBookings({ role: 'student', status: 'pending' })

      expect(bookingApi.getBookings).toHaveBeenCalledWith({
        role: 'student',
        status: 'pending',
      })
    })

    it('should handle errors', async () => {
      const store = useBookingStore()
      bookingApi.getBookings.mockRejectedValue(new Error('Network error'))

      await store.loadBookings()

      expect(store.error).toBe('Network error')
    })
  })

  describe('loadBooking action', () => {
    it('should load single booking', async () => {
      const store = useBookingStore()
      bookingApi.getBooking.mockResolvedValue(mockBooking)

      await store.loadBooking(1)

      expect(bookingApi.getBooking).toHaveBeenCalledWith(1)
      expect(store.currentBooking).toEqual(mockBooking)
    })
  })

  describe('createBooking action', () => {
    it('should create booking and add to list', async () => {
      const store = useBookingStore()
      bookingApi.createBooking.mockResolvedValue(mockBooking)

      const result = await store.createBooking({
        tutor_id: 2,
        slot_id: 1,
        subject: 'Math',
        lesson_type: 'regular',
      })

      expect(result).toEqual(mockBooking)
      expect(store.bookings).toContain(mockBooking)
    })
  })

  describe('confirmBooking action', () => {
    it('should confirm booking and update list', async () => {
      const store = useBookingStore()
      store.bookings = [{ ...mockBooking, status: 'pending' }]

      const confirmedBooking = { ...mockBooking, status: 'confirmed' }
      bookingApi.confirmBooking.mockResolvedValue(confirmedBooking)

      await store.confirmBooking(1)

      expect(store.bookings[0].status).toBe('confirmed')
    })
  })

  describe('cancelBooking action', () => {
    it('should cancel booking with reason', async () => {
      const store = useBookingStore()
      store.bookings = [mockBooking]

      const cancelledBooking = { ...mockBooking, status: 'cancelled' }
      bookingApi.cancelBooking.mockResolvedValue(cancelledBooking)

      await store.cancelBooking(1, 'Schedule conflict')

      expect(bookingApi.cancelBooking).toHaveBeenCalledWith(1, 'Schedule conflict')
      expect(store.bookings[0].status).toBe('cancelled')
    })
  })

  describe('rescheduleBooking action', () => {
    it('should reschedule booking', async () => {
      const store = useBookingStore()
      store.bookings = [mockBooking]

      const rescheduledBooking = {
        ...mockBooking,
        id: 2,
        status: 'confirmed',
        time_slot: { ...mockBooking.time_slot, id: 5 },
      }
      bookingApi.rescheduleBooking.mockResolvedValue(rescheduledBooking)

      const result = await store.rescheduleBooking(1, 5, 'Need different time')

      expect(bookingApi.rescheduleBooking).toHaveBeenCalledWith(1, 5, 'Need different time')
      expect(store.bookings).not.toContainEqual(mockBooking)
      expect(store.bookings).toContainEqual(rescheduledBooking)
    })
  })

  describe('WebSocket handlers', () => {
    it('handleBookingCreated should add booking', () => {
      const store = useBookingStore()
      store.handleBookingCreated(mockBooking)

      expect(store.bookings).toContain(mockBooking)
    })

    it('handleBookingCreated should not duplicate', () => {
      const store = useBookingStore()
      store.bookings = [mockBooking]
      store.handleBookingCreated(mockBooking)

      expect(store.bookings).toHaveLength(1)
    })

    it('handleBookingUpdated should update booking', () => {
      const store = useBookingStore()
      store.bookings = [mockBooking]

      const updated = { ...mockBooking, status: 'cancelled' }
      store.handleBookingUpdated(updated)

      expect(store.bookings[0].status).toBe('cancelled')
    })

    it('handleBookingUpdated should update currentBooking', () => {
      const store = useBookingStore()
      store.currentBooking = mockBooking
      store.bookings = [mockBooking]

      const updated = { ...mockBooking, status: 'cancelled' }
      store.handleBookingUpdated(updated)

      expect(store.currentBooking?.status).toBe('cancelled')
    })
  })

  describe('$reset action', () => {
    it('should reset all state', () => {
      const store = useBookingStore()
      store.bookings = [mockBooking]
      store.currentBooking = mockBooking
      store.isLoading = true
      store.error = 'Some error'
      store.totalCount = 10

      store.$reset()

      expect(store.bookings).toEqual([])
      expect(store.currentBooking).toBeNull()
      expect(store.isLoading).toBe(false)
      expect(store.error).toBeNull()
      expect(store.totalCount).toBe(0)
    })
  })
})
