// Mock handlers for booking API endpoints

export const bookingHandlers = {
  // POST /api/v1/bookings/manual - Manual Booking API
  createManualBooking: (data: {
    student_id: number
    start_at_utc: string
    duration_min: number
    notes?: string
  }) => {
    return {
      id: 123,
      student_id: data.student_id,
      tutor_id: 1,
      start_at_utc: data.start_at_utc,
      duration_min: data.duration_min,
      notes: data.notes || '',
      status: 'confirmed',
      created_at: new Date().toISOString(),
    }
  },

  // Error scenarios
  createManualBookingTutorOverlap: () => {
    throw {
      response: {
        data: {
          error: 'tutor_overlap',
          message: 'Tutor already has a lesson at this time',
        },
      },
    }
  },

  createManualBookingStudentOverlap: () => {
    throw {
      response: {
        data: {
          error: 'student_overlap',
          message: 'Student already has a lesson at this time',
        },
      },
    }
  },

  // GET /api/v1/students/search - Student Search API
  searchStudents: (query: string) => {
    const mockStudents = [
      { id: 1, name: 'Іван Петренко', email: 'ivan@example.com' },
      { id: 2, name: 'Марія Коваленко', email: 'maria@example.com' },
      { id: 3, name: 'Олексій Шевченко', email: 'oleksiy@example.com' },
    ]

    const filtered = mockStudents.filter(s =>
      s.name.toLowerCase().includes(query.toLowerCase())
    )

    return {
      results: filtered,
      count: filtered.length,
    }
  },
}
