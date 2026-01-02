/**
 * Time formatting utilities for calendar with timezone support
 * 
 * Ensures consistent time display across calendar components
 * by formatting in the calendar's timezone, not browser's locale.
 */

/**
 * Format ISO datetime string in specific timezone as HH:MM
 */
export function formatTimeInCalendarTz(iso: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('uk-UA', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(iso))
  } catch (error) {
    console.warn('[time] Failed to format time in timezone:', { iso, timezone, error })
    // Fallback to local time
    const date = new Date(iso)
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  }
}

/**
 * Format ISO datetime string in specific timezone as full date
 */
export function formatDateInCalendarTz(iso: string, timezone: string, locale = 'uk-UA'): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      timeZone: timezone,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(iso))
  } catch (error) {
    console.warn('[time] Failed to format date in timezone:', { iso, timezone, error })
    // Fallback to local date
    return new Date(iso).toLocaleDateString(locale, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }
}

/**
 * Format ISO datetime string in specific timezone as short date (YYYY-MM-DD)
 */
export function formatShortDateInCalendarTz(iso: string, timezone: string): string {
  try {
    const date = new Date(iso)
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date)
    
    const year = parts.find(p => p.type === 'year')?.value
    const month = parts.find(p => p.type === 'month')?.value
    const day = parts.find(p => p.type === 'day')?.value
    
    return `${year}-${month}-${day}`
  } catch (error) {
    console.warn('[time] Failed to format short date in timezone:', { iso, timezone, error })
    // Fallback
    return new Date(iso).toISOString().split('T')[0]
  }
}
