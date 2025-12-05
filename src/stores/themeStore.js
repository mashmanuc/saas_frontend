import { defineStore } from 'pinia'

const STORAGE_KEY = 'theme'
const DEFAULT_THEME = 'system'

export const THEME_OPTIONS = Object.freeze(['light', 'dark', 'system'])

const getStoredTheme = () => {
  if (typeof window === 'undefined') return DEFAULT_THEME
  return localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME
}

export const useThemeStore = defineStore('theme', {
  state: () => ({
    theme: getStoredTheme(),
    _mediaQuery: null,
    _systemListener: null,
  }),

  actions: {
    init() {
      if (typeof window === 'undefined') return

      if (!this._mediaQuery) {
        this._mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      }

      if (!this._systemListener) {
        this._systemListener = (event) => {
          if (this.theme === 'system') {
            this.applyTheme('system', event.matches)
          }
        }

        if (this._mediaQuery.addEventListener) {
          this._mediaQuery.addEventListener('change', this._systemListener)
        } else if (this._mediaQuery.addListener) {
          this._mediaQuery.addListener(this._systemListener)
        }
      }

      this.applyTheme(this.theme)
    },

    setTheme(value) {
      if (!THEME_OPTIONS.includes(value)) {
        value = DEFAULT_THEME
      }

      this.theme = value

      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, value)
      }

      this.applyTheme(value)
    },

    applyTheme(theme, systemPrefersDark) {
      if (typeof document === 'undefined') return

      let prefersDark = typeof systemPrefersDark === 'boolean' ? systemPrefersDark : null

      if (prefersDark === null) {
        if (this._mediaQuery) {
          prefersDark = this._mediaQuery.matches
        } else if (typeof window !== 'undefined') {
          prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        } else {
          prefersDark = false
        }
      }

      const isDark = theme === 'dark' || (theme === 'system' && prefersDark)
      const root = document.documentElement

      if (isDark) {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    },
  },
})
