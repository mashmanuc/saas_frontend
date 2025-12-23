import type { WeekViewResponse } from '@/modules/booking/types/calendar'

// Mock handlers for calendar API endpoints
// Note: MSW is optional dependency, these handlers can be used with fetch mocks too

export const calendarHandlers = {
  // GET /api/v1/calendar/week - Week View API
  getWeekView: (start?: string, tz?: string) => {
    const mockResponse: WeekViewResponse = {
      week_start: start || '2024-12-23',
      timezone: tz || 'Europe/Kiev',
      cells: [
        {
          startAtUTC: '2024-12-23T08:00:00Z',
          durationMin: 30,
          status: 'available',
          source: 'template',
        },
        {
          startAtUTC: '2024-12-23T09:00:00Z',
          durationMin: 30,
          status: 'blocked',
          source: 'manual',
        },
        {
          startAtUTC: '2024-12-23T10:00:00Z',
          durationMin: 60,
          status: 'booked',
          source: 'lesson',
          booking: {
            id: 123,
            student: {
              id: 45,
              name: 'Іван Петренко',
            },
            lesson_id: 789,
          },
        },
      ],
    }

    return mockResponse
  },

  // Error scenario for Week View
  getWeekViewError: () => {
    throw new Error('Network error')
  },
}
