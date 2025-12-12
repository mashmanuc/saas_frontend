// F7: useLocale Composable
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useLocaleStore } from '../stores/localeStore'

export function useLocale() {
  const { t, d, n, locale } = useI18n()
  const store = useLocaleStore()
  const { currentLocale, currentLocaleInfo, activeLocales, isRTL } = storeToRefs(store)

  // Format date
  function formatDate(date: Date | string, format: 'short' | 'long' = 'short'): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    return d(dateObj, format)
  }

  // Format currency
  function formatCurrency(amount: number, currency?: string): string {
    const currencyMap: Record<string, string> = {
      en: 'USD',
      uk: 'UAH',
      pl: 'PLN',
      de: 'EUR',
    }
    const targetCurrency = currency || currencyMap[currentLocale.value] || 'UAH'
    return new Intl.NumberFormat(currentLocale.value, {
      style: 'currency',
      currency: targetCurrency,
    }).format(amount / 100)
  }

  // Format number
  function formatNumber(num: number): string {
    return n(num)
  }

  // Format percent
  function formatPercent(value: number): string {
    return new Intl.NumberFormat(currentLocale.value, {
      style: 'percent',
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }).format(value / 100)
  }

  // Get relative time
  function formatRelativeTime(date: Date | string): string {
    const now = new Date()
    const target = typeof date === 'string' ? new Date(date) : date
    const diff = now.getTime() - target.getTime()

    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return t('common.justNow')
    if (minutes < 60) return t('common.minutesAgo', { count: minutes })
    if (hours < 24) return t('common.hoursAgo', { count: hours })
    if (days < 7) return t('common.daysAgo', { count: days })

    return formatDate(date)
  }

  // Format time only
  function formatTime(date: Date | string): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    return new Intl.DateTimeFormat(currentLocale.value, {
      hour: '2-digit',
      minute: '2-digit',
    }).format(dateObj)
  }

  // Format date and time
  function formatDateTime(date: Date | string): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    return new Intl.DateTimeFormat(currentLocale.value, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(dateObj)
  }

  return {
    // i18n
    t,
    locale,

    // Store state
    currentLocale,
    currentLocaleInfo,
    activeLocales,
    isRTL,

    // Actions
    changeLocale: store.changeLocale,

    // Formatters
    formatDate,
    formatTime,
    formatDateTime,
    formatCurrency,
    formatNumber,
    formatPercent,
    formatRelativeTime,
  }
}
