/**
 * Date utility functions for ISO 8601 day handling
 */

/**
 * Get day of week in ISO 8601 format (1=Monday, 7=Sunday)
 */
export function getISODayOfWeek(date: Date | string): number {
  const d = typeof date === 'string' ? new Date(date) : date
  const day = d.getDay()
  return day === 0 ? 7 : day
}

/**
 * Convert JS day (0=Sunday) to ISO day (7=Sunday)
 */
export function jsToISODay(jsDay: number): number {
  if (jsDay < 0 || jsDay > 6) {
    throw new Error(`Invalid JS day: ${jsDay}. Must be 0-6.`)
  }
  return jsDay === 0 ? 7 : jsDay
}

/**
 * Convert ISO day (7=Sunday) to JS day (0=Sunday)
 */
export function isoToJSDay(isoDay: number): number {
  if (isoDay < 1 || isoDay > 7) {
    throw new Error(`Invalid ISO day: ${isoDay}. Must be 1-7.`)
  }
  return isoDay === 7 ? 0 : isoDay
}

/**
 * Validate that a day value is a valid ISO 8601 day (1-7)
 */
export function validateISODay(day: number): boolean {
  return Number.isInteger(day) && day >= 1 && day <= 7
}

/**
 * Validate that a day value is a valid JavaScript day (0-6)
 */
export function validateJSDay(day: number): boolean {
  return Number.isInteger(day) && day >= 0 && day <= 6
}

/**
 * Check if a date falls on a specific ISO day
 */
export function isDateOnISODay(date: Date, isoDay: number): boolean {
  if (!validateISODay(isoDay)) {
    throw new Error(`Invalid ISO day: ${isoDay}`)
  }
  return getISODayOfWeek(date) === isoDay
}

/**
 * Get all dates in a range that fall on a specific ISO day
 */
export function getDatesForISODay(startDate: Date, endDate: Date, isoDay: number): Date[] {
  if (!validateISODay(isoDay)) {
    throw new Error(`Invalid ISO day: ${isoDay}`)
  }
  
  const dates: Date[] = []
  const current = new Date(startDate)
  
  while (current <= endDate) {
    if (isDateOnISODay(current, isoDay)) {
      dates.push(new Date(current))
    }
    current.setDate(current.getDate() + 1)
  }
  
  return dates
}

/**
 * Format date to ISO date string (YYYY-MM-DD)
 */
export function toISODateString(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toISOString().slice(0, 10)
}

/**
 * Parse ISO date string and validate format
 */
export function parseISODate(dateStr: string): Date | null {
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!isoDateRegex.test(dateStr)) {
    console.warn(`Invalid ISO date format: ${dateStr}`)
    return null
  }
  
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) {
    console.warn(`Invalid date: ${dateStr}`)
    return null
  }
  
  return date
}

/**
 * Check if a date string is a valid ISO date
 */
export function isValidISODate(dateStr: string): boolean {
  return parseISODate(dateStr) !== null
}
