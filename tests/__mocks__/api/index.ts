// Export all mock API handlers for testing

import { calendarHandlers } from './calendarHandlers'
import { bookingHandlers } from './bookingHandlers'
import { availabilityHandlers } from './availabilityHandlers'

export { calendarHandlers, bookingHandlers, availabilityHandlers }

// Helper to setup API mocks in tests
export const setupApiMocks = () => {
  // Mock fetch or axios interceptors here if needed
  // For now, these handlers can be used directly in tests
  return {
    calendar: calendarHandlers,
    booking: bookingHandlers,
    availability: availabilityHandlers,
  }
}
