// Booking Module Exports

// Views
export { default as BookLessonView } from './views/BookLessonView.vue'
export { default as MyLessonsView } from './views/MyLessonsView.vue'
export { default as TutorCalendarView } from './views/TutorCalendarView.vue'
export { default as BookingDetailView } from './views/BookingDetailView.vue'

// Stores
export { useBookingStore } from './stores/bookingStore'
export { useAvailabilityStore } from './stores/availabilityStore'
export { useCalendarWeekStore } from './stores/calendarWeekStore'

// Composables
export { useBooking } from './composables/useBooking'

// API
export { bookingApi } from './api/booking'
export type {
  TutorSettings,
  TimeSlot,
  Booking,
  BookingStatus,
  Availability,
  AvailabilityInput,
  DateException,
  ExceptionInput,
  CustomSlotInput,
  BookingInput,
  BookingListParams,
  PaginatedResponse,
  CalendarDay,
  CalendarResponse,
  User,
} from './api/booking'
