import { z } from 'zod'

/**
 * Normalized API Error
 * Єдиний формат помилок для всього додатку
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public details?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * API Response Wrapper
 * Обгортка для всіх API відповідей з валідацією
 */
export async function apiCall<T>(
  apiFunction: () => Promise<T>,
  schema: z.ZodSchema<T>,
  options?: {
    errorContext?: string
    timeout?: number
    retries?: number
  }
): Promise<T> {
  const { errorContext = 'API call', timeout = 30000, retries = 0 } = options || {}

  let lastError: Error | null = null
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Timeout wrapper
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), timeout)
      })

      const response = await Promise.race([
        apiFunction(),
        timeoutPromise
      ])

      // Validate response with Zod
      const validated = schema.safeParse(response)
      
      if (!validated.success) {
        console.error('[apiWrapper] Validation failed:', {
          context: errorContext,
          errors: validated.error.errors,
          response
        })
        
        throw new ApiError(
          `Invalid response format: ${errorContext}`,
          'VALIDATION_ERROR',
          undefined,
          validated.error.errors
        )
      }

      return validated.data
    } catch (error: any) {
      lastError = error
      
      // Don't retry on validation errors
      if (error instanceof ApiError && error.code === 'VALIDATION_ERROR') {
        throw error
      }

      // Retry on network errors
      if (attempt < retries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }

      // Normalize error
      if (error.response) {
        throw new ApiError(
          error.response.data?.message || error.message || 'API request failed',
          error.response.data?.code || 'API_ERROR',
          error.response.status,
          error.response.data
        )
      }

      throw new ApiError(
        error.message || 'Network error',
        'NETWORK_ERROR',
        undefined,
        error
      )
    }
  }

  throw lastError!
}

/**
 * Error Handler для UI
 * Конвертує ApiError в user-friendly повідомлення
 */
export function getErrorMessage(error: unknown, fallback = 'Щось пішло не так'): string {
  if (error instanceof ApiError) {
    // Map common error codes to user messages
    const errorMessages: Record<string, string> = {
      'VALIDATION_ERROR': 'Невірний формат даних',
      'NETWORK_ERROR': 'Проблеми з підключенням до сервера',
      'TIMEOUT_ERROR': 'Запит занадто довгий',
      'slot_not_available': 'Цей час вже зайнятий',
      'unauthorized': 'Потрібна авторизація',
      'forbidden': 'Немає доступу',
      'not_found': 'Не знайдено',
    }

    return errorMessages[error.code] || error.message || fallback
  }

  if (error instanceof Error) {
    return error.message || fallback
  }

  return fallback
}

/**
 * Common Zod schemas для API responses
 */
export const commonSchemas = {
  // Pagination
  pagination: z.object({
    count: z.number(),
    next: z.string().nullable(),
    previous: z.string().nullable(),
    results: z.array(z.any()),
  }),

  // Time slot
  timeSlot: z.object({
    id: z.number(),
    start_datetime: z.string(),
    end_datetime: z.string().optional(),
    duration_minutes: z.number(),
    status: z.enum(['available', 'booked', 'blocked']),
  }),

  // Booking
  booking: z.object({
    id: z.number(),
    tutor_id: z.number(),
    student_id: z.number(),
    slot_id: z.number().optional(),
    start_datetime: z.string(),
    duration_minutes: z.number(),
    status: z.string(),
    subject: z.string().optional(),
    lesson_type: z.string().optional(),
    student_notes: z.string().optional(),
    tutor_notes: z.string().optional(),
    created_at: z.string(),
    updated_at: z.string(),
  }),

  // Calendar event
  calendarEvent: z.object({
    id: z.number(),
    type: z.string(),
    start: z.string(),
    end: z.string(),
    title: z.string().optional(),
    description: z.string().optional(),
    status: z.string().optional(),
  }),

  // Error response
  error: z.object({
    message: z.string(),
    code: z.string().optional(),
    details: z.any().optional(),
  }),
}
