/**
 * Date utility functions for ISO 8601 day handling
 */

/**
 * Get day of week in ISO 8601 format (1=Monday, 7=Sunday)
 */
export function getISODayOfWeek(date: Date): number {
  const day = date.getDay()
  return day === 0 ? 7 : day
}

/**
 * Convert JS day (0=Sunday) to ISO day (7=Sunday)
 */
export function jsToISODay(jsDay: number): number {
  return jsDay === 0 ? 7 : jsDay
}

/**
 * Convert ISO day (7=Sunday) to JS day (0=Sunday)
 */
export function isoToJSDay(isoDay: number): number {
  return isoDay === 7 ? 0 : isoDay
}

/**
 * Check if a date falls on a specific ISO day
 */
export function isDateOnISODay(date: Date, isoDay: number): boolean {
  return getISODayOfWeek(date) === isoDay
}

/**
 * Get all dates in a range that fall on a specific ISO day
 */
export function getDatesForISODay(startDate: Date, endDate: Date, isoDay: number): Date[] {
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
