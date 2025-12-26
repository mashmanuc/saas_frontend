/**
 * Date and weekday helpers for M4SH Calendar
 * Handles ISO 8601 day-of-week mapping (Monday=1, Sunday=7)
 */

/**
 * Convert JavaScript day (0=Sunday, 6=Saturday) to ISO 8601 day (1=Monday, 7=Sunday)
 */
export function jsToIsoDayOfWeek(jsDay: number): number {
  if (jsDay < 0 || jsDay > 6) {
    throw new Error(`Invalid JS day: ${jsDay}. Must be 0-6.`)
  }
  // JS: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  // ISO: 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 7=Sun
  return jsDay === 0 ? 7 : jsDay
}

/**
 * Convert ISO 8601 day (1=Monday, 7=Sunday) to JavaScript day (0=Sunday, 6=Saturday)
 */
export function isoToJsDayOfWeek(isoDay: number): number {
  if (isoDay < 1 || isoDay > 7) {
    throw new Error(`Invalid ISO day: ${isoDay}. Must be 1-7.`)
  }
  // ISO: 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 7=Sun
  // JS: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  return isoDay === 7 ? 0 : isoDay
}

/**
 * Get ISO 8601 day of week from a date string or Date object
 */
export function getISODayOfWeek(date: string | Date): number {
  const d = typeof date === 'string' ? new Date(date) : date
  return jsToIsoDayOfWeek(d.getDay())
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
 * Get day name from ISO day number
 */
export function getISODayName(isoDay: number, locale: string = 'en'): string {
  if (!validateISODay(isoDay)) {
    throw new Error(`Invalid ISO day: ${isoDay}`)
  }
  
  const jsDay = isoToJsDayOfWeek(isoDay)
  const date = new Date(2024, 0, jsDay + 1) // Jan 1, 2024 is Monday
  
  return new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(date)
}

/**
 * Get short day name from ISO day number
 */
export function getISODayShortName(isoDay: number, locale: string = 'en'): string {
  if (!validateISODay(isoDay)) {
    throw new Error(`Invalid ISO day: ${isoDay}`)
  }
  
  const jsDay = isoToJsDayOfWeek(isoDay)
  const date = new Date(2024, 0, jsDay + 1)
  
  return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date)
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

/**
 * Get week start (Monday) for a given date
 */
export function getWeekStart(date: Date | string): Date {
  const d = typeof date === 'string' ? new Date(date) : new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day // Monday is week start
  const weekStart = new Date(d)
  weekStart.setDate(d.getDate() + diff)
  weekStart.setHours(0, 0, 0, 0)
  return weekStart
}

/**
 * Get week end (Sunday) for a given date
 */
export function getWeekEnd(date: Date | string): Date {
  const weekStart = getWeekStart(date)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)
  return weekEnd
}

/**
 * Format time from datetime string or time string
 */
export function formatTime(timeStr: string, format24h: boolean = true): string {
  if (!timeStr) return ''
  
  let date: Date
  
  // Handle full datetime strings
  if (timeStr.includes('T')) {
    date = new Date(timeStr)
  } else {
    // Handle time-only strings (HH:MM or HH:MM:SS)
    const [hours, minutes] = timeStr.split(':').map(Number)
    date = new Date()
    date.setHours(hours, minutes, 0, 0)
  }
  
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: !format24h
  })
}
