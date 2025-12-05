import { useAuthStore } from '../modules/auth/store/authStore'

export function getUserTimezone() {
  const auth = useAuthStore()
  return auth.user?.timezone || 'Europe/Kyiv'
}

export function formatDateTime(value, options = {}) {
  if (!value) return ''

  const date = typeof value === 'string' ? new Date(value) : value
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return ''
  }

  const normalizedOptions = typeof options === 'string' ? { timeZone: options } : { ...options }
  const tz = normalizedOptions.timeZone || getUserTimezone()

  return new Intl.DateTimeFormat('uk-UA', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: tz,
    ...normalizedOptions,
  }).format(date)
}
