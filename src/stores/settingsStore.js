import { defineStore } from 'pinia'
import { DEFAULT_LOCALE, STORAGE_KEY, getInitialLocale, setI18nLocale } from '../i18n'

const hasWindow = typeof window !== 'undefined'

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    locale: getInitialLocale(),
  }),

  actions: {
    init() {
      setI18nLocale(this.locale)
    },

    setLocale(locale) {
      const next = locale || DEFAULT_LOCALE
      this.locale = next
      if (hasWindow) {
        window.localStorage.setItem(STORAGE_KEY, next)
      }
      setI18nLocale(next)
    },
  },
})
