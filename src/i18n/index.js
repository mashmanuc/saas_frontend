import { createI18n } from 'vue-i18n'
import uk from './locales/uk.json'
import en from './locales/en.json'
import ru from './locales/ru.json'
import pl from './locales/pl.json'
import de from './locales/de.json'

export const DEFAULT_LOCALE = 'uk'
export const STORAGE_KEY = 'lang'
export const SUPPORTED_LOCALES = ['uk', 'en', 'ru', 'pl', 'de']

export function getInitialLocale() {
  if (typeof window === 'undefined') {
    return DEFAULT_LOCALE
  }
  
  // Check if user has manually selected a language
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored && SUPPORTED_LOCALES.includes(stored)) {
    return stored
  }
  
  // Auto-detect Ukrainian for UA users (LiqPay compliance #8)
  // Method 1: Check browser language
  const browserLang = navigator.language || navigator.userLanguage
  if (browserLang && browserLang.toLowerCase().startsWith('uk')) {
    return 'uk'
  }
  
  // Method 2: Check timezone (fallback for Ukraine)
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const ukraineTimezones = [
      'Europe/Kiev',
      'Europe/Kyiv',
      'Europe/Uzhgorod',
      'Europe/Zaporozhye',
      'Europe/Simferopol'
    ]
    if (ukraineTimezones.includes(timezone)) {
      return 'uk'
    }
  } catch (e) {
    // Timezone detection failed, continue
  }
  
  return DEFAULT_LOCALE
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
    ru,
    pl,
    de,
  },
})

export function setI18nLocale(locale) {
  if (!locale || !SUPPORTED_LOCALES.includes(locale)) return
  i18n.global.locale.value = locale
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('lang', locale)
  }
  localStorage.setItem(STORAGE_KEY, locale)
}

// Alias for compatibility with TypeScript version
export const setLocale = setI18nLocale

/**
 * Тимчасовий перемикач мови з URL (`?lang=en`) — БЕЗ запису в localStorage.
 *
 * Навіщо (Phase 3, 2026-09-03): англомовна продажна сторінка `/pro` веде на
 * `/legal/terms|privacy|refund`, а ті рендеряться мовою відвідувача. Рев'ювер
 * Paddle (MoR перевіряє сайт продавця перед live-активацією) міг би клікнути
 * «Terms of Service» і отримати українську сторінку — типова причина відмови.
 *
 * Свідомо НЕ персистимо: інакше українець, який відкрив легалку з англійського
 * посилання, лишився б з англійським інтерфейсом назавжди. Перекриття живе
 * рівно доти, доки в URL є `?lang`.
 */
export function applyLocaleOverride(locale) {
  if (!locale || !SUPPORTED_LOCALES.includes(locale)) return false
  if (i18n.global.locale.value !== locale) {
    i18n.global.locale.value = locale
  }
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('lang', locale)
  }
  return true
}

/** Повернути мову, збережену користувачем, коли `?lang` у URL більше немає. */
export function restoreStoredLocale() {
  const stored = getInitialLocale()
  if (i18n.global.locale.value !== stored) {
    applyLocaleOverride(stored)
  }
}

setI18nLocale(initialLocale)

export async function setupI18n(locale = DEFAULT_LOCALE) {
  setI18nLocale(locale)
  return Promise.resolve()
}

export default i18n
