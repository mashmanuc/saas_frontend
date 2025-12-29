// F1: i18n Setup
import { createI18n } from 'vue-i18n'
import { LANGUAGES, LANGUAGE_CODES } from '@/config/languages'
import ukMessages from './locales/uk.json'

// Lazy load translations
const loadLocaleMessages = async (locale: string) => {
  const messages = await import(`./locales/${locale}.json`)
  return messages.default
}

// Date formats for each locale
const datetimeFormats = {
  en: {
    short: { year: 'numeric', month: 'short', day: 'numeric' } as const,
    long: { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' } as const,
    time: { hour: '2-digit', minute: '2-digit' } as const,
  },
  uk: {
    short: { year: 'numeric', month: 'short', day: 'numeric' } as const,
    long: { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' } as const,
    time: { hour: '2-digit', minute: '2-digit' } as const,
  },
  pl: {
    short: { year: 'numeric', month: 'short', day: 'numeric' } as const,
    long: { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' } as const,
    time: { hour: '2-digit', minute: '2-digit' } as const,
  },
  de: {
    short: { year: 'numeric', month: 'short', day: 'numeric' } as const,
    long: { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' } as const,
    time: { hour: '2-digit', minute: '2-digit' } as const,
  },
}

// Number formats for each locale
const numberFormats = {
  en: {
    currency: { style: 'currency', currency: 'USD' } as const,
    decimal: { style: 'decimal', minimumFractionDigits: 2 } as const,
    percent: { style: 'percent' } as const,
  },
  uk: {
    currency: { style: 'currency', currency: 'UAH' } as const,
    decimal: { style: 'decimal', minimumFractionDigits: 2 } as const,
    percent: { style: 'percent' } as const,
  },
  pl: {
    currency: { style: 'currency', currency: 'PLN' } as const,
    decimal: { style: 'decimal', minimumFractionDigits: 2 } as const,
    percent: { style: 'percent' } as const,
  },
  de: {
    currency: { style: 'currency', currency: 'EUR' } as const,
    decimal: { style: 'decimal', minimumFractionDigits: 2 } as const,
    percent: { style: 'percent' } as const,
  },
}

// Supported locales
const SUPPORTED_LOCALES = ['en', 'uk', 'pl', 'de'] as const
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

// Create i18n instance
export const i18n = createI18n({
  legacy: false, // Composition API
  locale: 'uk', // Default locale
  fallbackLocale: 'en',
  messages: {
    uk: ukMessages
  },
  datetimeFormats,
  numberFormats,
  missingWarn: false,
  fallbackWarn: false,
})

// Load initial locale
export async function setupI18n(locale: string = 'uk') {
  const targetLocale = LANGUAGE_CODES.includes(locale) ? locale : 'uk'
  
  if (!i18n.global.availableLocales.includes(targetLocale as SupportedLocale)) {
    try {
      const messages = await loadLocaleMessages(targetLocale)
      i18n.global.setLocaleMessage(targetLocale as SupportedLocale, messages)
    } catch (e) {
      console.warn(`Failed to load locale ${targetLocale}, falling back to uk`)
      if (!i18n.global.availableLocales.includes('uk')) {
        const ukMessages = await loadLocaleMessages('uk')
        i18n.global.setLocaleMessage('uk', ukMessages)
      }
    }
  }
  
  ;(i18n.global.locale as any).value = targetLocale
  document.documentElement.setAttribute('lang', targetLocale)
}

// Change locale dynamically
export async function setLocale(locale: string) {
  if (!LANGUAGE_CODES.includes(locale)) {
    console.warn(`Locale ${locale} is not supported`)
    return
  }
  
  if (!i18n.global.availableLocales.includes(locale as SupportedLocale)) {
    try {
      const messages = await loadLocaleMessages(locale)
      i18n.global.setLocaleMessage(locale as SupportedLocale, messages)
    } catch (e) {
      console.error(`Failed to load locale ${locale}:`, e)
      return
    }
  }
  
  ;(i18n.global.locale as any).value = locale
  document.documentElement.setAttribute('lang', locale)
  localStorage.setItem('locale', locale)
}

// Get current locale
export function getCurrentLocale(): string {
  return i18n.global.locale.value
}

// Get available locales
export function getAvailableLocales(): string[] {
  return i18n.global.availableLocales
}

export default i18n
