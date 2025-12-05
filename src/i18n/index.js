import { createI18n } from 'vue-i18n'
import uk from './locales/uk.json'
import en from './locales/en.json'

export const DEFAULT_LOCALE = 'uk'
export const STORAGE_KEY = 'lang'

export function getInitialLocale() {
  if (typeof window === 'undefined') {
    return DEFAULT_LOCALE
  }
  return localStorage.getItem(STORAGE_KEY) || DEFAULT_LOCALE
}

const initialLocale = getInitialLocale()

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: initialLocale,
  fallbackLocale: DEFAULT_LOCALE,
  messages: {
    uk,
    en,
  },
})

export function setI18nLocale(locale) {
  if (!locale) return
  i18n.global.locale.value = locale
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('lang', locale)
  }
}

setI18nLocale(initialLocale)

export default i18n
