export function formatInTimezone(utcDate: string, timezone: string): string {
  const date = new Date(utcDate)
  return date.toLocaleTimeString('uk-UA', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
  })
}

export function formatDateInTimezone(utcDate: string, timezone: string): string {
  const date = new Date(utcDate)
  return date.toLocaleDateString('uk-UA', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: timezone,
  })
}

export function isDSTTransitionDay(date: Date, timezone: string): boolean {
  // DST transitions happen in March (spring forward) and October (fall back)
  // Not in December!
  const month = date.getMonth() // 0-11
  
  // Only check for DST in March (2) and October (9)
  if (month !== 2 && month !== 9) {
    return false
  }
  
  const startOfDay = new Date(date)
  startOfDay.setHours(0, 0, 0, 0)
  
  const endOfDay = new Date(date)
  endOfDay.setHours(23, 59, 59, 999)
  
  const startOffset = getTimezoneOffset(startOfDay, timezone)
  const endOffset = getTimezoneOffset(endOfDay, timezone)
  
  return startOffset !== endOffset
}

function getTimezoneOffset(date: Date, timezone: string): number {
  const utcDate = date.getTime()
  const localDate = new Date(date.toLocaleString('en-US', { timeZone: timezone })).getTime()
  return (localDate - utcDate) / (1000 * 60)
}
