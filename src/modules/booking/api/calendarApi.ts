import apiClient from '@/utils/apiClient'
import type { WeekViewResponse, CalendarCell } from '@/modules/booking/types/calendar'

// Dev mock для швидкого тестування
function generateMockCells(weekStart: string): CalendarCell[] {
  const cells: CalendarCell[] = []
  const start = new Date(weekStart)
  
  // Генеруємо клітинки для робочих годин (9:00-18:00)
  for (let day = 0; day < 7; day++) {
    // Пропускаємо неділю (день 6)
    if (day === 6) continue
    
    for (let hour = 9; hour < 18; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const date = new Date(start)
        date.setDate(date.getDate() + day)
        date.setUTCHours(hour - 2, minute, 0, 0) // Конвертуємо в UTC (Kiev = UTC+2)
        
        // Робимо деякі слоти доступними, деякі заблокованими
        let status: CalendarCell['status'] = 'available'
        let source: CalendarCell['source'] = 'template'
        
        // Блокуємо обідню перерву (12:00-13:00)
        if (hour === 12) {
          status = 'blocked'
          source = 'manual'
        }
        
        // Додаємо кілька заброньованих слотів
        if ((day === 0 && hour === 10) || (day === 2 && hour === 14)) {
          status = 'booked'
          source = 'lesson'
        }
        
        const cell: CalendarCell = {
          startAtUTC: date.toISOString(),
          durationMin: 30,
          status,
          source,
        }
        
        // Додаємо booking info для заброньованих слотів
        if (status === 'booked') {
          cell.booking = {
            id: Math.floor(Math.random() * 1000),
            student: {
              id: 45,
              name: 'Іван Петренко',
            },
            lesson_id: Math.floor(Math.random() * 1000),
          }
        }
        
        cells.push(cell)
      }
    }
  }
  
  return cells
}

export const calendarApi = {
  async getWeekView(params: {
    weekStart: string
    timezone: string
    tutorId?: number
  }): Promise<WeekViewResponse> {
    // DEV MOCK для тестування (увімкнути через .env.development)
    if (import.meta.env.DEV && import.meta.env.VITE_USE_MOCK_CALENDAR === 'true') {
      console.log('[calendarApi] 🎭 Using MOCK data for development')
      
      // Симулюємо затримку мережі
      await new Promise(resolve => setTimeout(resolve, 500))
      
      return {
        week_start: params.weekStart,
        timezone: params.timezone,
        cells: generateMockCells(params.weekStart),
      }
    }
    
    // Production API call
    console.log('[calendarApi] Calling /calendar/week/ with params:', {
      start: params.weekStart,
      tz: params.timezone,
      tutor_id: params.tutorId,
    })
    
    const data = await apiClient.get('/calendar/week/', {
      params: {
        start: params.weekStart,
        tz: params.timezone,
        tutor_id: params.tutorId,
      },
    }) as WeekViewResponse
    
    console.log('[calendarApi] Response data:', data)
    
    return data
  },
}
